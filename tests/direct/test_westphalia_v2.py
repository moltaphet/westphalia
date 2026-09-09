"""Westphalia V2 direct-mode tests: dual-feed telemetry, dynamic reputation
bonds, anti-Sybil maturation, amicable dissolution, and strict solvency.

Run: pytest tests/direct/ -v   (Python 3.12; see README for the uv env).
Pure-ASCII. Direct mode executes the leader function only.
"""

from conftest import (
    CONTRACT,
    ATTO,
    COLLATERAL,
    BOND,
    MIN_DISPUTE,
    khex,
    active_treaty,
    add_treaty,
    found,
    mock_telemetry,
    mock_verdict,
    params_for,
    telemetry,
)

HIGH_BOND = 6000 * ATTO  # above the contract's HIGH_BOND_THRESHOLD (5000 GEN)


# --- V2.1: dual-feed agreement -> accurate settlement -----------------------
def test_dual_telemetry_agreement(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)

    # Both feeds report the same high breach metric (delta 0 -> no contradiction).
    mock_telemetry(direct_vm, 0.9)  # matches both primary and secondary URLs
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(
        tid, "verified breach", "ipfs://e", "hda1",
        "https://telemetry.example/primary", "https://telemetry.example/secondary",
    )
    direct_vm.value = 0

    assert verdict == "CRITICAL_BREACH"
    assert c.get_enclave(khex(c, direct_vm, direct_bob))["status"] == "SANCTIONED"


# --- V2.2: dual-feed divergence > 5% -> MALICIOUS_REPORT, plaintiff slashed --
def test_dual_telemetry_divergence_slashes(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)

    ov0 = c.get_protocol_overview()
    reserves0 = int(ov0["reserves"])

    # Feeds diverge by 70% (9000 vs 2000 bps) -> contract flags contradiction
    # deterministically and forces MALICIOUS_REPORT regardless of the LLM.
    direct_vm.mock_web(r".*primary.*", telemetry(0.9))
    direct_vm.mock_web(r".*secondary.*", telemetry(0.2))
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(
        tid, "fabricated breach", "ipfs://e", "hdd1",
        "https://telemetry.example/primary", "https://telemetry.example/secondary",
    )
    direct_vm.value = 0

    assert verdict == "MALICIOUS_REPORT"
    ov1 = c.get_protocol_overview()
    assert int(ov1["reserves"]) == reserves0 + MIN_DISPUTE  # 100% dispute bond slashed
    assert c.claimable_of(khex(c, direct_vm, direct_alice)) == "0"


