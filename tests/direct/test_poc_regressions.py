"""P1-P4 black-hat PoC regression tests (permanent).

Each test re-drives an attack that was PoC-confirmed during the security
review and asserts the deployed fix holds:
  P1  reputation laundering via withdraw_collateral + re-found
  P2  hostage treaty (expires_at=0 + uncooperative counterparty)
  P3  sanctioned enclave ratifying a pending treaty
  P4  SSRF bypass via non-dotted numeric IP encodings
plus the governor-only reserves drain.

Run: pytest tests/direct/ -v. Pure-ASCII. Direct mode (leader only).
"""

from conftest import (
    CONTRACT,
    ATTO,
    BOND,
    COLLATERAL,
    MIN_DISPUTE,
    ORACLE_P,
    ORACLE_S,
    khex,
    future_expiry,
    warp_later,
    active_treaty,
    add_treaty,
    found,
    fund,
    propose,
    mock_telemetry,
    mock_verdict,
    params_for,
)

VALIDATION_FEE = 5 * ATTO


# --- P4: SSRF via numeric-host encodings ------------------------------------
def test_ssrf_numeric_encodings_blocked(direct_deploy):
    """The PoC: 0x7f000001 / 2130706433 / 0177.0.0.1 / 127.1 / 0x7f.1 all
    encode 127.0.0.1 and previously slipped past the dotted-quad blocklist.
    All must now normalize to the same blocked address."""
    c = direct_deploy(CONTRACT)
    for u in (
        "http://0x7f000001/",
        "http://2130706433/",
        "http://0177.0.0.1/",
        "http://127.1/",
        "http://0x7f.1/",
        "http://127.0.0.1/",
    ):
        assert c.is_safe_url(u) is False, u
    # Equivalent encodings of private ranges are blocked too.
    assert c.is_safe_url("http://0x0a000001/") is False  # 10.0.0.1
    assert c.is_safe_url("http://3232235521/") is False  # 192.168.0.1
    assert c.is_safe_url("http://2852039166/") is False  # 169.254.169.254
    assert c.is_safe_url("http://0xA9.254.169.254/") is False  # mixed hex
    # A public IP in any encoding still passes (no false positives).
    assert c.is_safe_url("http://8.8.8.8/") is True
    assert c.is_safe_url("http://134744072/") is True  # 8.8.8.8 decimal
    assert c.is_safe_url("https://telemetry.example/feed") is True


