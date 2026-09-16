"""Second-audit regression suite: party-attributed telemetry, independent
elevated flags, high-telemetry MALICIOUS clamp, governor rotation, and the
trailing-dot / backslash SSRF cases.

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
    found,
    future_expiry,
    params_for,
    warp_later,
    mock_telemetry,
    mock_party_telemetry,
    mock_verdict,
)


# --- 1: party-specific telemetry kills the race to courthouse ---------------
def test_party_attributed_no_race_to_courthouse(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Telemetry attributes the breach to party_a, but party_a sues party_b.
    Adjudication reads only the DEFENDANT's (party_b's) clean metric, so party_a
    cannot weaponize its own breach to slash the counterparty."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)  # alice=party_a, bob=party_b
    bob = khex(c, direct_vm, direct_bob)

    # party_a is breaching (0.85 -> 8500 bps), party_b is clean (0.1 -> 1000 bps).
    mock_party_telemetry(direct_vm, party_a=0.85, party_b=0.1)
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    # Alice (party_a, the actual breacher) races to sue Bob (party_b).
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(tid, "he breached everything", "ipfs://e", "hrace1")
    direct_vm.value = 0

    # Bob's own metric is clean, so the CRITICAL verdict clamps to NORMAL; Bob is
    # untouched. A's breach cannot be used by A to slash B.
    assert verdict == "NORMAL"
    assert c.get_enclave(bob)["status"] == "ACTIVE"
    assert int(c.get_treaty(tid)["bond_b"]) == BOND


def test_party_attributed_defendant_breach_surfaces(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The mirror case: party_b sues party_a and telemetry attributes the breach
    to party_a, so adjudication uses party_a's metric and the breach is actioned."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    alice = khex(c, direct_vm, direct_alice)

    mock_party_telemetry(direct_vm, party_a=0.85, party_b=0.1)
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    # Bob (party_b) sues Alice (party_a, the breacher): target metric is 8500 bps.
    direct_vm.sender = direct_bob
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(tid, "she breached", "ipfs://e", "hrace2")
    direct_vm.value = 0

    assert verdict == "CRITICAL_BREACH"
    assert c.get_enclave(alice)["status"] == "SANCTIONED"


# --- 2: independent per-party elevated-slash flags --------------------------
def test_independent_elevated_flags_per_party(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Each party can be elevated-slashed once, independently. A slash against
    party_b must not consume party_a's one-slash budget (and vice versa): both
    slashes land and the treaty stays ACTIVE."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)
    slash = BOND * 25 // 100

    mock_telemetry(direct_vm, 0.4)  # symmetric ELEVATED for whoever is defendant
    mock_verdict(direct_vm, "ELEVATED_RISK")

    # Alice sues Bob -> party_b slashed once.
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    assert c.trigger_dispute(tid, "risk b", "ipfs://e", "hib1") == "ELEVATED_RISK"
    direct_vm.value = 0
    t = c.get_treaty(tid)
    assert t["elevated_slashed_b"] is True and t["elevated_slashed_a"] is False
    assert int(t["bond_b"]) == BOND - slash
    assert t["status"] == "ACTIVE"

    warp_later(direct_vm, 600)  # clear the per-treaty cooldown

    # Bob sues Alice -> party_a slashed once, INDEPENDENTLY (not treated as a
    # repeat slash that would close the treaty). Bob's reputation fell to 40 from
    # his own slash, so his dispute bond is reputation-scaled above the minimum.
    direct_vm.sender = direct_bob
    direct_vm.value = int(c.required_dispute_bond(bob))
    assert c.trigger_dispute(tid, "risk a", "ipfs://e", "hib2") == "ELEVATED_RISK"
    direct_vm.value = 0
    t2 = c.get_treaty(tid)
    assert t2["elevated_slashed_a"] is True and t2["elevated_slashed_b"] is True
    assert int(t2["bond_a"]) == BOND - slash
    assert t2["status"] == "ACTIVE"


# --- 4a: MALICIOUS clamps to ELEVATED on critical telemetry -----------------
def test_malicious_clamped_to_elevated_on_critical_telemetry(direct_vm, direct_deploy, direct_alice, direct_bob):
    """At >= BPS_CRITICAL the allowed set is {CRITICAL_BREACH, ELEVATED_RISK}. An
    LLM MALICIOUS_REPORT is telemetry-contradicted and floors to ELEVATED_RISK
    (never NORMAL), aligning with the clamp docstring."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)

    mock_telemetry(direct_vm, 0.9)  # 9000 bps -> critical range
    mock_verdict(direct_vm, "MALICIOUS_REPORT")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(tid, "x", "ipfs://e", "hmc1")
    direct_vm.value = 0

    assert verdict == "ELEVATED_RISK"
    assert int(c.get_treaty(tid)["bond_b"]) == BOND - BOND * 25 // 100
    assert c.get_enclave(bob)["status"] == "ACTIVE"  # not sanctioned, not acquitted


