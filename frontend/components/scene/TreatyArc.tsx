"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const PARTICLES = 26;

// A dynamic glowing data conduit between two citadels: an additive emissive
// tube plus a stream of particle sprites flowing toward the destination.
// Dispute links (amber/red) get an electric jitter on the whole arc.
export default function TreatyArc({
  a,
  b,
  color,
  dispute,
  selected,
  opacity,
  onSelect,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  color: string;
  dispute: boolean;
  selected: boolean;
  opacity: number;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Group>(null);

  const curve = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += a.distanceTo(b) * 0.32 + 1.4;
    return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  }, [a, b]);

  const speed = dispute ? 0.5 : 0.32;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (particles.current) {
      const n = particles.current.children.length;
      particles.current.children.forEach((child, i) => {
        const phase = (t * speed + i / n) % 1;
        child.position.copy(curve.getPoint(phase));
      });
    }
    // Electric glitch vibration for contested / breached links.
    if (group.current) {
      if (dispute) {
        group.current.position.set(
          (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.08
        );
      } else if (group.current.position.lengthSq() > 0) {
        group.current.position.set(0, 0, 0);
      }
    }
  });

  const visible = opacity > 0.35;

  return (
    <group ref={group} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Base emissive conduit (additive) */}
      <mesh>
        <tubeGeometry args={[curve, 48, selected ? 0.06 : 0.035, 8, false]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Flowing data particles */}
      {visible && (
        <group ref={particles}>
          {Array.from({ length: PARTICLES }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[selected ? 0.075 : 0.055, 6, 6]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={opacity}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
