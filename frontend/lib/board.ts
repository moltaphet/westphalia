import type { SovereigntyStatus } from "./types";

// Shared rendering constants and color maps for the 3D board.
export const TILE = 1; // world units per grid tile
export const VOXEL_H = 0.32; // world height per discrete voxel level

// Status overlay colors (independent of an island's base terrain tint).
export const STATUS_COLOR: Record<SovereigntyStatus, string> = {
  stable: "#64748b",
  allied: "#10b981",
  disputed: "#f59e0b",
  slashed: "#ef4444",
};

export const KIND_COLOR: Record<string, string> = {
  trade: "#22d3ee",
  "data-sharing": "#10b981",
  "non-aggression": "#a3e635",
};
