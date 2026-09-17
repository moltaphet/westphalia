"""Shared helpers for Westphalia direct-mode tests.

Pure-ASCII. Uses the genlayer-test pytest plugin fixtures: direct_vm,
direct_deploy, direct_alice, direct_bob, direct_charlie.
"""

import hashlib
import json
import time
from datetime import datetime, timezone

CONTRACT = "contracts/westphalia.py"

ATTO = 10**18
COLLATERAL = 2000 * ATTO
BOND = 1000 * ATTO
MIN_DISPUTE = 500 * ATTO

# Valid typed parameter sets per treaty kind (V2 schema).
PARAMS = {
    "NON_AGGRESSION": '{"max_exploit_bps": 300, "max_mev_events": 2}',
    "TRADE_CORRIDOR": '{"min_settlement_volume": 100000, "max_slippage_bps": 50}',
    "DATA_SHARING": '{"min_uptime_bps": 9900, "max_latency_bps": 250}',
}


def params_for(kind: str) -> str:
    return PARAMS[kind]


def addr_hex(a) -> str:
    """Canonical 0x-hex for a test address, matching the in-VM Address.as_hex
    the contract uses for its storage keys."""
    if isinstance(a, (bytes, bytearray)):
        return "0x" + bytes(a).hex()
    v = getattr(a, "as_hex", None)
    if isinstance(v, str):
        return v.lower()
    b = getattr(a, "as_bytes", None)
    if b is not None:
        try:
            return "0x" + bytes(b).hex()
        except Exception:
            pass
    s = str(a)
    return s.lower()


def khex(contract, direct_vm, who) -> str:
    """Canonical storage key for a test account, read straight from the VM via
    the contract's whoami() view (matches in-VM Address.as_hex exactly)."""
    prev = getattr(direct_vm, "sender", None)
    direct_vm.sender = who
    k = contract.whoami()
    if prev is not None:
        direct_vm.sender = prev
    return k


def telemetry(breach_metric: float, contradiction: bool = False) -> dict:
    """A pinned successful telemetry web response, party-attributed. The same
    metric is reported for BOTH parties so a single value applies to whichever
    party is the defendant -- backward-compatible with the old single-metric
    feeds while exercising the party-keyed extraction path."""
    body = json.dumps(
        {"party_a": breach_metric, "party_b": breach_metric, "contradiction": contradiction}
    )
    return {"status": 200, "body": body}


def party_telemetry(party_a: float, party_b: float, contradiction: bool = False) -> dict:
    """A party-attributed telemetry response with DISTINCT per-party metrics, so
    a dispute reads only the defendant's own breach (kills the race to
    courthouse)."""
    body = json.dumps({"party_a": party_a, "party_b": party_b, "contradiction": contradiction})
    return {"status": 200, "body": body}


def mock_telemetry(direct_vm, breach_metric: float, contradiction: bool = False):
    direct_vm.mock_web(r".*", telemetry(breach_metric, contradiction))


def mock_party_telemetry(direct_vm, party_a: float, party_b: float, contradiction: bool = False):
    direct_vm.mock_web(r".*", party_telemetry(party_a, party_b, contradiction))


def mock_verdict(direct_vm, tier: str, rationale: str = "Judicial reasoning for the verdict."):
    # The tribunal returns {"verdict", "rationale"}; the contract reads the tier
    # and the equivalence round validates the reasoning. Double-encoded: the
    # harness json.loads()s the mock into a string, and the v0.3 SDK's
    # exec_prompt(response_format="json") json.loads()s that string again to
    # produce the dict the contract parses.
    payload = {"verdict": tier, "rationale": rationale}
    direct_vm.mock_llm(r".*", json.dumps(json.dumps(payload)))