# --- V2.3: amicable mutual dissolution -> full refund, no penalty -----------
def test_amicable_dissolution(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    assert c.dissolve_treaty(tid) == "PENDING_DISSOLUTION"

    direct_vm.sender = direct_bob
    assert c.dissolve_treaty(tid) == "SETTLED"

    assert int(c.claimable_of(khex(c, direct_vm, direct_alice))) == BOND
    assert int(c.claimable_of(khex(c, direct_vm, direct_bob))) == BOND
    assert c.get_treaty(tid)["status"] == "SETTLED"


# --- V2.4: reputation-scaled dispute bond (discount + premium + enforcement) -
def test_reputation_scaled_dispute_bond(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy(CONTRACT)
    tid_ab = active_treaty(c, direct_vm, direct_alice, direct_bob)
    found(c, direct_vm, direct_charlie, "Sovereign Enclave")
    tid_ac = add_treaty(c, direct_vm, direct_alice, direct_charlie, kind="DATA_SHARING")

    alice = khex(c, direct_vm, direct_alice)
    bob = khex(c, direct_vm, direct_bob)

    # Baseline: reputation 50 -> required == MIN.
    assert int(c.required_dispute_bond(alice)) == MIN_DISPUTE

    # Alice wins a CRITICAL breach -> reputation reward (50 -> 65).
    mock_telemetry(direct_vm, 0.95)
    mock_verdict(direct_vm, "CRITICAL_BREACH")
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    c.trigger_dispute(tid_ab, "breach", "ipfs://e", "hrs1", "https://p/x", "https://s/y")
    direct_vm.value = 0

    discounted = MIN_DISPUTE * (150 - 65) // 100  # rep 65 -> 0.85 x MIN
    assert int(c.required_dispute_bond(alice)) == discounted
    assert discounted < MIN_DISPUTE  # high reputation pays less

    # Sanctioned defendant (reputation 0) pays the maximum premium (1.5 x MIN).
    assert int(c.required_dispute_bond(bob)) == MIN_DISPUTE * 150 // 100

    # Enforcement on the second treaty: below the scaled bond reverts.
    direct_vm.clear_mocks()
    mock_telemetry(direct_vm, 0.1)
    mock_verdict(direct_vm, "NORMAL")
    direct_vm.sender = direct_alice
    direct_vm.value = discounted - 1
    with direct_vm.expect_revert("ERR_INSUFFICIENT_BOND"):
        c.trigger_dispute(tid_ac, "x", "ipfs://e", "hrs2", "https://p/x", "https://s/y")
    direct_vm.value = 0

    # Exactly the scaled bond is accepted.
    direct_vm.sender = direct_alice
    direct_vm.value = discounted
    v = c.trigger_dispute(tid_ac, "x", "ipfs://e", "hrs3", "https://p/x", "https://s/y")
    direct_vm.value = 0
    assert v == "NORMAL"


# --- V2.5: anti-Sybil enclave maturation lock -------------------------------
def test_sybil_maturation_lock(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy(CONTRACT)
    found(c, direct_vm, direct_alice, "Citadel Alpha")
    found(c, direct_vm, direct_bob, "Vanguard Nexus")
    bob = khex(c, direct_vm, direct_bob)

    # Fresh enclave cannot lock a high-tier bond immediately.
    direct_vm.sender = direct_alice
    direct_vm.value = HIGH_BOND
    with direct_vm.expect_revert("ERR_ENCLAVE_NOT_MATURED"):
        c.propose_treaty(bob, "TRADE_CORRIDOR", "big", 4_000_000_000, params_for("TRADE_CORRIDOR"))
    direct_vm.value = 0

    # After the maturation window passes, the high-tier treaty is allowed.
    direct_vm.warp("2035-01-01T00:00:00Z")
    direct_vm.sender = direct_alice
    direct_vm.value = HIGH_BOND
    tid = c.propose_treaty(bob, "TRADE_CORRIDOR", "big", 4_000_000_000, params_for("TRADE_CORRIDOR"))
    direct_vm.value = 0
    assert c.get_treaty(tid)["status"] == "PROPOSED"


# --- V2.6: strict solvency across deposit / slash / dispute / claim ---------
def test_strict_solvency_accounting(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy(CONTRACT)
    tid_ab = active_treaty(c, direct_vm, direct_alice, direct_bob)  # 2 founds + AB bonds
    found(c, direct_vm, direct_charlie, "Sovereign Enclave")
    add_treaty(c, direct_vm, direct_alice, direct_charlie, kind="DATA_SHARING")  # AC bonds

    # Alice wins a CRITICAL breach on AB (slashing + credits).
    mock_telemetry(direct_vm, 0.95)
    mock_verdict(direct_vm, "CRITICAL_BREACH")
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    c.trigger_dispute(tid_ab, "breach", "ipfs://e", "hss1", "https://p/x", "https://s/y")
    direct_vm.value = 0

    deposits = 3 * COLLATERAL + 4 * BOND + MIN_DISPUTE

    def tracked():
        ov = c.get_protocol_overview()
        return (
            int(ov["total_collateral"])
            + int(ov["locked_escrow"])
            + int(ov["reserves"])
            + int(ov["total_claimable"])
        )

    # Conservation of value: tracked liabilities equal total deposits.
    assert tracked() == deposits

    # Fund the contract to its tracked liabilities and confirm the on-chain
    # solvency predicate self.balance == liabilities holds True.
    if direct_vm._contract_address is not None:
        direct_vm.deal(direct_vm._contract_address, tracked())
        assert c.get_protocol_overview()["solvent"] is True

    # Pull-pattern claim reduces the liability by exactly the claimed amount.
    alice = khex(c, direct_vm, direct_alice)
    owed = int(c.claimable_of(alice))
    direct_vm.sender = direct_alice
    paid = c.claim_payout()
    assert int(paid) == owed
    assert c.claimable_of(alice) == "0"
    assert tracked() == deposits - owed
