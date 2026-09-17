"""V4 hardening regression suite: ground-truth telemetry bounding corridors and
the structured judicial rationale round-trip.

The corridors (_clamp_tier) protect both sides from an LLM hallucination or a
prompt injection: an innocent defendant can never be fully sanctioned on low
telemetry, and an honest plaintiff reporting a high-telemetry breach can never be
dismissed as malicious.

Run with the rest of the direct suite:
    .venv/bin/python -m pytest tests/direct/ -v
Pure-ASCII. Direct mode executes the leader function only.
"""

from conftest import (
    CONTRACT,
    BOND,
    MIN_DISPUTE,
    khex,
    active_treaty,
    party_telemetry,
    mock_telemetry,
    mock_evidence,
    mock_verdict,
)


# --- Ceiling: below the elevated threshold, CRITICAL is forbidden ------------
def test_low_telemetry_critical_no_evidence_floored_to_normal(direct_vm, direct_deploy, direct_alice, direct_bob):
    """1000 bps (< 2500) with no corroborating evidence: an injected / hallucinated
    CRITICAL_BREACH is floored to NORMAL. The defendant keeps its full bond."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)

    mock_telemetry(direct_vm, 0.1)  # 1000 bps, below the elevated threshold
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(tid, "breach!", "ipfs://e", "hv4a")
    direct_vm.value = 0

    assert verdict == "NORMAL"
    assert c.get_enclave(bob)["status"] == "ACTIVE"
    assert int(c.get_treaty(tid)["bond_b"]) == BOND


def test_low_telemetry_critical_with_evidence_capped_to_elevated(direct_vm, direct_deploy, direct_alice, direct_bob):
    """1000 bps (< 2500) WITH corroborating evidence: a CRITICAL_BREACH is capped
    to ELEVATED_RISK -- a 25% slash, never a full sanction on low telemetry."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)

    # Telemetry oracles (on *.westphalia.io) report 1000 bps for the defendant.
    direct_vm.mock_web(r".*westphalia\.io.*", party_telemetry(0.0, 0.1))
    mock_evidence(direct_vm, r".*audit-log\.example.*", "Sustained partial SLA breach observed over 4h.")
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(
        tid, "breach with evidence", "https://audit-log.example/case.md", "hv4b"
    )
    direct_vm.value = 0

    assert verdict == "ELEVATED_RISK"
    assert c.get_enclave(bob)["status"] == "ACTIVE"
    assert int(c.get_treaty(tid)["bond_b"]) == BOND - BOND * 25 // 100


def test_negligible_telemetry_elevated_no_evidence_floored_to_normal(direct_vm, direct_deploy, direct_alice, direct_bob):
    """300 bps (< 500) with no evidence: even an ELEVATED_RISK verdict is floored
    to NORMAL -- negligible telemetry with no corroboration supports no breach."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)

    mock_telemetry(direct_vm, 0.03)  # 300 bps, negligible
    mock_verdict(direct_vm, "ELEVATED_RISK")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(tid, "minor risk", "ipfs://e", "hv4c")
    direct_vm.value = 0

    assert verdict == "NORMAL"
    assert c.get_enclave(bob)["status"] == "ACTIVE"
    assert int(c.get_treaty(tid)["bond_b"]) == BOND


def test_structured_rationale_round_trip(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The verdict tier still drives settlement deterministically when the model
    returns the structured {"verdict", "rationale"} object the equivalence round
    now compares. A high-telemetry CRITICAL with a rich rationale sanctions the
    defendant exactly as before -- the rationale rides through without changing
    the on-chain execution."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)

    mock_telemetry(direct_vm, 0.95)  # 9500 bps -> critical range
    mock_verdict(
        direct_vm,
        "CRITICAL_BREACH",
        rationale="Telemetry and covenant terms establish a clear, unexcused breach.",
    )

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(tid, "verified breach", "ipfs://e", "hv4d")
    direct_vm.value = 0

    assert verdict == "CRITICAL_BREACH"
    assert c.get_enclave(bob)["status"] == "SANCTIONED"
