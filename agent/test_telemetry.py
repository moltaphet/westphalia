"""Unit tests for the deterministic telemetry feeds (no chain, no I/O).

The demo's arbitration only means something if the evidence every validator
fetches is the same evidence. These tests lock two invariants against the
contract's own constants: the feeds are byte-identical for every fetcher, and
the breach pair lands where the demo claims it does -- agreeing well inside the
divergence budget, and above the critical threshold.
"""

import base64
import json

from agent.decider import HeuristicDecider
from agent.profiles import ALICE, BOB
from agent.telemetry import (
    BREACH_FEEDS,
    CALM_FEEDS,
    DIVERGENCE_BPS,
    PRIMARY_HOST,
    SECONDARY_HOST,
    agreed_bps,
    bps_of,
    feed_url,
)

# Mirrored from contracts/westphalia.py. The contract is the authority; these
# are duplicated so a contract-side retune fails loudly here instead of
# silently weakening the demo.
BPS_CRITICAL = 7500
BPS_ELEVATED = 2500

PEER = {"name": "Halcyon", "archetype": "Autonomous Arbiter", "reputation": "50"}


def test_feed_is_byte_identical_for_every_fetcher():
    url = feed_url(PRIMARY_HOST, 0.0, 0.80)
    assert feed_url(PRIMARY_HOST, 0.0, 0.80) == url, "same metrics -> same URL"
    body = base64.b64decode(url.rsplit("/", 1)[-1])
    assert json.loads(body) == {"party_a": 0.0, "party_b": 0.80}


def test_feeds_are_on_independent_trusted_hosts():
    assert BREACH_FEEDS[0].startswith(f"https://{PRIMARY_HOST}/")
    assert BREACH_FEEDS[1].startswith(f"https://{SECONDARY_HOST}/")
    assert PRIMARY_HOST != SECONDARY_HOST
    for host in (PRIMARY_HOST, SECONDARY_HOST):
        assert host in ALICE.trusted_oracle_hosts
        assert host in BOB.trusted_oracle_hosts


def test_breach_feeds_agree_within_the_divergence_budget():
    """A pair that diverged would settle as a neutral FEED_CONFLICT, so the
    demo's feeds must stay inside DIVERGENCE_BPS on the defendant's metric."""
    first, second = (bps_of(m) for m in (0.80, 0.78))
    assert abs(first - second) <= DIVERGENCE_BPS


def test_breach_feeds_land_above_the_critical_threshold():
    assert agreed_bps(BREACH_FEEDS) == 7900
    assert agreed_bps(BREACH_FEEDS) >= BPS_CRITICAL


def test_calm_feeds_land_under_the_elevated_threshold():
    assert agreed_bps(CALM_FEEDS) == 450
    assert agreed_bps(CALM_FEEDS) < BPS_ELEVATED


def test_bps_quantization_matches_the_contract():
    assert bps_of(0.0) == 0
    assert bps_of(1.0) == 10000
    assert bps_of(2.0) == 10000, "clamped at 10000"
    assert bps_of(-1.0) == 0, "clamped at 0"


def test_compose_offer_uses_the_profile_oracles():
    """Oracle endpoints are profile data, not a constant in the composer --
    otherwise a treaty could only ever be bound to one hardcoded pair."""
    offer = HeuristicDecider(ALICE).compose_offer(PEER, 0)
    assert (offer.oracle_primary, offer.oracle_secondary) == ALICE.oracles


def test_profile_oracles_pass_the_deciders_own_trust_rules():
    """The offered pair must survive the counterparty's fail-closed checks."""
    offer = HeuristicDecider(ALICE).compose_offer(PEER, 0)
    reasons: list = []
    score = HeuristicDecider(BOB)._score_oracles(
        {"oracle_primary": offer.oracle_primary, "oracle_secondary": offer.oracle_secondary},
        reasons,
    )
    assert score == 1.0, reasons
    assert offer.oracle_primary != offer.oracle_secondary
