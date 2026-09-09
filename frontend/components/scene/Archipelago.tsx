"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import type { Sovereignty } from "@/lib/types";
import { TILE, VOXEL_H } from "@/lib/board";
import { ISLANDS } from "@/lib/world";

interface Props {
  tiles: {
    wx: number;
    wz: number;
    height: number;
    biome: string;
    islandId: string;
    baseY: number;
  }[];
  sovereignties: Sovereignty[];
  hoveredZone: string | null;
  selectedZone: string | null;
  onHoverZone: (id: string | null) => void;
  onSelectZone: (id: string | null) => void;
}

function tileColor(
  biome: string,
  palette: { base: string; ridge: string; accent: string },
  status: string | null,
  height: number
): THREE.Color {
  const c = new THREE.Color(palette.base);

  switch (biome) {
    case "river":
      c.lerp(new THREE.Color("#0ea5e9"), 0.55);
      break;
    case "mountain":
      c.lerp(new THREE.Color(palette.ridge), 0.7).lerp(new THREE.Color("#e2e8f0"), 0.2);
      break;
    case "core":
      c.lerp(new THREE.Color(palette.accent), 0.4);
      break;
    default:
      c.lerp(new THREE.Color(palette.ridge), 0.3);
      break;
  }

  if (status === "slashed") {
    c.lerp(new THREE.Color("#ef4444"), 0.25).multiplyScalar(0.55);
  } else if (status === "disputed") {
    c.lerp(new THREE.Color("#f59e0b"), 0.16);
  }

  c.multiplyScalar(0.7 + height * 0.05);
  return c;
}

export default function Archipelago({
  tiles,
  sovereignties,
  hoveredZone,
  selectedZone,
  onHoverZone,
  onSelectZone,
}: Props) {
  const sovMap = useMemo(() => {
    const m = new Map<string, Sovereignty>();
    for (const s of sovereignties) m.set(s.id, s);
    return m;
  }, [sovereignties]);

  const islandMap = useMemo(() => {
    const m = new Map<string, (typeof ISLANDS)[number]>();
    for (const i of ISLANDS) m.set(i.id, i);
    return m;
  }, []);

  const computed = useMemo(() => {
    return tiles.map((t) => {
      const isl = islandMap.get(t.islandId)!;
      const sov = isl.sovereigntyId ? sovMap.get(isl.sovereigntyId) : undefined;
      const color = tileColor(t.biome, isl.palette, sov?.status ?? null, t.height);
      const h = t.height * VOXEL_H;
      return {
        key: `${t.wx}-${t.wz}`,
        color,
        x: t.wx * TILE,
        z: t.wz * TILE,
        y: t.baseY + h / 2,
        h,
        zoneId: isl.sovereigntyId,
      };
    });
  }, [tiles, islandMap, sovMap]);

  return (
    <group>
      {/* Floating keels beneath each island for the archipelago silhouette. */}
      {ISLANDS.map((isl) => (
        <mesh
          key={`keel-${isl.id}`}
          position={[isl.center[0] * TILE, isl.floatY - 1.6, isl.center[1] * TILE]}
          rotation={[Math.PI, 0, 0]}
        >
          <coneGeometry args={[isl.radius * 0.85, 4.2, 6]} />
          <meshStandardMaterial
            color={new THREE.Color(isl.palette.base).multiplyScalar(0.35)}
            roughness={0.9}
            metalness={0.1}
            flatShading
          />
        </mesh>
      ))}

      <Instances limit={computed.length} range={computed.length} castShadow receiveShadow>
        <boxGeometry args={[TILE * 0.96, 1, TILE * 0.96]} />
        <meshStandardMaterial roughness={0.82} metalness={0.08} />
        {computed.map(({ key, color, x, y, z, h, zoneId }) => {
          const active =
            zoneId !== null && (zoneId === hoveredZone || zoneId === selectedZone);
          const lift = active ? 0.2 : 0;
          return (
            <Instance
              key={key}
              position={[x, y + lift, z]}
              scale={[1, h, 1]}
              color={active ? color.clone().multiplyScalar(1.4) : color}
              onPointerOver={(e) => {
                e.stopPropagation();
                onHoverZone(zoneId);
              }}
              onPointerOut={() => onHoverZone(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectZone(zoneId);
              }}
            />
          );
        })}
      </Instances>
    </group>
  );
}
