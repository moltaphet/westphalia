"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { ProtocolState } from "@/lib/types";
import type { WorldTile } from "@/lib/world";
import { TILE, islandForSovereignty, islandTopY } from "@/lib/world";
import Archipelago from "./scene/Archipelago";
import Citadel from "./scene/Citadel";
import TreatyLinks from "./scene/TreatyLinks";
import DisputeDome from "./scene/DisputeDome";
import ContainmentGrid from "./scene/ContainmentGrid";
import CentralPlatform from "./scene/CentralPlatform";
import ParticleField from "./scene/ParticleField";
import Causeways from "./scene/Causeways";
import RadarSweep from "./scene/RadarSweep";
import IslandLabels from "./scene/IslandLabels";
import { islandById } from "@/lib/world";

interface Props {
  state: ProtocolState;
  tiles: WorldTile[];
  hoveredZone: string | null;
  selectedZone: string | null;
  focusZone: string | null;
  selectedTreaty: string | null;
  onHoverZone: (id: string | null) => void;
  onSelectZone: (id: string | null) => void;
  onSelectTreaty: (id: string) => void;
}

function CursorManager({ hovered }: { hovered: boolean }) {
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);
  return null;
}

// Smoothly re-frames the orbit target onto the selected island / sector.
function CameraRig({ focus }: { focus: [number, number, number] }) {
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const target = useRef(new THREE.Vector3(focus[0], focus[1], focus[2]));

  useEffect(() => {
    target.current.set(focus[0], focus[1], focus[2]);
  }, [focus]);

  useFrame(() => {
    if (!controls) return;
    controls.target.lerp(target.current, 0.06);
    controls.update();
  });
  return null;
}

export default function DiplomaticBoard({
  state,
  tiles,
  hoveredZone,
  selectedZone,
  focusZone,
  selectedTreaty,
  onHoverZone,
  onSelectZone,
  onSelectTreaty,
}: Props) {
  const focus = useMemo<[number, number, number]>(() => {
    if (focusZone) {
      const isl = islandForSovereignty(focusZone);
      if (isl) return [isl.center[0] * TILE, islandTopY(isl), isl.center[1] * TILE];
    }
    return [0, 2, 0];
  }, [focusZone]);

  return (
    <div className="absolute inset-0">
      <CursorManager hovered={hoveredZone !== null} />
      <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
        <PerspectiveCamera makeDefault position={[52, 44, 52]} fov={32} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan
          minDistance={14}
          maxDistance={120}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 2, 0]}
        />
        <CameraRig focus={focus} />

        {/* Lighting rig */}
        <ambientLight intensity={0.5} />
        <hemisphereLight args={["#38bdf8", "#0f172a", 0.5]} />
        <directionalLight
          position={[24, 34, 16]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={120}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <pointLight position={[-30, 14, -24]} intensity={0.6} color="#a78bfa" />
        <pointLight position={[30, 12, 24]} intensity={0.5} color="#22d3ee" />

        <Suspense fallback={null}>
          <Stars radius={120} depth={60} count={2200} factor={3} saturation={0} fade speed={0.5} />
          <ParticleField count={520} />
          <RadarSweep />

          <Archipelago
            tiles={tiles}
            sovereignties={state.sovereignties}
            hoveredZone={hoveredZone}
            selectedZone={selectedZone}
            onHoverZone={onHoverZone}
            onSelectZone={onSelectZone}
          />

          <Causeways />

          {state.sovereignties.map((s) => {
            const isl = islandForSovereignty(s.id);
            if (!isl) return null;
            const pos: [number, number] = [isl.center[0] * TILE, isl.center[1] * TILE];
            const baseY = islandTopY(isl);
            return (
              <group key={s.id}>
                <Citadel
                  sovereignty={s}
                  position={pos}
                  baseY={baseY}
                  active={s.id === hoveredZone || s.id === selectedZone}
                  onHover={onHoverZone}
                  onSelect={onSelectZone}
                />
                {s.status === "disputed" && (
                  <DisputeDome sovereignty={s} position={pos} baseY={baseY} />
                )}
                {s.status === "slashed" && (
                  <ContainmentGrid position={pos} baseY={baseY} />
                )}
              </group>
            );
          })}

          <TreatyLinks
            treaties={state.treaties}
            sovereignties={state.sovereignties}
            selectedTreaty={selectedTreaty}
            onSelectTreaty={onSelectTreaty}
          />

          <CentralPlatform
            totalEscrowGen={state.totalEscrowGen}
            baseY={islandById("central")?.floatY ?? 0}
          />

          <IslandLabels sovereignties={state.sovereignties} />

          {/* Ground shadow catcher */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
            <planeGeometry args={[160, 160]} />
            <shadowMaterial transparent opacity={0.3} />
          </mesh>

          {/* Cyber bloom: makes every emissive beam, ring, and core glow. */}
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.2}
              intensity={1.5}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
