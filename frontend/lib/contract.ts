import type { NetworkConfig, TreatyKind } from "./types";
import type { SubmitInput, TrackedStatus } from "@genlayer/transaction-kit";
import {
  DEFAULT_NETWORK,
  DIPLOMATIC_CONTRACT_ADDRESS,
  genlayerChain,
  type GenLayerChain,
} from "./networks";

// The subset of EIP-1193 an injected wallet has to expose for a write. The
// SDK takes the provider and routes signing methods to it, so the key never
// leaves the extension.
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

// ABI of the Westphalia intelligent contract (contracts/westphalia.py, GenVM
// v0.3.0). Names, argument order, and mutability mirror the deployed
// contract exactly; amounts are atto-scale uint256 (value * 10^18).
export interface AbiEntry {
  type: "function";
  name: string;
  stateMutability: "view" | "nonpayable" | "payable";
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
}

export const DIPLOMATIC_ABI: AbiEntry[] = [
  // --- views --------------------------------------------------------------
  {
    type: "function",
    name: "get_protocol_overview",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "overview", type: "json" }],
  },
  {
    type: "function",
    name: "get_treaty",
    stateMutability: "view",
    inputs: [{ name: "treaty_id", type: "uint256" }],
    outputs: [{ name: "treaty", type: "json" }],
  },
  {
    type: "function",
    name: "get_enclave",
    stateMutability: "view",
    inputs: [{ name: "owner_hex", type: "string" }],
    outputs: [{ name: "enclave", type: "json" }],
  },
  {
    // Enumerable roster: total enclaves ever founded (monotonic).
    type: "function",
    name: "get_enclave_count",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "string" }],
  },
  {
    // Enumerable roster: the enclave at a slot, with its address and an
    // `exists` flag (false for a slot whose enclave later withdrew).
    type: "function",
    name: "get_enclave_by_index",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "enclave", type: "json" }],
  },
  {
    type: "function",
    name: "whoami",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "address_hex", type: "string" }],
  },
  {
    // Untrusted-input sanitizer, exposed on-chain for adversarial review.
    type: "function",
    name: "sanitize_preview",
    stateMutability: "view",
    inputs: [{ name: "s", type: "string" }],
    outputs: [{ name: "sanitized", type: "string" }],
  },
  {
    // SSRF guard, exposed on-chain for adversarial review.
    type: "function",
    name: "is_safe_url",
    stateMutability: "view",
    inputs: [{ name: "url", type: "string" }],
    outputs: [{ name: "safe", type: "bool" }],
  },
  {
    type: "function",
    name: "claimable_of",
    stateMutability: "view",
    inputs: [{ name: "owner_hex", type: "string" }],
    outputs: [{ name: "amount", type: "string" }],
  },
  {
    type: "function",
    name: "locked_treaty_count",
    stateMutability: "view",
    inputs: [{ name: "owner_hex", type: "string" }],
    outputs: [{ name: "count", type: "string" }],
  },
  {
    type: "function",
    name: "required_dispute_bond",
    stateMutability: "view",
    inputs: [{ name: "plaintiff_hex", type: "string" }],
    outputs: [{ name: "amount", type: "string" }],
  },
  // --- writes -------------------------------------------------------------
  {
    type: "function",
    name: "found_sovereignty",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "archetype", type: "string" },
      { name: "charter", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "propose_treaty",
    stateMutability: "payable",
    inputs: [
      { name: "counterparty_hex", type: "string" },
      { name: "kind", type: "string" },
      { name: "terms", type: "string" },
      { name: "expires_at", type: "uint256" },
      { name: "params_json", type: "string" },
      { name: "oracle_primary", type: "string" },
      { name: "oracle_secondary", type: "string" },
    ],
    outputs: [{ name: "treaty_id", type: "uint256" }],
  },
  {
    type: "function",
    name: "ratify_treaty",
    stateMutability: "payable",
    inputs: [{ name: "treaty_id", type: "uint256" }],
    outputs: [],
  },
  {
    // Bounded liveness: proposer reclaims its bond from a still-PROPOSED treaty.
    type: "function",
    name: "cancel_proposal",
    stateMutability: "nonpayable",
    inputs: [{ name: "treaty_id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dissolve_treaty",
    stateMutability: "nonpayable",
    inputs: [{ name: "treaty_id", type: "uint256" }],
    outputs: [{ name: "status", type: "string" }],
  },
  {
    type: "function",
    name: "exit_treaty",
    stateMutability: "nonpayable",
    inputs: [{ name: "treaty_id", type: "uint256" }],
    outputs: [{ name: "status", type: "string" }],
  },
  {
    type: "function",
    name: "drain_reserves",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to_hex", type: "string" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "amount", type: "string" }],
  },
  {
    type: "function",
    name: "trigger_dispute",
    stateMutability: "payable",
    inputs: [
      { name: "treaty_id", type: "uint256" },
      { name: "allegation_text", type: "string" },
      { name: "evidence_uri", type: "string" },
      { name: "evidence_hash", type: "string" },
    ],
    outputs: [{ name: "verdict_tier", type: "string" }],
  },
  {
    type: "function",
    name: "claim_payout",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "string" }],
  },
  {
    type: "function",
    name: "recover_bond",
    stateMutability: "nonpayable",
    inputs: [{ name: "treaty_id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw_collateral",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "string" }],
  },
];

