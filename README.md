# Westphalia | Interactive 3D Voxel Diplomatic Board

A full-stack Next.js dApp that renders the **Westphalia Protocol** as an
interactive isometric 3D voxel world board. Autonomous agent sovereignties,
on-chain diplomatic treaties, and GenLayer multi-LLM dispute arbitrations are
visualized as a living tactical map, with a monospace command HUD for driving
Web3 workflows against GenLayer StudioNet.

---

## Architecture Overview

```
frontend/
  app/
    layout.tsx            Root layout, tactical grid backdrop, fonts
    page.tsx              Server entry -> mounts the client Experience
    globals.css           Tailwind + tactical HUD styling (scanlines, grid)
  components/
    Experience.tsx        Client state hub. Owns protocol state, selection,
                          camera focus, network, wallet/contract, view, and
                          treaty actions. Imports the board with ssr:false.
    TopBar.tsx            Command strip (stability, TVL, network, connect) plus
                          the multi-view tab switcher.
    DiplomaticBoard.tsx   The r3f <Canvas>: camera + focus rig, bounded
                          OrbitControls, lighting, Bloom, scene composition.
    HudOverlay.tsx        World-view HUD: dossier + treaty inspector, live feed,
                          consensus audit modal, action bar (P/D/C hotkeys),
                          and the propose / dispute / claim modals.
    GlobalFeedback.tsx    Cross-view transaction pipeline overlay + toast.
    scene/
      Archipelago.tsx     InstancedMesh voxel islands + floating keels (60fps)
      Citadel.tsx         Data Bastion: server strips, energy core, status rings
      TreatyLinks.tsx     Animated alliance/trade laser beams with particles
      Causeways.tsx       Energy causeways + kinetic streams (severed rogue link)
      DisputeDome.tsx     Pulsing amber LLM-arbitration dome + validator ring
      ContainmentGrid.tsx Red containment barrier + warning beacons (slashed)
      CentralPlatform.tsx The Geneva hub: rotating GenLayer consensus core
      RadarSweep.tsx      Rotating tactical radar sweep + range rings
      ParticleField.tsx   Ambient drifting data-dust particles
      IslandLabels.tsx    Floating island names + sector hazard readouts
    views/
      TopologyView.tsx    2D treaty node graph + non-aggression matrix
      TribunalView.tsx    GenLayer consensus courtroom dashboard
      TreasuryView.tsx    Escrow collateral + pull-pattern withdrawals
  lib/
    types.ts              Domain model (Sovereignty, Treaty, Audit, View, ...)
    networks.ts           GenLayer StudioNet RPC + chain configuration
    contract.ts           Mock intelligent-contract ABI + Web3 binding
    mockData.ts           Realistic on-chain state + consensus audits
    world.ts              Archipelago islands + procedural world generation
    noise.ts              Deterministic value/fBm noise for terrain relief
    board.ts              Shared render constants + status/kind color maps
```

### Multi-island archipelago

The board is a floating voxel archipelago rather than a single chunk. Five
procedurally generated islands are placed around a neutral hub and linked by
glowing energy causeways carrying kinetic data particles:

- Western Data Federation (Citadel Alpha) - high-tech cyan / slate ridges.
- Vanguard Autonomous Nexus (Vanguard Nexus) - industrial violet / amethyst.
- Sovereign Freeholds (Sovereign Enclave) - emerald autonomous enclave.
- Rogue Containment Shard (Consensus Bastion) - basalt / crimson slashed
  quarantine with a severed causeway.
- The Geneva Platform - central neutral treaty hub with a rotating GenLayer
  consensus core displaying global escrow.

Islands, causeways, radar sweep, and floating labels live in
`lib/world.ts` + `components/scene/*`. Selecting a citadel smoothly re-frames
the camera onto that sector via a lerped orbit target (`CameraRig`).

### Multi-view workspace

A top view-switcher (`components/TopBar.tsx`) drives four workspaces:

- Tactical 3D World - the interactive archipelago + world HUD.
- Diplomatic Topology (`views/TopologyView.tsx`) - 2D node graph of
  multilateral treaty vectors (edge width = trade volume), a non-aggression
  matrix, and trade-volume flows.
- Consensus Tribunal (`views/TribunalView.tsx`) - the courtroom: docket of
  disputes, submitted natural-language breach, ingested `gl.nondet.web`
  telemetry, GenVM multi-LLM deliberation log, validator panel, equivalence
  principle settlement timeline, and escrow penalties.
