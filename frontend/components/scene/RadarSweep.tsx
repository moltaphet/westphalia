"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WORLD_EXTENT } from "@/lib/world";

// A tactical radar sweep and range rings spanning the whole archipelago.
export default function RadarSweep() {
  const sweep = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (sweep.current) sweep.current.rotation.z -= delta * 0.35;
  });

  const R = WORLD_EXTENT + 4;

  return (
    <group position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Static range rings */}
      {[0.35, 0.6, 0.85, 1].map((f, i) => (
        <mesh key={i}>
          <ringGeometry args={[R * f - 0.06, R * f, 96]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Rotating sweep sector */}
      <group ref={sweep}>
        <mesh>
          <circleGeometry args={[R, 48, 0, Math.PI / 5]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[R / 2, 0, 0]}>
          <planeGeometry args={[R, 0.06]} />
          <meshBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
