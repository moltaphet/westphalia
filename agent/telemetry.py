"""Deterministic telemetry oracles.

A treaty's oracle URLs are its evidence, and every validator in a GenLayer
consensus round fetches those URLs independently. A live price feed answers two
validators at two different instants, so their readings -- and therefore their
breach verdicts -- can disagree; a rate-limited feed turns the whole round into
``[TRANSIENT]`` and the dispute reverts. Neither failure is a property of the
treaty, and neither says anything about the allegation.

``httpbin.org/base64/<payload>`` echoes the decoded payload verbatim, so every
validator receives byte-identical evidence. The verdict then turns on the part
GenLayer actually contributes -- the arbitration and its equivalence round --
rather than on which validator happened to fetch first.

The metric is quantized contract-side (``_quantize_bps``) into integer basis
points, so the LLM sees a stable integer either way.
"""

import base64
import json

# The host both feeds are served from; trust is granted by host in profiles.py.
FEED_HOST = "httpbin.org"

# Breach thresholds mirrored from the contract, for readable rationale strings.
BPS_CRITICAL = 7500
BPS_ELEVATED = 2500
DIVERGENCE_BPS = 500


def feed_url(breach_metric: float) -> str:
    """A URL whose body is exactly ``{"breach_metric": <m>}`` for every fetcher."""
    payload = json.dumps({"breach_metric": breach_metric}, sort_keys=True)
    token = base64.b64encode(payload.encode()).decode()
    return f"https://{FEED_HOST}/base64/{token}"


def bps_of(breach_metric: float) -> int:
    """The contract's integer quantization of a metric, for demo narration."""
    return max(0, min(10000, int(round(breach_metric * 10000.0))))


# The duet's declared evidence pair. Two endpoints that agree well inside the
# contract's 500 bps divergence budget, and whose mean sits above the 7500 bps
# critical threshold -- so the arbitration has one defensible answer.
BREACH_PRIMARY = 0.80
BREACH_SECONDARY = 0.78
BREACH_FEEDS = (feed_url(BREACH_PRIMARY), feed_url(BREACH_SECONDARY))

# The counterfactual pair: identical machinery, telemetry well under the
# elevated threshold. A court that returns NORMAL here is reading its evidence.
CALM_PRIMARY = 0.05
CALM_SECONDARY = 0.04
CALM_FEEDS = (feed_url(CALM_PRIMARY), feed_url(CALM_SECONDARY))


def agreed_bps(feeds: tuple[str, str]) -> int:
    """The conservative mean bps the contract derives from an agreeing pair."""
    metrics = []
    for url in feeds:
        token = url.rsplit("/", 1)[-1]
        metrics.append(json.loads(base64.b64decode(token).decode())["breach_metric"])
    return sum(bps_of(m) for m in metrics) // len(metrics)
