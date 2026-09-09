"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { ProtocolState } from "@/lib/types";
import { HUB, TILE, buildLayouts, islandTopY } from "@/lib/world";
import ProceduralIsland from "./ProceduralIsland";
import TreatyLinks from "./scene/TreatyLinks";
import CentralPlatform from "./scene/CentralPlatform";
import ParticleField from "./scene/ParticleField";
import Causeways from "./scene/Causeways";
import RadarSweep from "./scene/RadarSweep";

interface Props {
  state: ProtocolState;
  hoveredId: string | null;
  selectedId: string | null;
  focusId: string | null;
  selectedTreaty: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
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

// Smoothly re-frames the orbit target onto the focused island / sector.
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
  hoveredId,
  selectedId,
  focusId,
  selectedTreaty,
  onHover,
  onSelect,
  onSelectTreaty,
}: Props) {
  const layouts = useMemo(() => buildLayouts(state.enclaves), [state.enclaves]);
  const layoutMap = useMemo(() => {
    const m = new Map(layouts.map((l) => [l.id, l] as const));
    return m;
  }, [layouts]);

  const focus = useMemo<[number, number, number]>(() => {
    if (focusId) {
      const l = layoutMap.get(focusId);
      if (l) return [l.center[0] * TILE, islandTopY(l.floatY), l.center[1] * TILE];
    }
    return [0, 2, 0];
  }, [focusId, layoutMap]);

  const treatyFocus = hoveredId ?? selectedId;

  return (
    <div className="absolute inset-0">
      <CursorManager hovered={hoveredId !== null} />
      <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
        <PerspectiveCamera makeDefault position={[56, 48, 56]} fov={32} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan
          minDistance={14}
          maxDistance={140}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 2, 0]}
        />
        <CameraRig focus={focus} />

        <ambientLight intensity={0.5} />
        <hemisphereLight args={["#38bdf8", "#0f172a", 0.5]} />
        <directionalLight
          position={[30, 40, 20]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={160}
          shadow-camera-left={-70}
          shadow-camera-right={70}
          shadow-camera-top={70}
          shadow-camera-bottom={-70}
        />
        <pointLight position={[-40, 18, -32]} intensity={0.6} color="#a78bfa" />
        <pointLight position={[40, 16, 32]} intensity={0.5} color="#22d3ee" />

        <Suspense fallback={null}>
          <Stars radius={140} depth={70} count={2600} factor={3} saturation={0} fade speed={0.5} />
          <ParticleField count={620} />
          <RadarSweep />

          <Causeways layouts={layouts} />

          {state.enclaves.map((e) => {
            const layout = layoutMap.get(e.id);
            if (!layout) return null;
            return (
              <ProceduralIsland
                key={e.id}
                enclave={e}
                layout={layout}
                active={e.id === hoveredId || e.id === selectedId}
                onHover={onHover}
                onSelect={onSelect}
              />
            );
          })}

          <TreatyLinks
            treaties={state.treaties}
            layouts={layouts}
            focusId={treatyFocus}
            selectedTreaty={selectedTreaty}
            onSelectTreaty={onSelectTreaty}
          />

          <CentralPlatform totalEscrowGen={state.totalEscrowGen} baseY={HUB.floatY} />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <shadowMaterial transparent opacity={0.3} />
          </mesh>

          <EffectComposer>
            <Bloom luminanceThreshold={0.2} intensity={1.5} luminanceSmoothing={0.9} mipmapBlur />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
