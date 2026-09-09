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
      child.position.copy(curve.getPoint(phase));
    });
  });

  const deck = useMemo(() => {
    if (!broken) return [{ t0: 0, t1: 1 }];
    return [
      { t0: 0, t1: 0.42 },
      { t0: 0.58, t1: 1 },
    ];
  }, [broken]);

  return (
    <group>
      {deck.map((seg, i) => {
        const sub = new THREE.QuadraticBezierCurve3(
          curve.getPoint(seg.t0),
          curve.getPoint((seg.t0 + seg.t1) / 2).add(new THREE.Vector3(0, 0.3, 0)),
          curve.getPoint(seg.t1)
        );
        return (
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
        );
      })}

      {broken && (
        <mesh position={curve.getPoint(0.5)}>
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
  const hub = new THREE.Vector3(HUB.center[0] * TILE, islandTopY(HUB.floatY) - 0.4, HUB.center[1] * TILE);
  return (
    <group>
      {layouts.map((l) => (
        <Causeway
          key={l.id}
          from={hub}
          to={new THREE.Vector3(l.center[0] * TILE, islandTopY(l.floatY) - 0.4, l.center[1] * TILE)}
          color={l.broken ? "#ef4444" : l.palette.accent}
          broken={l.broken}
        />
      ))}
    </group>
  );
}
