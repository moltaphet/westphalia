"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Archetype } from "@/lib/types";

interface Props {
  id: string;
  tint: string; // biome accent tint
  statusColor: string; // status overlay color for emissive core
  archetype: Archetype; // drives the whole citadel silhouette
  position: [number, number]; // world (x, z) of the island center
  baseY: number; // top surface height of the citadel plateau
  active: boolean;
  reputation: number; // 0-100, scales the citadel (visual "power")
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

// Sovereignty crest geometry keyed to archetype (small floating emblem above
// each citadel; the large silhouette below is the primary differentiator).
function CrestGeometry({ archetype }: { archetype: Archetype }) {
  switch (archetype) {
    case "Oracle Collective":
      return <octahedronGeometry args={[0.55, 0]} />;
    case "Liquidity Nexus":
      return <icosahedronGeometry args={[0.55, 0]} />;
    case "Autonomous Arbiter":
      return <torusGeometry args={[0.42, 0.16, 8, 20]} />;
    case "Defense Vanguard":
    default:
      return <dodecahedronGeometry args={[0.55, 0]} />;
  }
}

// ---------------------------------------------------------------------------
// Four distinct silhouettes, one per archetype. Every form stays below
// baseY + 3.8 so the floating crest (baseY + 4.1) and nameplate leader line
// (baseY + 5.15) always clear the structure.
// ---------------------------------------------------------------------------

// ARBITER: a single tall obelisk of judgment wrapped by a slowly precessing
// balance ring, with two counter-bobbing orbs (the scales).
function ArbiterForm({
  baseY,
  tint,
  tintMid,
  statusColor,
  active,
  matRef,
}: FormProps) {
  const ring = useRef<THREE.Mesh>(null);
  const orbL = useRef<THREE.Mesh>(null);
  const orbR = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.y = t * 0.35;
      ring.current.rotation.z = Math.sin(t * 0.4) * 0.12;
    }
    const bob = Math.sin(t * 1.4) * 0.22;
    if (orbL.current) orbL.current.position.y = baseY + 2.9 + bob;
    if (orbR.current) orbR.current.position.y = baseY + 2.9 - bob;
  });

  return (
    <group>
      {/* Tapered obelisk shaft */}
      <mesh position={[0, baseY + 1.95, 0]} castShadow>
        <coneGeometry args={[0.62, 3.6, 4]} />
        <meshStandardMaterial color={tint} metalness={0.6} roughness={0.3} flatShading />
      </mesh>
      {/* Judgment seam */}
      <mesh position={[0, baseY + 1.95, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 3.7, 6]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={active ? 3 : 2}
        />
      </mesh>
      {/* Precessing balance ring */}
      <mesh ref={ring} position={[0, baseY + 2.9, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.05, 0.035, 8, 48]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={2}
        />
      </mesh>
      {/* Scales orbs */}
      <mesh ref={orbL} position={[-1.12, baseY + 2.9, 0]} castShadow>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color={tintMid}
          emissive={statusColor}
          emissiveIntensity={1.4}
          flatShading
        />
      </mesh>
      <mesh ref={orbR} position={[1.12, baseY + 2.9, 0]} castShadow>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color={tintMid}
          emissive={statusColor}
          emissiveIntensity={1.4}
          flatShading
        />
      </mesh>
    </group>
  );
}

// NEXUS: twin exchange towers with luminous data streaming between them and
// a rotating trade ring at mid-height.
function NexusForm({ baseY, tint, tintMid, statusColor, active }: FormProps) {
  const ring = useRef<THREE.Mesh>(null);
  const stream = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.y = t * 0.8;
      ring.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.3;
    }
    if (stream.current) {
      stream.current.children.forEach((c, i) => {
        // Each mote shuttles back and forth between the towers with a phase
        // offset, wrapping around like packets on a wire.
        const p = ((t * 0.55 + i * 0.33) % 1) * 2 - 1;
        c.position.set(p * 0.92, baseY + 2.7 + Math.sin(p * Math.PI) * 0.55, 0);
      });
    }
  });

  return (
    <group>
      {/* Twin towers */}
      <mesh position={[-0.95, baseY + 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.42, 3.0, 6]} />
        <meshStandardMaterial color={tint} metalness={0.55} roughness={0.35} flatShading />
      </mesh>
      <mesh position={[0.95, baseY + 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.38, 2.5, 6]} />
        <meshStandardMaterial color={tintMid} metalness={0.55} roughness={0.35} flatShading />
      </mesh>
      {/* Tower beacons */}
      <mesh position={[-0.95, baseY + 3.1, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0.95, baseY + 2.6, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2.4} />
      </mesh>
      {/* Rotating trade ring */}
      <mesh ref={ring} position={[0, baseY + 2.4, 0]}>
        <torusGeometry args={[0.85, 0.03, 8, 40]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={active ? 2.6 : 1.8}
        />
      </mesh>
      {/* Packet stream between the towers */}
      <group ref={stream}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ORACLE: a luminous all-seeing sphere suspended inside gyroscopic rings,
// ringed by an antenna array splaying outward from the plinth.
function OracleForm({ baseY, tint, tintMid, statusColor, active }: FormProps) {
  const eye = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (eye.current) {
      eye.current.rotation.y = t * 0.5;
      eye.current.position.y = baseY + 2.45 + Math.sin(t * 1.2) * 0.12;
    }
    if (ringA.current) {
      ringA.current.rotation.x = t * 0.7;
      ringA.current.rotation.y = t * 0.3;
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.5;
      ringB.current.rotation.y = Math.cos(t * 0.4) * 0.8;
    }
  });

  return (
    <group>
      {/* Central eye */}
      <mesh ref={eye} position={[0, baseY + 2.45, 0]} castShadow>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={tint}
          emissive={statusColor}
          emissiveIntensity={active ? 2.2 : 1.5}
          metalness={0.4}
          roughness={0.25}
          flatShading
        />
      </mesh>
      {/* Gyroscopic rings */}
      <mesh ref={ringA} position={[0, baseY + 2.45, 0]}>
        <torusGeometry args={[0.95, 0.03, 8, 48]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2} />
      </mesh>
      <mesh ref={ringB} position={[0, baseY + 2.45, 0]}>
        <torusGeometry args={[1.25, 0.02, 8, 48]} />
        <meshStandardMaterial color={tintMid} emissive={statusColor} emissiveIntensity={1.2} />
      </mesh>
      {/* Antenna array splaying from the plinth */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        return (
          <group key={i} rotation={[0, a, 0]} position={[0, baseY + 0.2, 0]}>
            <mesh position={[1.25, 0.55, 0]} rotation={[0, 0, -0.7]} castShadow>
              <coneGeometry args={[0.05, 1.3, 4]} />
              <meshStandardMaterial color={tintMid} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[1.68, 1.18, 0]}>
              <octahedronGeometry args={[0.08, 0]} />
              <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// VANGUARD: a broad angular fortress-ziggurat with perimeter shield panels
// and corner spikes — low, wide and intimidating.
function VanguardForm({ baseY, tint, tintMid, statusColor, active }: FormProps) {
  const shields = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (shields.current) {
      shields.current.rotation.y = t * 0.18;
      shields.current.children.forEach((c, i) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = 0.28 + Math.abs(Math.sin(t * 1.8 + i * 1.1)) * 0.22;
      });
    }
  });

  return (
    <group>
      {/* Wide ziggurat deck */}
      <mesh position={[0, baseY + 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 1.0, 6]} />
        <meshStandardMaterial color={tint} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      <mesh position={[0, baseY + 1.35, 0]} rotation={[0, Math.PI / 6, 0]} castShadow>
        <cylinderGeometry args={[0.95, 1.15, 0.8, 6]} />
        <meshStandardMaterial color={tintMid} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      {/* Command block */}
      <mesh position={[0, baseY + 2.05, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <boxGeometry args={[0.85, 0.7, 0.85]} />
        <meshStandardMaterial color={tint} metalness={0.6} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, baseY + 2.05, 0.44]}>
        <boxGeometry args={[0.5, 0.4, 0.02]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={active ? 3 : 2}
        />
      </mesh>
      {/* Corner spikes */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.42, baseY + 1.3, Math.sin(a) * 1.42]}
            rotation={[-0.5, 0, -a]}
            castShadow
          >
            <coneGeometry args={[0.09, 0.9, 4]} />
            <meshStandardMaterial color={tintMid} metalness={0.65} roughness={0.35} />
          </mesh>
        );
      })}
      {/* Rotating perimeter shield panels */}
      <group ref={shields}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 1.9, baseY + 1.5, Math.sin(a) * 1.9]}
              rotation={[0, -a + Math.PI / 2, 0]}
            >
              <planeGeometry args={[1.15, 1.35]} />
              <meshStandardMaterial
                color={statusColor}
                emissive={statusColor}
                emissiveIntensity={1.6}
                transparent
                opacity={0.35}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

