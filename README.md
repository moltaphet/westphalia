# Westphalia

An on-chain diplomatic protocol in which sovereign AI agents write treaties in
natural language, bond them with real GEN, and have their breaches adjudicated
by a **multi-LLM GenLayer validator quorum that reads real evidence on-chain** --
rendered as an interactive 3D voxel war room.

![Network: GenLayer Studio Next](https://img.shields.io/badge/network-GenLayer%20Studio%20Next-00E5FF)
![Chain ID: 61997](https://img.shields.io/badge/chain%20id-61997-7c3aed)
![Contract: 0x126d..74d9](https://img.shields.io/badge/contract-0x126d..74d9-00FFA3)
![Direct tests: 65 passing](https://img.shields.io/badge/direct%20tests-65%20passing-2ea043)
![genvm-lint: clean](https://img.shields.io/badge/genvm--lint-clean-2ea043)
![Runner: py-genlayer v0.3.0](https://img.shields.io/badge/runner-py--genlayer%20v0.3.0-333)

| | |
|---|---|
| **Live contract** | [`0x126d145Edcb422E94a3202dFa5c983C8DC5374d9`](https://explorer-studio-next.genlayer.com/address/0x126d145Edcb422E94a3202dFa5c983C8DC5374d9) |
| **Network** | GenLayer Studio Next, chain 61997 |
| **RPC** | `https://studio-next.genlayer.com/api` |
| **Explorer** | https://explorer-studio-next.genlayer.com |
| **Contract source** | [`contracts/westphalia.py`](contracts/westphalia.py) |
| **Runner** | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| **Tests** | 65 direct pytest tests passing; `genvm-lint check` clean (23 methods, 11 view / 12 write) |
| **Demo video** | [Demo Walkthrough Video - Click to Watch](https://...) |
| **Reviewer quickstart** | [Quickstart for reviewers](#quickstart-for-reviewers) |

---

## Audited V3 -- what makes GenLayer load-bearing

Westphalia is a production-hardened V3, shipped after two adversarial security
audits. GenLayer is not decoration: the protocol **cannot function** without
on-chain web reads and multi-LLM consensus, and the code layer only backstops
the tribunal, it never replaces it.

### 1. True semantic multi-LLM adjudication (no "AI theater")

- On a dispute, every validator independently runs the arbitration closure: it
  fetches the **defendant's dual telemetry** and the plaintiff's **evidence
  document** on-chain with `gl.nondet.web.get(evidence_uri)` (SSRF-guarded,
  sanitized, truncated to 1,500 chars), then a **multi-LLM tribunal reasons over
  the qualitative covenant `terms`, the allegation, and the real evidence**.
- Consensus is reached under the Equivalence Principle via
  `gl.eq_principle.prompt_comparative`: validators must agree on the **core legal
  judgment**, not on a byte-identical string. A judge that read the evidence and
  the covenant is what decides `CRITICAL_BREACH` vs `ELEVATED_RISK` vs `NORMAL`.
- The code-side clamp is a **narrow anti-hallucination guardrail, not an
  arithmetic `if/else` replacement**: it floors an injected breach to `NORMAL`
  only when telemetry reads a clean `0 bps` **and** no evidence document was
  provided. Everywhere else the tribunal's reasoning is trusted across the full
  tier spectrum.

### 2. Game-theoretic hardening

- **Courthouse race eliminated.** Telemetry is party-attributed
  (`{"party_a": ..., "party_b": ...}`) and adjudication reads only the
  **defendant's** metric, so a plaintiff can never weaponize a breach charged to
  itself to slash the counterparty.
- **Neutral oracle conflict (`FEED_CONFLICT`).** If the two independent-host
  oracles contradict, diverge by more than 5%, or are unreachable / corrupt, the
  dispute settles neutrally: **100% dispute-bond refund, 0 fee**, and the treaty
  stays `ACTIVE`. A defendant who controls one feed cannot force a slash.
- **Anti-griefing.** Independent per-party elevated flags
  (`elevated_slashed_a`, `elevated_slashed_b`): each party can be
  elevated-slashed at most once; a second elevated verdict settles and closes the
  treaty instead of bleeding the defendant with arbitrary evidence hashes.
- **Anti-hostage.** `cancel_proposal` reclaims a proposer's bond from an
  unratified proposal, and unilateral `exit_treaty` has a notice window that
  **either** party may execute after expiry (with a lapse fallback), so no party
  is ever trapped by a stalling counterparty.
- Plus: mandatory **dual independent-host oracles**, SSRF hardening (`urlsplit`,
  CGNAT `100.64.0.0/10`, `0.0.0.0/8`, trailing-dot and backslash normalization),
  strict per-party numeric telemetry parsing, and governor rotation
  (`transfer_governor`, which rejects the zero address).

### 3. Transparency

- The **local demo agents** (`agent/decider.py`) use **deterministic heuristics**
  so hackathon evaluation is reproducible: the same inputs always produce the
  same offers and the same staged outcomes, with no run-to-run flakiness. This is
  the off-chain **agent policy** only.
- The **on-chain tribunal adjudication is fully decentralized**: every GenVM
  validator independently fetches the evidence and runs its own LLM, and the
  verdict is reached across validators under the Equivalence Principle. The
  determinism of the demo agents never touches the on-chain ruling.

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

**License**

- [MIT](#license)

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
| Intelligent contract | `contracts/westphalia.py` | The entire protocol. 23 public methods, 11 view / 12 write. |
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

The dual-oracle requirement is not decoration. The two feeds must be on
independent hosts, and if they disagree by more than 5% (`DIVERGENCE_BPS`), are
unreachable, or return corrupt data, the dispute settles as a neutral
`FEED_CONFLICT` -- the plaintiff's bond is refunded in full with no fee, and the
treaty stays `ACTIVE` -- rather than being adjudicated on contradictory evidence.
This is what stops a defendant who controls one feed from forcing a slash.

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

The minimum bond scales inversely with the *plaintiff's* reputation, requiring newer
or lower-reputation plaintiffs to stake a higher anti-griefing bond:

```
bond = MIN_DISPUTE_BOND * (150 - min(plaintiff_rep, 100)) / 100
```

`MIN_DISPUTE_BOND` is 500 GEN, scaling between 250-750 GEN (a 100-rep plaintiff posts 250 GEN;
a 0-rep plaintiff posts 750 GEN). Separately, to prevent Sybil bond inflation, an anti-Sybil
cap of 2000 GEN (`MAX_UNTRUSTED_BOND`) applies to treaty proposals initiated by any enclave
with reputation below 30 (`ERR_UNTRUSTED_BOND_CAP`).

Only then does the contract enter the non-deterministic block: fetch both
oracles, compare them, and submit the clause plus the readings to
`gl.eq_principle.prompt_comparative`, where an independent validator quorum must
agree on the same tier.

### 4.5 Verdict tiers and settlement

The tribunal's answer is one of four categorical tiers, plus a code-decided
neutral outcome for feed conflicts. Settlement is ordinary deterministic code
from that point on.

| Tier | Escrow effect | Reputation | Enclave |
|---|---|---|---|
| `CRITICAL_BREACH` | 100% of defendant bond -> plaintiff. Dispute bond refunded. | Plaintiff +15 | Defendant `SANCTIONED` |
| `ELEVATED_RISK` | 25% of defendant bond -> reserves. Dispute bond refunded. A second elevated verdict against the same party settles and closes the treaty. | Defendant -10 | unchanged |
| `NORMAL` | Dismissed. Dispute bond refunded minus a 5 GEN validation fee. | unchanged | unchanged |
| `MALICIOUS_REPORT` | 100% of the *plaintiff's* dispute bond -> reserves. | Plaintiff -20 | unchanged |
| `FEED_CONFLICT` | Neutral. 100% dispute-bond refund, **zero** fee. | unchanged | unchanged |

`MALICIOUS_REPORT` is the answer to frivolous litigation the tribunal judges
unsupported by the evidence. A *contradictory or unreachable oracle pair* is no
longer forced to `MALICIOUS_REPORT` -- that would let a defendant weaponize a
feed it controls -- and instead settles neutrally as `FEED_CONFLICT`.

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

A third hatch covers the stage before a treaty exists. A `PROPOSED` treaty that
the counterparty neither ratifies nor rejects holds the proposer's bond -- and,
through `open_treaties`, blocks the proposer's own collateral exit -- until it
expires, which can be a year away. `cancel_proposal` lets the proposer reclaim
that bond unilaterally while the treaty is still `PROPOSED`. Only `party_a` may
call it, and only while the counterparty has posted nothing, so no counterparty
value is ever touched.

## 5. Contract architecture

### 5.1 Storage

`contracts/westphalia.py` declares fourteen storage slots on `Westphalia`, plus
two storage-enabled dataclasses (`Enclave`, `Treaty`). The dataclasses are
decorated `@allow_storage`, a module-level alias bound to `gl.storage.allow` --
the same decorator object under the bare name `genvm-lint`'s `E014` check matches
on. The alias changes the *name the linter sees*, not the decorator's behaviour;
see the note in section 5 on why it is not `@gl.allow_storage`.

| Slot | Type | Purpose |
|---|---|---|
| `enclaves` | `TreeMap[str, Enclave]` | Owner address hex -> enclave record. |
| `treaties` | `TreeMap[u256, Treaty]` | Treaty id -> treaty record. |
| `claimable` | `TreeMap[str, u256]` | Address hex -> pull-pattern balance. |
| `replay` | `TreeMap[str, bool]` | Deterministic dispute replay index. |
| `open_treaties` | `TreeMap[str, u256]` | Address hex -> count of bond-locking treaties. |
| `rep_history` | `TreeMap[str, u256]` | Address hex -> last known reputation (survives exit). |
| `next_treaty_id` | `u256` | Monotonic treaty counter. Also the treaty enumeration handle. |
| `total_collateral` | `u256` | Solvency component. |
| `locked_escrow` | `u256` | Solvency component. |
| `reserves` | `u256` | Solvency component, governor-spendable. |
| `total_claimable` | `u256` | Solvency component. |
| `governor` | `Address` | Treasury steward; the deployer at genesis. |
| `enclave_index` | `TreeMap[u256, str]` | Sequential roster slot -> owner address hex. |
| `enclave_count` | `u256` | Monotonic count of enclaves ever founded. |

The last two make the roster enumerable. `get_enclave` alone answers only for an
address a client already knows, so the set used to be derived transitively --
enumerate treaties through `next_treaty_id`, resolve each `party_a` and
`party_b` -- and a sovereignty that had never been party to a treaty was
readable but not discoverable. `get_enclave_count` plus `get_enclave_by_index`
lists every enclave directly. Both fields were appended *after* `governor`
rather than inserted: storage layout is positional, so an inserted field would
shift every slot below it. A slot whose enclave later withdrew is a
**tombstone** (`exists: false`) -- the count never rewinds, so a client can
enumerate safely while the roster changes underneath it.

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
| `DIVERGENCE_BPS` | 500 | Oracle disagreement above 5% settles as a neutral FEED_CONFLICT. |
| `BPS_CRITICAL` / `BPS_ELEVATED` | 7500 / 2500 | Slash fractions for the two adverse tiers. |
| `REP_SEED` / `REP_REWARD_CRITICAL` | 50 / +15 | Reputation seeding and vindication reward. |
| `REP_DEBIT_ELEVATED` / `REP_DEBIT_MALICIOUS` | -10 / -20 | Reputation penalties. |
| `MAX_TREATY_DURATION` | 365 days | Upper bound on `expires_at - now`. |
| `EXIT_NOTICE_PERIOD` / `EXIT_PENALTY_BPS` | 3 days / 1000 | Unilateral exit terms. |

### 5.3 Public surface

23 public methods: 11 view, 12 write. The ABI in `frontend/lib/contract.ts`
mirrors this exactly, and `scripts/check_abi.py` fails the build if it drifts.

| # | Method | Kind | Payable | Purpose |
|---|---|---|---|---|
| 1 | `get_protocol_overview` | view | | Solvency counters, `next_treaty_id`, `solvent` flag. |
| 2 | `get_treaty` | view | | One treaty record by id. |
| 3 | `get_enclave` | view | | One enclave record by owner hex. |
| 4 | `get_enclave_count` | view | | Enclaves ever founded. The roster enumeration handle. |
| 5 | `get_enclave_by_index` | view | | The enclave at a roster slot, with `exists` false for a tombstone. |
| 6 | `whoami` | view | | The caller's address, as the contract sees it. |
| 7 | `sanitize_preview` | view | | Preview of the ASCII sanitizer applied to untrusted text. |
| 8 | `is_safe_url` | view | | Preview of the SSRF gate applied to a telemetry URL. |
| 9 | `claimable_of` | view | | Pull-pattern balance for an address. |
| 10 | `locked_treaty_count` | view | | Bond-locking treaties for an address. |
| 11 | `required_dispute_bond` | view | | Reputation-scaled bond a plaintiff would need. |
| 12 | `found_sovereignty` | write | yes | Post collateral, register an enclave. |
| 13 | `propose_treaty` | write | yes | Open a treaty with bond, clause, params, oracles. |
| 14 | `ratify_treaty` | write | yes | Counterparty accepts with a matching bond. |
| 15 | `cancel_proposal` | write | | Proposer reclaims its bond from a still-`PROPOSED` treaty. |
| 16 | `dissolve_treaty` | write | | Amicable mutual dissolution; both bonds refunded. |
| 17 | `exit_treaty` | write | | Unilateral exit after notice, at a 10% own-bond penalty. |
| 18 | `trigger_dispute` | write | yes | File a breach; oracles come from treaty storage. |
| 19 | `claim_payout` | write | | Withdraw a credited balance. |
| 20 | `drain_reserves` | write | | Governor-only treasury exit. |
| 21 | `recover_bond` | write | | Reclaim a bond from an EXPIRED treaty. |
| 22 | `withdraw_collateral` | write | | Sovereign exit, gated on zero locked bonds. |

Methods 7 and 8 exist as *pure functions of the same code path* the contract
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

1. Both oracle URLs are fetched via `gl.nondet.web`, reading the **defendant's**
   party-attributed metric (`{"party_a": ..., "party_b": ...}`) only.
2. The plaintiff's `evidence_uri` is fetched with `gl.nondet.web.get` when it is
   an http(s) URL that passes the SSRF guard, sanitized and truncated to 1,500
   chars, so the tribunal reasons over the real document.
3. HTTP 429/5xx raise `[TRANSIENT]`; a malformed LLM response raises
   `[LLM_ERROR]`. Both revert the dispute and refund the bond.
4. If the two readings contradict, diverge >5%, or are unreachable/corrupt, the
   round returns `FEED_CONFLICT` (neutral, full refund) -- decided by code, never
   by the model.
5. Otherwise the covenant `terms`, allegation, evidence, and defendant metric are
   submitted to `gl.eq_principle.prompt_comparative`, whose principle requires the
   quorum to agree on the same *core legal judgment* (semantic, not byte-identical).
6. The tier is validated against `VALID_TIERS` and passed through the narrow
   anti-hallucination clamp (floors an injected breach to `NORMAL` only at 0 bps
   with no evidence) before settlement.

### 5.5 Adversarial hardening

Every defense below was first confirmed as a *working exploit* against an
earlier revision, then fixed, then pinned with a permanent regression test.

| # | Vector | Defense |
|---|---|---|
| P1 | Reputation laundering -- withdraw collateral, re-found, get a clean seed. | `rep_history` keyed by address persists the debited/sanctioned record across exit. |
| P2 | Hostage treaties -- a zero or absurdly long expiry traps the counterparty's bond forever. | Zero and >365-day expiries rejected at proposal; `exit_treaty` provides a unilateral escape after 3 days at a 10% own-bond penalty paid to reserves. |
| P3 | Sanctioned ratification -- a SANCTIONED enclave, or one whose treaty already expired, still ratifies. | Both parties must be ACTIVE at ratify time; a PROPOSED treaty past its expiry is not ratifiable. |
| P4 | SSRF via numeric host encodings -- `0x7f000001`, `2130706433`, `0177.0.0.1`, `127.1`, `0x7f.1`. | Full `inet_aton` semantics: every encoding is normalized to a 32-bit integer and checked against all private and reserved ranges. |

Two subsequent adversarial audits added the game-theoretic and semantic
hardening this V3 ships with, each pinned by regression tests
(`tests/direct/test_review_poc.py`, `tests/direct/test_audit2.py`):

| # | Vector | Defense |
|---|---|---|
| A1 | LLM hallucination / prompt injection slashing an innocent defendant. | Semantic adjudication over real evidence; a narrow code clamp floors an injected breach to `NORMAL` only at 0 bps with no evidence -- a guardrail, not an arithmetic override. |
| A2 | Defendant-controlled oracle forcing a slash by contradicting itself. | Contradiction / >5% divergence / unreachable feeds settle neutrally as `FEED_CONFLICT` (100% refund, 0 fee). |
| A3 | Cumulative `ELEVATED_RISK` griefing draining a bond with fresh evidence hashes. | Independent per-party flags (`elevated_slashed_a`, `elevated_slashed_b`); a second elevated verdict settles and closes the treaty. |
| A4 | Race to courthouse -- a breacher sues first to slash the victim. | Party-attributed telemetry; adjudication reads only the **defendant's** metric. |
| A5 | Unilateral-exit hostage / same-host "dual" oracles / boolean-and-overflow telemetry / zero-address governor burn. | Either party executes an exit after notice (lapse fallback); dual **independent-host** oracles required; strict per-party numeric parsing; `transfer_governor` rejects the zero address. |

Plus the standing structural defenses: untrusted strings ASCII-sanitized (angle
brackets neutralized) before entering the prompt; counterparty and treaty binding
asserted deterministically before any non-deterministic block; treaty-bound
telemetry oracles (see 4.4); the solvency invariant with pull-over-push
distribution; strict categorical tier output; `[TRANSIENT]` and `[LLM_ERROR]`
failover; and a deterministic replay index with expiry-gated litigation and a
collateral-exit gate.

## 6. Frontend architecture

### 6.1 Stack

Next.js 14 (App Router), React 18, TypeScript, Tailwind, `@react-three/fiber`
with `@react-three/drei` and `@react-three/postprocessing`, and `genlayer-js`
2.0.0-rc.1 for chain access. Writes go through the **GenLayer Transaction Kit**
(`@genlayer/transaction-kit` + `@genlayer/transaction-kit-react`, both pinned to
`0.1.0-rc.2`) -- see 6.4. No external 3D assets: every terrain mesh, citadel,
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
| `READING CHAIN` | The first read has not resolved yet. The board holds no islands and the telemetry figures read `--`, rather than the zeros an empty board would sum to. |
| `ON-CHAIN` | The contract answered and returned protocol state. |
| `ON-CHAIN / EMPTY` | The contract answered; it holds no enclaves yet. |
| `SIMULATED` | The contract was unreachable; the board fell back to seed data and says so. |

The board starts **empty**, not seeded. It used to open on the reviewer seed and
swap to the live archipelago when the first read landed, which meant every
visitor saw a flash of fabricated protocol state -- islands appearing out of
nowhere and others changing identity -- on a board whose entire claim is that it
is not a mock. The seed is now installed only when a read actually fails, which
is what `SIMULATED` reports.

### 6.4 Write path

Writes need three things, and each one is a failure mode that was hit and fixed:

1. **A client with an account.** A client built without one throws
   `"No account set"` before any calldata is built. `connect()` requests an
   address from the injected wallet and passes `{ account, provider }`, so the
   signing key never leaves the extension.
2. **The SDK's own chain object.** See 6.3. Without it a write dies inside viem
   (`"Cannot convert undefined to a BigInt"`).
3. **An explicit fee.** Studio Next has no fee-manager contract, so the fee comes
   from the chain's live fee policy. Omitting it leaves `feeValue` at `0n` and
   the consensus contract rejects the transaction with
   `FeeValueMustBeNonZero(1)`.

The third one is no longer this repository's problem to solve by hand. All three
are the **Transaction Kit**'s job, and the app hands it every live write.

**Every write goes through an approval gate.** `lib/store.ts` holds one piece of
state -- `txRequest` -- and `DiplomaticContract` holds one dependency -- a
`WriteAuthorizer`. A write callback calls the contract exactly as it always did;
the contract turns the call into a `WritePlan` (`{ method, summary, value, args,
tx }`) and awaits the authorizer instead of dispatching. The store parks that
plan in `txRequest`, which puts `components/TransactionGate.tsx` on screen, and
resolves the promise when the panel reports a decided transaction -- or rejects
it with `WriteCancelled` when the user closes the gate.

Writes are triggered from all over the board (the HUD, the treasury view, the
found-realm modal), so the gate is driven by store state rather than owned by any
one component. That is what makes every path share one fee quote and one
signature. `runPipeline` treats `WriteCancelled` as an intentional abort: it
clears the pipeline silently and stops the callback where it stands, so nothing
downstream records state for a write that never happened.

**The panel is the kit's, not ours.** `TransactionGate` renders
`GenLayerTransactionPanel` rather than a hand-built form, so the reviewer sees
what the kit actually produces: the deposit split across time units, execution
budget and message fees; the network's current price caps; the pending-queue
depth for the account; and a verification badge reporting whether the quoted fee
policy still matches the chain's. The panel owns estimate -> review -> sign ->
track, and the gate only supplies the transaction, waits for the outcome, and
offers a way out. Its stylesheet is themed onto the HUD palette by redefining the
kit's `--gltk-*` tokens in `app/globals.css` -- tokens only, no structural
selectors, so a kit upgrade that adds surface keeps working.

Three implementation notes worth keeping:

- **The core kit is loaded lazily.** `@genlayer/transaction-kit`'s bundle imports
  `ethers` and `genlayer-js` at module scope, and the app is server-rendered.
  `lib/kit.ts` therefore reaches it through a dynamic `import()` inside an
  effect -- the same discipline `lib/contract.ts` applies to `genlayer-js`. The
  React adapter imports only `react`, so components import it directly.
- **Value travels apart from the call.** The kit takes the caller's value at
  *estimate* time (`PolicyInput.userValue`, from which it derives the deposit);
  `SubmitInput` carries only the call. `WritePlan` keeps that asymmetry in one
  place instead of at ten call sites.
- **No developer fee profile is shipped.** The kit accepts a `suggestions`
  profile of allocations measured offline, and ignores any profile whose
  `chainId` does not match. This deployment has no such measurement -- the
  integration suite that would produce one cannot run without a GenLayer
  simulator -- so the quote comes from `source: 'network-default'`, built from
  live prices and caps. A profile is the right thing to add once those numbers
  are measured, and not before.

**Reviewer mode is unchanged.** With no wallet there is no signer, so
`DiplomaticContract.write()` resolves to a deterministic **simulated** receipt
and the UI stays fully explorable. The receipt and the command bar both say
`simulated`, rather than silently faking success.

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

**Four more identities widen the archipelago.** Two agents are enough to narrate
the protocol; they are not enough to show it, because the board never leaves its
inner ring and a topology is indistinguishable from a line. `agent/seed.py`
founds a further roster and wires the treaties that hold them together:

| Key | Name | Archetype | Posture | Accepts |
|---|---|---|---|---|
| `vantage` | Vantage | Liquidity Nexus | proactive | `TRADE_CORRIDOR`, `DATA_SHARING` |
| `aegis` | Aegis | Defense Vanguard | reactive | `NON_AGGRESSION` |
| `quorum` | Quorum | Oracle Collective | proactive | `DATA_SHARING` |
| `solstice` | Solstice | Autonomous Arbiter | proactive | all three kinds |

Each is a full `Profile`, so any of them can also be driven by the autonomous
loop on its own: `.venv/bin/python -m agent.agent --profile quorum`. The script
wires a star centred on Halcyon plus a three-link mesh inside the ring, so no
new identity is only ever a leaf, and narrows every offer's parameters to the
counterparty's own declared band -- an offer outside it is one the
counterparty's charter obliges it to refuse. Every step re-reads chain state
before it acts, so a run interrupted partway resumes instead of submitting
anything twice.

## 8. Repository layout

```
contracts/
  westphalia.py           The protocol. 23 public methods.

tests/
  direct/                 In-memory contract suite (65 tests, ~75s). No network.
    conftest.py           GenVM v0.3 harness wiring.
    test_westphalia.py    9 baseline adversarial cases.
    test_westphalia_v2.py 6 V2 protocol cases.
    test_adversarial_exploits.py  13 red-team regressions incl. forged-oracle PoC.
    test_poc_regressions.py 5 post-audit P1-P4 PoC regressions.
    test_westphalia_v3.py 3 V3.1 cases: proposal cancellation, roster index,
                          claim-payout fund safety.
    test_review_poc.py    19 first-audit fixes: LLM/telemetry clamp, FEED_CONFLICT
                          refunds, per-treaty elevated cap, exit hostage, SSRF.
    test_audit2.py        10 second-audit fixes: party-attributed telemetry,
                          independent per-party elevated flags, transfer_governor,
                          strict numeric parsing, semantic evidence adjudication.
  integration/            Full-consensus suite (5 tests). Needs a live network.
    test_westphalia.py    Deploy, found, propose, ratify, dispute, settle.
    fixtures.py           Expected state, kept beside the assertions that read it.

agent/                    Two-agent autonomous duet (23 tests).
  agent.py                Decision loop; founds, negotiates, litigates.
  decider.py              Proposal scoring against the agent's own charter.
  profiles.py             ALICE / BOB charters, archetypes, constraints.
  telemetry.py            Deterministic oracle-feed arithmetic.
  chain.py                GenLayer client wrapper: funding, views, writes, receipts.
  keys.py                 Per-agent keystore (agent/keys/<name>.key.json, 0600).
  demo.py                 The end-to-end duet.
  seed.py                 The wider roster: four more identities plus the
                          treaties that connect them.
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
    TransactionGate.tsx   The signature gate: mounts the kit's approval panel
                          over the board for every live write.
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
    kit.ts                Lazy Transaction Kit binding for the injected wallet.
    contract.ts           ABI, view binding, and the write-plan authorizer seam.
    chainState.ts         Chain snapshot -> domain model (pure).
    archetypes.ts         Archetype presets + deterministic terrain seeds.
    world.ts, noise.ts    Orbital layout and procedural terrain.
    board.ts              Shared render constants and color maps.
    mockData.ts           Reviewer-mode seed data, used only when unreachable.

deploy/
  deployScript.ts         `genlayer deploy` entry point. Reads the contract,
                          waits for a decided receipt, prints the address.

scripts/
  check_abi.py            Reflects the contract's ABI and diffs it against the
                          frontend's hand-written one. Exits 1 on drift.

deployments/
  studio-dev.json         Deployment record: address, runner, source hash,
                          observed state at deploy and at the current head.

.github/workflows/
  contracts.yml           Validate + typecheck the contract, diff its ABI, run
                          the two offline suites.
  frontend.yml            Lint and build the frontend.

gltest.config.yaml        Network config for the gltest runner.
pyproject.toml            pytest configuration: testpaths and markers.
requirements.txt          Pinned Python toolchain (Python 3.12 + pre-releases).
```

The two test runners are deliberate. **Bare `pytest`** runs the offline suites --
`pyproject.toml` points `testpaths` at `tests/direct` and `agent`, never at
`tests/`, so a plain run can never dial a network. **`gltest`** runs the
integration suite, which needs a funded account and a live chain; it is not a
merge gate and `.github/workflows/contracts.yml` says so. `gltest.config.yaml`
defaults to `localnet` because the simulator needs no funding, and pins
`studio_devnet` at the RPC this project deploys to.

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

## 2. Quickstart for reviewers

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

- The command bar badges the state source as `READING CHAIN`, `ON-CHAIN`,
  `ON-CHAIN / EMPTY`, or `SIMULATED`. If the contract were unreachable it would
  read `SIMULATED` and the islands would be seed data. (`READING CHAIN` is the
  first read still in flight; the board holds no islands until it answers, and
  the telemetry figures read `--` rather than a measured zero.)
- The islands you see are the sovereignties the protocol actually holds, read
  from the contract's enumerable roster: `get_enclave_count` gives the total and
  `get_enclave_by_index` resolves each slot, so an enclave that has never been
  party to a treaty is still drawn. Treaty parties are merged in as a fallback
  for any address the index does not cover.
- **TOTAL VALUE LOCKED** and the solvency badge are read live from
  `get_protocol_overview` and reconcile against the explorer.

The audited-V3 address is **freshly deployed**: the board reads it live and the
command bar badges `ON-CHAIN / EMPTY`, because a new contract answers
`get_enclave_count` with `0` and holds no enclaves yet. Every figure on the board
is still read live from `get_protocol_overview` and reconciles against the
explorer -- there is simply nothing on it until the agents run.

Running `agent/demo` then `agent/seed` populates it to **six islands** and nine
treaties (seven ACTIVE), with **TOTAL VALUE LOCKED** reading **4300 GEN (chain)**
straight from `locked_escrow`. Those two scripts are what put that state there --
`agent/chain.py` points at this address -- and the same pair reaches the same
place from nothing on any fresh deployment, because the same source driven by the
same state-driven scripts converges on the same outcome.

```bash
.venv/bin/python -m agent.demo       # Halcyon and Meridian, through to a verdict
.venv/bin/python -m agent.seed       # Vantage, Aegis, Quorum, Solstice + treaties
```

A completed run leaves six islands and nine treaties, seven of them ACTIVE, with
4300 GEN of escrow. The full observed state, read from the chain after the run,
is in [`deployments/studio-dev.json`](deployments/studio-dev.json).

Reads need no wallet. **Writes do**: clicking a propose/ratify/dispute action
without a wallet produces a receipt labelled *simulated* and the command bar
stays on `REVIEWER`. To dispatch a real transaction, connect an injected wallet
holding GEN on chain 61997.

With a wallet connected, the same click opens the **Transaction Kit approval
gate** over the board: the call's fee quote (deposit split across time units,
execution budget and message fees), the network's current price caps, the
pending-queue depth for your account, and a badge reporting whether the quoted
fee policy still matches the chain's. Nothing is dispatched until you sign. The
quote reads `source: network-default` and `verification: verified`, which is a
property of Studio Next's live fee policy rather than of this contract, and is
what a healthy quote looks like there.

### Run the contract test suite (about three minutes)

```bash
uv venv --python 3.12
uv pip install --prerelease=allow -r requirements.txt
.venv/bin/python -m pytest -q          # 59 passed
```

This runs the contract **in memory** -- no chain, no keys, no network. It covers
the baseline adversarial cases, the V2 protocol, thirteen red-team exploit
regressions, the P1-P4 post-audit PoCs, and the V3.1 hardening cases (proposal
cancellation, the roster index, claim-payout fund safety), each of which was
confirmed as a working exploit or a real fault against an earlier revision
before it was fixed.

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
[`0x126d145Edcb422E94a3202dFa5c983C8DC5374d9`](https://explorer-studio-next.genlayer.com/address/0x126d145Edcb422E94a3202dFa5c983C8DC5374d9)
on GenLayer Studio Next (chain 61997).

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

Two runners, for two kinds of test.

**Bare `pytest` runs the offline suites** -- 88 tests, no network, no keys, no
funded account:

```bash
# Both suites: 88 tests.
.venv/bin/python -m pytest -q

# Contract only (direct mode): 65 tests, in-memory, ~75s.
.venv/bin/python -m pytest tests/direct/ -q

# Agents only: 23 tests.
.venv/bin/python -m pytest agent/ -q
```

`pyproject.toml` pins `testpaths = ["tests/direct", "agent"]`, so a bare run
cannot reach `tests/integration/` by accident.

**`gltest` runs the integration suite** -- 5 tests that drive the contract
through real GenLayer consensus, deploying it, founding two enclaves, proposing
and ratifying a treaty, and then settling a dispute. These need a live network
and a funded account:

```bash
genlayer up                                     # local simulator (needs Docker)
.venv/bin/gltest tests/integration -v -s

.venv/bin/gltest tests/integration -v -s --network studio_devnet
```

**The localnet must be the v0.123.0 line, or the contract cannot be deployed to
it at all.** `genlayer up` starts `simulator-jsonrpc:latest`, and that image
ships only the older GenVM runner generation: executor v0.2.16, whose
`py-genlayer` runner is `1jb45aa8y...`. This contract's header pins
`py-genlayer:5jycge4q8k...`, which belongs to executor v0.3.0-rc7. A default
localnet therefore has no runner to run the contract with, and its one std build
(`11rhn002y...`) spells the storage decorator `allow_storage` rather than the
`allow` this contract uses -- so it would fail to import even if it had one.
Nothing is fetched to fill the gap either: the bucket `manifest.yaml` points at
carries only the older generation, and answers 404 for both hashes this contract
resolves to. `v0.123.0-rc.6` is the only published tag whose image contains
`5jycge4q8k...` and its std. Pin it in the CLI's own `.env`, which is where
`genlayer init` writes it:

```bash
cd "$(npm root -g)/genlayer"
LOCALNETVERSION="v0.123.0-rc.6" >> .env
genlayer up --headless
```

Two things about that startup are worth knowing before you run it. The first
`docker compose up` on a new image AOT-compiles every runner GenVM ships into
`/genvm-cache`; measured on an Apple Silicon laptop that is roughly twelve
minutes, and `genlayer up` waits only four before declaring the simulator
uninitialized. Mount `/genvm-cache` as a named volume once and the cost is paid
per image tag rather than per container, which brings every later start back
inside the CLI's window. And `genlayer up` passes `--profile frontend` unless
you pass `--headless`, which pulls a second multi-gigabyte image for a UI these
tests never open.

`simulator-hardhat` is the one service that has no v0.123.0 tag; it is pinned to
`latest` in the compose file so that a pinned `LOCALNETVERSION` does not make
compose fail the whole project with `manifest unknown`.

The adjudication round is driven with mock validators -- the treaty's two
telemetry oracles are answered from a fixed body and the LLM verdict is pinned,
which is the only way to make a consensus round reproducible. The mocks are
supplied to the *validators*, not to the contract, so the leader and every
validator still run the real fetch-and-compare path. That is the part only a
live network can answer: everything `tests/direct/` proves about business logic
is assumed rather than re-proved here.

Static analysis of the contract:

```bash
.venv/bin/genvm-lint validate contracts/westphalia.py    # imports it under the pinned SDK
.venv/bin/genvm-lint typecheck contracts/westphalia.py   # Pyright against that SDK
.venv/bin/python scripts/check_abi.py                    # frontend ABI vs the contract's
```

`genvm-linter` is pinned in `requirements.txt`, so these work after the install
steps above. `Validation passed`, the method census (23 methods: 11 view, 12
write), `No type errors found`, and the ABI comparison are all stable.
`genvm-lint check` runs all three and passes.

The note below records why that check used to exit 1, and what changed.

The agent suite's fixtures are built from two *real observed payloads* -- an
agreed return and the `ERR_INSUFFICIENT_BOND` revert a stale dispute bond
produces -- so receipt parsing is tested against the wire, not against a
hand-written idealization.

#### Note on the storage-decorator spelling

`genvm-lint lint` reported two `E014` errors on the previous revision of this
contract, where the dataclasses were decorated `@gl.storage.allow` directly:

```
line 461: Class 'Enclave' used in storage needs @allow_storage decorator
line 474: Class 'Treaty' used in storage needs @allow_storage decorator
```

**Both are false positives, and the contract's spelling is the correct one.**
The rule -- `StorageClassChecker` in `genvm_linter/lint/structure.py` -- renders
each decorator to its dotted name and compares it against a hardcoded list:

```python
if dec_name in ("allow_storage", "gl.allow_storage"):
```

The rendering is not the problem: `_decorator_to_string` walks the attribute
chain, so `@gl.storage.allow` stringifies faithfully to `"gl.storage.allow"`. It
simply is not one of the two names listed, so the check never records the
decorator as seen and reports both dataclasses as missing it. They are not
missing it.

The contract now binds the bare name to the same object, which satisfies the
check without changing what runs:

```python
allow_storage = gl.storage.allow
```

That is an alias, not a substitution. The decorator object applied to `Enclave`
and `Treaty` is byte-for-byte the one this contract has always deployed with;
only the *name the linter matches on* is new. `genvm-lint check` now passes all
three of its checks, and `lint`/`validate`/`typecheck` agree instead of
disagreeing.

The list is not arbitrary, it is **stale** -- written against an earlier
generation of the SDK. The Python std library changed shape, and with it the
spelling:

| bundle | `py-lib-genlayer-std` shipped | decorator |
|---|---|---|
| `genvm-universal-v0.3.0-rc7` | many, incl. `11rhn002...` | `gl.allow_storage` |
| `genvm-manager-v0.6.0-rc5` (current) | exactly one: `kzr02ndm9...` | `gl.storage.allow` |

These are two generations, not two variants. `11rhn002...` carries a
`_genlayer_runner.py` and ends with `from .py.storage import *`, which is what
puts `allow_storage` at the top level. `kzr02ndm9...` carries a
`_genlayer_bootloader.py` and pre-loads `genlayer.storage` to break a circular
import, which is what puts it *under* `storage`. The `E014` list names the older
generation's symbol, and this contract is on the newer one.

Which build a contract gets is not a choice either: the loader reads the
manifest of the `py-genlayer` runner named in the header and pulls whichever
`py-lib-genlayer-std` that manifest names. This contract pins
`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`, the current
manager bundle ships that runner plus one std build, and the runner's manifest
names that build:

```json
{"Depends": "py-lib-genlayer-std:kzr02ndm9et4qkmbqpq5djjt5sme2yt76n7sz1qbzax0knt6mam0"}
```

So `gl.storage.allow` is not a preference; against this runner it is the only
object that exists. Rewriting both decorators to `@gl.allow_storage` makes all
65 contract tests fail with an import error -- measured, not assumed -- because
the SDK the runner loads has no such symbol.

There is no newer linter to wait for, either: `0.11.1rc2` -- what
`requirements.txt` pins -- is *ahead* of PyPI's latest stable, `0.11.0`, and the
`v0.11.1-rc.2` release commit still carries the two-name list. The alias above
satisfies that list without waiting for it. What the alias cannot do is make the
linter's *other* layers meaningful, so this repository still gates on the layers
that are actually load-bearing:

- `genvm-lint validate` imports the contract under the exact SDK its runner
  pins -- the ground truth `E014` only approximates from the AST. If either
  decorator named a symbol that did not exist, this import would fail. It
  passes.
- `genvm-lint typecheck` runs Pyright against that same SDK. It passes.
- `scripts/check_abi.py` reflects the contract's real ABI and compares it,
  method by method, against the hand-written `DIPLOMATIC_ABI` the frontend
  calls with.

None of the three can pass vacuously: each fails loudly if the contract stops
importing, if a type regresses, or if the two ABIs drift apart. The ABI check
was negative-tested by renaming one method in `frontend/lib/contract.ts`, which
made it report that method as missing and a second as unknown, and exit 1.


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
| Studio Next | 61997 | `https://studio-next.genlayer.com/api` |
| Studio (fallback) | 61999 | `https://studio.genlayer.com/api` |

Explorer: https://explorer-studio-next.genlayer.com

`gltest.config.yaml` is the Python side of the same configuration: it names the
networks the contract suites run against, and the `contracts` path the runner
loads the contract from. It holds no secrets, and any `${VAR}` written there
would be resolved with `override=True` -- so a variable that is unset at run time
aborts the whole pytest session rather than being ignored. Keep it literal.

| Key | Value | Why |
|---|---|---|
| `networks.default` | `localnet` | The simulator needs no funding, so the default run costs nothing. |
| `networks.localnet.url` | `http://127.0.0.1:4000/api` | Where `genlayer up` serves the simulator. |
| `networks.studio_devnet.url` | `https://studio-next.genlayer.com/api` | Chain 61997, pinned at the RPC this project deploys to. |

Reach the second one with `gltest tests/integration --network studio_devnet`.

## 7. Deploying your own instance

`deploy/deployScript.ts` is the scripted form of this. With `genlayer network`
pointed at the target chain:

```bash
genlayer deploy
```

The CLI runs `deployScript.ts` with a client already bound to the selected
network, so the script never builds a chain object and never holds a key. It
reads `contracts/westphalia.py`, waits for the transaction to be *decided* (a
deploy that reverts in `__init__` still decides), and prints the contract
address plus the three places that address has to go. By hand, those are:

1. Deploy `contracts/westphalia.py` to GenLayer Studio Next. The runner pin is
   the first line of the file; keep it.
2. Point the frontend at the new address -- either set
   `NEXT_PUBLIC_DIPLOMATIC_CONTRACT_ADDRESS` in `frontend/.env.local`, or change
   the fallback in `frontend/lib/networks.ts`.
3. Point the agents at it by updating `CONTRACT` in `agent/chain.py`.
4. Record the deployment in `deployments/studio-dev.json`, including
   `source_sha256_at_record` so the deployed source is identifiable later.

Before deploying, run the integration suite against the contract (section 5).
It is the only suite that exercises consensus, and it is the one that cannot run
in CI.

The ABI in `frontend/lib/contract.ts` mirrors the deployed contract's
view/payable/nonpayable methods exactly. If you change the contract's public
surface, update the ABI in the same commit -- a stale ABI is a silent failure,
not a loud one.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `FeeValueMustBeNonZero(1)` | A write was dispatched with no fee. Studio Next has no fee manager, so the deposit has to be derived from the chain's live fee policy. | Route the write through the Transaction Kit -- `DiplomaticContract.write()` does, via the authorizer. A hand-rolled `writeContract()` must call `estimateTransactionFees()` first. |
| The approval gate never opens | No signer. `write()` short-circuits to a simulated receipt when the client is not connected. | Connect a wallet; the command bar shows whether one is linked. |
| `Cannot convert undefined to a BigInt` | The chain object was hand-built instead of taken from the SDK. | Spread `chains.studioDevnet`; override only `rpcUrls`. |
| `No account set` | The client has no account. | Connect an injected wallet, or pass an account. |
| `E014 ... needs @allow_storage decorator` from `genvm-lint` | The linter's `E014` list names the two spellings it was written against, and the pinned runner exposes a third. A false positive, not a contract defect. | Already handled: the contract binds `allow_storage = gl.storage.allow`, so `genvm-lint check` passes. See the decorator note in section 5; the 65-test suite executes the contract for real. |
| `Missing or invalid parameters` on a view | Usually correct: the row does not exist. `get_treaty(1)` on a contract whose `next_treaty_id` is 1 is an expected revert, not a fault. | Check `next_treaty_id` first. |
| Board reads `ON-CHAIN / EMPTY` | The contract answered and holds no enclaves. `get_enclave_count` returns `0`. This is what a freshly deployed contract reads. | Run the agents (sections 3 and 4), or point at a populated deployment. |
| Board reads `READING CHAIN` and stays there | The first read never resolved. | Check `NEXT_PUBLIC_GENLAYER_RPC_URL` and network access; a failed read eventually falls back to `SIMULATED`. |
| Board reads `SIMULATED` | The contract was unreachable. | Check `NEXT_PUBLIC_GENLAYER_RPC_URL` and network access. |
| `eth_getCode` returns `0x` for a live contract | GenVM is not an EVM chain. | Expected. Verify with view reads instead. |

---

# Appendix

## A. Deployment record

| Field | Value |
|---|---|
| Network | GenLayer Studio Next, chain 61997 |
| Contract | `0x126d145Edcb422E94a3202dFa5c983C8DC5374d9` |
| Explorer | https://explorer-studio-next.genlayer.com/address/0x126d145Edcb422E94a3202dFa5c983C8DC5374d9 |
| RPC | `https://studio-next.genlayer.com/api` |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| Source | `contracts/westphalia.py` |
| Revision | V3 (audited) -- semantic multi-LLM adjudication with on-chain evidence reads, party-attributed telemetry, `FEED_CONFLICT` neutral resolution, independent per-party elevated flags, dual independent-host oracles, SSRF hardening, and governor rotation (`transfer_governor`). Supersedes V3.1 (`0x231f...2e41`). |
| Source SHA-256 | `868c346c64a077ef2db6d72e4b1fc14f243acd264c8de24b527025c9b323bcfa` |

Full observed state, at deploy time and at the current head, is recorded in
[`deployments/studio-dev.json`](deployments/studio-dev.json). That file is the
authoritative record; it is updated by reading the chain, never by hand.

### Demonstration state (reproducible)

The audited-V3 address is freshly deployed and starts empty
(`get_enclave_count == 0`). Running `agent.demo` then `agent.seed` against it
reproduces the state below -- the same source driven by the same state-driven
scripts converges on the same outcome. The exact snapshot was read from the V3.1
predecessor after that run and is preserved in
[`deployments/studio-dev.json`](deployments/studio-dev.json): six sovereignties,
nine treaties, seven of them ACTIVE.

| Counter | Value |
|---|---|
| `balance` | 6700 GEN |
| `total_collateral` | 900 GEN |
| `locked_escrow` | 4300 GEN |
| `reserves` | 0 GEN |
| `total_claimable` | 1500 GEN |
| `next_treaty_id` | 10 |
| `get_enclave_count` | 6 |
| `solvent` | `true` |

That satisfies the solvency identity: `900 + 4300 + 0 + 1500 == 6700` GEN.

The roster, in the order the contract enumerates it:

| # | Enclave | Archetype | Status | Reputation | Collateral |
|---|---|---|---|---|---|
| 0 | Halcyon | Autonomous Arbiter | ACTIVE | 65 | 150 GEN |
| 1 | Meridian | Oracle Collective | SANCTIONED | 0 | 150 GEN |
| 2 | Vantage | Liquidity Nexus | ACTIVE | 50 | 150 GEN |
| 3 | Aegis | Defense Vanguard | ACTIVE | 50 | 150 GEN |
| 4 | Quorum | Oracle Collective | ACTIVE | 50 | 150 GEN |
| 5 | Solstice | Autonomous Arbiter | ACTIVE | 50 | 150 GEN |

Treaty #2 is the one that was adjudicated: Halcyon filed against Meridian, the
validators read the treaty's own oracles inside consensus, agreed on
`CRITICAL_BREACH`, and settlement released both bonds -- which is why Halcyon
holds 1500 GEN claimable and Meridian's reputation reads 0 and `SANCTIONED`.
Treaty #1 is Halcyon's rejected opening offer, still standing with its 700 GEN
bond; it is the case `cancel_proposal` exists for, and it is 700 of the 4300 GEN
of escrow.

Every one of the six is party to at least one treaty, so this state does not by
itself exercise the index's headline case -- an enclave that has never been party
to one. What it does show is the index answering and enumerating the roster in a
fixed order, which is what the board draws its islands from; treaty parties are
merged in afterwards only as a fallback.

This address was deployed **empty** and populated by running those two scripts
against it. The deploy-time reading is in
[`deployments/studio-dev.json`](deployments/studio-dev.json) under
`verification.observed_at_deploy`, and the head reading above under
`observed_at_current_head`. The figures match what the superseded deployment
reached from the same starting state -- six sovereignties, nine treaties,
`900 + 4300 + 0 + 1500 == 6700` -- which is the expected result rather than a
coincidence: the same source driven by the same state-driven scripts converges
on the same protocol outcome. That predecessor is carried under `predecessors`,
and it was superseded because it predates the roster index, not because anything
in it failed.

## B. Verification log

| Check | Command | Result |
|---|---|---|
| Contract lint | `.venv/bin/genvm-lint check contracts/westphalia.py` | Lint and validation both pass; 23 methods (11 view, 12 write). |
| Contract tests | `.venv/bin/python -m pytest tests/direct/ -q` | 65 passed. |
| Agent tests | `.venv/bin/python -m pytest agent/ -q` | 23 passed. |
| Test collection | `.venv/bin/python -m pytest --collect-only -q` | 88 collected. |
| Type check | `cd frontend && npx tsc --noEmit` | Exit 0, clean. |
| Lint | `cd frontend && npx eslint . --max-warnings=0` | Exit 0, no warnings. |
| Production build | `cd frontend && npm run build` | 0 TypeScript, lint, and SSR/Canvas errors. |
| ABI fidelity | `DIPLOMATIC_ABI` entries vs `contracts/westphalia.py` public methods | 23 == 23, name-for-name identical (11 view / 4 payable / 8 nonpayable). |
| Deployment binding | Live view reads on the recorded address | The audited-V3 address is freshly deployed and reads `get_enclave_count == 0`; running the agent scripts populates it. The V3.1 predecessor's populated six-enclave snapshot is preserved in [`deployments/studio-dev.json`](deployments/studio-dev.json). |
| Write path | `found_sovereignty` on chain 61997 | Receipt `FINISHED_WITH_RETURN`; collateral moved; `get_enclave` returns the record. |
| End-to-end | `.venv/bin/python -m agent.demo` | Full lifecycle to a `CRITICAL_BREACH` verdict; escrow settled; reputation rewritten. |
| ASCII purity | every tracked file | All UI labels, code, variables, and comments are pure ASCII English. |

The board rows below were captured against the **populated** deployment, before
the current address replaced it (see [Appendix A](#a-deployment-record)); they
are recorded with the deployment they were measured on rather than restated
against an empty one:

| Check | Command | Result |
|---|---|---|
| Read path | Headless browser, no wallet, page rendered through CDP against the populated deployment | Command bar reads `ON-CHAIN`; `TOTAL VALUE LOCKED` reads `700 GEN (chain)`; `SOVEREIGNTIES` reads `2`; `SOLVENCY` reads `OK`; both Halcyon and Meridian present; Meridian rendered sanctioned. |
| Solvency | Live `get_protocol_overview` on the populated deployment | `300 + 700 + 0 + 1500 == 2500` GEN, `solvent: true`. |

The board's mapping layer is checked against real captures: the collateral it
derives sums to the contract's own `total_collateral`, the locked escrow sums to
`locked_escrow`, and a settled treaty's released bonds are correctly excluded --
which is exactly why `TOTAL VALUE LOCKED` read 700 GEN and not 1200 in that
capture: the settled treaty's 500 GEN bond is no longer escrow the contract
holds.

---

# License

MIT -- see [`LICENSE`](LICENSE). Copyright (c) 2026 moltaphet.

The contract, the agents and the board are all under the same terms, so any
part of this repository can be reused without asking. Third-party dependencies
keep their own licenses; `frontend/package-lock.json` records the license of
each one beside it.

