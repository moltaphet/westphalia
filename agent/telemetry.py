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

import hashlib
import urllib.request

# GitHub repository the static telemetry documents are committed to.
_REPO = "moltaphet/westphalia"
_BRANCH = "main"

# raw.githubusercontent.com serves the file to any client, but identifying
# ourselves is the polite default for a public CDN.
_UA = "westphalia-agent/1.0"

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


def evidence_digest(url: str, timeout: float = 20.0) -> str | None:
    """The evidence commitment for `url`: the SHA-256 the contract will recompute
    over the document it fetches, as lowercase hex with no prefix. Returns None
    when this machine cannot read the document.

    V4.2 makes ``evidence_hash`` a commitment verified inside the
    non-deterministic round, so a filing is admissible only when its hash equals
    the digest of the bytes the contract itself fetched. This derives that same
    number from those same bytes: a plain 2xx GET, decoded as utf-8 with
    replacement characters for invalid sequences -- exactly what the contract's
    ``_get_evidence_text`` does before ``_evidence_digest`` hashes it -- so the
    commitment covers the document and not this client's reading of it.

    None is a real answer, not a nuisance: a digest cannot be invented for a
    document nobody has read. A filing that committed to a fabricated hash would
    still be accepted on-chain and then adjudicated on NO_EVIDENCE, which is a
    wrong verdict recorded permanently. The caller aborts instead."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            if not (200 <= res.status < 300):
                return None
            raw = res.read()
    except Exception:
        return None
    text = raw.decode("utf-8", "replace")
    return hashlib.sha256(text.encode("utf-8")).hexdigest().lower()

