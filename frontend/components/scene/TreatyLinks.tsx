"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Treaty } from "@/lib/types";
import type { IslandLayout } from "@/lib/world";
import { TILE, islandTopY } from "@/lib/world";
import TreatyArc from "./TreatyArc";

interface Props {
  treaties: Treaty[];
  layouts: IslandLayout[];
  focusId: string | null; // hovered or selected enclave
  selectedTreaty: string | null;
  onSelectTreaty: (id: string) => void;
}

// Focused treaty rendering: by default show active alliances and active
// dispute arcs; when an enclave is focused, dim links not connected to it.
export default function TreatyLinks({
  treaties,
  layouts,
  focusId,
  selectedTreaty,
  onSelectTreaty,
}: Props) {
  // Memoized endpoint vectors so hover-driven board re-renders never rebuild
  // the treaty curves (each rebuild reconstructs every tube geometry).
  const byId = useMemo(() => {
    const m = new Map<string, IslandLayout>();
    for (const l of layouts) m.set(l.id, l);
    return m;
  }, [layouts]);

  const tops = useMemo(() => {
    const m = new Map<string, THREE.Vector3>();
    for (const l of layouts) {
      m.set(
        l.id,
        new THREE.Vector3(
          l.center[0] * TILE,
          islandTopY(l.floatY) + 2.55,
          l.center[1] * TILE
        )
      );
    }
    return m;
  }, [layouts]);

  return (
    <group>
      {treaties.map((t) => {
        if (t.status === "resolved") return null; // only alliances + disputes
        const la = byId.get(t.parties[0]);
        const lb = byId.get(t.parties[1]);
        const a = tops.get(t.parties[0]);
        const b = tops.get(t.parties[1]);
        if (!la || !lb || !a || !b) return null;

        // Sleek tactical palette: emerald alliance, electric cyan trade,
        // focused amber for links under active review.
        const underReview = t.status === "pending" || t.status === "breached";
        const color = underReview
          ? "#f59e0b"
          : t.kind === "trade"
          ? "#06b6d4"
          : "#10b981";

        // Context-aware focus: 40% when nothing is selected, 100% for
        // connected vectors, 15% for unrelated ones.
        const opacity = !focusId ? 0.4 : t.parties.includes(focusId) ? 1 : 0.15;

        return (
          <TreatyArc
            key={t.id}
            a={a}
            b={b}
            color={color}
            selected={t.id === selectedTreaty}
            opacity={opacity}
            onSelect={() => onSelectTreaty(t.id)}
          />
        );
      })}
    </group>
  );
}
