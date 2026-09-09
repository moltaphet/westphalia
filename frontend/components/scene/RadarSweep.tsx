"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WORLD_EXTENT } from "@/lib/world";

// A subtle, high-tech radar beam: faint range rings, one thin bright leading
// line, and a very soft short trailing gradient arc (< 25 degrees, max opacity
// 0.12) that never obscures island colors or citadels.
export default function RadarSweep() {
  const sweep = useRef<THREE.Group>(null);
  const R = WORLD_EXTENT + 4;

  useFrame((_, delta) => {
    if (sweep.current) sweep.current.rotation.z -= delta * 0.3;
  });

  // Vertex-colored trailing gradient: bright at the leading edge, fading to
  // transparent across a ~22 degree arc.
  const trail = useMemo(() => {
    const seg = 16;
    const arc = (Math.PI / 180) * 22;
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color("#22d3ee");
    for (let i = 0; i < seg; i++) {
      const a0 = -(i / seg) * arc;
      const a1 = -((i + 1) / seg) * arc;
      // Two triangles from center outward for this slice.
      pos.push(0, 0, 0, Math.cos(a0) * R, Math.sin(a0) * R, 0, Math.cos(a1) * R, Math.sin(a1) * R, 0);
      const o0 = 1 - i / seg;
      const o1 = 1 - (i + 1) / seg;
      // encode opacity into color brightness (multiplied by low material opacity)
      col.push(c.r, c.g, c.b, c.r * o0, c.g * o0, c.b * o0, c.r * o1, c.g * o1, c.b * o1);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }, [R]);

  return (
    <group position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Faint static range rings */}
      {[0.4, 0.68, 1].map((f, i) => (
        <mesh key={i}>
          <ringGeometry args={[R * f - 0.05, R * f, 96]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.05}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      <group ref={sweep}>
        {/* Soft trailing gradient arc */}
        <mesh geometry={trail}>
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* Thin bright leading beam line */}
        <mesh position={[R / 2, 0, 0.01]}>
          <planeGeometry args={[R, 0.04]} />
          <meshBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
