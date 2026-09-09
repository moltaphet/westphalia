import type { EnclaveStatus } from "./types";

// Shared rendering constants and color maps for the 3D board.
export const TILE = 1; // world units per grid tile
export const VOXEL_H = 0.32; // world height per discrete voxel level

// Status overlay colors (independent of an enclave's biome tint).
export const STATUS_COLOR: Record<EnclaveStatus, string> = {
  Active: "#10b981",
  Contested: "#f59e0b",
  Slashed: "#ef4444",
};

export const STATUS_LABEL: Record<EnclaveStatus, string> = {
  Active: "ACTIVE",
  Contested: "CONTESTED",
  Slashed: "SANCTIONED",
};

export const KIND_COLOR: Record<string, string> = {
  trade: "#22d3ee",
  "data-sharing": "#10b981",
  "non-aggression": "#a3e635",
};
