"use client";

import { Html } from "@react-three/drei";
import type { Sovereignty } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/board";
import { ISLANDS, TILE, islandTopY } from "@/lib/world";

// Floating tactical labels over each island: name and sector hazard readout.
export default function IslandLabels({
  sovereignties,
}: {
  sovereignties: Sovereignty[];
}) {
  return (
    <>
      {ISLANDS.map((isl) => {
        const sov = isl.sovereigntyId
          ? sovereignties.find((s) => s.id === isl.sovereigntyId)
          : undefined;
        const hazard = sov?.hazardPct ?? 0;
        const color = sov ? STATUS_COLOR[sov.status] : "#22d3ee";
        const y = islandTopY(isl) + 4.2;
        return (
          <Html
            key={isl.id}
            center
            distanceFactor={18}
            position={[isl.center[0] * TILE, y, isl.center[1] * TILE]}
            pointerEvents="none"
          >
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                whiteSpace: "nowrap",
                textAlign: "center",
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontSize: 9, letterSpacing: 2, color, textShadow: `0 0 8px ${color}` }}>
                {isl.name.toUpperCase()}
              </div>
              {sov ? (
                <div style={{ fontSize: 8, color: "#94a3b8", letterSpacing: 1 }}>
                  HAZARD {hazard}%
                </div>
              ) : (
                <div style={{ fontSize: 8, color: "#94a3b8", letterSpacing: 1 }}>
                  NEUTRAL HUB
                </div>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}
