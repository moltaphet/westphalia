// Reads the deployed Westphalia contract and maps its records onto the board's
// domain model.
//
// Two on-chain shapes constrain this mapping:
//
//   1. There is no enclave enumerator. The contract exposes
//      `get_enclave(owner_hex)` only, so the enclave set is derived
//      transitively: walk the treaties and collect both party addresses. An
//      enclave that has never been party to a treaty is therefore invisible
//      here -- it exists on-chain and answers `get_enclave`, but nothing on the
//      board can discover its address. Treaties are enumerable via
//      `next_treaty_id`, which is why they are the entry point.
//
//   2. Every amount is an atto-scale string, not a number. Values are narrowed
//      through `attoToGen` (which divides with BigInt before converting) so a
//      large balance cannot lose precision on the way to a float.

import { attoToGen, type DiplomaticContract } from "./contract";
import { presetFor, elevationSeedFor } from "./archetypes";
import { orderEnclaves } from "./world";
import type {
  AgentEnclave,
  Archetype,
  ChainOverview,
  EnclaveStatus,
  LedgerEvent,
  LedgerEventKind,
  ReputationTier,
  Treaty,
  TreatyKind,
  TreatyStatus,
  ValidatorVote,
} from "./types";

// On-chain treaty kinds (contract TREATY_PARAM_SCHEMA keys) -> board kinds.
const KIND_FROM_CHAIN: Record<string, TreatyKind> = {
  NON_AGGRESSION: "non-aggression",
  TRADE_CORRIDOR: "trade",
  DATA_SHARING: "data-sharing",
};

// The contract's closed status sets. Treaty: PROPOSED | ACTIVE | SETTLED |
// EXPIRED. Enclave: ACTIVE | SANCTIONED.
const TREATY_STATUS: Record<string, TreatyStatus> = {
  PROPOSED: "pending",
  ACTIVE: "active",
  SETTLED: "resolved",
  EXPIRED: "resolved",
};

const ENCLAVE_STATUS: Record<string, EnclaveStatus> = {
  ACTIVE: "Active",
  SANCTIONED: "Slashed",
};

// How a treaty's on-chain status reads as a validator ballot in the audit
// inspector. This is a rendering of the stored status, not a claim about how
// any individual validator voted.
const AUDIT_VOTE: Record<string, ValidatorVote> = {
  PROPOSED: "ABSTAIN",
  ACTIVE: "COMPLIANT",
  SETTLED: "COMPLIANT",
  EXPIRED: "ABSTAIN",
};