# --- 4b: governor rotation --------------------------------------------------
def test_transfer_governor(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    """The genesis governor can rotate the role; afterward only the NEW governor
    may drain reserves, and the old one is locked out."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)

    # Generate reserves via an ELEVATED dispute so a drain is meaningful.
    mock_telemetry(direct_vm, 0.4)
    mock_verdict(direct_vm, "ELEVATED_RISK")
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    c.trigger_dispute(tid, "risk", "ipfs://e", "htg1")
    direct_vm.value = 0

    new_gov = khex(c, direct_vm, direct_alice)

    # A non-governor cannot rotate the role.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("ERR_UNAUTHORIZED_PARTY"):
        c.transfer_governor(new_gov)

    # The genesis governor (deployer) rotates the role to Alice.
    direct_vm.sender = direct_owner
    c.transfer_governor(new_gov)

    reserves = int(c.get_protocol_overview()["reserves"])
    treasury = khex(c, direct_vm, direct_charlie)

    # The OLD governor can no longer drain.
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("ERR_UNAUTHORIZED_PARTY"):
        c.drain_reserves(treasury, reserves)

    # The NEW governor can.
    direct_vm.sender = direct_alice
    assert c.drain_reserves(treasury, reserves) == str(reserves)
    assert int(c.get_protocol_overview()["reserves"]) == 0


# --- 5: SSRF trailing-dot normalization + backslash rejection ---------------
def test_ssrf_trailing_dot_and_backslash(direct_deploy):
    c = direct_deploy(CONTRACT)

    # A trailing FQDN-root dot cannot bypass the whole-label blocklist.
    assert c.is_safe_url("http://localhost./") is False
    assert c.is_safe_url("http://metadata.google.internal./latest/meta-data") is False

    # Backslashes are rejected outright (they confuse @ / authority parsing, and
    # browsers fold them to '/').
    assert c.is_safe_url("http://trusted.example\\@127.0.0.1/") is False
    assert c.is_safe_url("https://good.example\\path") is False

    # A normal public host with a root-anchored trailing dot is still allowed.
    assert c.is_safe_url("https://telemetry-primary.westphalia.io./metrics") is True


# --- Final hardening: strict telemetry + governance safety ------------------
def test_boolean_telemetry_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A JSON boolean is an int subclass (True == 1) and would otherwise quantize
    to a breach. It must be rejected as a metric -> neutral FEED_CONFLICT."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    alice = khex(c, direct_vm, direct_alice)

    direct_vm.mock_web(r".*", {"status": 200, "body": '{"party_a": 0.0, "party_b": true}'})
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    assert c.trigger_dispute(tid, "x", "ipfs://e", "hbool1") == "FEED_CONFLICT"
    direct_vm.value = 0
    assert int(c.claimable_of(alice)) == MIN_DISPUTE
    assert c.get_enclave(khex(c, direct_vm, direct_bob))["status"] == "ACTIVE"


def test_no_single_metric_fallback(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A feed reporting only an aggregate breach_metric (no per-party key) can no
    longer be aimed at the defendant: with the fallback gone it resolves to a
    neutral FEED_CONFLICT rather than slashing on an unattributed number."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    alice = khex(c, direct_vm, direct_alice)

    direct_vm.mock_web(r".*", {"status": 200, "body": '{"breach_metric": 0.9}'})
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    assert c.trigger_dispute(tid, "x", "ipfs://e", "hnf1") == "FEED_CONFLICT"
    direct_vm.value = 0
    assert int(c.claimable_of(alice)) == MIN_DISPUTE
    assert c.get_enclave(khex(c, direct_vm, direct_bob))["status"] == "ACTIVE"


def test_transfer_governor_rejects_zero_address(direct_vm, direct_deploy, direct_owner):
    """Rotating governance to the zero address would irrecoverably burn the
    reserves-drain and rotation authority; it must be rejected."""
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.transfer_governor("0x0000000000000000000000000000000000000000")


def test_oracle_hosts_trailing_dot_not_independent(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Two feeds whose hosts differ only by a trailing FQDN dot resolve to the
    SAME host and must fail the independence check."""
    c = direct_deploy(CONTRACT)
    found(c, direct_vm, direct_alice, "Citadel Alpha")
    found(c, direct_vm, direct_bob, "Vanguard Nexus")
    bob = khex(c, direct_vm, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.propose_treaty(
            bob, "NON_AGGRESSION", "t", future_expiry(),
            params_for("NON_AGGRESSION"),
            "https://feed.example/primary", "https://feed.example./secondary",
        )
    direct_vm.value = 0
