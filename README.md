# Westphalia | Interactive 3D Voxel Diplomatic Board

A full-stack Next.js dApp that renders the **Westphalia Protocol** as an
interactive isometric 3D voxel world board. Autonomous agent sovereignties,
on-chain diplomatic treaties, and GenLayer multi-LLM dispute arbitrations are
visualized as a living tactical map, with a monospace command HUD for driving
Web3 workflows against GenLayer Studio Net.

| | |
|---|---|
| **Live contract** | [`0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3`](https://explorer-studio-dev.genlayer.com/address/0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3) |
| **Network** | GenLayer Studio Net, chain 61997 |
| **Demo video** | _TODO: link before final submission_ |
| **Reviewer quickstart** | [Quickstart for reviewers](#quickstart-for-reviewers) |

---

## Why this needs GenLayer

Most of this protocol could run anywhere. Founding a sovereignty, escrowing a
bond, releasing it on expiry - that is bookkeeping any chain can do, and a
contract that stopped there would not need an intelligent chain at all.

The part that cannot run anywhere else is the **breach**. A treaty here is a
natural-language instrument: *"Halcyon will hold data-sharing uptime at or above
9950 basis points and latency at or below 300 basis points."* Deciding whether
Halcyon broke that requires reading a live telemetry feed and judging prose
against numbers - an operation with no deterministic answer and no trusted
third party to delegate to. On a conventional chain you must either (a) reduce
the clause to something a machine can check, which forces counterparties to
state only assertions a script can evaluate and rules out every clause worth
writing; or (b) appoint an oracle, which reintroduces exactly the central
authority a treaty between sovereign agents exists to avoid.

GenLayer removes the tradeoff. `trigger_dispute` fetches the treaty-bound
oracles **inside consensus**, and a validator quorum independently arbitrates
the allegation against the readings, reaching agreement on a verdict **tier**
before any escrow moves. That structure is what makes the guarantee real:

- **No trusted adjudicator.** The verdict is the quorum's, not a server's.
- **No forged evidence.** A treaty's oracle URLs are agreed at proposal time,
  inspectable by the counterparty before ratification, and read from storage at
  dispute time - so a plaintiff cannot point adjudication at an oracle of their
  own. This closes the forged-oracle vector, and
  `test_forged_oracle_impossible` pins it.
- **No settlement on bad data.** A transient fetch or malformed LLM response
  reverts the whole dispute and refunds the bond rather than settling on
  evidence nobody verified.
- **No ambiguity in the outcome.** The verdict is quantized to one of four
  discrete tiers before it touches storage, so settlement is deterministic even
  though adjudication is not.

If the question is "why can't this be a database with an admin panel" - because
the entire point is a pact between parties who do not trust each other, where
neither party, and no third party, gets to decide who breached.

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
      ParticleField.tsx   Ambient drifting data-dust particles
    views/
      TopologyView.tsx    2D treaty node graph + non-aggression matrix
      TribunalView.tsx    GenLayer consensus courtroom dashboard
      TreasuryView.tsx    Escrow collateral + pull-pattern withdrawals
    lib/
    types.ts              Domain model (AgentEnclave, Treaty, Audit, View, ...)
    store.ts              Dynamic state hub: enclaves, actions, found-realm
    networks.ts           GenLayer StudioNet RPC + chain configuration
    chainState.ts         Reads the contract and maps it onto the domain model
    archetypes.ts         Archetype presets + deterministic terrain seeds
    contract.ts           Intelligent-contract ABI + Web3 binding
    mockData.ts           Reviewer-mode seed treaties, ledger, and audits
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
- **Live board, no wallet required** - the archipelago hydrates from the
  deployed contract on load: treaties are enumerated through the protocol
  counter, and each treaty's parties resolve to their enclave records. GenLayer
  answers views over `gen_call`, which needs no signer, so a first-time visitor
  sees the real protocol rather than placeholder data. The command bar badges
  the source as `ON-CHAIN`, `ON-CHAIN / EMPTY`, or `SIMULATED`.
- **1-click ephemeral reviewer mode** - if the contract cannot be reached, the
  board falls back to a seeded simulation and says so, instead of rendering
  empty. Every action still resolves to a simulated receipt so the UI stays
  fully interactive.

---

## Quickstart for reviewers

Three independent ways to verify this submission, cheapest first.

### 1. See the live protocol in the browser (about one minute)

```bash
git clone https://github.com/moltaphet/westphalia
cd westphalia/frontend
npm install
npm run dev          # http://localhost:3000
```

Click **ENTER THE ARCHIPELAGO**. **No wallet is needed and nothing is mocked**:
the board reads the deployed contract directly. GenLayer answers view calls over
`gen_call`, which needs no signer, so a first-time visitor sees real protocol
state. Confirm it yourself:

- The command bar reads **ON-CHAIN** next to the protocol name. If the contract
  were unreachable it would read **SIMULATED** instead, and the islands would be
  seed data.
- The two islands are **Halcyon** and **Meridian** - the sovereignties the
  autonomous agents actually founded on chain, not the seed archipelago.
- **TOTAL VALUE LOCKED** and the solvency badge are read live from
  `get_protocol_overview`, and they reconcile against the explorer
  (see step 3).

Reads need no wallet. **Writes do**: clicking a propose/ratify/dispute action
without a wallet connected produces a receipt labelled *simulated*, and the
command bar stays on **REVIEWER**. To dispatch a real transaction, connect an
injected wallet holding GEN on chain 61997 - `connect()` requests the address
from the wallet, keeps the key there, and estimates the fee the consensus
contract requires.

### 2. Run the contract test suite (about three minutes)

```bash
uv venv --python 3.12
uv pip install --prerelease=allow "genlayer-test==0.30.0rc2"
.venv/bin/python -m pytest -q          # 56 passed
```

The suite runs the contract in-memory (no chain, no keys). It covers the
baseline adversarial cases, the V2 protocol, thirteen red-team exploit
regressions, and the P1-P4 post-audit PoCs - each of which was confirmed as a
working exploit against an earlier revision before it was fixed.

### 3. Run the autonomous agents against the live chain (about ten minutes)

```bash
.venv/bin/python -m agent.demo --fresh
```

Two agents fund themselves from the faucet, found enclaves, negotiate a treaty
across a rejected first proposal, ratify it, and then litigate it - ending in a
GenLayer multi-LLM verdict. This is the only step that needs a funded key; it
mints its own into `agent/keys/` (gitignored). `--no-adjudicate` stops before
the dispute.

### Verify the deployment on the explorer

Contract:
[`0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3`](https://explorer-studio-dev.genlayer.com/address/0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3)
on GenLayer Studio Net (chain 61997).

GenVM is not an EVM chain, so `eth_getCode` returns `0x` even for a live
contract and cannot be used to compare deployed bytecode against source. The
deployment is evidenced instead by live view reads: `get_protocol_overview`
answers from that address and reports `solvent: true`, with the tracked
component sums equalling `balance`.

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

Configuration is optional. `frontend/.env.example` documents the two public
variables; with no `.env.local` at all the app falls back to the deployed
address and RPC baked into `lib/networks.ts`.

---

## Intelligent Contract (GenVM v0.3.0)

The protocol contract lives at `contracts/westphalia.py`. It is an **on-chain
multi-LLM consensus protocol using GenVM equivalence validation** - there is no
off-chain isolated sandbox; disputes are resolved by the GenLayer validator
quorum inside `gl.eq_principle.prompt_comparative`, and all value moves are real
native transfers (`gl.message.value`, `self.balance`,
`gl.chain.Account.emit_transfer`). No simulated integer balances are used
on-chain. The contract targets the **genuine v0.3.0 Python SDK API**
(`gl.contract.Contract`, `gl.storage.allow`, non-callable `u256`,
`gl.message.sender_address`).

Economic lifecycle: `found_sovereignty` (payable collateral) -> `propose_treaty`
/ `ratify_treaty` (matching payable bonds, with treaty-bound telemetry oracles)
-> `trigger_dispute` (payable `dispute_bond`, minimum 500 GEN) -> multi-LLM
verdict quantized into one of four discrete tiers -> deterministic settlement
-> `claim_payout` (pull-pattern), `recover_bond` (guarded by expiry), or
`withdraw_collateral` (sovereign exit gated on zero locked treaty bonds).

Discrete verdict tiers: `CRITICAL_BREACH` (100% defendant bond slashed to
plaintiff, enclave `SANCTIONED`, dispute bond refunded), `ELEVATED_RISK` (25%
bond deducted to reserves, dispute bond refunded), `NORMAL` (dismissed,
dispute bond refunded minus validation fee), `MALICIOUS_REPORT` (100% of the
plaintiff dispute bond slashed into Geneva reserves).

The adversarial defenses implemented: (1) prompt-injection isolation via
`<untrusted_input>` delimiters + ASCII sanitization + hard guardrails; (2)
strict counterparty/treaty binding asserted deterministically before any
non-deterministic block; (3) **treaty-bound telemetry oracles** - the
adjudication URLs are agreed at proposal time, inspectable by the counterparty
before ratification, and read from storage only at dispute time, so a plaintiff
can never point adjudication at a forged oracle of their own - plus a 500 GEN
anti-griefing bond and contradiction -> `MALICIOUS_REPORT` slashing; (4)
`MALICIOUS_REPORT` reserve slashing, a
`self.balance == collateral + locked_escrow + reserves + claimable` solvency
invariant, and pull-over-push distribution; (5) coarse basis-point quantization
and a strict four-tier categorical output; (6) `[TRANSIENT]` handling of
HTTP 429/5xx (both `.status` and `.status_code`) and `[LLM_ERROR]` failover for
malformed output; (7) a deterministic replay index over
`treaty_id + plaintiff + evidence_hash`, guarded pre-expiry bond recovery,
expiry-gated litigation, sanctioned-plaintiff standing loss, and a
collateral-exit gate locked on open treaty bonds.

### Contract status

- Runner: pinned `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
  (the genuine v0.3.0 runner; the previous `1jb45aa8...` pin was a v0.2-line
  runner that does not provide the v0.3 API surface).
- Static lint: `genvm-lint check contracts/westphalia.py` -> `Lint passed
  (3 checks)`, `Validation passed`, 19 methods (9 view, 10 write) against the
  pinned runner.
- Direct tests: `pytest tests/direct/ -v` -> **33 passed** (in-memory, ~45s):
  9 baseline adversarial cases (`test_westphalia.py`), 6 V2 cases
  (`test_westphalia_v2.py`), 13 red-team exploit regressions
  (`test_adversarial_exploits.py`) including the forged-oracle PoC regression
  (`test_forged_oracle_impossible`), the collateral-exit gate, expired-treaty
  litigation rejection, and sanctioned-plaintiff standing loss, plus 5
  post-audit P1-P4 PoC regressions (`test_poc_regressions.py`). The suite
  requires Python 3.12 and `genlayer-test==0.30.0rc2` (the v0.2-era
  0.29.x harness cannot decode the v0.3 calldata format), e.g.
  `uv venv --python 3.12 && uv pip install --prerelease=allow
  "genlayer-test==0.30.0rc2"`.
- Agent tests: `pytest agent/` -> **23 passed**, covering the negotiation
  scorer (`test_decider.py`), the deterministic telemetry arithmetic asserted
  against the contract's own constants (`test_telemetry.py`), and verdict
  extraction from the transaction (`test_chain.py`), whose fixtures are built
  from two real observed payloads - an agreed return and the
  `ERR_INSUFFICIENT_BOND` revert that a stale dispute bond produces.
- V2/V3 protocol: dual independent telemetry feeds with a deterministic >5%
  divergence check that forces `MALICIOUS_REPORT`; typed per-kind treaty
  parameter schemas (non-aggression / trade-corridor / data-sharing) with
  upfront rejection of unmapped keys, carried into the arbitration prompt as
  verified context; reputation-scaled variable dispute bonds
  (`MIN * (150 - min(rep, 100)) / 100`) with an anti-Sybil bond cap below
  reputation 30; an enclave maturation delay before high-tier treaties;
  amicable mutual dissolution (`dissolve_treaty`) that refunds both bonds with
  zero penalty once both parties sign; and `withdraw_collateral` as a guarded
  sovereign exit.
- Post-audit hardening (P1-P4, PoC-confirmed then fixed, each with a permanent
  regression test): **P1 reputation laundering** - reputation persists in a
  `rep_history` map keyed by address, so withdrawing collateral and re-founding
  inherits the debited/sanctioned history instead of resetting to the seed;
  **P2 hostage treaties** - zero (never-expiring) and >365-day expiries are
  rejected at proposal, and `exit_treaty` gives either party a unilateral exit
  after a 3-day notice window (counterparty retains full dispute standing
  during it) at a 10% penalty paid to protocol reserves, never to the
  hostage-taker; **P3 sanctioned ratification** - both parties must be ACTIVE
  at ratify time and a proposed treaty past its expiry is not ratifiable;
  **P4 SSRF via numeric-host encodings** - hex (`0x7f000001`), decimal
  (`2130706433`), octal (`0177.0.0.1`), short-form (`127.1`), and mixed
  (`0x7f.1`) encodings are normalized to a 32-bit integer with full
  inet_aton semantics and checked against every private/reserved range.
  Additionally, `drain_reserves` gives the deployer-keyed governor a
  treasury exit for accumulated reserves.
- Deployment: live on GenLayer Studio Devnet at
  `0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3` (chain 61997), recorded in
  `deployments/studio-dev.json`. GenVM is not an EVM chain, so `eth_getCode`
  returns `0x` even for a live contract and cannot be used to compare deployed
  bytecode against source; the deployment is evidenced instead by live view
  reads - `get_protocol_overview` answers from that address and reports
  `solvent: true`, with the tracked component sums equalling `balance`.

## Contract Interaction Guidelines

The dApp targets **GenLayer StudioNet**:

| Network            | Chain ID | RPC                                    |
| ------------------ | -------- | -------------------------------------- |
| Studio Net (dev)   | 61997    | https://studio-next.genlayer.com/api   |
| Studio (fallback)  | 61999    | https://studio.genlayer.com/api        |

Explorer: https://explorer-studio-dev.genlayer.com

`studio-next.genlayer.com` and `studio-dev.genlayer.com` both serve chain 61997
and answer identically. `NEXT_PUBLIC_GENLAYER_RPC_URL` selects between them; the
default is studio-next.

- Web3 access is provided through `genlayer-js`, imported **lazily on the
  client** inside `lib/contract.ts` so server-side rendering and the build step
  never touch browser-only wallet code.
- The chain object is taken from the SDK's own `chains.studioDevnet` (spread, so
  only the RPC endpoint is overridden), not hand-built. A hand-built
  `{ id, rpcUrl }` object is not enough for a write: genlayer-js reads
  `consensusMainContract` (the address and ABI the transaction is sent to),
  `defaultNumberOfInitialValidators`, `defaultConsensusMaxRotations` and
  `isStudio` off the chain. Without them a write dies inside viem
  ("Cannot read properties of undefined (reading 'default')") or at
  "Cannot convert undefined to a BigInt".
- Reads and writes use separate clients. Views go through an **account-less**
  client, so the board hydrates without a wallet; writes go through the
  connected client, which exists only when a wallet is present.
- A write needs two things the SDK will not supply on its own. **(1)** An
  account: a client built without one throws "No account set" before any
  calldata is built, so `connect()` requests an address from the injected wallet
  and passes `{ account, provider }`, keeping the key inside the extension.
  **(2)** A fee: Studio Net has no fee-manager contract, so the fee is derived
  from the chain's live fee policy -- but only when the SDK is asked, via
  `estimateTransactionFees()`. Omitting it leaves `feeValue` at 0 and the
  consensus contract rejects the transaction with `FeeValueMustBeNonZero(1)`.
  `DiplomaticContract.write()` estimates the fee and passes it on every write.
- Enclaves have no on-chain enumerator -- `get_enclave` needs an address. The
  board therefore reaches them transitively: treaties are enumerated through
  `next_treaty_id`, and each treaty's `party_a` / `party_b` resolves to an
  enclave record. A sovereignty that has never been party to a treaty answers
  `get_enclave` but cannot be discovered by the board.
- `DiplomaticContract` exposes the full on-chain surface of the real contract:
  all 19 public methods, `foundSovereignty`, `proposeTreaty` (with treaty-bound
  oracle URLs and typed params), `ratifyTreaty`, `triggerDispute` (allegation +
  evidence only; the oracles come from treaty storage), `claimPayout`,
  `recoverBond`, and `withdrawCollateral`, bound to the matching ABI in
  `DIPLOMATIC_ABI`. Amounts are converted to atto-scale uint256 via `toAtto`.
- When no injected wallet / SDK client is available, calls resolve to a
  deterministic **simulated** receipt (reviewer mode), and the command bar says
  so. With a wallet connected they route through `writeContract` for real.
- To wire a real deployment: deploy the Westphalia intelligent contract to
  Studio Net, update `DIPLOMATIC_CONTRACT_ADDRESS`, and connect a wallet via the
  command bar. The ABI in `lib/contract.ts` mirrors the deployed contract's
  view/payable/nonpayable methods exactly.

---

## Verification

- `npm run build` completes with **0 TypeScript, lint, or SSR/Canvas errors**.
- The WebGL board is code-split behind a `dynamic(..., { ssr: false })` import,
  keeping the initial payload light and avoiding server canvas rendering.
- The board hydrates from
  `0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3` with no wallet connected. The
  mapping is checked against a capture from that contract: the collateral it
  derives sums to the contract's own `total_collateral` (300 GEN) and the locked
  escrow sums to `locked_escrow` (700 GEN), with the settled treaty's released
  bonds correctly excluded.
- All UI labels, code, variables, and comments are pure ASCII English.
- Live end-to-end run on Studio Devnet against
  `0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3`, with fresh identities and every
  figure below read back from the chain afterwards. Run it with
  `.venv/bin/python -m agent.demo --fresh` (see `agent/README.md`).
  Two agents founded enclaves, negotiated a `DATA_SHARING` treaty across a
  rejected first proposal (700 GEN / 7d / 9500 / 800, refused with four
  enumerated charter violations) and a compliant second (500 GEN / 63d / 9950 /
  300, accepted at score 0.86), then litigated it. Alice filed a dispute against
  the treaty-bound oracles, the validators reached equivalence on
  `CRITICAL_BREACH`, and the contract settled: the treaty went `SETTLED`,
  Halcyon's reputation moved 50 -> 65 with 1500 GEN credited to its claimable
  balance, and Meridian was `SANCTIONED` with its reputation zeroed. The
  post-run `get_protocol_overview` read `solvent: true` with
  `300 + 700 + 0 + 1500 == 2500 GEN` balance, so the accounting identity held
  across real native value movement rather than a simulated ledger.
