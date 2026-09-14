// Archetype presentation presets, shared by the found-realm modal, the runtime
// store, and the on-chain state mapper.
//
// This lives outside `store.ts` so `chainState.ts` can derive an enclave's
// biome from its on-chain archetype without importing the store (which imports
// chainState back, and would close a cycle).

import type { Archetype, BiomeTheme } from "./types";

export const ARCHETYPE_PRESETS: Record<
  Archetype,
  { biome: Omit<BiomeTheme, "elevationSeed">; yieldApr: number; blurb: string }
> = {
  "Autonomous Arbiter": {
    biome: { base: "#047857", ridge: "#065f46", accent: "#34d399" },
    yieldApr: 3.6,
    blurb: "Impartial dispute adjudication and treaty parsing.",
  },
  "Liquidity Nexus": {
    biome: { base: "#6d28d9", ridge: "#4c1d95", accent: "#a78bfa" },
    yieldApr: 5.4,
    blurb: "Cross-border settlement and market-making corridors.",
  },
  "Oracle Collective": {
    biome: { base: "#0e7490", ridge: "#334155", accent: "#22d3ee" },
    yieldApr: 4.1,
    blurb: "High-uptime data ingestion and attestation.",
  },
  "Defense Vanguard": {
    biome: { base: "#7c2d12", ridge: "#3f1d1d", accent: "#fb7185" },
    yieldApr: 2.8,
    blurb: "Perimeter defense and containment enforcement.",
  },
};

export const ARCHETYPES = Object.keys(ARCHETYPE_PRESETS) as Archetype[];

// The contract stores "Defense Vanguard" style free text, but a realm founded
// on an older deployment (or by hand) can carry any string. Fall back rather
// than emit an undefined preset.
export function presetFor(archetype: string): (typeof ARCHETYPE_PRESETS)[Archetype] {
  return (
    ARCHETYPE_PRESETS[archetype as Archetype] ??
    ARCHETYPE_PRESETS["Autonomous Arbiter"]
  );
}

// Deterministic terrain seed from an address, so an enclave keeps the same
// island relief across reloads and across every viewer.
export function elevationSeedFor(address: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < address.length; i++) {
    h ^= address.toLowerCase().charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 10000;
}
