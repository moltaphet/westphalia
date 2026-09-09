"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Ambient "data dust": a subtle drifting particle grid across the isometric
// plane that adds depth without competing with the treaty visuals.
export default function ParticleField({ count = 420 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 9 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      speeds[i] = 0.15 + Math.random() * 0.35;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((_, delta) => {
    const geo = points.current?.geometry;
    if (!geo) return;
    const arr = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      if (arr[i * 3 + 1] > 10) arr[i * 3 + 1] = 0.5;
    }
    geo.attributes.position.needsUpdate = true;
    if (points.current) points.current.rotation.y += delta * 0.01;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#38bdf8"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
