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
    ProceduralIsland.tsx  Per-enclave voxel island (InstancedMesh terrain +
                          rune tiles + keel + citadel + status overlays + label)
    FoundRealmModal.tsx   Found Sovereignty deployment modal.
    RealmDirectory.tsx    Collapsible search / quick-jump camera drawer.
    scene/
      Citadel.tsx         Data Bastion: server strips, energy core, status rings
      TreatyLinks.tsx     Focused alliance/dispute arcs (dim unrelated links)
      Causeways.tsx       Energy causeways + kinetic streams (severed rogue link)
      DisputeDome.tsx     Pulsing amber LLM-arbitration dome + validator ring
      ContainmentGrid.tsx Red containment barrier + warning beacons (slashed)
      CentralPlatform.tsx The Geneva hub: rotating GenLayer consensus core
      RadarSweep.tsx      Rotating tactical radar sweep + range rings
      ParticleField.tsx   Ambient drifting data-dust particles
    views/
      TopologyView.tsx    2D treaty node graph + non-aggression matrix
      TribunalView.tsx    GenLayer consensus courtroom dashboard
      TreasuryView.tsx    Escrow collateral + pull-pattern withdrawals
  lib/
    types.ts              Domain model (AgentEnclave, Treaty, Audit, View, ...)
    store.ts              Dynamic state hub: enclaves, actions, found-realm
    networks.ts           GenLayer StudioNet RPC + chain configuration
    contract.ts           Mock intelligent-contract ABI + Web3 binding
    mockData.ts           Seed treaties, ledger, and consensus audits
    world.ts              Orbital layout algorithm + procedural island tiles
    noise.ts              Deterministic value/fBm noise for terrain relief
    board.ts              Shared render constants + status/kind color maps
```

### Dynamic scalable archipelago

The archipelago is fully state-driven. Agents are `AgentEnclave[]` held in
`lib/store.ts` (`useWestphaliaStore`), and island geometry is derived at runtime
from each enclave's index via a concentric-ring orbital algorithm
(`lib/world.ts` `orbitSlot`):

- Ring 1 (radius 18-24): enclaves 1-4
- Ring 2 (radius 30-36): enclaves 5-10
- Ring 3 (radius 42-50): enclaves 11+

Angle per enclave is `2*pi * (i mod N) / N` with subtle deterministic offsets
for organic placement. Each island is rendered by
`components/ProceduralIsland.tsx`, which builds its voxel mesh from the
enclave's `biomeTheme` (palette + elevation seed) using two `InstancedMesh`
groups (terrain + glowing rune tiles) so the map holds 60fps with 12+ islands.

**Founding a new realm.** Click `[+ FOUND SOVEREIGNTY]` in the command bar to
open `components/FoundRealmModal.tsx`. Provide an agent name, a sovereign
archetype (Autonomous Arbiter, Liquidity Nexus, Oracle Collective, Defense
Vanguard), initial GEN collateral, and a natural-language governance philosophy
(parsed by GenLayer validators to auto-evaluate treaties). On submit the store
runs the multi-step transaction pipeline, instantiates a new voxel island in
the next orbital slot, and flies the camera to focus on the new realm.

**Navigation.** The Realm Directory (`components/RealmDirectory.tsx`) is a
collapsible search drawer that jumps the camera to any agent. Treaty arcs are
rendered conditionally: by default only active alliances and active dispute
arcs are shown, and hovering or selecting an enclave dims every link not
connected to it.

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

## Intelligent Contract (GenLayer v0.3.0)

The protocol contract lives at `contracts/westphalia.py`. It is an **on-chain
multi-LLM consensus protocol using GenVM equivalence validation** - there is no
off-chain isolated sandbox; disputes are resolved by the GenLayer validator
quorum inside `gl.eq_principle.prompt_comparative`, and all value moves are real
native transfers (`gl.message.value`, `self.balance`, ghost-contract
`emit_transfer`). No simulated integer balances are used on-chain.

Economic lifecycle: `found_sovereignty` (payable collateral) -> `propose_treaty`
/ `ratify_treaty` (matching payable bonds) -> `trigger_dispute` (payable
`dispute_bond`, minimum 500 GEN) -> multi-LLM verdict quantized into one of four
discrete tiers -> deterministic settlement -> `claim_payout` (pull-pattern) or
`recover_bond` (guarded by expiry).

Discrete verdict tiers: `CRITICAL_BREACH` (100% defendant bond slashed to
plaintiff, enclave `SANCTIONED`, dispute bond refunded), `ELEVATED_RISK` (25%
bond deducted to reserves, dispute bond refunded), `NORMAL` (dismissed, dispute
bond refunded minus validation fee), `MALICIOUS_REPORT` (100% of the plaintiff
dispute bond slashed into Geneva reserves).

The 7 adversarial defenses are implemented: (1) prompt-injection isolation via
`<untrusted_input>` delimiters + ASCII sanitization + hard guardrails; (2)
strict counterparty/treaty binding asserted deterministically before any
non-deterministic block; (3) contract-side ground-truth telemetry via
`gl.nondet.web.get` plus a 500 GEN anti-griefing bond and contradiction ->
`MALICIOUS_REPORT` slashing; (4) `MALICIOUS_REPORT` reserve slashing, a
`self.balance == collateral + locked_escrow + reserves + claimable` solvency
invariant, and pull-over-push distribution; (5) coarse basis-point quantization
and a strict four-tier categorical output; (6) `[TRANSIENT]` handling of
HTTP 429/5xx (both `.status` and `.status_code`) and `[LLM_ERROR]` failover for
malformed output; (7) a deterministic replay index over
`treaty_id + plaintiff + evidence_hash` plus guarded pre-expiry bond recovery.

### Contract status

- Runner: pinned `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- Static lint: `genvm-lint check contracts/westphalia.py` -> `Lint passed
  (3 checks)`. (The optional heavy SDK-validation step needs a 310 MB download
  that was unreliable in this environment; the on-chain deploy below compiled
  the contract against the real runner with no code errors.)
