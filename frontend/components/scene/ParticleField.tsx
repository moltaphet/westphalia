"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// A glowing data-particle cloud: microscopic nodes drifting softly along the
// Y and Z axes to give the scene volumetric atmospheric depth.
export default function ParticleField({ count = 1500 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  const { positions, driftY, driftZ } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const driftY = new Float32Array(count);
    const driftZ = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 26 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
      driftY[i] = 0.12 + Math.random() * 0.4;
      driftZ[i] = (Math.random() - 0.5) * 0.3;
    }
    return { positions, driftY, driftZ };
  }, [count]);

  useFrame((_, delta) => {
    const geo = points.current?.geometry;
    if (!geo) return;
    const arr = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += driftY[i] * delta;
      arr[i * 3 + 2] += driftZ[i] * delta;
      if (arr[i * 3 + 1] > 24) arr[i * 3 + 1] = -2;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#67e8f9"
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
