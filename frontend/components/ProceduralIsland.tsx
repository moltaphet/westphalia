"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance, Html } from "@react-three/drei";
import type { AgentEnclave } from "@/lib/types";
import type { IslandLayout } from "@/lib/world";
import { generateIslandTiles, islandTopY, TILE } from "@/lib/world";
import { VOXEL_H, STATUS_COLOR, STATUS_LABEL } from "@/lib/board";
import Citadel from "./scene/Citadel";
import DisputeDome from "./scene/DisputeDome";
import ContainmentGrid from "./scene/ContainmentGrid";
import TreatyMotes from "./scene/TreatyMotes";

interface Props {
  enclave: AgentEnclave;
  layout: IslandLayout;
  active: boolean;
  showLabel: boolean;
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
  showLabel,
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

  // Pre-brightened colors for the selected/hovered state, so the render body
  // never clones a THREE.Color per tile per frame.
  const brightened = useMemo(
    () => terrain.map((t) => t.color.clone().multiplyScalar(1.4)),
    [terrain]
  );
  const keelColor = useMemo(
    () => new THREE.Color(enclave.biomeTheme.base).multiplyScalar(0.35),
    [enclave.biomeTheme.base]
  );

  const runes = useMemo(() => terrain.filter((t) => t.rune), [terrain]);
  const baseY = islandTopY(layout.floatY);

  // Procedural spawn FX: newly founded realms rise from y = -20 to 0 while an
  // expanding neon shockwave ring sweeps outward.
  const SPAWN_MS = 1600;
  const rise = useRef<THREE.Group>(null);
  const shock = useRef<THREE.Mesh>(null);
  const spawning = useRef(enclave.spawnedAt !== undefined);

  useFrame(() => {
    if (!spawning.current || !enclave.spawnedAt) return;
    const t = Math.min(1, (Date.now() - enclave.spawnedAt) / SPAWN_MS);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    if (rise.current) rise.current.position.y = -20 * (1 - ease);
    if (shock.current) {
      const s = 1 + ease * layout.radius * 2.4;
      shock.current.scale.set(s, s, s);
      const mat = shock.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.8;
    }
    if (t >= 1) spawning.current = false;
  });

  return (
    <group ref={rise}>
      {/* Spawn shockwave ring */}
      {enclave.spawnedAt !== undefined && (
        <mesh
          ref={shock}
          position={[cx * TILE, layout.floatY + 0.1, cz * TILE]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[layout.radius * 0.9, layout.radius * 1.02, 64]} />
          <meshBasicMaterial
            color={enclave.biomeTheme.accent}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Floating keel */}
      <mesh position={[cx * TILE, layout.floatY - 1.6, cz * TILE]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[layout.radius * 0.85, 4.2, 6]} />
        <meshStandardMaterial
          color={keelColor}
          roughness={0.9}
          flatShading
        />
      </mesh>

      {/* Color-matched citadel point light picking out voxel specular edges. */}
      <pointLight
        position={[cx * TILE, baseY + 3, cz * TILE]}
        color={enclave.biomeTheme.accent}
        intensity={1.4}
        distance={18}
        decay={2}
      />

      {/* Terrain voxels */}
      <Instances limit={terrain.length} range={terrain.length} castShadow receiveShadow>
        <boxGeometry args={[TILE * 0.96, 1, TILE * 0.96]} />
        <meshStandardMaterial roughness={0.45} metalness={0.35} />
        {terrain.map((t, i) => (
          <Instance
            key={t.key}
            position={[t.x, t.y + (active ? 0.2 : 0), t.z]}
            scale={[1, t.h, 1]}
            color={active ? brightened[i] : t.color}
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
        archetype={enclave.archetype}
        position={[cx * TILE, cz * TILE]}
        baseY={baseY}
        active={active}
        reputation={enclave.reputation}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* One orbiting mote per active treaty */}
      <TreatyMotes
        count={enclave.treaties.length}
        color={statusColor}
        center={[cx * TILE, cz * TILE]}
        baseY={baseY}
      />
      {status === "Contested" && (
        <DisputeDome position={[cx * TILE, cz * TILE]} baseY={baseY} nodes={enclave.treaties.length + 3} />
      )}
      {status === "Slashed" && <ContainmentGrid position={[cx * TILE, cz * TILE]} baseY={baseY} />}

      {/* Sovereignty nameplate: a leader line rises from the citadel crest to
          a floating chip positioned clearly ABOVE the agent's head, so names
          never visually merge with the island geometry. */}
      {showLabel && (
        <>
          <mesh position={[cx * TILE, baseY + 5.15, cz * TILE]}>
            <cylinderGeometry args={[0.015, 0.015, 1.0, 6]} />
            <meshBasicMaterial
              color={statusColor}
              transparent
              opacity={active ? 0.85 : 0.5}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[cx * TILE, baseY + 5.65, cz * TILE]} rotation={[0, Math.PI / 4, 0]}>
            <planeGeometry args={[0.12, 0.12]} />
            <meshBasicMaterial
              color={statusColor}
              transparent
              opacity={active ? 0.95 : 0.7}
              depthWrite={false}
            />
          </mesh>
          <Html
            center
            distanceFactor={20}
            position={[cx * TILE, baseY + 6.35, cz * TILE]}
            pointerEvents="none"
            zIndexRange={[0, 10]}
          >
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                whiteSpace: "nowrap",
                textAlign: "center",
                userSelect: "none",
                pointerEvents: "none",
                background: "rgba(9, 9, 11, 0.78)",
                border: `1px solid ${statusColor}66`,
                borderRadius: 4,
                padding: "4px 9px",
                boxShadow: `0 0 12px ${statusColor}33`,
                backdropFilter: "blur(2px)",
                opacity: active ? 1 : 0.92,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: statusColor,
                  textShadow: `0 0 8px ${statusColor}`,
                }}
              >
                {enclave.name.toUpperCase()}
              </div>
              <div style={{ fontSize: 8, color: "#94a3b8", letterSpacing: 1, marginTop: 2 }}>
                {STATUS_LABEL[status]} - HAZARD {enclave.hazardPct}%
              </div>
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
