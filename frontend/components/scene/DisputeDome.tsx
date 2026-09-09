"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
// Pulsing holographic amber dome marking a territory under active
// GenLayer multi-LLM validator consensus.
export default function DisputeDome({
  position,
  baseY,
  nodes = 5,
}: {
  position: [number, number];
  baseY: number;
  nodes?: number;
}) {
  const dome = useRef<THREE.Mesh>(null);
  const validators = useRef<THREE.Group>(null);
  const [x, z] = position;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (dome.current) {
      const mat = dome.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.16 + Math.sin(t * 2.2) * 0.08;
      dome.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.03);
    }
    if (validators.current) validators.current.rotation.y = t * 0.6;
  });

  return (
    <group position={[x, baseY, z]}>
      <mesh ref={dome}>
        <sphereGeometry args={[2.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.9}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Orbiting validator nodes representing the empaneled LLM validators. */}
      <group ref={validators} position={[0, 2.2, 0]}>
        {Array.from({ length: nodes }).map((_, i, arr) => {
          const a = (i / arr.length) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2]}>
              <boxGeometry args={[0.16, 0.16, 0.16]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