- Direct tests: `pytest tests/direct/ -v` -> **15 passed** (in-memory, ~5s):
  9 baseline adversarial cases (`test_westphalia.py`) plus 6 V2 cases
  (`test_westphalia_v2.py`) covering dual-feed telemetry agreement/divergence,
  amicable dissolution, reputation-scaled dispute bonds, anti-Sybil enclave
  maturation, and strict solvency. The suite requires Python 3.12 (the local
  default Python 3.14 breaks a transitive test dependency), e.g.
  `uv venv --python 3.12 && uv pip install genlayer-test`.
- V2 protocol: dual independent telemetry feeds with a deterministic >5%
  divergence check that forces `MALICIOUS_REPORT`; typed per-kind treaty
  parameter schemas (non-aggression / trade-corridor / data-sharing) with
  upfront rejection of unmapped keys; reputation-scaled variable dispute bonds
  (`MIN * (150 - min(rep, 100)) / 100`) with an anti-Sybil bond cap below
  reputation 30; an enclave maturation delay before high-tier treaties; and
  amicable mutual dissolution (`dissolve_treaty`) that refunds both bonds with
  zero penalty once both parties sign.
- Deployment: the contract **compiles on GenLayer Studio Devnet** (the deploy
  transaction reached the fee/consensus stage). Finalizing a fresh deployment is
  currently blocked on deployer funding: every keystore account holds 0 GEN on
  studio-dev and the Studio faucet did not credit within the polling window, so
  the fee-bearing deploy transaction reverts with `FeeValueMustBeNonZero`. Once
  a funded key is available, run:
  `genlayer deploy --contract contracts/westphalia.py --fee-value <wei>` and
  paste the resulting address into `frontend/lib/networks.ts`
  (`DIPLOMATIC_CONTRACT_ADDRESS`).

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
