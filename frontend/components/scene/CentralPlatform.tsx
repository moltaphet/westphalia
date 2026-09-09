"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

// The Geneva Platform: floating neutral assembly hub with a rotating GenLayer
// consensus core, displaying the global diplomatic escrow.
export default function CentralPlatform({
  totalEscrowGen,
  baseY = 0,
}: {
  totalEscrowGen: number;
  baseY?: number;
}) {
  const platform = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const hover = baseY + 2.7;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (platform.current) platform.current.position.y = hover + Math.sin(t * 0.8) * 0.12;
    if (rings.current) rings.current.rotation.y = t * 0.4;
    if (core.current) {
      core.current.rotation.y = t * 1.2;
      core.current.rotation.x = t * 0.5;
    }
  });

  return (
    <group ref={platform} position={[0, hover, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[1.6, 1.25, 0.3, 6]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive="#0ea5e9"
          emissiveIntensity={0.3}
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.08, 6]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.3} />
      </mesh>

      {/* Rotating GenLayer consensus core */}
      <mesh ref={core} position={[0, 0.85, 0]}>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={2.4}
          wireframe
        />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#ffffff" emissive="#a5f3fc" emissiveIntensity={3} />
      </mesh>

      <group ref={rings} position={[0, 0.85, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.9, 0.02, 8, 48]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0.4, 0]}>
          <torusGeometry args={[1.6, 0.015, 8, 48]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.3} />
        </mesh>
        <mesh rotation={[Math.PI / 3, -0.5, 0.3]}>
          <torusGeometry args={[1.3, 0.012, 8, 48]} />
          <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={1.2} />
        </mesh>
      </group>

      <Html center distanceFactor={14} position={[0, 1.9, 0]} pointerEvents="none">
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "nowrap",
            textAlign: "center",
            color: "#e2e8f0",
            textShadow: "0 0 8px rgba(34,211,238,0.8)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div style={{ fontSize: 8, letterSpacing: 2, color: "#94a3b8" }}>
            THE GENEVA PLATFORM
          </div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#22d3ee" }}>GLOBAL ESCROW</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {totalEscrowGen.toLocaleString("en-US")} GEN
          </div>
        </div>
      </Html>
    </group>
  );
}
