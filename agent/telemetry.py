"""Deterministic, party-attributed telemetry oracles.

A treaty's oracle URLs are its evidence, and every validator in a GenLayer
consensus round fetches those URLs independently. A live price feed answers two
validators at two different instants, so their readings -- and therefore their
breach verdicts -- can disagree; a rate-limited feed turns the whole round into
``[TRANSIENT]`` and the dispute reverts. Neither failure is a property of the
treaty, and neither says anything about the allegation.

Two invariants shape these feeds:

* Party attribution. Each payload reports a metric PER PARTY
  (``{"party_a": .., "party_b": ..}``), so adjudication reads only the
  defendant's own breach. A metric describing party_a can never be used BY
  party_a to slash party_b (no "race to courthouse").
* Independent hosts. The contract requires the primary and secondary oracles to
  live on distinct hostnames, so the duet's evidence is served from two separate
  feeds rather than two paths on one host.

The payload is base64-encoded into the path so the URL string is deterministic
and self-describing: every fetcher receives byte-identical evidence, and the
verdict turns on the part GenLayer actually contributes -- the arbitration and
its equivalence round. The metric is quantized contract-side (``_quantize_bps``)
into integer basis points, so the LLM sees a stable integer either way.
"""

import base64
import json

# Two INDEPENDENT feed hosts (the contract requires distinct hostnames).
PRIMARY_HOST = "telemetry-primary.westphalia.io"
SECONDARY_HOST = "telemetry-secondary.westphalia.io"

# Breach thresholds mirrored from the contract, for readable rationale strings.
BPS_CRITICAL = 7500
BPS_ELEVATED = 2500
DIVERGENCE_BPS = 500


def feed_url(host: str, party_a: float, party_b: float) -> str:
    """A URL whose body is exactly ``{"party_a": <a>, "party_b": <b>}`` for every
    fetcher, base64-encoded into the path so the URL is deterministic."""
    payload = json.dumps({"party_a": party_a, "party_b": party_b}, sort_keys=True)
    token = base64.b64encode(payload.encode()).decode()
    return f"https://{host}/metrics/{token}"


def bps_of(breach_metric: float) -> int:
    """The contract's integer quantization of a metric, for demo narration."""
    return max(0, min(10000, int(round(breach_metric * 10000.0))))


# The duet's declared evidence. party_b is the defendant on trial: the breach is
# attributed to party_b, party_a stays clean. The two feeds agree well inside
# the contract's 500 bps divergence budget, and party_b's mean sits above the
# 7500 bps critical threshold -- so the arbitration has one defensible answer.
CLEAN_PARTY = 0.00
BREACH_PRIMARY_B = 0.80
BREACH_SECONDARY_B = 0.78
BREACH_FEEDS = (
    feed_url(PRIMARY_HOST, CLEAN_PARTY, BREACH_PRIMARY_B),
    feed_url(SECONDARY_HOST, CLEAN_PARTY, BREACH_SECONDARY_B),
)

# The counterfactual pair: identical machinery, party_b well under the elevated
# threshold. A court that returns NORMAL here is reading its evidence.
CALM_PRIMARY_B = 0.05
CALM_SECONDARY_B = 0.04
CALM_FEEDS = (
    feed_url(PRIMARY_HOST, CLEAN_PARTY, CALM_PRIMARY_B),
    feed_url(SECONDARY_HOST, CLEAN_PARTY, CALM_SECONDARY_B),
)


def agreed_bps(feeds: tuple[str, str], target_role: str = "party_b") -> int:
    """The conservative mean bps the contract derives for the DEFENDANT
    (``target_role``) from an agreeing pair."""
    metrics = []
    for url in feeds:
        token = url.rsplit("/", 1)[-1]
        data = json.loads(base64.b64decode(token).decode())
        metrics.append(data[target_role])
    return sum(bps_of(m) for m in metrics) // len(metrics)