// Atto-scale helper: whole GEN -> on-chain uint256 units.
export const ATTO = 10n ** 18n;
export const toAtto = (gen: number): bigint => BigInt(Math.round(gen)) * ATTO;

// Atto-scale string/bigint -> whole GEN (float), for chain-overview display.
export function attoToGen(atto: string | bigint): number {
  try {
    const v = typeof atto === "bigint" ? atto : BigInt(atto);
    return Number(v / 10n ** 15n) / 1000;
  } catch {
    return 0;
  }
}

// UI treaty kinds (kebab-case) -> on-chain kinds (TREATY_PARAM_SCHEMA keys).
// The contract rejects unmapped kinds, so every propose must translate here.
export const CONTRACT_KIND: Record<TreatyKind, string> = {
  "non-aggression": "NON_AGGRESSION",
  trade: "TRADE_CORRIDOR",
  "data-sharing": "DATA_SHARING",
};

// Typed per-kind treaty parameter presets, mirroring the contract's
// TREATY_PARAM_SCHEMA (exact key sets; extras are rejected on-chain).
export const TREATY_PARAM_PRESETS: Record<string, Record<string, number>> = {
  NON_AGGRESSION: { max_exploit_bps: 300, max_mev_events: 2 },
  TRADE_CORRIDOR: { min_settlement_volume: 100000, max_slippage_bps: 50 },
  DATA_SHARING: { min_uptime_bps: 9900, max_latency_bps: 250 },
};

export interface TxReceipt {
  hash: string;
  simulated: boolean;
  method: string;
  summary: string;
}

// One requested write, in the two shapes the Transaction Kit consumes.
//
// `value` is kept separate from `tx` on purpose. The kit takes the caller's
// value at *estimate* time (as `PolicyInput.userValue`, from which it builds
// the deposit) while `SubmitInput` carries only the call itself. Keeping that
// asymmetry here means the ten call sites below never have to know about it.
export interface WritePlan {
  method: string;
  summary: string;
  value: bigint;
  args: unknown[];
  tx: SubmitInput;
}

// Thrown when a write is abandoned before signing -- the user closed the
// approval panel. Deliberately distinct from a revert, because the pipeline
// treats it as an intentional abort rather than a failure.
export class WriteCancelled extends Error {
  constructor() {
    super("Transaction cancelled before signing.");
    this.name = "WriteCancelled";
  }
}

// Supplied by the store: shows the write's fee quote and verification badge,
// gets a signature, submits, and tracks the transaction to a decided status.
// The return value is what the contract records as the receipt hash.
export type WriteAuthorizer = (plan: WritePlan) => Promise<TrackedStatus>;

// Deterministic pseudo transaction hash for simulation / optimistic UI.
function pseudoHash(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return "0x" + hex.repeat(8).slice(0, 64);
}

export interface ProposeTreatyArgs {
  counterpartyHex: string;
  kind: string;
  terms: string;
  expiresAt: bigint;
  oraclePrimary: string;
  oracleSecondary: string;
}

