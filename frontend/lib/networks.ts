import type { NetworkConfig } from "./types";

// GenLayer StudioNet targets. Primary is studio-dev, with studio as fallback.
export const STUDIO_DEV: NetworkConfig = {
  key: "studio-dev",
  label: "GenLayer StudioNet (dev)",
  chainId: 61997,
  rpcUrl: "https://studio-dev.genlayer.com/api",
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
  "0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3";
