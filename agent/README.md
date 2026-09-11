# Westphalia Autonomous Agents

Sovereign on-chain actors for the Westphalia protocol. Each agent holds its own
key, funds itself, reads the chain, reasons against a written charter, and acts
through GenLayer consensus transactions -- there is no human in the loop.

```
agent/
  profiles.py   identity + mission (charter, accepted kinds, bond/horizon appetite, oracle pair)
  decider.py    pure decision engine: evaluate(proposal) -> accept/reject + rationale;
                compose_offer(peer, attempt) -> concrete proposal
  telemetry.py  deterministic oracle feeds: byte-identical evidence for every validator
  chain.py      GenLayer client wrapper: faucet funding, views, fee-estimated writes, receipts
  keys.py       per-agent keystore (agent/keys/<name>.key.json, chmod 0600)
  agent.py      the observe -> decide -> act loop + CLI
  demo.py       two-agent duet: founding -> proposal -> rejection -> adaptation ->
                ratification -> adjudication
  test_decider.py    unit tests for the heuristic (no chain, no I/O)
  test_telemetry.py  unit tests for the feeds (no chain, no I/O)
```

## Quick start

```bash
# the full duet, live on studio-dev (about ten minutes; consensus time varies)
.venv/bin/python -m agent.demo

# same, on two brand-new identities -- runs the whole lifecycle from scratch
.venv/bin/python -m agent.demo --fresh

# negotiation only: stop before the dispute that sanctions the counterparty
.venv/bin/python -m agent.demo --fresh --no-adjudicate

# one agent, one pass
.venv/bin/python -m agent.agent --profile alice --once

# one agent, autonomous loop (Ctrl-C to stop)
.venv/bin/python -m agent.agent --profile bob --peer 0x<counterparty>

# reason without submitting anything
.venv/bin/python -m agent.agent --profile alice --once --dry-run

# unit-test the decision engine and the telemetry feeds
.venv/bin/python -m pytest agent/test_decider.py agent/test_telemetry.py -q
```

`demo.py` is state-driven, so it resumes from whatever is actually on-chain
rather than stacking duplicate proposals. A verified `--fresh` run:

```
>>> FOUNDING
  [Halcyon] FOUND sovereignty established, 150 GEN collateral
  [Meridian] FOUND sovereignty established, 150 GEN collateral

>>> ALICE PROPOSES (attempt 1: loose)
  [Halcyon] PROPOSE to Meridian: outreach attempt 1: kind=DATA_SHARING
            bond=700 GEN horizon=7d params={'min_uptime_bps': 9500, 'max_latency_bps': 800}

>>> BOB EVALUATES
  [Meridian] REJECT treaty #3 (DATA_SHARING) -- param max_latency_bps=800 outside
             mission [0, 500]; param min_uptime_bps=9500 outside mission [9900, 10000];
             bond 700 GEN exceeds charter cap 600 GEN; horizon 6d below charter minimum 14d

>>> ALICE ADAPTS (attempt 2: compliant)
  [Halcyon] PROPOSE to Meridian: outreach attempt 2: kind=DATA_SHARING
            bond=500 GEN horizon=63d params={'min_uptime_bps': 9950, 'max_latency_bps': 300}

>>> BOB ACCEPTS
  [Meridian] ACCEPT treaty #4 (DATA_SHARING) -- score 0.86
  [Meridian] RATIFIED treaty #4 active, 500 GEN escrowed
```

`--fresh` mints new keys over `agent/keys/<name>.key.json`, so archive any
identity you still need before running it.

## What makes it autonomous

1. **Self-funding.** `chain.fund()` tops the wallet up from the studio faucet
   (`sim_fundAccount`) so collateral, bonds and fees always clear.
2. **Self-founding.** On a chain where its address has no enclave, the agent
   locks collateral and writes its charter on-chain (`found_sovereignty`).
3. **Self-directed diplomacy.** It reads every treaty on-chain, finds the ones
   addressed to it, and scores each against its mission: bond versus charter
   cap and liquid balance, horizon versus charter window, oracle host trust,
   typed treaty parameters versus per-kind risk limits, and counterparty
   reputation. Every accept/reject prints the per-factor rationale.
4. **Adaptive negotiation.** A proposal the counterparty sits on is read as
   "not acceptable". After `ADAPT_COOLDOWN_S` the agent tightens toward its
   conservative posture and supersedes with a new offer, up to
   `MAX_OUTREACH_ATTEMPTS`.
5. **Fail-closed safety.** Unsafe or untrusted oracle URLs, unknown treaty
   kinds, and out-of-schema parameters are hard rejections, never scored.
6. **Self-help justice.** A wronged agent files a dispute against the
   treaty-bound oracles and lets GenLayer's validators decide it. No other chain
   can do this: the contract fetches the evidence, arbitrates the allegation
   against it, and the validators reach equivalence on the verdict before any
   escrow moves. The bond is read from `required_dispute_bond` rather than
   assumed, because it scales with the plaintiff's own reputation.

## Why the evidence feeds are deterministic

