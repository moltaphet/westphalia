"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ISLANDS, TILE, islandById, islandTopY } from "@/lib/world";

function endpoint(id: string): THREE.Vector3 {
  const isl = islandById(id)!;
  return new THREE.Vector3(isl.center[0] * TILE, islandTopY(isl) - 0.4, isl.center[1] * TILE);
}

// A single causeway between the Geneva hub and an island. Intact links carry
// kinetic data particles; the rogue containment link is severed with a gap.
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
      // Data packets vanish at the break on a severed link.
      if (broken && phase > 0.42 && phase < 0.58) phase = 0.42;
      const p = curve.getPoint(phase);
      child.position.copy(p);
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = broken && phase >= 0.42 && phase <= 0.42 ? 0.2 : 1;
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

      {/* Broken-link spark cluster at the severed midpoint. */}
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
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function Causeways() {
  const hub = endpoint("central");
  return (
    <group>
      {ISLANDS.filter((i) => i.id !== "central").map((isl) => (
        <Causeway
          key={isl.id}
          from={hub}
          to={endpoint(isl.id)}
          color={isl.broken ? "#ef4444" : isl.palette.accent}
          broken={!!isl.broken}
        />
      ))}
    </group>
  );
}
