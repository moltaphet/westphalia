"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Sovereignty, Treaty } from "@/lib/types";
import { KIND_COLOR } from "@/lib/board";
import { TILE, islandForSovereignty, islandTopY } from "@/lib/world";

function citadelTop(s: Sovereignty): THREE.Vector3 {
  const isl = islandForSovereignty(s.id);
  if (!isl) return new THREE.Vector3(0, 4, 0);
  return new THREE.Vector3(
    isl.center[0] * TILE,
    islandTopY(isl) + 2.55,
    isl.center[1] * TILE
  );
}

function Beam({
  treaty,
  a,
  b,
  active,
  onSelect,
}: {
  treaty: Treaty;
  a: THREE.Vector3;
  b: THREE.Vector3;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const particles = useRef<THREE.Group>(null);
  const color = KIND_COLOR[treaty.kind] ?? "#22d3ee";

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
      const p = curve.getPoint(phase);
      child.position.copy(p);
    });
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(treaty.id); }}>
      <mesh>
        <tubeGeometry args={[curve, 40, active ? 0.055 : 0.03, 8, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 2.4 : 1.4}
          transparent
          opacity={0.9}
        />
      </mesh>
      <group ref={particles}>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

interface Props {
  treaties: Treaty[];
  sovereignties: Sovereignty[];
  selectedTreaty: string | null;
  onSelectTreaty: (id: string) => void;
}

export default function TreatyLinks({
  treaties,
  sovereignties,
  selectedTreaty,
  onSelectTreaty,
}: Props) {
  const byId = useMemo(() => {
    const m = new Map<string, Sovereignty>();
    for (const s of sovereignties) m.set(s.id, s);
    return m;
  }, [sovereignties]);

  return (
    <group>
      {treaties
        .filter((t) => t.status === "active")
        .map((t) => {
          const sa = byId.get(t.parties[0]);
          const sb = byId.get(t.parties[1]);
          if (!sa || !sb) return null;
          return (
            <Beam
              key={t.id}
              treaty={t}
              a={citadelTop(sa)}
              b={citadelTop(sb)}
              active={selectedTreaty === t.id}
              onSelect={onSelectTreaty}
            />
          );
        })}
    </group>
  );
}