A treaty's oracle URLs are its evidence, and every validator in a consensus
round fetches those URLs *independently*. A live price feed answers two
validators at two different instants, so their readings -- and therefore their
breach verdicts -- can differ; a rate-limited feed turns the round into
`[TRANSIENT]` and the dispute reverts. Neither failure is a property of the
treaty, and neither says anything about the allegation.

`telemetry.py` points the oracles at `httpbin.org/base64/<payload>`, which
echoes the decoded payload verbatim, so every validator receives byte-identical
evidence. The verdict then turns on the part GenLayer actually contributes --
the arbitration and its equivalence round -- rather than on which validator
happened to fetch first.

The demo's pair reads 8000 and 7800 bps. They agree inside the contract's
500 bps divergence budget (a wider gap would be forced to `MALICIOUS_REPORT`),
and their mean of 7900 clears the 7500 bps critical threshold -- so the
arbitration has exactly one defensible answer, and the demo asserts that
arithmetic in `test_telemetry.py` rather than trusting it.

## The adjudication act

Phase 6 is the part no other chain can do. Phases 1-5 are transactions any chain
could carry; the arbitration is GenLayer's alone.

1. The wronged party calls `trigger_dispute(treaty_id, allegation, evidence_uri,
   evidence_hash)` and posts a reputation-scaled bond.
2. The contract re-runs its deterministic preconditions, then enters the
   non-deterministic round: it fetches **both treaty-bound oracles itself** --
   the caller cannot supply or override them, which closes the forged-oracle
   vector -- and arbitrates the allegation against the readings.
3. Validators reach equivalence on the verdict tier. Any transient fetch or LLM
   misbehaviour reverts the whole dispute and refunds the bond rather than
   settling on bad evidence.
4. Only then does deterministic settlement run, per tier.

A `CRITICAL_BREACH` verdict is total: both bonds are released, the plaintiff is
credited `defendant_bond + plaintiff_bond + dispute_bond`, the defendant enclave
is **SANCTIONED**, and the plaintiff's reputation rises by 15. The demo's
allegation is a true one, so that is the verdict it earns -- 1500 GEN credited
on a 500 GEN treaty, and a counterparty that can no longer transact.

Two details the agent has to get right, both of which cost real transactions to
learn:

- **The dispute bond is not a constant.** It scales as
  `500 * (150 - min(rep, 100)) / 100`: 500 GEN at reputation 50, but 600 GEN at
  reputation 30. A hardcoded figure reverts `ERR_INSUFFICIENT_BOND` before any
  validator runs, which looks like an arbitration failure but is not one. The
  agent reads `required_dispute_bond` from the contract instead.
- **The verdict is on the transaction, not the receipt.** `write()` returns a
  receipt, which reports *status*; the contract's return value lives in
  `consensus_data.leader_receipt` on the transaction, and GenVM marks a return
  payload with a leading `|` while an error payload carries no marker. Both
  shapes are pinned in `test_chain.py`.

## The two profiles

| | Alice ("Halcyon") | Bob ("Meridian") |
|---|---|---|
| archetype | Autonomous Arbiter | Oracle Collective |
| posture | proactive, moderate risk | reactive, conservative |
| accepts | DATA_SHARING, NON_AGGRESSION | DATA_SHARING only |
| bond | target 500, cap 1000 GEN | target 500, cap 600 GEN |
| horizon | 7 - 120 days | 14 - 90 days |
| telemetry | uptime >= 9500 bps, latency <= 800 bps | uptime >= 9900 bps, latency <= 500 bps |

Alice's first offer uses her own lenient bounds (uptime 9500, latency 800,
bond 700 GEN, 7 days), which violates four of Bob's constraints at once -- so
Bob rejects it with an enumerated rationale. Alice then tightens to uptime
9950, latency 300, bond 500 GEN, 63 days, which Bob accepts and ratifies.
That reject-then-accept script is locked by `test_decider.py`.

## On-chain interface used

Contract `0x6fc9fb342ADDE50BE4Cc21360dcB949095e44Fe3` on studio-dev (chain 61997).

- views: `get_protocol_overview`, `get_enclave`, `get_treaty`,
  `required_dispute_bond`, `claimable_of`
- writes: `found_sovereignty` (payable), `propose_treaty` (payable),
  `ratify_treaty` (payable), `trigger_dispute` (payable)

Writes carry an explicit fee distribution. The accurate path is
`estimate_transaction_fees_for_write`, but that pre-flight simulation executes
the contract against a **simulation clock that is not the block clock** -- so
any write whose logic compares against `_now()` (treaty expiry, enclave
maturation) reverts *inside the simulation* with `execution failed`, while the
real transaction, which carries a real block timestamp, succeeds. A failed
simulation is therefore not evidence about the transaction, and `chain.py`
falls back to the SDK's policy-derived estimate, which needs no simulation.

Submissions are never retried (a duplicate would create a second treaty) while
receipt polling is retried through transient RPC drops.

## Adding a profile

Append a `Profile` to `agent/profiles.py` and register it in `PROFILES`. The
decider is profile-driven, so a new mission needs no code changes -- only the
identity, the accepted kinds, the numeric appetite, and the `(primary,
secondary)` oracle pair the agent offers to be judged against. Add that pair's
host to `trusted_oracle_hosts` or the decider will score it as untrusted.
