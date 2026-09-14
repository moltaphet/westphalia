"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface Props {
  count: number; // number of active treaties -> number of orbiting motes
  color: string; // emissive mote color (status color)
  center: [number, number]; // world (x, z) of the island center
  baseY: number; // citadel plateau height
  radius?: number; // orbit radius
}

const MAX_MOTES = 8; // cap so treaty spam never floods the scene

// One luminous mote per active treaty, circling the citadel on a faint orbit
// ring -- the agent's diplomatic web made visible, and idle life for the scene.
export default function TreatyMotes({
  count,
  color,
  center,
  baseY,
  radius = 2.6,
}: Props) {
  const orbit = useRef<THREE.Group>(null);
  const motes = Math.max(0, Math.min(count, MAX_MOTES));

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (orbit.current) {
      orbit.current.rotation.y = t * 0.3;
      orbit.current.children.forEach((c, i) => {
        // Gentle per-mote vertical breathing, phase-offset.
        c.position.y = Math.sin(t * 1.5 + i * 1.3) * 0.25;
      });
    }
  });

  if (motes === 0) return null;

  const [x, z] = center;

  return (
    <group position={[x, baseY + 2.4, z]}>
      {/* Faint orbit path */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.012, 6, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={orbit}>
        {Array.from({ length: motes }, (_, i) => {
          const a = (i / motes) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
