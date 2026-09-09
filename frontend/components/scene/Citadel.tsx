"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface Props {
  id: string;
  tint: string; // biome accent tint
  statusColor: string; // status overlay color for emissive core
  position: [number, number]; // world (x, z) of the island center
  baseY: number; // top surface height of the citadel plateau
  active: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

// A futuristic modular Data Bastion: hexagonal plinth, corner server towers
// with emissive vertical strips, a floating rotating energy core, and stacked
// pulsing status rings. All geometry is procedural (no external assets).
export default function Citadel({
  id,
  tint: tintHex,
  statusColor,
  position,
  baseY,
  active,
  onHover,
  onSelect,
}: Props) {
  const core = useRef<THREE.Mesh>(null);
  const innerCore = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const strips = useRef<THREE.Group>(null);

  const [x, z] = position;
  const tint = new THREE.Color(tintHex);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (core.current) {
      core.current.rotation.y = t * 0.9;
      core.current.rotation.x = Math.sin(t * 0.6) * 0.3;
      core.current.position.y = baseY + 2.55 + Math.sin(t * 1.6) * 0.14;
    }
    if (innerCore.current) {
      innerCore.current.rotation.y = -t * 1.6;
      innerCore.current.position.y = baseY + 2.55 + Math.sin(t * 1.6) * 0.14;
    }
    if (ringA.current) {
      ringA.current.rotation.z = t * 1.4;
      const s = 1 + Math.sin(t * 2.4) * 0.07;
      ringA.current.scale.set(s, s, s);
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.9;
      const s = 1 + Math.sin(t * 2.4 + 1.2) * 0.05;
      ringB.current.scale.set(s, s, s);
    }
    if (strips.current) {
      const pulse = 1.4 + Math.abs(Math.sin(t * 2.2)) * 2.2;
      strips.current.children.forEach((c, i) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = pulse * (0.6 + (i % 3) * 0.2);
      });
    }
  });

  const scale = active ? 1.07 : 1;
  const towerOffsets: [number, number][] = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ];

  return (
    <group
      position={[x, 0, z]}
      scale={scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(id);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      <mesh position={[0, baseY + 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.35, 0.36, 6]} />
        <meshStandardMaterial color={tint.clone().multiplyScalar(0.45)} metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, baseY + 0.37, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.02, 0.03, 8, 40]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2} />
      </mesh>

      <group ref={strips}>
        {towerOffsets.map(([sx, sz], i) => (
          <mesh key={`strip-${i}`} position={[sx * 1.1, baseY + 1.1, sz * 1.1]}>
            <boxGeometry args={[0.06, 1.7, 0.06]} />
            <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2} />
          </mesh>
        ))}
      </group>
      {towerOffsets.map(([sx, sz], i) => (
        <mesh key={`tower-${i}`} position={[sx * 1.1, baseY + 1.05, sz * 1.1]} castShadow>
          <boxGeometry args={[0.34, 1.75, 0.34]} />
          <meshStandardMaterial color={tint.clone().multiplyScalar(0.8)} metalness={0.55} roughness={0.4} />
        </mesh>
      ))}

      <mesh position={[0, baseY + 1.5, 0]} castShadow>
        <boxGeometry args={[0.7, 2.4, 0.7]} />
        <meshStandardMaterial color={tint} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, baseY + 1.5, 0.36]}>
        <boxGeometry args={[0.4, 2.0, 0.02]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1.6} />
      </mesh>

      <mesh ref={core} position={[0, baseY + 2.55, 0]}>
        <icosahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={active ? 3 : 2}
          metalness={0.3}
          roughness={0.2}
          wireframe
        />
      </mesh>
      <mesh ref={innerCore} position={[0, baseY + 2.55, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#ffffff" emissive={statusColor} emissiveIntensity={3.2} />
      </mesh>

      <mesh ref={ringA} position={[0, baseY + 2.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.028, 8, 40]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2.2} />
      </mesh>
      <mesh ref={ringB} position={[0, baseY + 2.55, 0]} rotation={[Math.PI / 2.6, 0.5, 0]}>
        <torusGeometry args={[0.82, 0.02, 8, 40]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1.6} />
      </mesh>

      <group position={[1.05, baseY + 0.36, 1.05]}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[0.22, 0.42, 0.16]} />
          <meshStandardMaterial color={tint.clone().multiplyScalar(1.1)} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1} />
        </mesh>
      </group>
    </group>
  );
}
