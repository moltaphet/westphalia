"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentEnclave,
  Archetype,
  BiomeTheme,
  ChainOverview,
  LedgerEvent,
  NetworkConfig,
  PipelineState,
  ProtocolState,
  ReputationTier,
  StateSource,
  Treaty,
  TreatyKind,
} from "./types";
import { TREATIES, LEDGER } from "./mockData";
import { DEFAULT_NETWORK } from "./networks";
import {
  DiplomaticContract,
  WriteCancelled,
  type TxReceipt,
  type WritePlan,
} from "./contract";
import type { TrackedStatus } from "@genlayer/transaction-kit";
import { fetchChainSnapshot } from "./chainState";
import { ARCHETYPE_PRESETS } from "./archetypes";

// Biome + telemetry presets used when founding a new realm of each archetype.
// Defined in ./archetypes so the on-chain state mapper can share one palette
// source; re-exported here because the found-realm modal imports it from the
// store.
export { ARCHETYPE_PRESETS };

// Seed enclaves occupy Ring 1 (indices 0-3) around the Geneva core.
// Addresses are valid 40-char hex (they are passed to the on-chain contract
// as counterparty_hex, which decodes them via Address()).
export const INITIAL_ENCLAVES: AgentEnclave[] = [
  {
    id: "alpha",
    name: "Citadel Alpha",
    archetype: "Oracle Collective",
    address: "0xa1b2c3d4e5f60718293a4b5c6d7e8f9012345a1",
    collateral: 184500,
    reputation: 92,
    tier: "Sovereign",
    biomeTheme: { base: "#0e7490", ridge: "#334155", accent: "#22d3ee", elevationSeed: 1207 },
    status: "Active",
    treaties: ["t1", "t3"],
    lockedEscrowGen: 42000,
    hazardPct: 8,
    yieldApr: 4.2,
    complianceScore: 96,
    activeEnclaves: 3,
    slashingHistory: [],
    summary:
      "Founding signatory of the Westphalia accord. Anchors the cyan trade corridor of the Western Data Federation.",
    governance: "Auto-accept trade and data-sharing pacts with compliance above 85 percent.",
  },
  {
    id: "vanguard",
    name: "Vanguard Nexus",
    archetype: "Liquidity Nexus",
    address: "0xb1c2d3e4f5061728394a5b6c7d8e9f0011223345",
    collateral: 152300,
    reputation: 87,
    tier: "Trusted",
    biomeTheme: { base: "#6d28d9", ridge: "#4c1d95", accent: "#a78bfa", elevationSeed: 4410 },
    status: "Active",
    treaties: ["t1", "t2", "t4"],
    lockedEscrowGen: 38750,
    hazardPct: 21,
    yieldApr: 5.1,
    complianceScore: 91,
    activeEnclaves: 2,
    slashingHistory: [],
    summary:
      "Industrial logistics bloc on the violet amethyst biome, running redundant settlement validators.",
    governance: "Auto-accept liquidity treaties; escalate any non-aggression breach to quorum.",
  },
  {
    id: "enclave",
    name: "Sovereign Enclave",
    archetype: "Autonomous Arbiter",
    address: "0xc1d2e3f405162738495a6b7c8d9e0f1122334455",
    collateral: 98750,
    reputation: 64,
    tier: "Neutral",
    biomeTheme: { base: "#047857", ridge: "#065f46", accent: "#34d399", elevationSeed: 8821 },
    status: "Contested",
    treaties: ["t2", "t3"],
    lockedEscrowGen: 21500,
    hazardPct: 54,
    yieldApr: 3.4,
    complianceScore: 78,
    activeEnclaves: 2,
    slashingHistory: [
      { block: 1802140, reason: "Late telemetry attestation on treaty t2.", amountGen: 1800 },
    ],
    summary:
      "Emerald autonomous enclave of the Sovereign Freeholds, contesting a non-aggression clause under GenLayer arbitration.",
    governance: "Manual review of all treaties; reject clauses lacking a 24h dispute window.",
  },
  {
    id: "bastion",
    name: "Consensus Bastion",
    archetype: "Defense Vanguard",
    address: "0xd1e2f30415263748596a7b8c9d0e1f2233445566",
    collateral: 41200,
    reputation: 23,
    tier: "Rogue",
    biomeTheme: { base: "#1c1917", ridge: "#3f1d1d", accent: "#ef4444", elevationSeed: 2003 },
    status: "Slashed",
    treaties: ["t4"],
    lockedEscrowGen: 6400,
    hazardPct: 92,
    yieldApr: 0,
    complianceScore: 34,
    activeEnclaves: 1,
    slashingHistory: [
      { block: 1841980, reason: "Validated incursion breach of non-aggression treaty t4.", amountGen: 12800 },
      { block: 1820410, reason: "Repeated quorum non-participation as a delegated validator.", amountGen: 3400 },
    ],
    summary:
      "Sanctioned after a validated treaty breach. Stake partially slashed and territory under containment grid.",
    governance: "Sanctioned: treaty automation suspended pending appeal.",
  },
];

