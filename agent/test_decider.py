"""Unit tests for the agent decision engine (no chain, no I/O).

Locks the exact negotiation script the live demo performs: Bob must reject
Alice's loose first offer for enumerated reasons, and accept her tightened
superseding offer.
"""

import json
import time

import pytest

from agent.decider import HeuristicDecider
from agent.profiles import ALICE, BOB, GEN, days

DATA_SHARING_KEYS = ("min_uptime_bps", "max_latency_bps")


def make_treaty(
    kind="DATA_SHARING",
    params=None,
    bond=500 * GEN,
    horizon_s=days(30),
    oracle_primary="https://api.binance.com/api/v3/ticker/24hr?symbol=GENUSDT",
    oracle_secondary="https://api.coingecko.com/api/v3/simple/price?ids=genlayer&vs_currencies=usd",
):
    return {
        "kind": kind,
        "party_a": "0xA",
        "party_b": "0xB",
        "bond_a": str(bond),
        "bond_b": "0",
        "status": "PROPOSED",
        "terms": "test",
        "params": json.dumps(params or {}),
        "oracle_primary": oracle_primary,
        "oracle_secondary": oracle_secondary,
        "expires_at": str(int(time.time()) + horizon_s),
        "_id": 1,
    }


PEER_ALICE = {"name": "Halcyon", "archetype": "Autonomous Arbiter", "reputation": "50"}


@pytest.fixture
def bob():
    return HeuristicDecider(BOB)


def test_bob_rejects_loose_offer(bob):
    """Alice's first offer violates three charter constraints at once."""
    treaty = make_treaty(
        params={"min_uptime_bps": 9500, "max_latency_bps": 800},
        bond=700 * GEN,
        horizon_s=days(7),
    )
    ev = bob.evaluate(treaty, PEER_ALICE, my_balance=10_000 * GEN)
    assert not ev.accepted
    text = "; ".join(ev.rationale)
    assert "700" in text  # bond above 600 GEN cap
    assert "uptime" in text  # 9500 < 9900 floor
    assert "latency" in text  # 800 > 500 cap
    assert "horizon" in text  # 7d < 14d minimum


def test_bob_accepts_tightened_offer(bob):
    """Alice's superseding offer satisfies every Meridian constraint."""
    treaty = make_treaty(
        params={"min_uptime_bps": 9950, "max_latency_bps": 300},
        bond=500 * GEN,
        horizon_s=days(63),
    )
    ev = bob.evaluate(treaty, PEER_ALICE, my_balance=10_000 * GEN)
    assert ev.accepted
    assert ev.score >= BOB.min_accept_score


def test_bob_rejects_outside_charter_kind(bob):
    ev = bob.evaluate(make_treaty(kind="NON_AGGRESSION"), PEER_ALICE, 10_000 * GEN)
    assert not ev.accepted
    assert "charter" in "; ".join(ev.rationale)


def test_reject_unsafe_oracle(bob):
    ev = bob.evaluate(
        make_treaty(oracle_primary="http://api.binance.com/x"),
        PEER_ALICE,
        10_000 * GEN,
    )
    assert not ev.accepted
    assert "https" in "; ".join(ev.rationale)


def test_reject_identical_oracle_feeds(bob):
    url = "https://api.binance.com/api/v3/ticker/24hr?symbol=GENUSDT"
    ev = bob.evaluate(make_treaty(oracle_primary=url, oracle_secondary=url), PEER_ALICE, 10_000 * GEN)
    assert not ev.accepted
    assert "identical" in "; ".join(ev.rationale)


def test_reject_bond_beyond_liquid_balance(bob):
    treaty = make_treaty(
        params={"min_uptime_bps": 9950, "max_latency_bps": 300},
        bond=500 * GEN,
    )
    ev = bob.evaluate(treaty, PEER_ALICE, my_balance=200 * GEN)
    assert not ev.accepted
    assert "balance" in "; ".join(ev.rationale)


def test_reject_malformed_params(bob):
    ev = bob.evaluate(make_treaty(params={"min_uptime_bps": 9950}), PEER_ALICE, 10_000 * GEN)
    assert not ev.accepted
    assert "keys" in "; ".join(ev.rationale)


def test_compose_offer_picks_peer_fitting_kind():
    """Alice courts an Oracle Collective -> DATA_SHARING, not her other kind."""
    alice = HeuristicDecider(ALICE)
    peer = {"name": "Meridian", "archetype": "Oracle Collective", "reputation": "50"}
    offer0 = alice.compose_offer(peer, attempts=0)
    assert offer0.kind == "DATA_SHARING"
    assert offer0.bond == 700 * GEN
    assert offer0.params == {"min_uptime_bps": 9500, "max_latency_bps": 800}
    # after one silent rejection the posture tightens toward conservative
    offer1 = alice.compose_offer(peer, attempts=1)
    assert offer1.bond == 500 * GEN
    assert offer1.params == {"min_uptime_bps": 9950, "max_latency_bps": 300}


def test_alice_would_accept_her_own_tightened_offer():
    """Sanity: the superseding offer passes both agents' deciders."""
    alice = HeuristicDecider(ALICE)
    treaty = make_treaty(
        params={"min_uptime_bps": 9950, "max_latency_bps": 300},
        bond=500 * GEN,
        horizon_s=days(63),
    )
    ev = alice.evaluate(treaty, {"name": "Meridian", "reputation": "50"}, 10_000 * GEN)
    assert ev.accepted