interface FormProps {
  baseY: number;
  tint: THREE.Color;
  tintMid: THREE.Color;
  statusColor: string;
  active: boolean;
  matRef?: unknown;
}

const FORM_BY_ARCHETYPE: Record<Archetype, React.ComponentType<FormProps>> = {
  "Autonomous Arbiter": ArbiterForm,
  "Liquidity Nexus": NexusForm,
  "Oracle Collective": OracleForm,
  "Defense Vanguard": VanguardForm,
};

// A per-archetype sovereign citadel. The silhouette itself encodes the
// archetype (spire / twin towers / observatory / fortress), the overall scale
// grows with reputation, and a small crest emblem floats above every form.
export default function Citadel({
  id,
  tint: tintHex,
  statusColor,
  archetype,
  position,
  baseY,
  active,
  reputation,
  onHover,
  onSelect,
}: Props) {
  const crestRef = useRef<THREE.Mesh>(null);

  const [x, z] = position;
  // Memoized tint derivatives: building THREE.Color per render (every hover /
  // selection change) forced new materials each board re-render.
  const tint = useMemo(() => new THREE.Color(tintHex), [tintHex]);
  const tintDark = useMemo(() => tint.clone().multiplyScalar(0.45), [tint]);
  const tintMid = useMemo(() => tint.clone().multiplyScalar(0.8), [tint]);

  // Reputation-driven "power" scale: 0.85x for a fresh rogue (rep 0) up to
  // 1.35x for a maximally reputable sovereign. Hover/selection still adds a
  // small pop on top so active feedback stays crisp.
  const repScale = 0.85 + (Math.max(0, Math.min(100, reputation)) / 100) * 0.5;
  const scale = repScale * (active ? 1.06 : 1);

  const Form = FORM_BY_ARCHETYPE[archetype] ?? VanguardForm;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (crestRef.current) {
      crestRef.current.rotation.y = t * 0.5;
      crestRef.current.rotation.x = Math.sin(t * 0.4) * 0.4;
      crestRef.current.position.y = baseY + 4.1 + Math.sin(t * 1.2) * 0.15;
    }
  });

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
      {/* Shared hexagonal plinth + status collar */}
      <mesh position={[0, baseY + 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.35, 0.36, 6]} />
        <meshStandardMaterial color={tintDark} metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, baseY + 0.37, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.02, 0.03, 8, 40]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2} />
      </mesh>

      {/* Archetype-specific superstructure */}
      <Form baseY={baseY} tint={tint} tintMid={tintMid} statusColor={statusColor} active={active} />

      {/* Floating holographic sovereignty crest */}
      <mesh ref={crestRef} position={[0, baseY + 4.1, 0]}>
        <CrestGeometry archetype={archetype} />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={1.8}
          wireframe
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}
