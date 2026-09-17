"""Deterministic, party-attributed telemetry oracles served over the public web.

A treaty's oracle URLs are its evidence, and every validator in a GenLayer
consensus round fetches those URLs independently via ``gl.nondet.web.get``. Two
invariants shape these feeds:

* Party attribution. Each payload reports a metric PER PARTY
  (``{"party_a": ..., "party_b": ...}``), so adjudication reads only the
  defendant's own breach -- a metric describing party_a can never be used BY
  party_a to slash party_b (no race to courthouse).
* Reachable, independent hosts. The feeds must actually resolve on the public
  web (an unresolvable host makes ``gl.nondet.web.get`` raise a transient error
  and the dispute reverts), and the contract requires the two oracles to be on
  DISTINCT hostnames. Both conditions are met by serving static JSON committed to
  this repository under ``telemetry/*.json`` from two independent public CDNs:

    - primary   -> raw.githubusercontent.com   (GitHub raw)
    - secondary -> cdn.jsdelivr.net             (jsDelivr GitHub CDN)

  Both answer HTTP 200 with a body such as
  ``{"party_a": 0.0, "party_b": 0.88, "contradiction": false}``. Because both
  CDNs serve the SAME committed file, every validator receives byte-identical
  evidence; the verdict then turns on the arbitration, not on which validator
  fetched first.

The metric is quantized contract-side (``_quantize_bps``) into integer basis
points, so the LLM sees a stable integer either way.
"""

# GitHub repository the static telemetry documents are committed to.
_REPO = "moltaphet/westphalia"
_BRANCH = "main"

# Two INDEPENDENT, publicly reachable feed hosts (the contract requires distinct
# hostnames; both serve the same committed telemetry/*.json).
PRIMARY_HOST = "raw.githubusercontent.com"
SECONDARY_HOST = "cdn.jsdelivr.net"

# Breach thresholds mirrored from the contract, for readable rationale strings.
BPS_CRITICAL = 7500
BPS_ELEVATED = 2500
DIVERGENCE_BPS = 500


def _primary_url(path: str) -> str:
    """A GitHub raw URL for a committed telemetry document."""
    return f"https://{PRIMARY_HOST}/{_REPO}/{_BRANCH}/{path}"


def _secondary_url(path: str) -> str:
    """A jsDelivr GitHub-CDN URL for the same committed document, on a distinct host."""
    return f"https://{SECONDARY_HOST}/gh/{_REPO}@{_BRANCH}/{path}"


def bps_of(breach_metric: float) -> int:
    """The contract's integer quantization of a metric, for demo narration."""
    return max(0, min(10000, int(round(breach_metric * 10000.0))))


# The duet's declared evidence. party_b is the defendant on trial. The two feeds
# of each pair agree well inside the 500 bps divergence budget; the breach pair's
# party_b mean sits above the 7500 bps critical threshold and the calm pair's
# below the 2500 bps elevated threshold.
BREACH_FEEDS = (
    _primary_url("telemetry/breach_primary.json"),
    _secondary_url("telemetry/breach_secondary.json"),
)
CALM_FEEDS = (
    _primary_url("telemetry/calm_primary.json"),
    _secondary_url("telemetry/calm_secondary.json"),
)

# The party-attributed metric each feed reports, mirroring the committed JSON.
# The feeds are static documents (not self-describing URLs), so narration and
# tests read the metric from here rather than decoding it from the URL. Keep in
# sync with telemetry/*.json.
_FEED_METRICS = {
    BREACH_FEEDS[0]: {"party_a": 0.0, "party_b": 0.80},
    BREACH_FEEDS[1]: {"party_a": 0.0, "party_b": 0.78},
    CALM_FEEDS[0]: {"party_a": 0.0, "party_b": 0.05},
    CALM_FEEDS[1]: {"party_a": 0.0, "party_b": 0.04},
}


def agreed_bps(feeds: tuple[str, str], target_role: str = "party_b") -> int:
    """The conservative mean bps the contract derives for the DEFENDANT
    (``target_role``) from an agreeing pair, read from the committed feed values."""
    vals = [_FEED_METRICS[u][target_role] for u in feeds if u in _FEED_METRICS]
    if not vals:
        return 0
    return sum(bps_of(v) for v in vals) // len(vals)
