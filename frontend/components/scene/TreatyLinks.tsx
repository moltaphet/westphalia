"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Treaty } from "@/lib/types";
import type { IslandLayout } from "@/lib/world";
import { KIND_COLOR } from "@/lib/board";
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
  const byId = useMemo(() => {
    const m = new Map<string, IslandLayout>();
    for (const l of layouts) m.set(l.id, l);
    return m;
  }, [layouts]);

  const top = (l: IslandLayout) =>
    new THREE.Vector3(l.center[0] * TILE, islandTopY(l.floatY) + 2.55, l.center[1] * TILE);

  return (
    <group>
      {treaties.map((t) => {
        if (t.status === "resolved") return null; // only alliances + disputes
        const la = byId.get(t.parties[0]);
        const lb = byId.get(t.parties[1]);
        if (!la || !lb) return null;

        const dispute = t.status === "pending" || t.status === "breached";
        const color = dispute
          ? t.status === "breached"
            ? "#ef4444"
            : "#f59e0b"
          : KIND_COLOR[t.kind] ?? "#22d3ee";

        const connected = !focusId || t.parties.includes(focusId);
        const opacity = connected ? 0.95 : 0.12;

        return (
          <TreatyArc
            key={t.id}
            a={top(la)}
            b={top(lb)}
            color={color}
            dispute={dispute}
            selected={t.id === selectedTreaty}
            opacity={opacity}
            onSelect={() => onSelectTreaty(t.id)}
          />
        );
      })}
    </group>
  );
}
