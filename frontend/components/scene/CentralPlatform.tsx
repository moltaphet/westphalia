"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

// The Geneva Core: a majestic orbital assembly with three gyroscopic rings on
// independent axes, a breathing quantum reactor, and a skyward volumetric
// beacon rising through the atmosphere.
export default function CentralPlatform({
  totalEscrowGen,
  baseY = 0,
  showLabel = true,
}: {
  totalEscrowGen: number;
  baseY?: number;
  showLabel?: boolean;
}) {
  const platform = useRef<THREE.Group>(null);
  const ringX = useRef<THREE.Mesh>(null);
  const ringY = useRef<THREE.Mesh>(null);
  const ringZ = useRef<THREE.Mesh>(null);
  const reactor = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const hover = baseY + 2.7;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (platform.current) platform.current.position.y = hover + Math.sin(t * 0.8) * 0.12;
    // Independent gyroscopic axes.
    if (ringX.current) ringX.current.rotation.x = t * 0.5;
    if (ringY.current) ringY.current.rotation.y = t * 0.7;
    if (ringZ.current) ringZ.current.rotation.z = t * 0.35;
    // Breathing quantum reactor.
    if (reactor.current) {
      const s = 0.42 + Math.sin(t * 1.6) * 0.08;
      reactor.current.scale.setScalar(s / 0.42);
    }
    // Beacon shimmer.
    if (beacon.current) {
      const mat = beacon.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + Math.abs(Math.sin(t * 0.9)) * 0.05;
    }
  });

  return (
    <group>
      {/* Skyward volumetric beacon rising from the core. */}
      <mesh ref={beacon} position={[0, baseY + 16, 0]}>
        <cylinderGeometry args={[0.7, 1.6, 34, 24, 1, true]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group ref={platform} position={[0, hover, 0]}>
        {/* Hex plinth */}
        <mesh castShadow>
          <cylinderGeometry args={[1.6, 1.25, 0.3, 6]} />
          <meshStandardMaterial
            color="#1e293b"
            emissive="#0ea5e9"
            emissiveIntensity={0.3}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[1.0, 1.0, 0.08, 6]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.3} />
        </mesh>

        {/* Breathing quantum reactor */}
        <mesh ref={reactor} position={[0, 0.95, 0]}>
          <icosahedronGeometry args={[0.42, 1]} />
          <meshStandardMaterial
            color="#a5f3fc"
            emissive="#22d3ee"
            emissiveIntensity={3}
            metalness={0.4}
            roughness={0.15}
          />
        </mesh>

        {/* Three gyroscopic rings on independent axes */}
        <mesh ref={ringX} position={[0, 0.95, 0]}>
          <torusGeometry args={[1.9, 0.03, 10, 60]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.6} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh ref={ringY} position={[0, 0.95, 0]}>
          <torusGeometry args={[1.55, 0.025, 10, 60]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.4} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh ref={ringZ} position={[0, 0.95, 0]}>
          <torusGeometry args={[1.25, 0.02, 10, 60]} />
          <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={1.3} metalness={0.6} roughness={0.3} />
        </mesh>

        {showLabel && (
          <Html
            center
            distanceFactor={14}
            position={[0, 2.1, 0]}
            pointerEvents="none"
            zIndexRange={[0, 10]}
          >
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
                THE GENEVA CORE
              </div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#22d3ee" }}>GLOBAL ESCROW</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {totalEscrowGen.toLocaleString("en-US")} GEN
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
