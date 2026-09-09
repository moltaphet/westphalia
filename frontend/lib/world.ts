import type { Biome } from "./types";
import { VOXEL_H } from "./board";
import { fbm } from "./noise";

// World-space layout for the multi-island archipelago. Each island is a
// self-contained floating voxel continent placed around the neutral hub.

export const TILE = 1;
export const WORLD_SEED = 20260909;

export interface IslandPalette {
  base: string;
  ridge: string;
  accent: string;
}

export interface Island {
  id: string;
  name: string;
  subtitle: string;
  sovereigntyId: string | null; // null for the neutral Geneva hub
  center: [number, number]; // world (x, z)
  radius: number; // tiles
  floatY: number; // vertical hover offset
  palette: IslandPalette;
  broken?: boolean; // severed causeway (rogue containment)
}

export const ISLANDS: Island[] = [
  {
    id: "central",
    name: "The Geneva Platform",
    subtitle: "Neutral Treaty Hub",
    sovereigntyId: null,
    center: [0, 0],
    radius: 4,
    floatY: 1.4,
    palette: { base: "#1e293b", ridge: "#334155", accent: "#22d3ee" },
  },
  {
    id: "alpha",
    name: "Western Data Federation",
    subtitle: "Citadel Alpha",
    sovereigntyId: "alpha",
    center: [-26, 0],
    radius: 6,
    floatY: 0.2,
    palette: { base: "#0e7490", ridge: "#334155", accent: "#22d3ee" },
  },
  {
    id: "beta",
    name: "Vanguard Autonomous Nexus",
    subtitle: "Vanguard Nexus",
    sovereigntyId: "vanguard",
    center: [0, -26],
    radius: 6,
    floatY: 0.6,
    palette: { base: "#6d28d9", ridge: "#4c1d95", accent: "#a78bfa" },
  },
  {
    id: "gamma",
    name: "Sovereign Freeholds",
    subtitle: "Sovereign Enclave",
    sovereigntyId: "enclave",
    center: [0, 26],
    radius: 6,
    floatY: -0.2,
    palette: { base: "#047857", ridge: "#065f46", accent: "#34d399" },
  },
  {
    id: "delta",
    name: "Rogue Containment Shard",
    subtitle: "Consensus Bastion",
    sovereigntyId: "bastion",
    center: [26, 0],
    radius: 6,
    floatY: -0.8,
    palette: { base: "#1c1917", ridge: "#3f1d1d", accent: "#ef4444" },
    broken: true,
  },
];

export function islandById(id: string): Island | undefined {
  return ISLANDS.find((i) => i.id === id);
}

export function islandForSovereignty(sovereigntyId: string): Island | undefined {
  return ISLANDS.find((i) => i.sovereigntyId === sovereigntyId);
}

// World (x, z) of a citadel / hub at the center of its island.
export function islandCenterWorld(id: string): [number, number] {
  const isl = islandById(id);
  return isl ? isl.center : [0, 0];
}

// Y of the raised central plateau top for an island (citadel base height).
export function islandTopY(isl: Island): number {
  return isl.floatY + 5 * VOXEL_H;
}

export interface WorldTile {
  wx: number;
  wz: number;
  height: number;
  biome: Biome;
  islandId: string;
  baseY: number;
}

// Generate the voxel terrain for every island as absolute world tiles.
export function generateWorld(): WorldTile[] {
  const tiles: WorldTile[] = [];
  for (const isl of ISLANDS) {
    for (let dz = -isl.radius; dz <= isl.radius; dz++) {
      for (let dx = -isl.radius; dx <= isl.radius; dx++) {
        const dist = Math.hypot(dx, dz);
        if (dist > isl.radius + 0.35) continue; // rounded continent outline

        const wx = isl.center[0] + dx;
        const wz = isl.center[1] + dz;
        const n = fbm(wx * 0.16, wz * 0.16, WORLD_SEED, 4);

        let height = 1 + Math.round(n * 4);
        let biome: Biome = "plain";

        if (n > 0.72) {
          biome = "mountain";
          height = 4 + Math.round((n - 0.72) * 10);
        }
        // Coastal shelves taper toward the island edge.
        if (dist > isl.radius - 1) height = Math.max(1, height - 2);

        // Raised central plateau hosts the citadel / hub.
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
          biome = "core";
          height = 5;
        }

        // A meandering coolant channel across the larger islands.
        if (isl.radius >= 6) {
          const river = fbm(wx * 0.12 + 4.2, wz * 0.12, WORLD_SEED + 91, 2);
          if (river > 0.47 && river < 0.53 && biome === "plain") {
            biome = "river";
            height = 1;
          }
        }

        tiles.push({ wx, wz, height, biome, islandId: isl.id, baseY: isl.floatY });
      }
    }
  }
  return tiles;
}

// Overall archipelago radius, used to size the radar sweep and camera bounds.
export const WORLD_EXTENT = 34;
