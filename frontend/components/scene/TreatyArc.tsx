"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const PHOTONS = 4; // discrete kinetic data packets per vector

// A precision-engineered tactical treaty vector: a razor-thin additive laser
// line following a low-profile quadratic Bezier, with a few crisp photon
// pulses gliding from source to destination at a uniform speed.
export default function TreatyArc({
  a,
  b,
  color,
  selected,
  opacity,
  onSelect,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  color: string;
  selected: boolean;
  opacity: number;
  onSelect: () => void;
}) {
  const photons = useRef<THREE.Group>(null);

  const curve = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    // Subtle, distance-proportional lift to avoid towering or chaotic loops.
    mid.y += a.distanceTo(b) * 0.18 + 2.5;
    return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  }, [a, b]);

  useFrame((state) => {
    if (!photons.current) return;
    const t = state.clock.elapsedTime;
    const n = photons.current.children.length;
    photons.current.children.forEach((child, i) => {
      const phase = (t * 0.28 + i / n) % 1;
      child.position.copy(curve.getPoint(phase));
    });
  });

  const lit = opacity > 0.5;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Razor-thin primary laser line */}
      <mesh>
        <tubeGeometry args={[curve, 40, selected ? 0.055 : 0.04, 6, false]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Precision photon pulses (only on lit vectors to keep the map clean) */}
      {lit && (
        <group ref={photons}>
          {Array.from({ length: PHOTONS }).map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial
                color="#ffffff"
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
