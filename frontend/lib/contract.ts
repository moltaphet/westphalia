import type { NetworkConfig } from "./types";
import { DEFAULT_NETWORK, DIPLOMATIC_CONTRACT_ADDRESS } from "./networks";

// Mock intelligent-contract ABI for the Westphalia diplomatic escrow.
// This mirrors the shape of a GenLayer intelligent contract: a set of
// read-only view methods and payable / state-changing write methods.
export interface AbiEntry {
  type: "function";
  name: string;
  stateMutability: "view" | "nonpayable" | "payable";
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
}

export const DIPLOMATIC_ABI: AbiEntry[] = [
  {
    type: "function",
    name: "get_protocol_state",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "state", type: "json" }],
  },
  {
    type: "function",
    name: "get_sovereignty",
    stateMutability: "view",
    inputs: [{ name: "sovereignty_id", type: "string" }],
    outputs: [{ name: "sovereignty", type: "json" }],
  },
  {
    type: "function",
    name: "propose_treaty",
    stateMutability: "payable",
    inputs: [
      { name: "partner_id", type: "string" },
      { name: "kind", type: "string" },
      { name: "terms", type: "string" },
      { name: "bond_gen", type: "uint256" },
    ],
    outputs: [{ name: "treaty_id", type: "string" }],
  },
  {
    type: "function",
    name: "trigger_dispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "treaty_id", type: "string" },
      { name: "evidence_uri", type: "string" },
    ],
    outputs: [{ name: "dispute_id", type: "string" }],
  },
  {
    type: "function",
    name: "claim_escrow",
    stateMutability: "nonpayable",
    inputs: [{ name: "treaty_id", type: "string" }],
    outputs: [{ name: "released_gen", type: "uint256" }],
  },
];

export interface TxReceipt {
  hash: string;
  simulated: boolean;
  method: string;
  summary: string;
}

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

// Web3 binding around the GenLayer diplomatic contract.
// genlayer-js is imported lazily on the client so that server-side
// rendering and the build step never touch browser-only wallet code.
export class DiplomaticContract {
  readonly address: string;
  readonly network: NetworkConfig;
  private client: unknown = null;

  constructor(network: NetworkConfig = DEFAULT_NETWORK, address = DIPLOMATIC_CONTRACT_ADDRESS) {
    this.network = network;
    this.address = address;
  }

  // Attempt to build a live GenLayer client. Returns false in read-only
  // (reviewer) mode when no injected wallet or SDK is available.
  async connect(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const sdk = (await import("genlayer-js").catch(() => null)) as
        | Record<string, unknown>
        | null;
      const injected = (window as unknown as { ethereum?: unknown }).ethereum;
      if (!sdk || !injected) return false;
      // The exact client factory is intentionally defensive: different
      // genlayer-js releases expose slightly different entry points.
      const factory =
        (sdk.createClient as ((cfg: unknown) => unknown) | undefined) ??
        (sdk.createAccount as ((cfg: unknown) => unknown) | undefined);
      if (typeof factory !== "function") return false;
      this.client = factory({
        chain: { id: this.network.chainId, rpcUrl: this.network.rpcUrl },
      });
      return true;
    } catch {
      return false;
    }
  }

  get connected(): boolean {
    return this.client !== null;
  }

  // Write helpers. When no live client exists, these resolve to a
  // simulated receipt so the reviewer-mode UI stays fully interactive.
  async proposeTreaty(
    partnerId: string,
    kind: string,
    terms: string,
    bondGen: number
  ): Promise<TxReceipt> {
    const summary = `Propose ${kind} treaty with ${partnerId} (bond ${bondGen} GEN)`;
    return this.write("propose_treaty", summary, [partnerId, kind, terms, bondGen]);
  }

  async triggerDispute(treatyId: string, evidenceUri: string): Promise<TxReceipt> {
    const summary = `Open dispute on ${treatyId}`;
    return this.write("trigger_dispute", summary, [treatyId, evidenceUri]);
  }

  async claimEscrow(treatyId: string): Promise<TxReceipt> {
    const summary = `Claim released escrow for ${treatyId}`;
    return this.write("claim_escrow", summary, [treatyId]);
  }

  private async write(method: string, summary: string, args: unknown[]): Promise<TxReceipt> {
    const seed = `${method}:${JSON.stringify(args)}:${Date.now()}`;
    if (!this.connected) {
      return { hash: pseudoHash(seed), simulated: true, method, summary };
    }
    try {
      const client = this.client as {
        writeContract?: (cfg: unknown) => Promise<{ hash?: string } | string>;
      };
      if (typeof client.writeContract === "function") {
        const res = await client.writeContract({
          address: this.address,
          abi: DIPLOMATIC_ABI,
          functionName: method,
          args,
        });
        const hash = typeof res === "string" ? res : res.hash ?? pseudoHash(seed);
        return { hash, simulated: false, method, summary };
      }
    } catch {
      // fall through to simulated receipt
    }
    return { hash: pseudoHash(seed), simulated: true, method, summary };
  }
}