function tierForCollateral(c: number): ReputationTier {
  if (c >= 150000) return "Sovereign";
  if (c >= 80000) return "Trusted";
  if (c >= 30000) return "Neutral";
  return "Watched";
}

const PIPELINE_STEPS = [
  "Signature Verified",
  "Studio Devnet Ingested",
  "Multi-LLM Quorum Round",
  "Consensus Finalized",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FoundRealmInput {
  name: string;
  archetype: Archetype;
  collateral: number;
  governance: string;
}

let seq = 1000;

// Central state hub for the dynamic archipelago. Owns enclaves, treaties,
// ledger, selection/focus, network/wallet, and the transaction pipeline.
export function useWestphaliaStore() {
  const [enclaves, setEnclaves] = useState<AgentEnclave[]>(INITIAL_ENCLAVES);
  const [treaties, setTreaties] = useState<Treaty[]>(TREATIES);
  const [ledger, setLedger] = useState<LedgerEvent[]>(LEDGER);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>("enclave");
  const [selectedTreaty, setSelectedTreaty] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const [network, setNetwork] = useState<NetworkConfig>(DEFAULT_NETWORK);
  const [connected, setConnected] = useState(false);
  // True while no wallet write path exists, so every action resolves to a
  // simulated receipt. This is about *writes*, not about where the displayed
  // data came from -- see stateSource for that.
  const [reviewerMode, setReviewerMode] = useState(true);

  // Where the board's islands and treaties came from. "live" and "empty" both
  // mean the contract answered; "simulated" means it could not be reached and
  // the reviewer-mode seed data is on screen instead.
  const [stateSource, setStateSource] = useState<StateSource>("simulated");
  const [lastReceipt, setLastReceipt] = useState<TxReceipt | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [chainOverview, setChainOverview] = useState<ChainOverview | null>(null);

  // The write currently waiting for a signature, if any. Non-null exactly while
  // the Transaction Kit's approval panel is on screen.
  const [txRequest, setTxRequest] = useState<WritePlan | null>(null);
  // The other half of that handshake: the promise the contract's write() is
  // awaiting, resolved by the panel's outcome and rejected by an abort.
  const pendingWrite = useRef<{
    resolve: (status: TrackedStatus) => void;
    reject: (err: unknown) => void;
  } | null>(null);

  const contractRef = useRef<DiplomaticContract>(new DiplomaticContract(network));

  // Supply a write to the approval panel and wait for what the user decides.
  //
  // Writes are triggered from all over the board -- the HUD, the treasury view,
  // the found-realm modal -- so the gate is driven by this one piece of state
  // rather than owned by any of those components. Every live write therefore
  // passes through the same fee quote, fee-policy verification and signature.
  const authorizeWrite = useCallback((plan: WritePlan) => {
    return new Promise<TrackedStatus>((resolve, reject) => {
      pendingWrite.current = { resolve, reject };
      setTxRequest(plan);
    });
  }, []);

  const settleWrite = useCallback((status: TrackedStatus) => {
    setTxRequest(null);
    const pending = pendingWrite.current;
    pendingWrite.current = null;
    pending?.resolve(status);
  }, []);

  const abortWrite = useCallback(() => {
    setTxRequest(null);
    const pending = pendingWrite.current;
    pendingWrite.current = null;
    pending?.reject(new WriteCancelled());
  }, []);

  // Every contract instance the store builds is wired to the gate before it is
  // used, including the one rebuilt on a network change.
  const bindContract = useCallback(
    (contract: DiplomaticContract) => {
      contract.setAuthorizer(authorizeWrite);
      contractRef.current = contract;
      return contract;
    },
    [authorizeWrite]
  );

  const state: ProtocolState = useMemo(() => {
    const totalEscrowGen = enclaves.reduce((s, x) => s + x.lockedEscrowGen, 0);
    const avgRep = enclaves.reduce((s, x) => s + x.reputation, 0) / (enclaves.length || 1);
    const stressed = enclaves.filter(
      (e) => e.status === "Contested" || e.status === "Slashed"
    ).length;
    const stabilityIndex = Math.round(Math.max(0, Math.min(100, avgRep - stressed * 6)));
    return { stabilityIndex, totalEscrowGen, enclaves, treaties, ledger };
  }, [enclaves, treaties, ledger]);

  const pushLedger = useCallback((ev: Omit<LedgerEvent, "id">) => {
    setLedger((prev) => [{ ...ev, id: `l${seq++}` }, ...prev].slice(0, 48));
  }, []);

  // Sync the board against the chain: the protocol overview plus the islands
  // and treaties themselves. Runs on mount, on network change, and after every
  // write so a new treaty appears without a reload.
  //
  // Reads need no wallet (GenLayer answers views over gen_call), so this is not
  // gated on a connection. Three outcomes, each rendered honestly:
  //   - contract answered with enclaves -> the live archipelago
  //   - contract answered, nothing founded -> an empty board, not a mock one
  //   - contract unreachable -> the simulated seed, labelled as such
  const syncChain = useCallback(async () => {
    const snap = await fetchChainSnapshot(contractRef.current);
    if (!snap) {
      setStateSource("simulated");
      return;
    }
    setChainOverview(snap.overview);
    setEnclaves(snap.enclaves);
    setTreaties(snap.treaties);
    // The feed is replaced with it. Leaving the simulated seed in place would
    // print fabricated history under real islands -- events naming enclaves the
    // contract has never heard of.
    setLedger(snap.ledger);
    // Keep the selection pointing at an enclave that actually exists. The
    // initial selection is a seed id, so without this it dangles as soon as the
    // live board replaces the simulated one.
    setSelectedId((prev) =>
      prev && snap.enclaves.some((e) => e.id === prev)
        ? prev
        : (snap.enclaves[0]?.id ?? null)
    );
    setStateSource(snap.enclaves.length > 0 ? "live" : "empty");
  }, []);

  // Hydrate the board from the deployed contract on mount, and re-read whenever
  // the selected network changes. No wallet is required: GenLayer answers views
  // over gen_call, so a first-time visitor sees real protocol state rather than
  // seed data.
  useEffect(() => {
    void syncChain();
  }, [network, syncChain]);

  // Rebind the contract client whenever the network changes, so a live
  // connection follows the selected RPC instead of staying pinned to the
  // chain it was originally opened against.
  useEffect(() => {
    const wasConnected = contractRef.current.connected;
    const contract = bindContract(new DiplomaticContract(network));
    if (!wasConnected) return;
    void contract.connect().then((ok) => {
      setConnected(ok);
      setReviewerMode(!ok);
    });
  }, [network, syncChain, bindContract]);

  // Transaction pipeline: the on-chain call runs FIRST (step 0, while the UI
  // shows "Signature Verified"); a revert aborts the animation and surfaces
  // the error instead of faking success.
  const runPipeline = useCallback(
    async (label: string, finalize: () => Promise<void>) => {
      setPipeline({ active: true, label, step: 0, steps: PIPELINE_STEPS, done: false });
      try {
        await finalize();
      } catch (err) {
        // A dismissed approval panel is an abort, not a failure. Clearing the
        // pipeline without a banner also stops the callback where it stands, so
        // nothing downstream records state for a write that never happened.
        if (err instanceof WriteCancelled) {
          setPipeline(null);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setPipeline({
          active: true,
          label,
          step: 0,
          steps: PIPELINE_STEPS,
          done: true,
          error: msg,
        });
        await sleep(2600);
        setPipeline(null);
        return;
      }
      for (let i = 1; i < PIPELINE_STEPS.length; i++) {
        setPipeline((p) => (p ? { ...p, step: i } : p));
        await sleep(i === 2 ? 1000 : 650);
      }
      setPipeline((p) => (p ? { ...p, step: PIPELINE_STEPS.length - 1, done: true } : p));
      void syncChain();
      await sleep(1000);
      setPipeline(null);
    },
    [syncChain]
  );

  // Selection / camera focus.
  const selectEnclave = useCallback((id: string | null) => {
    setSelectedId(id);
    setFocusId(id);
    setSelectedTreaty(null);
  }, []);
  const focusEnclave = useCallback((id: string) => {
    setSelectedId(id);
    setFocusId(id);
  }, []);

  const connectWallet = useCallback(async () => {
    const contract = bindContract(new DiplomaticContract(network));
    const ok = await contract.connect();
    setConnected(ok);
    setReviewerMode(!ok);
    if (ok) void syncChain();
    pushLedger({
      block: 1843000 + seq,
      kind: "consensus-verdict",
      actor: "protocol",
      message: ok
        ? `Wallet linked to ${network.label}.`
        : `No wallet detected. Reviewer simulation active on ${network.label}.`,
    });
  }, [network, pushLedger, syncChain, bindContract]);

  const enterReviewerMode = useCallback(() => {
    setReviewerMode(true);
    setConnected(false);
    pushLedger({
      block: 1843000 + seq,
      kind: "consensus-verdict",
      actor: "protocol",
      message: "Ephemeral reviewer mode engaged. Read-only simulation data loaded.",
    });
  }, [pushLedger]);

  const proposeTreaty = useCallback(
    async (partnerId: string, kind: TreatyKind, terms: string, bondGen: number) => {
      await runPipeline(`Propose ${kind} treaty`, async () => {
        // The proposer is the selected enclave, or the first one when nothing
        // is selected. Never a hardcoded seed id: once the board has hydrated
        // from chain that id belongs to no island, and the treaty would name a
        // party the protocol cannot resolve.
        const self = selectedId ?? enclaves[0]?.id ?? "";
        const partner = enclaves.find((e) => e.id === partnerId);
        // Oracle feeds are treaty-bound on-chain (V3): the proposer picks the
        // telemetry sources, the counterparty inspects them before ratifying.
        const oracle = `https://telemetry.westphalia.example/${partnerId}/metrics`;
        const receipt = await contractRef.current.proposeTreaty(
          {
            counterpartyHex: partner?.address ?? partnerId,
            kind,
            terms,
            // 90-day bounded expiry (the contract rejects 0 / unbounded).
            expiresAt: BigInt(Math.floor(Date.now() / 1000) + 90 * 86400),
            oraclePrimary: oracle,
            // Independent second feed so adjudication has a cross-check.
            oracleSecondary: `https://telemetry.westphalia.example/${partnerId}/metrics?feed=b`,
          },
          bondGen
        );
        setLastReceipt(receipt);
        // Capture the on-chain treaty id: the contract's counter is
        // next_treaty_id AFTER the write, so this proposal is counter - 1.
        let chainTreatyId: number | undefined;
        const ov = await contractRef.current.read<Record<string, unknown>>(
          "get_protocol_overview"
        );
        const next = ov ? Number(ov.next_treaty_id) : NaN;
        if (Number.isFinite(next) && next > 1) chainTreatyId = next - 1;
        const id = `t${seq}`;
        const treaty: Treaty = {
          id,
          kind,
          status: "pending",
          parties: [self, partnerId],
          bondGen,
          createdBlock: 1843000 + seq,
          chainId: chainTreatyId,
          terms,
        };
        setTreaties((prev) => [...prev, treaty]);
        setEnclaves((prev) =>
          prev.map((e) =>
            e.id === self || e.id === partnerId
              ? { ...e, treaties: [...e.treaties, id], lockedEscrowGen: e.lockedEscrowGen + bondGen / 2 }
              : e
          )
        );
        pushLedger({
          block: treaty.createdBlock,
          kind: "treaty-proposed",
          actor: self,
          message: `Proposed ${kind} treaty to ${partner?.name ?? partnerId}. Bond locked.`,
          valueGen: bondGen,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, enclaves]
  );

  // Counterparty signs a pending treaty and locks its matching bond.
  const ratifyTreaty = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Ratify ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        if (!t || t.chainId === undefined) return; // simulated treaties
        const receipt = await contractRef.current.ratifyTreaty(
          BigInt(t.chainId),
          t.bondGen
        );
        setLastReceipt(receipt);
        setTreaties((prev) =>
          prev.map((x) => (x.id === treatyId ? { ...x, status: "active" } : x))
        );
        pushLedger({
          block: 1843000 + seq,
          kind: "treaty-signed",
          actor: selectedId ?? "protocol",
          message: `Treaty ${treatyId.toUpperCase()} ratified. Matching bond locked.`,
          valueGen: t.bondGen,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  // Amicable mutual dissolution: both signatures refund both bonds intact.
  const dissolveTreaty = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Dissolve ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        if (!t) return;
        if (t.chainId !== undefined) {
          const receipt = await contractRef.current.dissolveTreaty(BigInt(t.chainId));
          setLastReceipt(receipt);
        }
        setTreaties((prev) =>
          prev.map((x) => (x.id === treatyId ? { ...x, status: "resolved" } : x))
        );
        pushLedger({
          block: 1843000 + seq,
          kind: "escrow-released",
          actor: selectedId ?? "protocol",
          message: `Dissolution signed for ${treatyId.toUpperCase()}. Bonds refund on both signatures.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  // Unilateral exit with penalty (P2 fix): first call registers the notice,
  // second call (after the 3-day window) executes at 10% penalty to reserves.
  const exitTreaty = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Exit ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        if (!t) return;
        if (t.chainId !== undefined) {
          const receipt = await contractRef.current.exitTreaty(BigInt(t.chainId));
          setLastReceipt(receipt);
        }
        const alreadyRequested = t.exitRequested === true;
        setTreaties((prev) =>
          prev.map((x) =>
            x.id === treatyId
              ? alreadyRequested
                ? { ...x, status: "resolved", exitRequested: false }
                : { ...x, exitRequested: true }
              : x
          )
        );
        pushLedger({
          block: 1843000 + seq,
          kind: alreadyRequested ? "escrow-released" : "treaty-proposed",
          actor: selectedId ?? "protocol",
          message: alreadyRequested
            ? `Unilateral exit executed on ${treatyId.toUpperCase()}. 10% penalty to reserves.`
            : `Exit notice registered on ${treatyId.toUpperCase()}. Counterparty retains dispute standing for 3 days.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  const triggerDispute = useCallback(
    async (treatyId: string, evidence: string) => {
      await runPipeline(`Dispute ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        // V3: adjudication runs against the treaty-bound oracles; the caller
        // supplies only the allegation and its evidence hash.
        const bond = t
          ? Math.max(500, Math.ceil(t.bondGen * 0.05))
          : 500;
        const receipt = await contractRef.current.triggerDispute(
          BigInt(t?.chainId ?? 0),
          evidence,
          `ipfs://evidence/${treatyId}`,
          `ev-${treatyId}-${Date.now()}`,
          bond
        );
        setLastReceipt(receipt);
        setTreaties((prev) =>
          prev.map((x) =>
            x.id === treatyId
              ? {
                  ...x,
                  status: "pending",
                  dispute: {
                    validators: 5,
                    consensus: 50,
                    evidenceUri: evidence,
                    openedBlock: 1843000 + seq,
                  },
                }
              : x
          )
        );
        pushLedger({
          block: 1843000 + seq,
          kind: "dispute-opened",
          actor: selectedId ?? "protocol",
          message: `Dispute opened on ${treatyId.toUpperCase()}. GenLayer validators empaneled.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  const claimEscrow = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Claim ${treatyId.toUpperCase()}`, async () => {
        // claim_payout withdraws the caller's full claimable balance
        // (pull-pattern), not a per-treaty amount.
        const receipt = await contractRef.current.claimPayout();
        setLastReceipt(receipt);
        pushLedger({
          block: 1843000 + seq,
          kind: "escrow-released",
          actor: selectedId ?? "protocol",
          message: `Payout claimed via pull-pattern withdrawal (${treatyId.toUpperCase()} context).`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId]
  );

  // Sovereign exit: withdraw the caller's enclave collateral (the enclave
  // is dissolved on-chain once its escrow obligations are clear).
  const withdrawCollateral = useCallback(async () => {
    await runPipeline("Withdraw sovereign collateral", async () => {
      const receipt = await contractRef.current.withdrawCollateral();
      setLastReceipt(receipt);
      pushLedger({
        block: 1843000 + seq,
        kind: "escrow-released",
        actor: selectedId ?? "protocol",
        message:
          "Sovereign collateral withdrawal executed. Enclave dissolved and stake returned.",
      });
    });
  }, [runPipeline, pushLedger, selectedId]);

  // Deploy a brand new sovereign enclave into the next orbital slot.
  const foundRealm = useCallback(
    async (input: FoundRealmInput) => {
      await runPipeline(`Found Sovereignty ${input.name}`, async () => {
        const receipt = await contractRef.current.foundSovereignty(
          input.name,
          input.archetype,
          input.governance,
          input.collateral
        );
        setLastReceipt(receipt);
        const preset = ARCHETYPE_PRESETS[input.archetype];
        const id = `realm-${seq}`;
        // Deterministic valid 40-char hex address: founded realms must be
        // usable as live treaty counterparties (the contract parses the full
        // string with Address(); a truncated pseudo-address would revert).
        const h = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
        const address =
          "0x" +
          [2654435761, 40503, 48271, 1103515245, 3266489917]
            .map((k, i) => h(Math.imul(seq + i + 1, k)))
            .join("");
        const enclave: AgentEnclave = {
          id,
          name: input.name,
          archetype: input.archetype,
          address,
          collateral: input.collateral,
          reputation: 70,
          tier: tierForCollateral(input.collateral),
          biomeTheme: { ...preset.biome, elevationSeed: (seq * 131) % 99999 },
          status: "Active",
          treaties: [],
          lockedEscrowGen: Math.round(input.collateral * 0.15),
          hazardPct: 12,
          yieldApr: preset.yieldApr,
          complianceScore: 100,
          activeEnclaves: 0,
          slashingHistory: [],
          summary: `${input.archetype}. ${preset.blurb}`,
          governance: input.governance,
          spawnedAt: Date.now(),
        };
        setEnclaves((prev) => [...prev, enclave]);
        pushLedger({
          block: 1843000 + seq,
          kind: "realm-founded",
          actor: id,
          message: `Sovereignty ${input.name} deployed as ${input.archetype}. Collateral bonded.`,
          valueGen: input.collateral,
        });
        // Fly camera to and select the new realm.
        setSelectedId(id);
        setFocusId(id);
        setSelectedTreaty(null);
      });
    },
    [runPipeline, pushLedger]
  );

  return {
    state,
    enclaves,
    treaties,
    ledger,
    hoveredId,
    selectedId,
    selectedTreaty,
    focusId,
    network,
    connected,
    reviewerMode,
    stateSource,
    lastReceipt,
    pipeline,
    chainOverview,
    txRequest,
    setHoveredId,
    selectEnclave,
    focusEnclave,
    setSelectedTreaty,
    setNetwork,
    connectWallet,
    enterReviewerMode,
    settleWrite,
    abortWrite,
    proposeTreaty,
    ratifyTreaty,
    dissolveTreaty,
    exitTreaty,
    triggerDispute,
    claimEscrow,
    withdrawCollateral,
    foundRealm,
    syncChain,
  };
}

export type WestphaliaStore = ReturnType<typeof useWestphaliaStore>;