def evidence_digest(text: str) -> str:
    """The SHA-256 the contract computes over the RAW body it fetches, in the
    spelling trigger_dispute records: lowercase hex, no 0x prefix. This is what a
    plaintiff hands the contract as `evidence_hash`, and what V4.2 checks inside
    the non-deterministic round before any document is admitted."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest().lower()


def mock_evidence(direct_vm, pattern: str, text: str, status: int = 200) -> str:
    """Mock an external evidence document the contract reads on-chain via
    gl.nondet.web.get(evidence_uri). `pattern` is a regex matched against the
    evidence URL; keep it disjoint from the telemetry-oracle mock patterns.

    Returns the digest that admits this body, so a caller can pass it straight
    through as `evidence_hash` and the test exercises the adjudication path
    rather than the document gate. A caller testing the gate itself passes
    something else on purpose."""
    direct_vm.mock_web(pattern, {"status": status, "body": text})
    return evidence_digest(text)


def fund(direct_vm, who, amount=10_000 * ATTO):
    """Ensure a test account can cover payable calls."""
    try:
        direct_vm.deal(who, amount)
    except Exception:
        pass


def found(contract, direct_vm, who, name, archetype="Autonomous Arbiter", charter="charter"):
    fund(direct_vm, who)
    direct_vm.sender = who
    direct_vm.value = COLLATERAL
    contract.found_sovereignty(name, archetype, charter)
    direct_vm.value = 0


# Treaty-bound telemetry oracles (V3). The URLs are agreed at proposal time
# and stored on the treaty; dispute-time adjudication reads them from storage.
# The two feeds live on INDEPENDENT hosts (the contract requires distinct
# hostnames, not just distinct URLs). The host substrings "primary"/"secondary"
# keep the `.*primary.*` / `.*secondary.*` web mocks matching per-feed.
ORACLE_P = "https://telemetry-primary.westphalia.io/metrics"
ORACLE_S = "https://telemetry-secondary.westphalia.io/metrics"


def propose(contract, direct_vm, proposer, counterparty_hex, kind, terms, expires_at, params_json,
            oracle_p=ORACLE_P, oracle_s=ORACLE_S, bond=BOND):
    direct_vm.sender = proposer
    direct_vm.value = bond
    tid = contract.propose_treaty(
        counterparty_hex, kind, terms, expires_at, params_json, oracle_p, oracle_s
    )
    direct_vm.value = 0
    return tid


def future_expiry(days: int = 300) -> int:
    """Expiry `days` out from the host clock, which is the contract's block
    clock whenever no warp() is active. Kept inside the 365-day max duration
    and beyond the 3-day exit notice window."""
    return int(time.time()) + days * 86400


def warp_later(direct_vm, seconds: int) -> None:
    """Warp the VM clock forward `seconds` from the host clock, staying inside
    the treaty expiry window (unlike a hard 2035 date, which would expire
    every future_expiry() treaty)."""
    later = datetime.fromtimestamp(time.time() + seconds, tz=timezone.utc)
    direct_vm.warp(later.strftime("%Y-%m-%dT%H:%M:%SZ"))


def active_treaty(contract, direct_vm, alice, bob, expires_at=None):
    """Found two enclaves, propose + ratify a NON_AGGRESSION treaty, return its id."""
    if expires_at is None:
        expires_at = future_expiry()
    found(contract, direct_vm, alice, "Citadel Alpha")
    found(contract, direct_vm, bob, "Vanguard Nexus")

    bob_key = khex(contract, direct_vm, bob)
    tid = propose(
        contract, direct_vm, alice, bob_key, "NON_AGGRESSION",
        "no staging within 3 tiles", expires_at, params_for("NON_AGGRESSION"),
    )

    direct_vm.sender = bob
    direct_vm.value = BOND
    contract.ratify_treaty(tid)
    direct_vm.value = 0
    return tid


def add_treaty(contract, direct_vm, proposer, counterparty, kind="TRADE_CORRIDOR", expires_at=None):
    """Propose + ratify an additional treaty between two already-founded enclaves."""
    if expires_at is None:
        expires_at = future_expiry()
    cp = khex(contract, direct_vm, counterparty)
    tid = propose(
        contract, direct_vm, proposer, cp, kind, "auxiliary terms",
        expires_at, params_for(kind),
    )
    direct_vm.sender = counterparty
    direct_vm.value = BOND
    contract.ratify_treaty(tid)
    direct_vm.value = 0
    return tid
