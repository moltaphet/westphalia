import type { NetworkConfig } from "./types";

// GenLayer Studio Net targets.
//
// Chain 61997 is served by two RPC hostnames that answer identically (verified:
// same eth_chainId 0xf22d, same contract state): `studio-next.genlayer.com`,
// which the hackathon brief names, and `studio-dev.genlayer.com`, which
// genlayer-js's own bundled `studioDevnet` chain definition names. The RPC
// default is the brief's, overridable per deployment via
// NEXT_PUBLIC_GENLAYER_RPC_URL.
//
// The explorer is *not* symmetric with the RPC: the brief names
// `explorer-studio-dev.genlayer.com` explicitly, so that is what is linked even
// though the RPC beside it points at studio-next.
export const STUDIO_DEV: NetworkConfig = {
  key: "studio-dev",
  label: "GenLayer Studio Net",
  chainId: 61997,
  rpcUrl:
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio-next.genlayer.com/api",
  explorerUrl: "https://explorer-studio-dev.genlayer.com",
};

export const STUDIO: NetworkConfig = {
  key: "studio",
  label: "GenLayer Studio",
  chainId: 61999,
  rpcUrl: "https://studio.genlayer.com/api",
  explorerUrl: "https://explorer-studio-dev.genlayer.com",
};

export const NETWORKS: NetworkConfig[] = [STUDIO_DEV, STUDIO];

export const DEFAULT_NETWORK = STUDIO_DEV;

export function networkByChainId(chainId: number): NetworkConfig | undefined {
  return NETWORKS.find((n) => n.chainId === chainId);
}

// Deployed diplomatic escrow contract address. Set via
// NEXT_PUBLIC_DIPLOMATIC_CONTRACT_ADDRESS (e.g. in .env.local) so each
// deployment is a config change, not a code change.
export const DIPLOMATIC_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_DIPLOMATIC_CONTRACT_ADDRESS ??
  "0xB78A41624fe09163fee3159091E907B7b7Af9D00";

// A genlayer-js chain object, as viem consumes it.
//
// This is NOT a hand-built `{ id, rpcUrl }` pair. genlayer-js reads three
// consensus fields off the chain when dispatching a write --
// `consensusMainContract` (address + ABI of the consensus contract the
// transaction is sent to), `defaultNumberOfInitialValidators` and
// `defaultConsensusMaxRotations` -- and `isStudio`, which selects the local
// fee-policy path instead of a fee-manager contract. A chain object missing
// them throws inside viem ("Cannot read properties of undefined (reading
// 'default')") or fails later at "Cannot convert undefined to a BigInt".
//
// All of them are already correct in the chain definitions genlayer-js ships,
// so the SDK's own object is spread and only the RPC endpoint is overridden.
export interface GenLayerChain {
  id: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: { default: { http: string[] } };
  isStudio?: boolean;
  defaultNumberOfInitialValidators?: number;
  defaultConsensusMaxRotations?: number;
  consensusMainContract?: { address: string; abi: readonly unknown[] };
}

// The chain genlayer-js ships for each GenLayer network id. 61997 is
// `studioDevnet` (GenLayer Studio Devnet / Studio Net); 61999 is `studionet`.
const SDK_CHAIN_BY_ID: Record<number, string> = {
  61997: "studioDevnet",
  61999: "studionet",
};

// Resolve the SDK chain for `network`, pinned to this deployment's RPC.
//
// Returns null when the SDK is unavailable or ships no chain for this network
// id, which callers treat as "no live client" -- never as a silently
// incomplete chain object, because that is the failure this function exists
// to prevent.
export function genlayerChain(
  network: NetworkConfig,
  chains: Record<string, GenLayerChain> | undefined
): GenLayerChain | null {
  const key = SDK_CHAIN_BY_ID[network.chainId];
  const shipped = key ? chains?.[key] : undefined;
  if (!shipped) return null;
  return {
    ...shipped,
    rpcUrls: { default: { http: [network.rpcUrl] } },
  };
}