// Reputation tiers. `tierForCollateral` in the store scales on staked
// collateral and is used for realms founded in this session; an on-chain
// enclave is ranked by the reputation the contract actually tracks, so a
// sanctioned counterparty reads as Rogue rather than by its leftover stake.
export function tierForReputation(rep: number): ReputationTier {
  if (rep >= 80) return "Sovereign";
  if (rep >= 60) return "Trusted";
  if (rep >= 40) return "Neutral";
  if (rep >= 20) return "Watched";
  return "Rogue";
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function asAtto(v: unknown): bigint {
  try {
    return BigInt(asString(v, "0"));
  } catch {
    return 0n;
  }
}

// A record read from the chain, or null when the id does not exist. A failed
// read is indistinguishable from a missing record at this layer; the caller
// treats both as "not on chain", which is the safe direction -- it can never
// invent a treaty that is not there.
async function readJson(
  contract: DiplomaticContract,
  method: string,
  args: unknown[]
): Promise<Record<string, unknown> | null> {
  const raw = await contract.read<Record<string, unknown>>(method, args);
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

export interface ChainSnapshot {
  overview: ChainOverview;
  treaties: Treaty[];
  enclaves: AgentEnclave[];
  ledger: LedgerEvent[];
}

// Raw on-chain records, exactly as the contract returns them. Kept separate
// from the mapping so the mapping is a pure function that can be exercised
// against captured payloads without a chain.
export interface RawRecords {
  overview: Record<string, unknown>;
  treaties: Record<string, unknown>[];
  enclaves: Record<string, unknown>[];
}

// Pure: raw contract records -> board domain model. No I/O, no globals, so it
// is testable against payloads captured from the live contract.
export function mapRecords(raw: RawRecords): ChainSnapshot {
  const overview: ChainOverview = {
    balance: asString(raw.overview.balance, "0"),
    totalCollateral: asString(raw.overview.total_collateral, "0"),
    lockedEscrow: asString(raw.overview.locked_escrow, "0"),
    reserves: asString(raw.overview.reserves, "0"),
    totalClaimable: asString(raw.overview.total_claimable, "0"),
    nextTreatyId: String(Number(asString(raw.overview.next_treaty_id, "1")) || 1),
    solvent: Boolean(raw.overview.solvent),
  };

  // --- enclaves -----------------------------------------------------------
  const enclaveById = new Map<string, AgentEnclave>();
  const idByAddress = new Map<string, string>();

  for (const rec of raw.enclaves) {
    const addr = asString(rec.address);
    if (!addr) continue;
    const name = asString(rec.name, "Unnamed");
    // The board keys treaties by enclave id, so the id must be stable and
    // unique. The lowercased address is both.
    const id = addr.toLowerCase();
    const archetype = asString(rec.archetype, "Autonomous Arbiter") as Archetype;
    const preset = presetFor(archetype);
    const reputation = Number(asString(rec.reputation, "0")) || 0;
    const collateralGen = attoToGen(asString(rec.collateral, "0"));
    idByAddress.set(id, id);

    enclaveById.set(id, {
      id,
      name,
      archetype,
      address: addr,
      collateral: collateralGen,
      reputation,
      tier: tierForReputation(reputation),
      biomeTheme: { ...preset.biome, elevationSeed: elevationSeedFor(addr) },
      status: ENCLAVE_STATUS[asString(rec.status)] ?? "Active",
      treaties: [],
      lockedEscrowGen: 0,
      hazardPct: 0,
      yieldApr: preset.yieldApr,
      complianceScore: reputation,
      activeEnclaves: 0,
      slashingHistory: [],
      summary: `${archetype} sovereignty "${name}" on GenLayer StudioNet. Reputation ${reputation}, ${collateralGen.toLocaleString("en-US")} GEN collateral.`,
      governance: "Charter written on-chain at founding (see get_enclave).",
    });
  }

  // --- treaties -----------------------------------------------------------
  const treaties: Treaty[] = [];
  // The feed is rebuilt from the treaties the contract actually holds. The
  // simulated seed narrates enclaves that do not exist on-chain, so it cannot
  // sit underneath live islands: the board would show real sovereignties while
  // the feed reported history belonging to fabricated ones.
  const feed: { chainId: number; ev: Omit<LedgerEvent, "id"> }[] = [];
  for (const rec of raw.treaties) {
    const id = Number(asString(rec.id, "0")) || 0;
    if (!id) continue;
    const partyA = idByAddress.get(asString(rec.party_a).toLowerCase());
    const partyB = idByAddress.get(asString(rec.party_b).toLowerCase());
    // A treaty whose party has no enclave record cannot be placed on the board.
    if (!partyA || !partyB) continue;

    const bondA = asAtto(rec.bond_a);
    const bondB = asAtto(rec.bond_b);
    const rawStatus = asString(rec.status);
    const status = TREATY_STATUS[rawStatus] ?? "pending";
    const kind = KIND_FROM_CHAIN[asString(rec.kind)] ?? "non-aggression";
    const nameA = enclaveById.get(partyA)?.name ?? partyA;
    const nameB = enclaveById.get(partyB)?.name ?? partyB;
    const bondTotalGen = attoToGen(bondA + bondB);

    treaties.push({
      id: `t${id}`,
      chainId: id,
      kind,
      status,
      parties: [partyA, partyB],
      // The escrow a treaty locks is the sum of the bonds actually posted; a
      // PROPOSED treaty has only the proposer's side down.
      bondGen: bondTotalGen,
      // GenVM has no EVM block height to cite and the contract stores none;
      // the on-chain treaty id is the stable identifier.
      createdBlock: 0,
      terms: asString(rec.terms),
    });

    // One feed line per treaty, phrased in the contract's own vocabulary so
    // nothing is claimed that `get_treaty` did not return.
    let kindLabel: LedgerEventKind;
    let message: string;
    let valueGen: number;
    switch (rawStatus) {
      case "ACTIVE":
        kindLabel = "treaty-signed";
        message = `Treaty t${id} (${kind}) ratified; ${bondTotalGen.toLocaleString("en-US")} GEN locked in escrow between ${nameA} and ${nameB}.`;
        valueGen = bondTotalGen;
        break;
      case "SETTLED":
        kindLabel = "consensus-verdict";
        message = `Treaty t${id} (${kind}) settled on-chain; escrow released.`;
        valueGen = bondTotalGen;
        break;
      case "EXPIRED":
        kindLabel = "escrow-released";
        message = `Treaty t${id} (${kind}) expired; posted bonds recoverable.`;
        valueGen = bondTotalGen;
        break;
      default:
        kindLabel = "treaty-proposed";
        message = `Treaty t${id} (${kind}) proposed by ${nameA} to ${nameB}; ${attoToGen(bondA).toLocaleString("en-US")} GEN bond posted.`;
        valueGen = attoToGen(bondA);
    }
    feed.push({
      chainId: id,
      ev: {
        block: id,
        kind: kindLabel,
        actor: partyA,
        message,
        valueGen,
        // Built only from what `get_treaty` returned. The contract does not
        // expose per-validator votes, so `validators` is empty and the
        // inspector says so rather than naming models it never saw.
        audit: {
          clause: asString(rec.terms) || "(no clause text recorded on-chain)",
          telemetry:
            `On-chain record for treaty t${id}: ${rawStatus}, kind ${kind}, ` +
            `bonds ${attoToGen(bondA).toLocaleString("en-US")} + ` +
            `${attoToGen(bondB).toLocaleString("en-US")} GEN, ` +
            `expires at ${asString(rec.expires_at) || "unset"}.`,
          // The feeds the parties agreed to at proposal time, read from
          // contract storage -- the exact inputs a dispute round would fetch.
          telemetrySource:
            [asString(rec.oracle_primary), asString(rec.oracle_secondary)]
              .filter(Boolean)
              .join("  |  ") || "(no oracle endpoint recorded)",
          validators: [],
          finalVote: AUDIT_VOTE[rawStatus] ?? "ABSTAIN",
          rationale:
            `Status read from get_treaty(${id}) at the current head. GenLayer's ` +
            `equivalence round over the telemetry above decides any dispute; ` +
            `the individual validator ballots are not part of contract storage.`,
          penalty:
            status === "active" || status === "pending"
              ? `${bondTotalGen.toLocaleString("en-US")} GEN remains locked in escrow.`
              : `Escrow released; bonds returned to the parties.`,
        },
      },
    });

    for (const pid of [partyA, partyB]) {
      enclaveById.get(pid)?.treaties.push(`t${id}`);
    }
    // Only bonds the contract still holds count as locked escrow per enclave.
    // Settlement releases them, so a SETTLED or EXPIRED treaty stops
    // contributing.
    if (status === "active" || status === "pending") {
      const ea = enclaveById.get(partyA);
      if (ea) ea.lockedEscrowGen += attoToGen(bondA);
      const eb = enclaveById.get(partyB);
      if (eb) eb.lockedEscrowGen += attoToGen(bondB);
    }
  }

  // Hazard is board-side presentation: derive it from status and reputation
  // rather than inventing a per-enclave constant the chain never supplied.
  for (const e of enclaveById.values()) {
    e.hazardPct =
      e.status === "Slashed" ? 90 : Math.max(0, Math.min(100, 60 - e.reputation));
    e.activeEnclaves = e.treaties.length;
  }

  // Newest first, matching how `pushLedger` prepends and how the HUD renders.
  // Treaty ids are monotonic on-chain, so descending id is descending time --
  // the one ordering the contract's own data guarantees.
  const ledger: LedgerEvent[] = feed
    .sort((a, b) => b.chainId - a.chainId)
    .map(({ chainId, ev }) => ({ ...ev, id: `chain-t${chainId}` }));

  // Sorted into the board's canonical order. Party addresses are discovered by
  // walking the treaty list, so a dropped treaty read (or a treaty list that
  // grows between polls) changes this array's order without any enclave having
  // moved -- and the archipelago lays itself out positionally, so that
  // reordering used to teleport every island. Sorting here fixes it for every
  // consumer at once, not just the board.
  return { overview, treaties, enclaves: orderEnclaves([...enclaveById.values()]), ledger };
}

// The full protocol state as the chain currently holds it, or null when the
// contract could not be reached at all (offline, wrong address, RPC down).
// The caller keeps the simulated board in that case rather than rendering an
// empty archipelago.
export async function fetchChainSnapshot(
  contract: DiplomaticContract
): Promise<ChainSnapshot | null> {
  const overview = await readJson(contract, "get_protocol_overview", []);
  if (!overview) return null;

  const nextTreatyId = Number(asString(overview.next_treaty_id, "1")) || 1;

  // Treaties are enumerable via the protocol counter; they are the entry point
  // because there is no enclave enumerator (see the file header).
  const treaties: Record<string, unknown>[] = [];
  for (let id = 1; id < nextTreatyId; id++) {
    const rec = await readJson(contract, "get_treaty", [id]);
    if (rec) treaties.push({ ...rec, id });
  }

  // Enclaves are reached transitively, through the treaty parties.
  const partyAddrs: string[] = [];
  for (const rec of treaties) {
    for (const key of ["party_a", "party_b"]) {
      const addr = asString(rec[key]);
      if (addr.startsWith("0x") && !partyAddrs.includes(addr)) partyAddrs.push(addr);
    }
  }

  const enclaves: Record<string, unknown>[] = [];
  for (const addr of partyAddrs) {
    const rec = await readJson(contract, "get_enclave", [addr]);
    if (rec) enclaves.push({ ...rec, address: addr });
  }

  return mapRecords({ overview, treaties, enclaves });
}
