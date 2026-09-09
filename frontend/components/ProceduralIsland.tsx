"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Instances, Instance, Html } from "@react-three/drei";
import type { AgentEnclave } from "@/lib/types";
import type { IslandLayout } from "@/lib/world";
import { generateIslandTiles, islandTopY, TILE } from "@/lib/world";
import { VOXEL_H, STATUS_COLOR, STATUS_LABEL } from "@/lib/board";
import Citadel from "./scene/Citadel";
import DisputeDome from "./scene/DisputeDome";
import ContainmentGrid from "./scene/ContainmentGrid";

interface Props {
  enclave: AgentEnclave;
  layout: IslandLayout;
  active: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

function tileColor(
  height: number,
  radius: number,
  palette: { base: string; ridge: string },
  status: string
): THREE.Color {
  const c = new THREE.Color(palette.base);
  // Taller voxels lean toward the ridge tint (cliffs / peaks).
  c.lerp(new THREE.Color(palette.ridge), Math.min(1, height / (radius + 3)));
  if (status === "Slashed") c.lerp(new THREE.Color("#ef4444"), 0.22).multiplyScalar(0.55);
  else if (status === "Contested") c.lerp(new THREE.Color("#f59e0b"), 0.14);
  c.multiplyScalar(0.68 + height * 0.05);
  return c;
}

// Procedurally generated floating voxel island with a citadel on top. Uses
// two InstancedMesh groups (terrain + glowing runes) for 60fps at scale.
export default function ProceduralIsland({
  enclave,
  layout,
  active,
  onHover,
  onSelect,
}: Props) {
  const [cx, cz] = layout.center;
  const status = enclave.status;
  const statusColor = STATUS_COLOR[status];

  const tiles = useMemo(
    () => generateIslandTiles(layout.radius, enclave.biomeTheme.elevationSeed),
    [layout.radius, enclave.biomeTheme.elevationSeed]
  );

  const terrain = useMemo(
    () =>
      tiles.map((t) => {
        const h = t.height * VOXEL_H;
        return {
          key: `${t.dx}-${t.dz}`,
          color: tileColor(t.height, layout.radius, enclave.biomeTheme, status),
          x: (cx + t.dx) * TILE,
          z: (cz + t.dz) * TILE,
          y: layout.floatY + h / 2,
          h,
          rune: t.rune,
          top: layout.floatY + h,
        };
      }),
    [tiles, cx, cz, layout.floatY, layout.radius, enclave.biomeTheme, status]
  );

  const runes = useMemo(() => terrain.filter((t) => t.rune), [terrain]);
  const baseY = islandTopY(layout.floatY);

  return (
    <group>
      {/* Floating keel */}
      <mesh position={[cx * TILE, layout.floatY - 1.6, cz * TILE]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[layout.radius * 0.85, 4.2, 6]} />
        <meshStandardMaterial
          color={new THREE.Color(enclave.biomeTheme.base).multiplyScalar(0.35)}
          roughness={0.9}
          flatShading
        />
      </mesh>

      {/* Terrain voxels */}
      <Instances limit={terrain.length} range={terrain.length} castShadow receiveShadow>
        <boxGeometry args={[TILE * 0.96, 1, TILE * 0.96]} />
        <meshStandardMaterial roughness={0.82} metalness={0.08} />
        {terrain.map((t) => (
          <Instance
            key={t.key}
            position={[t.x, t.y + (active ? 0.2 : 0), t.z]}
            scale={[1, t.h, 1]}
            color={active ? t.color.clone().multiplyScalar(1.4) : t.color}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHover(enclave.id);
            }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(enclave.id);
            }}
          />
        ))}
      </Instances>

      {/* Glowing rune tiles */}
      {runes.length > 0 && (
        <Instances limit={runes.length} range={runes.length}>
          <boxGeometry args={[TILE * 0.5, 0.08, TILE * 0.5]} />
          <meshStandardMaterial
            color={enclave.biomeTheme.accent}
            emissive={enclave.biomeTheme.accent}
            emissiveIntensity={2.4}
          />
          {runes.map((t) => (
            <Instance key={`rune-${t.key}`} position={[t.x, t.top + (active ? 0.2 : 0) + 0.06, t.z]} />
          ))}
        </Instances>
      )}

      {/* Citadel + status overlays */}
      <Citadel
        id={enclave.id}
        tint={enclave.biomeTheme.accent}
        statusColor={statusColor}
        position={[cx * TILE, cz * TILE]}
        baseY={baseY}
        active={active}
        onHover={onHover}
        onSelect={onSelect}
      />
      {status === "Contested" && (
        <DisputeDome position={[cx * TILE, cz * TILE]} baseY={baseY} nodes={enclave.treaties.length + 3} />
      )}
      {status === "Slashed" && <ContainmentGrid position={[cx * TILE, cz * TILE]} baseY={baseY} />}

      {/* Floating label with sector hazard */}
      <Html center distanceFactor={20} position={[cx * TILE, baseY + 4.4, cz * TILE]} pointerEvents="none">
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "nowrap",
            textAlign: "center",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 9, letterSpacing: 2, color: statusColor, textShadow: `0 0 8px ${statusColor}` }}>
            {enclave.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 8, color: "#94a3b8", letterSpacing: 1 }}>
            {STATUS_LABEL[status]} - HAZARD {enclave.hazardPct}%
          </div>
        </div>
      </Html>
    </group>
  );
}
