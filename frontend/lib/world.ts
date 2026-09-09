import type { AgentEnclave, BiomeTheme } from "./types";
import { VOXEL_H } from "./board";
import { fbm } from "./noise";

// Dynamic archipelago geometry. Islands are no longer hardcoded: their world
// coordinates are derived from an enclave's index via a concentric-ring
// orbital algorithm around the central Geneva core.

export const TILE = 1;
export const WORLD_EXTENT = 54; // outer bound, sizes radar + camera limits

// The neutral Geneva hub at the center of the archipelago.
export const HUB = { center: [0, 0] as [number, number], floatY: 1.4, radius: 4 };

// Deterministic 0..1 hash for organic, stable pseudo-random placement.
function pseudo(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

export interface OrbitSlot {
  ring: number;
  radius: number;
  angle: number;
  x: number;
  z: number;
  floatY: number;
}

// Concentric ring placement:
//   Ring 1 (radius 18-24): enclaves 1-4
//   Ring 2 (radius 30-36): enclaves 5-10
//   Ring 3 (radius 42-50): enclaves 11+
export function orbitSlot(index: number): OrbitSlot {
  let ring: number;
  let capacity: number;
  let radius: number;
  let startIndex: number;

  if (index < 4) {
    ring = 1;
    capacity = 4;
    radius = 21;
    startIndex = 0;
  } else if (index < 10) {
    ring = 2;
    capacity = 6;
    radius = 33;
    startIndex = 4;
  } else {
    ring = 3;
    capacity = 8;
    radius = 46;
    startIndex = 10;
  }

  const local = index - startIndex;
  const base = (2 * Math.PI * (local % capacity)) / capacity;
  // Subtle pseudo-random angular + radial offset for organic layout.
  const angle = base + (pseudo(index) * 2 - 1) * (Math.PI / capacity) * 0.35;
  const r = radius + (pseudo(index + 99) * 2 - 1) * 2;
  const floatY = (pseudo(index + 7) * 2 - 1) * 0.8;

  return {
    ring,
    radius: r,
    angle,
    x: Math.cos(angle) * r,
    z: Math.sin(angle) * r,
    floatY,
  };
}

export interface IslandLayout {
  id: string; // enclave id
  name: string;
  center: [number, number];
  radius: number; // tiles
  floatY: number;
  palette: BiomeTheme;
  broken: boolean; // severed causeway for slashed enclaves
  ring: number;
}

// Compute island layouts for the current set of enclaves.
export function buildLayouts(enclaves: AgentEnclave[]): IslandLayout[] {
  return enclaves.map((e, i) => {
    const slot = orbitSlot(i);
    // Outer rings render slightly smaller islands to keep the map readable.
    const radius = slot.ring === 1 ? 6 : slot.ring === 2 ? 5 : 4;
    return {
      id: e.id,
      name: e.name,
      center: [slot.x, slot.z],
      radius,
      floatY: slot.floatY,
      palette: e.biomeTheme,
      broken: e.status === "Slashed",
      ring: slot.ring,
    };
  });
}

// Top surface height of the raised central plateau (citadel base height).
export function islandTopY(floatY: number): number {
  return floatY + 5 * VOXEL_H;
}

export interface IslandTile {
  dx: number;
  dz: number;
  height: number;
  rune: boolean;
}

// Procedurally generate an island's voxel tiles from its biome seed.
export function generateIslandTiles(radius: number, seed: number): IslandTile[] {
  const tiles: IslandTile[] = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.hypot(dx, dz);
      if (dist > radius + 0.35) continue;

      const n = fbm((dx + 40) * 0.19, (dz + 40) * 0.19, seed, 4);
      let height = 1 + Math.round(n * 5); // stepped elevation

      // Cliff drops toward the coast.
      if (dist > radius - 1) height = Math.max(1, height - 3);
      else if (dist > radius - 2) height = Math.max(1, height - 1);

      // Raised central plateau for the citadel.
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) height = 5;

      // Glowing rune tiles: a sparse deterministic set of emissive markers.
      const runeNoise = fbm((dx - 12) * 0.33, (dz + 5) * 0.33, seed + 71, 2);
      const rune = runeNoise > 0.74 && dist < radius - 0.5 && height >= 2;

      tiles.push({ dx, dz, height, rune });
    }
  }
  return tiles;
}
