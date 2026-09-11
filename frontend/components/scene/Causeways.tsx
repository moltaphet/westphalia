"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { IslandLayout } from "@/lib/world";
import { HUB, TILE, islandTopY } from "@/lib/world";

// A single causeway between the Geneva hub and an island. Intact links carry
// kinetic data particles; slashed enclaves have a severed link with a gap.
function Causeway({
  from,
  to,
  color,
  broken,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  broken: boolean;
}) {
  const particles = useRef<THREE.Group>(null);
  // Reused getPoint target: no per-frame Vector3 allocation in the hot loop.
  const pt = useRef(new THREE.Vector3());

  const curve = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 2.4;
    return new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
  }, [from, to]);

  useFrame((state) => {
    if (!particles.current) return;
    const t = state.clock.elapsedTime;
    particles.current.children.forEach((child, i) => {
      let phase = (t * 0.28 + i / particles.current!.children.length) % 1;
      if (broken && phase > 0.42 && phase < 0.58) phase = 0.42;
      child.position.copy(curve.getPoint(phase, pt.current));
    });
  });

  // Deck sub-curves memoized: recreating them in the render body would give
  // tubeGeometry new args on every re-render and rebuild every tube.
  const deck = useMemo(() => {
    const segment = (t0: number, t1: number) => {
      const mid = curve.getPoint((t0 + t1) / 2).add(new THREE.Vector3(0, 0.3, 0));
      return new THREE.QuadraticBezierCurve3(
        curve.getPoint(t0),
        mid,
        curve.getPoint(t1)
      );
    };
    if (!broken) return [segment(0, 1)];
    return [segment(0, 0.42), segment(0.58, 1)];
  }, [curve, broken]);

  const breakPoint = useMemo(
    () => (broken ? curve.getPoint(0.5) : null),
    [broken, curve]
  );

  return (
    <group>
      {deck.map((sub, i) => (
        <mesh key={i}>
          <tubeGeometry args={[sub, 24, 0.06, 8, false]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={broken ? 1.2 : 2}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {breakPoint && (
        <mesh position={breakPoint}>
          <icosahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3} wireframe />
        </mesh>
      )}

      <group ref={particles}>
        {Array.from({ length: broken ? 3 : 5 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function Causeways({ layouts }: { layouts: IslandLayout[] }) {
  // Memoized so hover-driven board re-renders never rebuild the hub vector or
  // the per-island endpoints (each change would rebuild every curve + tube).
  const hub = useMemo(
    () => new THREE.Vector3(HUB.center[0] * TILE, islandTopY(HUB.floatY) - 0.4, HUB.center[1] * TILE),
    []
  );
  const endpoints = useMemo(
    () =>
      layouts.map((l) => ({
        layout: l,
        to: new THREE.Vector3(l.center[0] * TILE, islandTopY(l.floatY) - 0.4, l.center[1] * TILE),
      })),
    [layouts]
  );
  return (
    <group>
      {endpoints.map(({ layout, to }) => (
        <Causeway
          key={layout.id}
          from={hub}
          to={to}
          color={layout.broken ? "#ef4444" : layout.palette.accent}
          broken={layout.broken}
        />
      ))}
    </group>
  );
}
