"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { ProtocolState } from "@/lib/types";
import { HUB, TILE, buildLayouts, islandTopY } from "@/lib/world";
import ProceduralIsland from "./ProceduralIsland";
import TreatyLinks from "./scene/TreatyLinks";
import CentralPlatform from "./scene/CentralPlatform";
import ParticleField from "./scene/ParticleField";
import Causeways from "./scene/Causeways";

interface Props {
  state: ProtocolState;
  hoveredId: string | null;
  selectedId: string | null;
  focusId: string | null;
  selectedTreaty: string | null;
  showLabels: boolean; // suppress Drei Html labels when a modal is open
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
// Cinematic fly-to: lerps both the camera position and the orbit target to a
// dynamic isometric framing of the focused citadel, then releases control back
// to the user once it has arrived. Re-arms only when flyKey changes.
function CameraRig({
  camPos,
  target,
  flyKey,
}: {
  camPos: [number, number, number];
  target: [number, number, number];
  flyKey: string;
}) {
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const camera = useThree((s) => s.camera);
  const desiredPos = useRef(new THREE.Vector3(...camPos));
  const desiredTarget = useRef(new THREE.Vector3(...target));
  const flying = useRef(true);

  useEffect(() => {
    desiredPos.current.set(camPos[0], camPos[1], camPos[2]);
    desiredTarget.current.set(target[0], target[1], target[2]);
    flying.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey]);

  useFrame(() => {
    if (!controls || !flying.current) return;
    camera.position.lerp(desiredPos.current, 0.08);
    controls.target.lerp(desiredTarget.current, 0.08);
    controls.update();
    if (
      camera.position.distanceTo(desiredPos.current) < 0.4 &&
      controls.target.distanceTo(desiredTarget.current) < 0.4
    ) {
      flying.current = false;
    }
  });
  return null;
}

export default function DiplomaticBoard({
  state,
  hoveredId,
  selectedId,
  focusId,
  selectedTreaty,
  showLabels,
  onHover,
  onSelect,
  onSelectTreaty,
}: Props) {
  const layouts = useMemo(() => buildLayouts(state.enclaves), [state.enclaves]);
  const layoutMap = useMemo(() => {
    const m = new Map(layouts.map((l) => [l.id, l] as const));
    return m;
  }, [layouts]);

  // Compute the orbit target and a dynamic isometric camera position for the
  // current focus (an island citadel, or the whole-archipelago overview).
  const { camPos, target } = useMemo<{
    camPos: [number, number, number];
    target: [number, number, number];
  }>(() => {
    const l = focusId ? layoutMap.get(focusId) : undefined;
    if (l) {
      const cx = l.center[0] * TILE;
      const cz = l.center[1] * TILE;
      const cy = islandTopY(l.floatY);
      return {
        target: [cx, cy, cz],
        camPos: [cx + 15, cy + 13, cz + 15],
      };
    }
    return { target: [0, 2, 0], camPos: [40, 34, 40] };
  }, [focusId, layoutMap]);

  const treatyFocus = hoveredId ?? selectedId;

  return (
    <div className="absolute inset-0">
      <CursorManager hovered={hoveredId !== null} />
      <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
        {/* Deep atmospheric fog for cinematic depth falloff. */}
        <fogExp2 attach="fog" args={["#040711", 0.015]} />
        <PerspectiveCamera makeDefault position={[40, 34, 40]} fov={45} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan
          minDistance={16}
          maxDistance={95}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 2, 0]}
        />
        <CameraRig camPos={camPos} target={target} flyKey={focusId ?? "overview"} />

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
          <ParticleField count={1500} />

          {/* Infinite cybernetic ground grid with radial opacity falloff. */}
          <Grid
            position={[0, -1.85, 0]}
            args={[10, 10]}
            infiniteGrid
            cellSize={2}
            cellThickness={0.6}
            cellColor="#1e293b"
            sectionSize={10}
            sectionThickness={1}
            sectionColor="#155e75"
            fadeDistance={95}
            fadeStrength={2.5}
          />

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
                showLabel={showLabels}
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

          <CentralPlatform
            totalEscrowGen={state.totalEscrowGen}
            baseY={HUB.floatY}
            showLabel={showLabels}
            scale={1.4}
          />

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