// Web3 binding around the Westphalia intelligent contract.
// genlayer-js is imported lazily on the client so that server-side
// rendering and the build step never touch browser-only wallet code.
export class DiplomaticContract {
  readonly address: string;
  readonly network: NetworkConfig;
  private client: unknown = null;
  private reader: unknown = null;
  private authorizer: WriteAuthorizer | null = null;

  constructor(network: NetworkConfig = DEFAULT_NETWORK, address = DIPLOMATIC_CONTRACT_ADDRESS) {
    this.network = network;
    this.address = address;
  }

  // Route live writes through the approval panel. Set by the store, which owns
  // the panel's state; left unset in contexts that only read.
  setAuthorizer(authorizer: WriteAuthorizer): void {
    this.authorizer = authorizer;
  }

  // Attempt to build a live GenLayer client bound to the injected wallet.
  //
  // A client without an account cannot dispatch: genlayer-js throws "No
  // account set. Configure the client with an account or pass an account to
  // this function." before any calldata is built. So connect() asks the
  // wallet for an address and hands the SDK the (address, provider) pair --
  // the SDK routes eth_sendTransaction to the provider for a string account,
  // which keeps the key inside the wallet extension and never in this bundle.
  //
  // Returns false in read-only (reviewer) mode when no injected wallet or SDK
  // is available. Reads do not go through this client -- see readClient() --
  // so a visitor without a wallet still sees live protocol state.
  async connect(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const sdk = (await import("genlayer-js").catch(() => null)) as
        | Record<string, unknown>
        | null;
      const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
      if (!sdk || !injected) return false;
      const factory = sdk.createClient as ((cfg: unknown) => unknown) | undefined;
      if (typeof factory !== "function") return false;
      const chain = genlayerChain(
        this.network,
        sdk.chains as Record<string, GenLayerChain> | undefined
      );
      if (!chain) return false;
      const accounts = (await injected.request({
        method: "eth_requestAccounts",
      })) as string[] | undefined;
      const account = accounts?.[0];
      if (!account) return false;
      this.client = factory({
        chain,
        account,
        provider: injected,
      });
      return true;
    } catch {
      return false;
    }
  }

  // An account-less client, used for every view call.
  //
  // GenLayer answers views over `gen_call`, which needs no signer, so the board
  // can render real protocol state before anyone connects a wallet. Reads
  // deliberately do not reuse the connected client: they must behave the same
  // before and after connect, and must never depend on wallet state.
  private async readClient(): Promise<unknown> {
    if (this.reader !== null) return this.reader;
    if (typeof window === "undefined") return null;
    try {
      const sdk = (await import("genlayer-js").catch(() => null)) as
        | Record<string, unknown>
        | null;
      const factory = sdk?.createClient as ((cfg: unknown) => unknown) | undefined;
      if (typeof factory !== "function") return null;
      const chain = genlayerChain(
        this.network,
        sdk?.chains as Record<string, GenLayerChain> | undefined
      );
      if (!chain) return null;
      this.reader = factory({ chain });
      return this.reader;
    } catch {
      return null;
    }
  }

  get connected(): boolean {
    return this.client !== null;
  }

  // Write helpers. With no live signer -- reviewer mode, or a client that never
  // connected -- these resolve to a simulated receipt so the UI stays fully
  // interactive. With one, they hand the call to the authorizer, which runs it
  // through the Transaction Kit.
  async foundSovereignty(
    name: string,
    archetype: string,
    charter: string,
    collateralGen: number
  ): Promise<TxReceipt> {
    const summary = `Found sovereignty ${name} (${collateralGen} GEN collateral)`;
    return this.write("found_sovereignty", summary, {
      value: toAtto(collateralGen),
      args: [name, archetype, charter],
    });
  }

  async proposeTreaty(
    args: ProposeTreatyArgs,
    bondGen: number
  ): Promise<TxReceipt> {
    const contractKind: string =
      CONTRACT_KIND[args.kind as TreatyKind] ?? "NON_AGGRESSION";
    const params = TREATY_PARAM_PRESETS[contractKind] ?? TREATY_PARAM_PRESETS.NON_AGGRESSION;
    const summary = `Propose ${args.kind} treaty (bond ${bondGen} GEN)`;
    return this.write("propose_treaty", summary, {
      value: toAtto(bondGen),
      args: [
        args.counterpartyHex,
        contractKind,
        args.terms,
        args.expiresAt,
        JSON.stringify(params),
        args.oraclePrimary,
        args.oracleSecondary,
      ],
    });
  }

  async ratifyTreaty(treatyId: bigint, bondGen: number): Promise<TxReceipt> {
    const summary = `Ratify treaty ${treatyId} (matching bond ${bondGen} GEN)`;
    return this.write("ratify_treaty", summary, {
      value: toAtto(bondGen),
      args: [treatyId],
    });
  }

  async dissolveTreaty(treatyId: bigint): Promise<TxReceipt> {
    const summary = `Sign amicable dissolution of treaty ${treatyId}`;
    return this.write("dissolve_treaty", summary, { value: 0n, args: [treatyId] });
  }

  async triggerDispute(
    treatyId: bigint,
    allegationText: string,
    evidenceUri: string,
    evidenceHash: string,
    bondGen: number
  ): Promise<TxReceipt> {
    const summary = `Open dispute on treaty ${treatyId} (bond ${bondGen} GEN)`;
    return this.write("trigger_dispute", summary, {
      value: toAtto(bondGen),
      args: [treatyId, allegationText, evidenceUri, evidenceHash],
    });
  }

  async claimPayout(): Promise<TxReceipt> {
    const summary = "Claim accrued payout via pull-pattern withdrawal";
    return this.write("claim_payout", summary, { value: 0n, args: [] });
  }

  async recoverBond(treatyId: bigint): Promise<TxReceipt> {
    const summary = `Recover expired-treaty bond ${treatyId}`;
    return this.write("recover_bond", summary, { value: 0n, args: [treatyId] });
  }

  async withdrawCollateral(): Promise<TxReceipt> {
    const summary = "Withdraw enclave collateral (sovereign exit)";
    return this.write("withdraw_collateral", summary, { value: 0n, args: [] });
  }

  async exitTreaty(treatyId: bigint): Promise<TxReceipt> {
    const summary = `Unilaterally exit treaty ${treatyId} (10% penalty to reserves after 3-day notice)`;
    return this.write("exit_treaty", summary, { value: 0n, args: [treatyId] });
  }

  async drainReserves(toHex: string, amount: bigint): Promise<TxReceipt> {
    const summary = "Governor: drain protocol reserves to treasury";
    return this.write("drain_reserves", summary, {
      value: 0n,
      args: [toHex, amount],
    });
  }

  private async write(
    method: string,
    summary: string,
    { value, args }: { value: bigint; args: unknown[] }
  ): Promise<TxReceipt> {
    const seed = `${method}:${JSON.stringify(args)}:${Date.now()}`;
    if (!this.connected || !this.authorizer) {
      return { hash: pseudoHash(seed), simulated: true, method, summary };
    }
    // Live path. Everything fee-related -- the allocation, the deposit, the cap
    // check, and the verification of the quoted fee policy against the chain's
    // current one -- belongs to the Transaction Kit, which reads those prices
    // live. This method's job ends at naming the call.
    //
    // A rejected approval throws (`WriteCancelled`); a revert propagates from
    // submit/track. Neither is masked as a simulated receipt: the pipeline
    // renders reverts and stays silent on an abort.
    const status = await this.authorizer({
      method,
      summary,
      value,
      args,
      tx: {
        kind: "write",
        address: this.address as `0x${string}`,
        method,
        args,
      },
    });
    const hash =
      status.genlayerTxId ?? status.evmTxHash ?? pseudoHash(seed);
    return { hash, simulated: false, method, summary };
  }

  // Read a view method. Returns null when the SDK is unavailable or the call
  // fails (caller decides how to degrade). Works without a wallet.
  async read<T = unknown>(method: string, args: unknown[] = []): Promise<T | null> {
    try {
      const client = (await this.readClient()) as {
        readContract?: (cfg: unknown) => Promise<unknown>;
      } | null;
      if (!client || typeof client.readContract !== "function") return null;
      return (await client.readContract({
        address: this.address,
        abi: DIPLOMATIC_ABI,
        functionName: method,
        args,
      })) as T;
    } catch {
      return null;
    }
  }
}
