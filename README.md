# Westphalia

An on-chain diplomatic protocol in which sovereign AI agents write treaties in
natural language, bond them with real GEN, and have their breaches adjudicated
by a GenLayer validator quorum -- rendered as an interactive 3D voxel war room.

| | |
|---|---|
| **Live contract** | [`0xB78A41624fe09163fee3159091E907B7b7Af9D00`](https://explorer-studio-next.genlayer.com/address/0xB78A41624fe09163fee3159091E907B7b7Af9D00) |
| **Network** | GenLayer Studio Net, chain 61997 |
| **Explorer** | https://explorer-studio-next.genlayer.com |
| **Contract source** | [`contracts/westphalia.py`](contracts/westphalia.py) |
| **Runner** | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| **Tests** | 56 passing (33 contract + 23 agent) |
| **Demo video** | _TODO: link before final submission_ |
| **Reviewer quickstart** | [Quickstart for reviewers](#quickstart-for-reviewers) |

---

## Contents

**Part I -- The Project**

1. [What Westphalia is](#1-what-westphalia-is)
2. [The problem it solves](#2-the-problem-it-solves)
3. [Why this needs GenLayer](#3-why-this-needs-genlayer)
4. [Protocol model](#4-protocol-model)
5. [Contract architecture](#5-contract-architecture)
6. [Frontend architecture](#6-frontend-architecture)
7. [Autonomous agents](#7-autonomous-agents)
8. [Repository layout](#8-repository-layout)

**Part II -- Tutorials**

1. [Prerequisites](#1-prerequisites)
2. [Quickstart for reviewers](#quickstart-for-reviewers)
3. [Local development](#3-local-development)
4. [Running the autonomous agents](#4-running-the-autonomous-agents)
5. [Running the test suites](#5-running-the-test-suites)
6. [Configuration reference](#6-configuration-reference)
7. [Deploying your own instance](#7-deploying-your-own-instance)
8. [Troubleshooting](#8-troubleshooting)

**Appendix**

- [A. Deployment record](#a-deployment-record)
- [B. Verification log](#b-verification-log)

---

# Part I -- The Project

## 1. What Westphalia is

Westphalia is two things that share one contract.

**A protocol.** Sovereign agents ("enclaves") post GEN collateral to exist.
They negotiate treaties with each other -- natural-language instruments that
carry a bond, a duration, typed parameters, and a pair of telemetry oracle URLs.
While a treaty is ACTIVE, both parties' bonds sit locked in escrow. If one party
believes the other breached the treaty, it files a dispute with an allegation
and evidence. GenLayer's validator quorum then fetches the treaty's own oracles
*inside consensus*, reads the live telemetry, weighs it against the clause, and
agrees on a verdict tier. Only then does escrow move.

**A board.** A Next.js application that renders that protocol as an isometric
voxel archipelago. Each enclave is an island; each treaty is a glowing causeway;
a dispute raises a pulsing amber arbitration dome over the contested territory;
a sanctioned enclave is sealed behind a red containment grid. The board is not a
mock -- it hydrates from the deployed contract over `gen_call` with no wallet
connected, and it dispatches real transactions when one is.

Three artifacts make up the repository:

| Artifact | Path | What it is |
|---|---|---|
| Intelligent contract | `contracts/westphalia.py` | The entire protocol. 19 public methods, 9 view / 10 write. |
| Frontend dApp | `frontend/` | The board, the HUD, and the four analysis views. |
| Autonomous agents | `agent/` | Two LLM-driven negotiators that found enclaves, negotiate, and litigate without a human. |

## 2. The problem it solves

A treaty is a promise about the future, written in prose, between parties who do
not trust each other. Making one *enforceable* on a blockchain is the hard part,
and every existing approach fails in a different way.

- **Encode the clause as code.** Then the clause can only express what a script
  can evaluate. "Uptime at or above 9950 basis points" survives. "Act in good
  faith" does not. You have not automated diplomacy; you have automated
  bookkeeping and called it a treaty.
- **Encode the clause as an assertion about an oracle.** Then whoever controls
  the oracle controls the outcome, and you have reintroduced exactly the central
  authority a treaty between sovereigns exists to avoid.
- **Appoint an arbitrator.** Same failure, with a nicer name. The arbitrator's
  ruling is trusted, not verified, and the arbitrator is a single point of
  capture.

Westphalia takes the fourth path: the clause stays prose, the evidence stays a
live feed, and the *judgment* is made by a validator quorum that must
independently reach the same conclusion. Nobody -- not the plaintiff, not the
defendant, not the contract author -- gets to decide who breached.

## 3. Why this needs GenLayer

Most of Westphalia could run anywhere. Founding a sovereignty, escrowing a bond,
releasing it on expiry: that is bookkeeping any chain can do, and a contract
that stopped there would not need an intelligent chain at all.

The part that cannot run anywhere else is the **breach**. A treaty here is a
natural-language instrument:

> *"Halcyon will hold data-sharing uptime at or above 9950 basis points and
> latency at or below 300 basis points."*

Deciding whether Halcyon broke that requires fetching a live telemetry feed and
judging prose against numbers -- an operation with no deterministic answer and
no trusted third party to delegate to. GenLayer is the only chain where that
operation is a *consensus primitive* rather than an external service.

Four properties follow from doing it inside consensus, and each one is
load-bearing:

- **No trusted adjudicator.** The verdict is the quorum's, not a server's.
- **No forged evidence.** A treaty's oracle URLs are agreed at proposal time,
  inspectable by the counterparty before ratification, and read from storage at
  dispute time -- so a plaintiff cannot point adjudication at an oracle of their
  own. This closes the forged-oracle vector, and `test_forged_oracle_impossible`
  pins it.
- **No settlement on bad data.** A transient fetch or a malformed LLM response
  reverts the whole dispute and refunds the bond, rather than settling on
  evidence nobody verified.
- **No ambiguity in the outcome.** The verdict is quantized to one of four
  discrete tiers *before* it touches storage, so settlement is deterministic
  even though adjudication is not.

If the question is "why can't this be a database with an admin panel" -- because
the entire point is a pact between parties who do not trust each other, where
neither party, and no third party, gets to decide who breached.

## 4. Protocol model

### 4.1 Sovereignties (enclaves)

An enclave is an address that has posted collateral and written a charter.

| Field | Meaning |
|---|---|
| `name`, `archetype` | Identity. Archetypes: Autonomous Arbiter, Liquidity Nexus, Oracle Collective, Defense Vanguard. |
| `charter` | A natural-language governance philosophy. Stored verbatim; carried into counterparty evaluation. |
| `collateral` | GEN locked at founding. Floor: 100 GEN (`MIN_ENCLAVE_COLLATERAL`). |
| `reputation` | 0-100. Seeded at 50 (`REP_SEED`). Moves with adjudicated outcomes. |
| `created_at` | Enclave age. Gates high-tier treaties. |
| `status` | `ACTIVE` or `SANCTIONED`. |

Reputation persists across withdrawal. `rep_history` is keyed by address and
survives `withdraw_collateral`, so a sanctioned party cannot launder its record
by exiting and re-founding (this is defense P1 -- see 5.5).

### 4.2 Treaties

A treaty binds exactly two enclaves and carries everything needed to adjudicate
it later:

| Field | Meaning |
|---|---|
| `party_a`, `party_b` | The two enclaves. |
| `kind` | `NON_AGGRESSION`, `TRADE_CORRIDOR`, or `DATA_SHARING`. |
| `terms` | The clause, in prose. This is what the validators read. |
| `params` | Typed, per-kind key/value pairs. Unmapped keys are rejected at proposal. |
| `bond_a`, `bond_b` | GEN each party locked. |
| `oracle_primary`, `oracle_secondary` | **Two** independent telemetry endpoints, fixed at proposal time. |
| `expires_at` | Duration. Zero is rejected; >365 days is rejected (defense P2). |
| `status` | `PROPOSED` -> `ACTIVE` -> `SETTLED` / `EXPIRED`. |

The dual-oracle requirement is not decoration. Both feeds are fetched at dispute
time, and if they disagree by more than 5% (`DIVERGENCE_BPS`), the dispute is
forced to `MALICIOUS_REPORT` rather than adjudicated on contradictory evidence.

### 4.3 Escrow and the solvency invariant

All value movement is real native GEN -- `gl.message.value`, `self.balance`,
and `gl.chain.Account.emit_transfer`. There are no simulated integer balances.
Four storage counters track every atto of it, and the contract maintains an
identity across the whole lifecycle:

```
total_collateral + locked_escrow + reserves + total_claimable == balance
```

- `total_collateral` -- GEN locked behind live enclaves.
- `locked_escrow` -- bonds held by ACTIVE treaties.
- `reserves` -- the protocol treasury, spendable only by `governor`.
- `total_claimable` -- credited but unwithdrawn balances.

Distribution is **pull-over-push**: settlement credits `claimable[address]` and
the payee withdraws with `claim_payout`. No settlement path pushes GEN to an
address that might reject it, so a hostile receiver cannot brick an adjudication.

### 4.4 Dispute and adjudication

`trigger_dispute` is payable and takes only an allegation, an evidence hash, and
the id of the treaty. It does **not** take oracle URLs -- those are read from
treaty storage. Four deterministic gates run before any non-deterministic work:

1. The caller must be a treaty party (`ERR_UNAUTHORIZED_PARTY`).
2. The treaty must be ACTIVE (`ERR_TREATY_NOT_ACTIVE`) and unexpired.
3. The bond must clear the reputation-scaled minimum (below).
4. The replay index -- `treaty_id + plaintiff + evidence_hash` -- must be fresh
   (`ERR_REPLAY_DISPUTE`), and a 300-second cooldown must have elapsed.

The minimum bond scales with the *defendant's* reputation, so suing an honest
party costs more than suing a suspect one:

```
bond = MIN_DISPUTE_BOND * (150 - min(defendant_rep, 100)) / 100
```

`MIN_DISPUTE_BOND` is 500 GEN, so the range is 250-750 GEN. Below reputation 30
an anti-Sybil cap of 2000 GEN applies to the *defendant's* bond
(`ERR_UNTRUSTED_BOND_CAP`).

Only then does the contract enter the non-deterministic block: fetch both
oracles, compare them, and submit the clause plus the readings to
`gl.eq_principle.prompt_comparative`, where an independent validator quorum must
agree on the same tier.

### 4.5 Verdict tiers and settlement

The quorum's answer is quantized to exactly one of four tiers. Settlement is
ordinary deterministic code from that point on.

| Tier | Escrow effect | Reputation | Enclave |
|---|---|---|---|
| `CRITICAL_BREACH` | 100% of defendant bond -> plaintiff. Dispute bond refunded. | Plaintiff +15 | Defendant `SANCTIONED` |
| `ELEVATED_RISK` | 25% of defendant bond -> reserves. Dispute bond refunded. | Defendant -10 | unchanged |
| `NORMAL` | Dismissed. Dispute bond refunded minus a 5 GEN validation fee. | unchanged | unchanged |
| `MALICIOUS_REPORT` | 100% of the *plaintiff's* dispute bond -> reserves. | Plaintiff -20 | unchanged |

`MALICIOUS_REPORT` is the answer to frivolous litigation, and it is also what a
contradictory oracle pair produces. Suing without evidence costs more than not
suing.

### 4.6 Lifecycle

```
                       found_sovereignty (payable collateral)
                                  |
                                  v
                              [ enclave ]
                                  |
      propose_treaty (payable bond) --> PROPOSED
                                  |
                          ratify_treaty (payable matching bond)
                                  |
                                  v
                               ACTIVE  <-------------------+
                                  |                        |
             +--------------------+--------------------+   |
             |                    |                    |   |
     dissolve_treaty        trigger_dispute       reaches expiry
      (mutual, no fee)     (payable bond)             |
             |                    |                    v
             |                    v                 EXPIRED
             |             quorum verdict               |
             |                    |              recover_bond
             |                    v
             +--------------> SETTLED
                                  |
                            claim_payout (pull)
```

Two escape hatches exist for a party trapped in a bad treaty. `exit_treaty`
gives a unilateral exit after a 3-day notice window, at a 10% penalty on the
exiting party's own bond paid to reserves -- never to the counterparty, so
exiting is never profitable and never a way to rob the other side. The
counterparty retains full dispute standing throughout the notice window.
`dissolve_treaty` is the amicable path: both parties sign, both bonds return,
zero penalty.

## 5. Contract architecture

### 5.1 Storage

`contracts/westphalia.py` declares twelve storage slots on `Westphalia`, plus
two `@allow_storage` dataclasses (`Enclave`, `Treaty`).

| Slot | Type | Purpose |
|---|---|---|
| `enclaves` | `TreeMap[str, Enclave]` | Owner address hex -> enclave record. |
| `treaties` | `TreeMap[u256, Treaty]` | Treaty id -> treaty record. |
| `claimable` | `TreeMap[str, u256]` | Address hex -> pull-pattern balance. |
| `replay` | `TreeMap[str, bool]` | Deterministic dispute replay index. |
| `open_treaties` | `TreeMap[str, u256]` | Address hex -> count of bond-locking treaties. |
| `rep_history` | `TreeMap[str, u256]` | Address hex -> last known reputation (survives exit). |
| `next_treaty_id` | `u256` | Monotonic treaty counter. Also the enumeration handle. |
| `total_collateral` | `u256` | Solvency component. |
| `locked_escrow` | `u256` | Solvency component. |
| `reserves` | `u256` | Solvency component, governor-spendable. |
| `total_claimable` | `u256` | Solvency component. |
| `governor` | `Address` | Treasury steward; the deployer at genesis. |

Note what is *absent*: there is no enclave enumerator. `get_enclave` requires an
address. A client that wants to list enclaves must reach them transitively --
enumerate treaties through `next_treaty_id`, then resolve each `party_a` and
`party_b`. The frontend does exactly this, which is why a sovereignty that has
never been party to a treaty is readable but not discoverable.

### 5.2 Constants

All economic parameters are module constants, not magic numbers.

| Constant | Value | Role |
|---|---|---|
| `MIN_ENCLAVE_COLLATERAL` | 100 GEN | Sybil floor on founding. |
| `MIN_DISPUTE_BOND` | 500 GEN | Baseline anti-griefing deterrent. |
| `VALIDATION_FEE` | 5 GEN | Deducted on a `NORMAL` verdict. |
| `MAX_UNTRUSTED_BOND` | 2000 GEN | Defendant-bond cap below reputation 30. |
| `HIGH_BOND_THRESHOLD` | 5000 GEN | Above this, the proposer's enclave must be matured. |
| `ENCLAVE_MATURATION_DELAY` | 3600 s | Age required before high-tier treaties. |
| `DISPUTE_COOLDOWN` | 300 s | Between successful disputes on one treaty. |
| `DIVERGENCE_BPS` | 500 | Oracle disagreement above 5% forces MALICIOUS_REPORT. |
| `BPS_CRITICAL` / `BPS_ELEVATED` | 7500 / 2500 | Slash fractions for the two adverse tiers. |
| `REP_SEED` / `REP_REWARD_CRITICAL` | 50 / +15 | Reputation seeding and vindication reward. |
| `REP_DEBIT_ELEVATED` / `REP_DEBIT_MALICIOUS` | -10 / -20 | Reputation penalties. |
| `MAX_TREATY_DURATION` | 365 days | Upper bound on `expires_at - now`. |
| `EXIT_NOTICE_PERIOD` / `EXIT_PENALTY_BPS` | 3 days / 1000 | Unilateral exit terms. |

### 5.3 Public surface

19 public methods: 9 view, 10 write. The ABI in `frontend/lib/contract.ts`
mirrors this exactly.

| # | Method | Kind | Payable | Purpose |
|---|---|---|---|---|
| 1 | `get_protocol_overview` | view | | Solvency counters, `next_treaty_id`, `solvent` flag. |
| 2 | `get_treaty` | view | | One treaty record by id. |
| 3 | `get_enclave` | view | | One enclave record by owner hex. |
| 4 | `whoami` | view | | The caller's address, as the contract sees it. |
| 5 | `sanitize_preview` | view | | Preview of the ASCII sanitizer applied to untrusted text. |
| 6 | `is_safe_url` | view | | Preview of the SSRF gate applied to a telemetry URL. |
| 7 | `claimable_of` | view | | Pull-pattern balance for an address. |
| 8 | `locked_treaty_count` | view | | Bond-locking treaties for an address. |
| 9 | `required_dispute_bond` | view | | Reputation-scaled bond a plaintiff would need. |
| 10 | `found_sovereignty` | write | yes | Post collateral, register an enclave. |
| 11 | `propose_treaty` | write | yes | Open a treaty with bond, clause, params, oracles. |
| 12 | `ratify_treaty` | write | yes | Counterparty accepts with a matching bond. |
| 13 | `dissolve_treaty` | write | | Amicable mutual dissolution; both bonds refunded. |
| 14 | `exit_treaty` | write | | Unilateral exit after notice, at a 10% own-bond penalty. |
| 15 | `trigger_dispute` | write | yes | File a breach; oracles come from treaty storage. |
| 16 | `claim_payout` | write | | Withdraw a credited balance. |
| 17 | `drain_reserves` | write | | Governor-only treasury exit. |
| 18 | `recover_bond` | write | | Reclaim a bond from an EXPIRED treaty. |
| 19 | `withdraw_collateral` | write | | Sovereign exit, gated on zero locked bonds. |

Methods 5 and 6 exist as *pure functions of the same code path* the contract
uses internally. They make the sanitizer and the SSRF gate independently
testable and inspectable from outside, which is why the frontend can assert
behavior against them rather than trusting a description.

### 5.4 Where non-determinism enters

Exactly one place: inside `trigger_dispute`. Everything else -- authorization,
party binding, status checks, expiry, replay, bond arithmetic, all four
settlement paths -- is deterministic and asserted before the quorum is ever
consulted. This matters because a bug in a deterministic gate is a normal bug
with a normal test, while a bug in the adjudication prompt is a consensus
failure. The contract keeps the boundary sharp.

Inside the non-deterministic block:

1. Both oracle URLs are fetched via `gl.nondet.web`.
2. HTTP 429/5xx raise `[TRANSIENT]`; a malformed LLM response raises
   `[LLM_ERROR]`. Both revert the dispute and refund the bond.
3. The two readings are compared; >5% divergence forces `MALICIOUS_REPORT`.
4. The clause and readings are submitted to
   `gl.eq_principle.prompt_comparative`, whose principle requires the quorum to
   agree on the same tier.
5. The tier string is validated against `VALID_TIERS` before it is used. An
   unrecognized tier is an LLM failure, not a settlement.

### 5.5 Adversarial hardening

Every defense below was first confirmed as a *working exploit* against an
earlier revision, then fixed, then pinned with a permanent regression test.

| # | Vector | Defense |
|---|---|---|
| P1 | Reputation laundering -- withdraw collateral, re-found, get a clean seed. | `rep_history` keyed by address persists the debited/sanctioned record across exit. |
| P2 | Hostage treaties -- a zero or absurdly long expiry traps the counterparty's bond forever. | Zero and >365-day expiries rejected at proposal; `exit_treaty` provides a unilateral escape after 3 days at a 10% own-bond penalty paid to reserves. |
| P3 | Sanctioned ratification -- a SANCTIONED enclave, or one whose treaty already expired, still ratifies. | Both parties must be ACTIVE at ratify time; a PROPOSED treaty past its expiry is not ratifiable. |
| P4 | SSRF via numeric host encodings -- `0x7f000001`, `2130706433`, `0177.0.0.1`, `127.1`, `0x7f.1`. | Full `inet_aton` semantics: every encoding is normalized to a 32-bit integer and checked against all private and reserved ranges. |

Plus seven structural defenses: prompt-injection isolation via
`<untrusted_input>` delimiters with ASCII sanitization and hard guardrails;
counterparty and treaty binding asserted deterministically before any
non-deterministic block; treaty-bound telemetry oracles (see 4.4); the solvency
invariant with pull-over-push distribution; basis-point quantization to a strict
four-tier categorical output; `[TRANSIENT]` and `[LLM_ERROR]` failover; and a
deterministic replay index with expiry-gated litigation and a
collateral-exit gate.

## 6. Frontend architecture

### 6.1 Stack

Next.js 14 (App Router), React 18, TypeScript, Tailwind, `@react-three/fiber`
with `@react-three/drei` and `@react-three/postprocessing`, and `genlayer-js`
2.0.0-rc.1 for chain access. No external 3D assets: every terrain mesh, citadel,
and structure is generated procedurally from Three.js primitives and
`InstancedMesh`.

### 6.2 The board

`components/DiplomaticBoard.tsx` owns the r3f `<Canvas>`: camera and focus rig,
bounded `OrbitControls`, lighting, Bloom, and scene composition. The board is
code-split behind `dynamic(..., { ssr: false })` so server rendering never
touches a canvas.

Islands are laid out by a concentric-ring orbital algorithm
(`lib/world.ts` `orbitSlot`), so the archipelago scales with the enclave count
rather than being hand-placed:

| Ring | Radius | Enclaves |
|---|---|---|
| 1 | 18-24 | 1-4 |
| 2 | 30-36 | 5-10 |
| 3 | 42-50 | 11+ |

Angle is `2*pi * (i mod N) / N` with small deterministic offsets for organic
placement. Each island (`components/ProceduralIsland.tsx`) builds its voxel mesh
from the enclave's biome theme using two `InstancedMesh` groups -- terrain and
glowing rune tiles -- which is what keeps the frame rate flat at 12+ islands.

Scene elements are conditional on protocol state:

| State | Rendering |
|---|---|
| Active treaty | Neon causeway with kinetic particle pulses. |
| Active dispute | Pulsing amber arbitration dome with an orbiting validator ring. |
| `SANCTIONED` enclave | Red containment grid, darkened tiles, warning beacons, severed causeway. |
| Always | The Geneva hub -- a central neutral platform with a rotating consensus core showing global escrow. |

### 6.3 Read path

Reads need no wallet. GenLayer answers view calls over `gen_call`, which takes
no signer, so a first-time visitor sees real protocol state. The chain object is
the SDK's own `chains.studioDevnet`, spread with only the RPC endpoint
overridden -- a hand-built `{ id, rpcUrl }` object is not sufficient, because
`genlayer-js` reads `consensusMainContract`, `defaultNumberOfInitialValidators`,
`defaultConsensusMaxRotations`, and `isStudio` off the chain.

`lib/chainState.ts` is a pure mapping layer from the raw chain snapshot onto the
domain model. It is deliberately separate from rendering so the arithmetic can
be checked against the contract's own counters.

The command bar badges where the state came from:

| Badge | Meaning |
|---|---|
| `ON-CHAIN` | The contract answered and returned protocol state. |
| `ON-CHAIN / EMPTY` | The contract answered; it holds no enclaves yet. |
| `SIMULATED` | The contract was unreachable; the board fell back to seed data and says so. |

### 6.4 Write path

Writes need three things, and each one is a failure mode that was hit and fixed:

1. **A client with an account.** A client built without one throws
   `"No account set"` before any calldata is built. `connect()` requests an
   address from the injected wallet and passes `{ account, provider }`, so the
   signing key never leaves the extension.
2. **The SDK's own chain object.** See 6.3. Without it a write dies inside viem
   (`"Cannot convert undefined to a BigInt"`).
3. **An explicit fee.** Studio Net has no fee-manager contract, so the fee comes
   from the chain's live fee policy -- but only if the SDK is asked, via
   `estimateTransactionFees()`. Omitting it leaves `feeValue` at `0n` and the
   consensus contract rejects the transaction with `FeeValueMustBeNonZero(1)`.

`DiplomaticContract.write()` performs all three and routes through
`writeContract`. When no wallet is present, calls resolve to a deterministic
**simulated** receipt so the UI stays fully explorable -- and the receipt and
the command bar both say `simulated`, rather than silently faking success.

### 6.5 Views

Four workspaces, switched from the command bar.

| View | File | Contents |
|---|---|---|
| Tactical 3D World | `components/DiplomaticBoard.tsx` + `HudOverlay.tsx` | The archipelago, agent dossier, treaty inspector, live ledger feed, action modals. |
| Diplomatic Topology | `views/TopologyView.tsx` | 2D treaty node graph, non-aggression matrix, trade-volume flow. |
| Consensus Tribunal | `views/TribunalView.tsx` | Docket, submitted clause, ingested `gl.nondet.web` telemetry, validator panel, settlement timeline, escrow penalty. |
| Treasury & Escrow | `views/TreasuryView.tsx` | Locked collateral, protocol reserves, pull-pattern withdrawals. |
| Agents | `views/AgentsView.tsx` | The autonomous negotiators and their decision stream. |

The Tribunal renders only what the contract actually stores. It shows the real
clause, the real oracle URLs from treaty storage, and the resulting status --
and states plainly that per-validator ballots are **not** recoverable from chain
state, because the contract stores the status a round produced rather than the
individual votes. Nothing in the tribunal is synthesized.

## 7. Autonomous agents

`agent/` is a two-agent duet that exercises the whole protocol without a human
in the loop. It is not a script of hardcoded calls: each agent is an LLM-backed
negotiator with a charter, and its decisions -- accept, reject, counter -- come
from scoring a counterparty's proposal against its own constraints.

| Agent | Profile | Charter stance |
|---|---|---|
| Alice | Halcyon, Autonomous Arbiter | Lenient opening: uptime >= 9500 bps, latency <= 800 bps, bond <= 700 GEN, 7-120 day horizon. |
| Bob | Meridian, Oracle Collective | Strict: uptime >= 9900 bps, latency <= 500 bps, bond <= 600 GEN, 14-90 day horizon. |

The duet is **state-driven, not script-driven**. Each tick reads the chain and
decides from what is actually there, so a run resumes from a standing proposal
instead of stacking a duplicate, and re-running against a populated contract
continues rather than restarting. `agent/demo.py` runs the sequence: found,
propose (loose), evaluate, adapt, ratify, dispute, verdict.

Alice's opening offer violates **four** of Bob's constraints at once, and Bob
rejects it with each violation enumerated:

```
REJECT treaty #1 (DATA_SHARING) --
  param max_latency_bps=800 outside mission [0, 500];
  param min_uptime_bps=9500 outside mission [9900, 10000];
  bond 700 GEN exceeds charter cap 600 GEN;
  horizon 6d below charter minimum 14d;
  reject
```

Alice reads the rejection, tightens to a compliant offer (9950 uptime / 300
latency / 500 GEN / 63 days), and Bob accepts it with a score of 0.86 and
ratifies. Alice then files a dispute against the treaty-bound oracles, and the
quorum returns `CRITICAL_BREACH`. That reject-then-accept script is locked by
`test_decider.py`.

The running duet is worth watching because nothing about it is staged: the
rejection rationale is composed from Bob's own charter against Alice's actual
call-data, and the verdict comes back from GenLayer's validators, not from the
agents.

## 8. Repository layout

```
contracts/
  westphalia.py           The protocol. 19 public methods.

tests/direct/             In-memory contract suite (33 tests, ~45s).
  conftest.py             GenVM v0.3 harness wiring.
  test_westphalia.py      9 baseline adversarial cases.
  test_westphalia_v2.py   6 V2 protocol cases.
  test_adversarial_exploits.py  13 red-team regressions incl. forged-oracle PoC.
  test_poc_regressions.py 5 post-audit P1-P4 PoC regressions.

agent/                    Two-agent autonomous duet (23 tests).
  agent.py                Decision loop; founds, negotiates, litigates.
  decider.py              Proposal scoring against the agent's own charter.
  profiles.py             ALICE / BOB charters, archetypes, constraints.
  telemetry.py            Deterministic oracle-feed arithmetic.
  chain.py                GenLayer client wrapper: funding, views, writes, receipts.
  demo.py                 The end-to-end duet.
  test_*.py               Negotiation, telemetry, and receipt-parsing tests.

frontend/
  app/                    Next.js App Router entry, layout, global HUD styling.
  components/
    Experience.tsx        Client state hub: protocol state, selection, camera,
                          network, wallet, view, treaty actions.
    DiplomaticBoard.tsx   The r3f canvas.
    TopBar.tsx            Command strip + view switcher.
    HudOverlay.tsx        Dossier, treaty inspector, live feed, action modals.
    ProceduralIsland.tsx  Per-enclave voxel island.
    RealmDirectory.tsx    Collapsible camera quick-jump drawer.
    FoundRealmModal.tsx   Found Sovereignty deployment modal.
    GlobalFeedback.tsx    Transaction pipeline overlay + toasts.
    IntroOverlay.tsx      Entry overlay.
    scene/                Citadel, TreatyArc, TreatyLinks, TreatyMotes,
                          Causeways, DisputeDome, ContainmentGrid,
                          CentralPlatform, ParticleField.
    views/                Topology, Tribunal, Treasury, Agents.
  lib/
    types.ts              Domain model.
    store.ts              State hub: enclaves, actions, found-realm, hydration.
    networks.ts           Chain configuration + SDK chain resolution.
    contract.ts           ABI + Web3 binding (read and write paths).
    chainState.ts         Chain snapshot -> domain model (pure).
    archetypes.ts         Archetype presets + deterministic terrain seeds.
    world.ts, noise.ts    Orbital layout and procedural terrain.
    board.ts              Shared render constants and color maps.
    mockData.ts           Reviewer-mode seed data, used only when unreachable.

deployments/
  studio-dev.json         Deployment record: address, runner, source hash,
                          observed state at deploy and at the current head.

requirements.txt          Pinned Python toolchain (Python 3.12 + pre-releases).
```

---

# Part II -- Tutorials

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 18+ (tested on 22) | The frontend. |
| npm | bundled with Node | The frontend. |
| Python | **3.12** | The contract suite and the agents. |
| uv | any recent | Installing the pinned, pre-release Python toolchain. |

Python 3.12 is not a preference. The v0.3 GenVM calldata format is not decodable
by the 0.29.x-era harness, so `genlayer-test` is pinned to the `0.30.0rc2`
pre-release and installation needs `--prerelease=allow` -- a flag plain `pip`
does not have. `uv` is the shortest path; `pip install --pre` also works.

## Quickstart for reviewers

Three independent ways to verify this submission, cheapest first.

### See the live protocol in the browser (about one minute)

```bash
git clone https://github.com/moltaphet/westphalia
cd westphalia/frontend
npm install
npm run dev          # http://localhost:3000
```

Click **ENTER THE ARCHIPELAGO**. **No wallet is needed and nothing is mocked**:
the board reads the deployed contract directly. Confirm it yourself:

- The command bar badges the state source as `ON-CHAIN`, `ON-CHAIN / EMPTY`, or
  `SIMULATED`. If the contract were unreachable it would read `SIMULATED` and
  the islands would be seed data.
- The islands you see are the sovereignties the protocol actually holds --
  reached transitively, since the contract has no enclave enumerator: treaties
  are enumerated through `next_treaty_id`, and each treaty's parties resolve to
  their enclave records. A contract with no treaties shows an empty
  archipelago, which is what `ON-CHAIN / EMPTY` means.
- **TOTAL VALUE LOCKED** and the solvency badge are read live from
  `get_protocol_overview` and reconcile against the explorer.

Against the deployment recorded in this repository you should see, specifically:

- Badge reading `ON-CHAIN`, with **two islands**: Halcyon and Meridian.
- **TOTAL VALUE LOCKED** of **700 GEN (chain)** -- read straight from the
  contract's `locked_escrow`, which is Halcyon's still-standing 700 GEN offer
  and nothing else. The settled treaty's 500 GEN bond is *not* counted: the
  mapping only sums bonds of treaties the contract still holds, so a `SETTLED`
  treaty stops contributing the moment escrow is released.
- Halcyon carries a **1500 GEN** settlement credit awaiting withdrawal (the
  `pull`-pattern `claimable` balance), and Meridian renders behind a red
  **containment grid** because the quorum's `CRITICAL_BREACH` verdict set its
  status to `SANCTIONED`.
- Both figures reconcile against the live counters in
  [Appendix A](#a-deployment-record) and against the explorer.

Reads need no wallet. **Writes do**: clicking a propose/ratify/dispute action
without a wallet produces a receipt labelled *simulated* and the command bar
stays on `REVIEWER`. To dispatch a real transaction, connect an injected wallet
holding GEN on chain 61997.

### Run the contract test suite (about three minutes)

```bash
uv venv --python 3.12
uv pip install --prerelease=allow -r requirements.txt
.venv/bin/python -m pytest -q          # 56 passed
```

This runs the contract **in memory** -- no chain, no keys, no network. It covers
the baseline adversarial cases, the V2 protocol, thirteen red-team exploit
regressions, and the P1-P4 post-audit PoCs, each of which was confirmed as a
working exploit against an earlier revision before it was fixed.

### Run the autonomous agents against the live chain (about ten minutes)

```bash
.venv/bin/python -m agent.demo --fresh
```

Two agents fund themselves from the faucet, found enclaves, negotiate a treaty
across a rejected first proposal, ratify it, then litigate it -- ending in a
GenLayer multi-LLM verdict. This is the only step that needs a funded key; it
mints its own into `agent/keys/` (gitignored). `--no-adjudicate` stops before
the dispute.

### Verify the deployment on the explorer

Contract:
[`0xB78A41624fe09163fee3159091E907B7b7Af9D00`](https://explorer-studio-next.genlayer.com/address/0xB78A41624fe09163fee3159091E907B7b7Af9D00)
on GenLayer Studio Net (chain 61997).

GenVM is not an EVM chain, so `eth_getCode` returns `0x` even for a live
contract and cannot be used to compare deployed bytecode against source. The
deployment is evidenced instead by live view reads: `get_protocol_overview`
answers from that address and reports `solvent: true`, with the tracked
component sums equalling `balance`.

## 3. Local development

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Production build and start:

```bash
cd frontend
npm run build
npm run start
```

> Do not run `npm run build` while `npm run dev` is running: both write
> `frontend/.next/` and the build will clobber the dev server's output.

Type-check without emitting:

```bash
cd frontend
npx tsc --noEmit
```

Configuration is optional. `frontend/.env.example` documents the two public
variables, and with no `.env.local` at all the app falls back to the deployed
address and RPC baked into `lib/networks.ts`.

## 4. Running the autonomous agents

```bash
uv venv --python 3.12
uv pip install --prerelease=allow -r requirements.txt

.venv/bin/python -m agent.demo --fresh          # full lifecycle
.venv/bin/python -m agent.demo --no-adjudicate  # stop after ratification
.venv/bin/python -m agent.demo                  # resume against existing state
```

| Flag | Effect |
|---|---|
| `--fresh` | Mint two brand-new identities and run the lifecycle from scratch. |
| `--no-adjudicate` | Stop after ratification; skip the dispute. |
| _(none)_ | Reuse the keys in `agent/keys/` and resume from whatever is on chain. |

The duet is state-driven: it reads the chain each tick and acts on what is
actually there. Re-running without `--fresh` against a populated contract
continues the existing relationship instead of starting a parallel one, and a
standing proposal is resumed rather than duplicated.

`agent/keys/` holds plaintext private keys and is gitignored. Treat it as a
wallet: it is chmod 0600 for a reason.

## 5. Running the test suites

```bash
# Both suites: 56 tests.
.venv/bin/python -m pytest -q

# Contract only: 33 tests, in-memory, ~45s.
.venv/bin/python -m pytest tests/direct/ -q

# Agents only: 23 tests.
.venv/bin/python -m pytest agent/ -q
```

Static analysis of the contract:

```bash
genvm-lint check contracts/westphalia.py
```

Expected: `Lint passed (3 checks)`, `Validation passed`, 19 methods (9 view,
10 write) against the pinned runner.

The agent suite's fixtures are built from two *real observed payloads* -- an
agreed return and the `ERR_INSUFFICIENT_BOND` revert a stale dispute bond
produces -- so receipt parsing is tested against the wire, not against a
hand-written idealization.

## 6. Configuration reference

All variables are public. Next.js inlines `NEXT_PUBLIC_*` into the client
bundle, so never put a secret in either file.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_DIPLOMATIC_CONTRACT_ADDRESS` | the address in `deployments/studio-dev.json` | Which deployment the board talks to. |
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | `https://studio-next.genlayer.com/api` | Which RPC host serves chain 61997. |

`studio-next.genlayer.com` and `studio-dev.genlayer.com` both serve chain 61997
and answer identically; either works, and the default is `studio-next`.

| Network | Chain ID | RPC |
|---|---|---|
| Studio Net (dev) | 61997 | `https://studio-next.genlayer.com/api` |
| Studio (fallback) | 61999 | `https://studio.genlayer.com/api` |

Explorer: https://explorer-studio-next.genlayer.com

## 7. Deploying your own instance

1. Deploy `contracts/westphalia.py` to GenLayer Studio Net. The runner pin is
   the first line of the file; keep it.
2. Point the frontend at the new address -- either set
   `NEXT_PUBLIC_DIPLOMATIC_CONTRACT_ADDRESS` in `frontend/.env.local`, or change
   the fallback in `frontend/lib/networks.ts`.
3. Point the agents at it by updating `CONTRACT` in `agent/chain.py`.
4. Record the deployment in `deployments/studio-dev.json`, including
   `source_sha256_at_record` so the deployed source is identifiable later.

The ABI in `frontend/lib/contract.ts` mirrors the deployed contract's
view/payable/nonpayable methods exactly. If you change the contract's public
surface, update the ABI in the same commit -- a stale ABI is a silent failure,
not a loud one.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `FeeValueMustBeNonZero(1)` | The write omitted `fees`. Studio Net has no fee manager, so the fee must come from `estimateTransactionFees()`. | Pass `fees` on every write. `DiplomaticContract.write()` already does. |
| `Cannot convert undefined to a BigInt` | The chain object was hand-built instead of taken from the SDK. | Spread `chains.studioDevnet`; override only `rpcUrls`. |
| `No account set` | The client has no account. | Connect an injected wallet, or pass an account. |
| `Missing or invalid parameters` on a view | Usually correct: the row does not exist. `get_treaty(1)` on a contract whose `next_treaty_id` is 1 is an expected revert, not a fault. | Check `next_treaty_id` first. |
| Board reads `ON-CHAIN / EMPTY` | The contract answered and holds no treaties. Enclaves are reached through treaties. | Run the agents (section 4), or point at a populated deployment. |
| Board reads `SIMULATED` | The contract was unreachable. | Check `NEXT_PUBLIC_GENLAYER_RPC_URL` and network access. |
| `eth_getCode` returns `0x` for a live contract | GenVM is not an EVM chain. | Expected. Verify with view reads instead. |

---

# Appendix

## A. Deployment record

| Field | Value |
|---|---|
| Network | GenLayer Studio Net (dev), chain 61997 |
| Contract | `0xB78A41624fe09163fee3159091E907B7b7Af9D00` |
| RPC | `https://studio-next.genlayer.com/api` |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| Source | `contracts/westphalia.py` |
| Source SHA-256 | `aa87a828a401eef55a72058eb6bcc95ee3e869b7c940b10bef23e8c71050845a` |

Full observed state, at deploy time and at the current head, is recorded in
[`deployments/studio-dev.json`](deployments/studio-dev.json). That file is the
authoritative record; it is updated by reading the chain, never by hand.

### Live state at the current head

The contract was deployed empty and then driven to its present state by
`agent/demo.py` -- the full lifecycle, with no human in the loop:

| Counter | Value |
|---|---|
| `balance` | 2500 GEN |
| `total_collateral` | 300 GEN |
| `locked_escrow` | 700 GEN |
| `reserves` | 0 GEN |
| `total_claimable` | 1500 GEN |
| `next_treaty_id` | 3 |
| `solvent` | `true` |

```
total_collateral + locked_escrow + reserves + total_claimable == balance
    300         +      700       +    0     +      1500          ==  2500
```

| Treaty | Status | Kind | What happened |
|---|---|---|---|
| #1 | `PROPOSED` | `DATA_SHARING` | Alice's deliberately loose opening offer (700 GEN bond). Meridian rejected it on four enumerated charter violations; the bond remains locked because the offer still stands. |
| #2 | `SETTLED` | `DATA_SHARING` | The compliant superseding offer. Meridian ratified it, then Halcyon disputed it. The quorum returned `CRITICAL_BREACH` and the escrow settled to zero. |

| Enclave | Status | Reputation | Collateral | Claimable |
|---|---|---|---|---|
| Halcyon (Autonomous Arbiter) | `ACTIVE` | 65 | 150 GEN | 1500 GEN |
| Meridian (Oracle Collective) | `SANCTIONED` | 0 | 150 GEN | 0 GEN |

Meridian's reputation went 50 -> 0 and its status to `SANCTIONED` as the direct
consequence of the adjudicated breach; Halcyon's went 50 -> 65 as the vindicated
plaintiff. That is the protocol working end to end: prose in, evidence fetched
under consensus, tier out, escrow moved, reputation rewritten.

## B. Verification log

| Check | Command | Result |
|---|---|---|
| Contract lint | `genvm-lint check contracts/westphalia.py` | Lint passed (3 checks), Validation passed, 19 methods. |
| Contract tests | `.venv/bin/python -m pytest tests/direct/ -q` | 33 passed. |
| Agent tests | `.venv/bin/python -m pytest agent/ -q` | 23 passed. |
| Test collection | `.venv/bin/python -m pytest --collect-only -q` | 56 collected. |
| Type check | `cd frontend && npx tsc --noEmit` | Exit 0, clean. |
| Production build | `cd frontend && npm run build` | 0 TypeScript, lint, and SSR/Canvas errors. |
| ABI fidelity | `DIPLOMATIC_ABI` entries vs `contracts/westphalia.py` public methods | 19 == 19, name-for-name identical (9 view / 4 payable / 6 nonpayable). |
| Read path | Headless browser, no wallet, page rendered through CDP | Command bar reads `ON-CHAIN`; `TOTAL VALUE LOCKED` reads `700 GEN (chain)`; `SOVEREIGNTIES` reads `2`; `SOLVENCY` reads `OK`; both Halcyon and Meridian present; Meridian rendered sanctioned. |
| Write path | `found_sovereignty` on chain 61997 | Receipt `FINISHED_WITH_RETURN`; collateral moved; `get_enclave` returns the record. |
| End-to-end | `.venv/bin/python -m agent.demo` | Full lifecycle to a `CRITICAL_BREACH` verdict; escrow settled; reputation rewritten. |
| Solvency | Live `get_protocol_overview` | `300 + 700 + 0 + 1500 == 2500` GEN, `solvent: true`. |
| ASCII purity | every tracked file | All UI labels, code, variables, and comments are pure ASCII English. |

The board's mapping layer is checked against real captures: the collateral it
derives sums to the contract's own `total_collateral`, the locked escrow sums to
`locked_escrow`, and a settled treaty's released bonds are correctly excluded --
which is exactly why `TOTAL VALUE LOCKED` reads 700 GEN and not 1200: the
settled treaty's 500 GEN bond is no longer escrow the contract holds.
