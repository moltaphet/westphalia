"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Treaty } from "@/lib/types";
import type { IslandLayout } from "@/lib/world";
import { KIND_COLOR } from "@/lib/board";
import { TILE, islandTopY } from "@/lib/world";

function Beam({
  treaty,
  a,
  b,
  color,
  radius,
  opacity,
  onSelect,
}: {
  treaty: Treaty;
  a: THREE.Vector3;
  b: THREE.Vector3;
  color: string;
  radius: number;
  opacity: number;
  onSelect: (id: string) => void;
}) {
  const particles = useRef<THREE.Group>(null);

  const curve = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += a.distanceTo(b) * 0.32 + 1.2;
    return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  }, [a, b]);

  useFrame((state) => {
    if (!particles.current) return;
    const t = state.clock.elapsedTime;
    particles.current.children.forEach((child, i) => {
      const phase = (t * 0.35 + i / particles.current!.children.length) % 1;
      child.position.copy(curve.getPoint(phase));
    });
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(treaty.id); }}>
      <mesh>
        <tubeGeometry args={[curve, 40, radius, 8, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.2}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      {opacity > 0.4 && (
        <group ref={particles}>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={opacity} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

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

        const isDispute = t.status === "pending" || t.status === "breached";
        const baseColor = isDispute
          ? t.status === "breached"
            ? "#ef4444"
            : "#f59e0b"
          : KIND_COLOR[t.kind] ?? "#22d3ee";

        const connected = !focusId || t.parties.includes(focusId);
        const selected = t.id === selectedTreaty;
        const opacity = connected ? 0.92 : 0.1;
        const radius = selected ? 0.06 : isDispute ? 0.03 : 0.04;

        return (
          <Beam
            key={t.id}
            treaty={t}
            a={top(la)}
            b={top(lb)}
            color={baseColor}
            radius={connected ? radius + (selected ? 0.02 : 0) : 0.02}
            opacity={opacity}
            onSelect={onSelectTreaty}
          />
        );
      })}
    </group>
  );
}
