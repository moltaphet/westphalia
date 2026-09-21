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
import json
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

# Incident reports, as opposed to the bare metric readings above. A filing's
# evidence document is chosen by the plaintiff at dispute time (unlike the
# oracles, which are fixed in treaty storage at proposal time), so this is the
# one input the protocol can require to be self-describing.
#
# A bare ``{"party_a": .., "party_b": ..}`` reading says a deviation happened
# but not to whom: it names no address, no treaty, and no event, so a tribunal
# ruling on it is ruling on an unattributed number. The documents below carry
# the reported target's address and the treaty it is party to, and every field
# in them is checkable against contract storage -- ``get_treaty(id)`` and the
# enclave roster -- so the reading is attributable to one address rather than to
# whoever the filer says it is about.
#
# They keep the same party-attributed metric shape the contract parses, so a
# filing that commits one is adjudicated exactly like any other document.
INCIDENT_FEEDS = (_primary_url("telemetry/incident_meridian_0001.json"),)

# The target each incident report names, and the on-chain record that binds it.
# Read from the document at runtime by ``incident_binding``; kept here so tests
# and narration can assert the binding without a network read.
INCIDENT_TARGETS = {
    INCIDENT_FEEDS[0]: {
        "address": "0xD0C66f72add962e469d002De98c36F300Ad2eE7f",
        "role": "party_b",
        "treaty_id": 2,
    },
}

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


def _is_address(value: str) -> bool:
    """True for a 0x-prefixed 20-byte hex address."""
    if len(value) != 42 or not value.startswith("0x"):
        return False
    try:
        int(value[2:], 16)
    except ValueError:
        return False
    return True


def _binding_of(doc) -> dict | None:
    """The target binding a parsed incident document declares, or None.

    Kept separate from the fetch so a caller already holding the document -- a
    test, or a client that read it off the treaty record -- can check the binding
    without a second network read."""
    if not isinstance(doc, dict):
        return None
    target = doc.get("target")
    treaty = doc.get("treaty")
    if not isinstance(target, dict) or not isinstance(treaty, dict):
        return None
    address = target.get("address")
    role = target.get("role")
    treaty_id = treaty.get("id")
    # A binding needs an address, the party key the reading is filed under, and
    # the treaty that makes that address a party to this dispute. Missing any one
    # leaves the reading unattributable, which is the state this refuses.
    if not isinstance(address, str) or not _is_address(address):
        return None
    if role not in ("party_a", "party_b"):
        return None
    if not isinstance(treaty_id, int) or isinstance(treaty_id, bool):
        return None
    # The metric must be filed under the very role the binding names, or the
    # address and the number are describing different parties.
    metric = doc.get(role)
    if isinstance(metric, bool) or not isinstance(metric, (int, float)):
        return None
    return {"address": address.lower(), "role": role, "treaty_id": treaty_id}


def incident_binding(url: str, timeout: float = 20.0) -> dict | None:
    """Read an incident report and return the target it binds to, or None when
    the document cannot be read or binds to no target.

    The contract cannot require this of a filing: its prompt is fixed at deploy
    time and it parses whatever the party-attributed keys hold, so an
    unattributed reading is admissible on chain and a tribunal will rule on it.
    This is the filing side holding itself to the stricter rule -- a plaintiff
    that cannot show who a reading is about does not file it.

    On success returns ``{"address", "role", "treaty_id"}``, every field of which
    is checkable against contract storage: ``get_treaty(treaty_id)`` names the
    address as the party holding ``role``."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            if not (200 <= res.status < 300):
                return None
            raw = res.read()
    except Exception:
        return None
    try:
        doc = json.loads(raw.decode("utf-8", "replace"))
    except Exception:
        return None
    return _binding_of(doc)