# --- P3: sanctioned counterparty ratifies a pending treaty -------------------
def test_sanctioned_ratify_blocked(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """The PoC: Bob was sanctioned, then ratified Alice's pending treaty,
    locking value under a sanctioned enclave. Ratification must now check
    that BOTH parties are still ACTIVE at ratify time."""
    c = direct_deploy(CONTRACT)
    found(c, direct_vm, direct_alice, "Citadel Alpha")
    found(c, direct_vm, direct_bob, "Vanguard Nexus")
    bob = khex(c, direct_vm, direct_bob)

    # Alice proposes; the treaty sits PROPOSED.
    tid = propose(
        c, direct_vm, direct_alice, bob, "NON_AGGRESSION", "terms",
        future_expiry(), params_for("NON_AGGRESSION"),
    )

    # Bob gets sanctioned via an unrelated dispute on a treaty of his own.
    found(c, direct_vm, direct_charlie, "Sovereign Enclave")
    tid_bc = add_treaty(c, direct_vm, direct_bob, direct_charlie)
    mock_telemetry(direct_vm, 0.95)
    mock_verdict(direct_vm, "CRITICAL_BREACH")
    direct_vm.sender = direct_charlie
    direct_vm.value = MIN_DISPUTE
    c.trigger_dispute(tid_bc, "breach", "ipfs://e", "hsr1")
    direct_vm.value = 0
    assert c.get_enclave(bob)["status"] == "SANCTIONED"

    # The PoC attack: sanctioned Bob ratifies Alice's pending treaty.
    direct_vm.sender = direct_bob
    direct_vm.value = BOND
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.ratify_treaty(tid)
    direct_vm.value = 0
    assert c.get_treaty(tid)["status"] == "PROPOSED"


# --- P2: hostage treaty ------------------------------------------------------
def test_hostage_treaty_impossible(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The PoC: (a) expires_at=0 locked Bob's bond forever because Alice
    refused dissolution and recover_bond requires a real expiry; (b) even
    with an expiry, Bob had no exit for the duration. Fixes: zero expiry is
    rejected, duration is capped, and exit_treaty provides a unilateral exit
    at a 10% penalty to reserves (never to the hostage-taker)."""
    c = direct_deploy(CONTRACT)
    found(c, direct_vm, direct_alice, "Citadel Alpha")
    found(c, direct_vm, direct_bob, "Vanguard Nexus")
    bob = khex(c, direct_vm, direct_bob)

    # (a) Zero expiry is rejected outright.
    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.propose_treaty(bob, "NON_AGGRESSION", "forever", 0,
                         params_for("NON_AGGRESSION"), ORACLE_P, ORACLE_S)
    direct_vm.value = 0

    # (b) Absurdly long durations are rejected too.
    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.propose_treaty(bob, "NON_AGGRESSION", "decades",
                         future_expiry(days=366),
                         params_for("NON_AGGRESSION"), ORACLE_P, ORACLE_S)
    direct_vm.value = 0

    # (c) Unilateral exit from a normal treaty: Bob registers the exit...
    # (alice and bob are already founded above, so add_treaty, not active_treaty)
    tid = add_treaty(c, direct_vm, direct_alice, direct_bob, kind="NON_AGGRESSION")
    direct_vm.sender = direct_bob
    assert c.exit_treaty(tid) == "EXIT_PENDING"

    # ...the counterparty (Alice) still has dispute standing during notice.
    # (ELEVATED_RISK keeps the treaty ACTIVE; CRITICAL would settle it.)
    mock_telemetry(direct_vm, 0.4)
    mock_verdict(direct_vm, "ELEVATED_RISK")
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    assert c.trigger_dispute(tid, "risk", "ipfs://e", "hhx1") == "ELEVATED_RISK"
    direct_vm.value = 0

    # (d) After the notice window Bob executes the exit: the penalty (10% of
    # his post-slash bond) goes to reserves, never to Alice, and the treaty
    # settles with both parties' open-treaty counts released.
    warp_later(direct_vm, 3 * 86400 + 60)  # past the 3-day notice period
    alice = khex(c, direct_vm, direct_alice)

    reserves1 = int(c.get_protocol_overview()["reserves"])
    bond_b_now = int(c.get_treaty(tid)["bond_b"])  # post-ELEVATED slash
    direct_vm.sender = direct_bob
    assert c.exit_treaty(tid) == "SETTLED"
    assert c.get_treaty(tid)["status"] == "SETTLED"
    assert c.locked_treaty_count(bob) == "0"
    penalty = bond_b_now * 10 // 100
    assert int(c.get_protocol_overview()["reserves"]) == reserves1 + penalty
    # Bob receives his bond minus the penalty; Alice is made whole.
    assert int(c.claimable_of(bob)) == bond_b_now - penalty
    assert int(c.claimable_of(alice)) >= BOND


# --- P1: reputation laundering ----------------------------------------------
def test_reputation_laundering_blocked(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The PoC: Bob withdrew collateral (deleting his Enclave record), then
    re-founded and his reputation reset to a fresh 50 despite a history of
    MALICIOUS_REPORTs. Reputation is now sticky across sovereign exits."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)

    # Bob files a frivolous dispute -> MALICIOUS_REPORT -> reputation 30.
    mock_telemetry(direct_vm, 0.1)
    mock_verdict(direct_vm, "MALICIOUS_REPORT")
    direct_vm.sender = direct_bob
    direct_vm.value = MIN_DISPUTE
    c.trigger_dispute(tid, "totally real breach", "ipfs://e", "hrl1")
    direct_vm.value = 0
    assert int(c.get_enclave(bob)["reputation"]) == 30

    # Bob dissolves and exits sovereignty, wiping his enclave record.
    direct_vm.sender = direct_alice
    c.dissolve_treaty(tid)
    direct_vm.sender = direct_bob
    c.dissolve_treaty(tid)
    direct_vm.sender = direct_bob
    assert c.withdraw_collateral() == str(COLLATERAL)

    # The PoC attack: re-found with a shiny reputation-50 record.
    fund(direct_vm, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.value = COLLATERAL
    c.found_sovereignty("Reborn Vanguard", "Oracle Collective", "clean slate")
    direct_vm.value = 0

    # Reputation is inherited, not reset (30, not the 50 seed).
    assert int(c.get_enclave(bob)["reputation"]) == 30
    # And the scaled dispute bond reflects the debited reputation.
    assert int(c.required_dispute_bond(bob)) == MIN_DISPUTE * 120 // 100


# --- Bonus: governor-only reserves drain ------------------------------------
def test_reserves_drain_governor_only(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    """Reserves accumulate with no exit path (design leftover); the governor
    (deployer) may now drain them to a treasury address. Non-governors and
    self-drains are rejected."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)

    # Generate some reserves via an ELEVATED_RISK dispute.
    mock_telemetry(direct_vm, 0.4)
    mock_verdict(direct_vm, "ELEVATED_RISK")
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    c.trigger_dispute(tid, "risk", "ipfs://e", "hrd1")
    direct_vm.value = 0
    reserves = int(c.get_protocol_overview()["reserves"])
    assert reserves > 0

    # Non-governor (the deployer deployed via direct_deploy; alice is not it)
    # cannot drain.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("ERR_UNAUTHORIZED_PARTY"):
        c.drain_reserves(khex(c, direct_vm, direct_bob), reserves)

    # Governor drains to a treasury address (not itself).
    treasury = khex(c, direct_vm, direct_charlie)
    governor = direct_owner  # the default sender that deployed via direct_deploy
    direct_vm.sender = governor
    assert c.drain_reserves(treasury, reserves) == str(reserves)
    assert int(c.get_protocol_overview()["reserves"]) == 0
    # Over-drain is rejected.
    direct_vm.sender = governor
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.drain_reserves(treasury, 1)
