"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
// Red containment barrier with warning beacons around a slashed / sanctioned
// rogue-agent territory.
export default function ContainmentGrid({
  position,
  baseY,
}: {
  position: [number, number];
  baseY: number;
}) {
  const beacons = useRef<THREE.Group>(null);
  const [x, z] = position;
  const R = 2.9;

  useFrame((state) => {
    if (!beacons.current) return;
    const t = state.clock.elapsedTime;
    beacons.current.children.forEach((c, i) => {
      const mesh = c.children[1] as THREE.Mesh | undefined;
      if (mesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1 + Math.abs(Math.sin(t * 3 + i)) * 3;
      }
    });
  });

  const corners: [number, number][] = [
    [-R, -R],
    [R, -R],
    [R, R],
    [-R, R],
  ];

  return (
    <group position={[x, baseY, z]}>
      {/* Barrier cage */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(R * 2, 2.6, R * 2)]} />
        <lineBasicMaterial color="#ef4444" transparent opacity={0.8} />
      </lineSegments>

      {/* Rotating hazard band */}
      <mesh position={[0, 1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R, 0.05, 8, 48]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.6} />
      </mesh>

      {/* Warning beacon poles at the corners */}
      <group ref={beacons}>
        {corners.map(([cx, cz], i) => (
          <group key={i} position={[cx, 0, cz]}>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1.4, 6]} />
              <meshStandardMaterial color="#7f1d1d" />
            </mesh>
            <mesh position={[0, 1.5, 0]}>
              <sphereGeometry args={[0.16, 10, 10]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