- Treasury & Escrow (`views/TreasuryView.tsx`) - locked GEN collateral,
  yield parameters, protocol treasury, and pull-pattern withdrawals.

### Design theme

Tactical Cyber-Geopolitical: a zinc-950 / slate-900 canvas, emerald alliance
links, amber dispute alerts, crimson containment grids, and a monospace HUD.
**Zero external 3D asset dependencies** - all terrain, citadels, agent figures,
and structures are generated procedurally with Three.js primitives and
`InstancedMesh` for smooth 60fps rendering.

### 3D board features

- **Procedural voxel terrain** - an isometric grid with height variation,
  rivers, and mountains, partitioned into four agent sovereignty zones:
  Citadel Alpha, Vanguard Nexus, Sovereign Enclave, and Consensus Bastion.
- **Agent citadels** - modular voxel towers with animated floating data cores,
  orbiting energy rings, and low-poly AI agent figures at each headquarters.
- **Live treaty dynamics**
  - Active alliances / trade pacts: animated neon beams with particle pulses.
  - Pending LLM disputes: pulsing holographic amber dome with orbiting
    validator nodes over the contested territory.
  - Slashed / sanctioned territory: red containment barrier, darkened tiles,
    and pulsing warning beacons.
  - Central treaty platform: a floating neutral assembly platform displaying
    global escrow holdings.
- **Raycast selection** - hover/click territories, citadels, and treaty links
  to drive the dossier and treaty inspector; bounded OrbitControls for
  rotate / zoom / pan.

### Tactical HUD and Web3 workflows

- **Geopolitical command bar** - Protocol Stability Index (0-100%), Total Value
  Locked in diplomatic escrow (GEN), network status, and a StudioNet switcher.
- **Agent dossier + treaty inspector** - agent address, stake, reputation tier,
  active covenants, and per-treaty dispute/consensus detail.
- **Live treaty feed** - real-time ledger of pacts, disputes, verdicts, and
  escrow releases.
- **Action modals** - Propose Treaty (payable GEN bond), Trigger Dispute
  (submit breach evidence to GenLayer validators), and Claim/Withdraw
  (pull-pattern escrow withdrawal).
- **1-click ephemeral reviewer mode** - a read-only simulation populated with
  realistic on-chain treaty data when no wallet is connected. Every action
  still resolves to a simulated receipt so the UI stays fully interactive.

---

## Local Setup and Run

Requirements: Node.js 18+ (tested on Node 22) and npm.

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Production build and start:

```bash
cd frontend
npm run build
npm run start
```

---

## Contract Interaction Guidelines

The dApp targets **GenLayer StudioNet**:

| Network            | Chain ID | RPC                                    |
| ------------------ | -------- | -------------------------------------- |
| StudioNet (dev)    | 61997    | https://studio-dev.genlayer.com/api    |
| Studio (fallback)  | 61999    | https://studio.genlayer.com/api        |

Explorer: https://explorer-studio-dev.genlayer.com

- Web3 access is provided through `genlayer-js`, imported **lazily on the
  client** inside `lib/contract.ts` so server-side rendering and the build step
  never touch browser-only wallet code.
- `DiplomaticContract` exposes `proposeTreaty`, `triggerDispute`, and
  `claimEscrow`, bound to the mock diplomatic-escrow ABI in
  `DIPLOMATIC_ABI`. Set the deployed address in `lib/networks.ts`
  (`DIPLOMATIC_CONTRACT_ADDRESS`).
- When no injected wallet / SDK client is available, calls resolve to a
  deterministic **simulated** receipt (reviewer mode). When a live client is
  present, the same methods route through `writeContract`.
- To wire a real deployment: deploy the Westphalia intelligent contract to
  StudioNet, update `DIPLOMATIC_CONTRACT_ADDRESS`, and connect a wallet via the
  command bar. The ABI shape in `lib/contract.ts` mirrors the expected
  view/payable/nonpayable methods.

---

## Verification

- `npm run build` completes with **0 TypeScript, lint, or SSR/Canvas errors**.
- The WebGL board is code-split behind a `dynamic(..., { ssr: false })` import,
  keeping the initial payload light and avoiding server canvas rendering.
- All UI labels, code, variables, and comments are pure ASCII English.
