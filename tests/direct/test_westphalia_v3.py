"""Direct-mode tests for the V3.1 hardening pass.

Covers the three fixes added on top of the deployed V3 contract:

  * cancel_proposal  -- bounded liveness: a proposer reclaims its own bond from
    a still-PROPOSED treaty instead of waiting out the (up to 365-day) expiry,
    which also unblocks withdraw_collateral.
  * enclave_index / get_enclave_count / get_enclave_by_index -- an enumerable
    roster so the board lists agents directly instead of deriving them from
    treaty parties (treatyless enclaves used to vanish on load/refresh).
  * claim_payout fund-safety guard -- if the outbound transfer raises at
    enqueue time the debit is rolled back and a classified error is surfaced,
    so a claimable balance is never destroyed without a transfer against it.

Pure-ASCII. Direct mode executes the leader function only.
Run: .venv/bin/python -m pytest tests/direct/test_westphalia_v3.py -v
"""

from conftest import (
    CONTRACT,
    BOND,
    COLLATERAL,
    khex,
    future_expiry,
    found,
    propose,
    params_for,
)


# --- V3.1-1: bounded liveness / anti-hostage proposal cancellation ----------
def test_cancel_unratified_proposal(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy(CONTRACT)
    found(c, direct_vm, direct_alice, "Citadel Alpha")
    found(c, direct_vm, direct_bob, "Vanguard Nexus")
    alice = khex(c, direct_vm, direct_alice)
    bob = khex(c, direct_vm, direct_bob)

    tid = propose(
        c, direct_vm, direct_alice, bob, "NON_AGGRESSION",
        "no staging within 3 tiles", future_expiry(), params_for("NON_AGGRESSION"),
    )

    # The proposer's bond is locked and gates its collateral exit.
    assert c.locked_treaty_count(alice) == "1"
    assert int(c.claimable_of(alice)) == 0
    locked0 = int(c.get_protocol_overview()["locked_escrow"])
    assert locked0 == BOND
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        direct_vm.sender = direct_alice
        c.withdraw_collateral()  # blocked while the proposal locks a bond

    # Only the proposer (party_a) may cancel; the counterparty cannot.
    with direct_vm.expect_revert("ERR_UNAUTHORIZED_PARTY"):
        direct_vm.sender = direct_bob
        c.cancel_proposal(tid)

    # Proposer cancels the un-ratified proposal and reclaims the whole bond.
    direct_vm.sender = direct_alice
    c.cancel_proposal(tid)

    assert int(c.claimable_of(alice)) == BOND          # bond reclaimed
    assert c.locked_treaty_count(alice) == "0"          # open counter drops to 0
    assert int(c.claimable_of(bob)) == 0                # counterparty untouched
    t = c.get_treaty(tid)
    assert t["status"] == "SETTLED"
    assert t["bond_a"] == "0"
    ov = c.get_protocol_overview()
    assert int(ov["locked_escrow"]) == locked0 - BOND
    # Books stay balanced: the bond only moved from escrow to claimable, nothing
    # was created or destroyed. Fund to tracked liabilities (direct mode does
    # not auto-credit self.balance) and the on-chain solvency predicate holds.
    if direct_vm._contract_address is not None:
        tracked = (
            int(ov["total_collateral"]) + int(ov["locked_escrow"])
            + int(ov["reserves"]) + int(ov["total_claimable"])
        )
        direct_vm.deal(direct_vm._contract_address, tracked)
        assert c.get_protocol_overview()["solvent"] is True

    # A settled proposal cannot be cancelled again.
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        direct_vm.sender = direct_alice
        c.cancel_proposal(tid)

    # With the bond released the exit gate opens: collateral is withdrawable.
    direct_vm.sender = direct_alice
    assert c.withdraw_collateral() == str(COLLATERAL)
    assert int(c.claimable_of(alice)) == COLLATERAL + BOND


# --- V3.1-2: enumerable enclave roster --------------------------------------
def test_enclave_indexing(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy(CONTRACT)

    # Empty roster before anything is founded.
    assert c.get_enclave_count() == "0"
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.get_enclave_by_index(0)

    found(c, direct_vm, direct_alice, "Citadel Alpha")
    found(c, direct_vm, direct_bob, "Vanguard Nexus")
    found(c, direct_vm, direct_charlie, "Sovereign Enclave")
    alice = khex(c, direct_vm, direct_alice)
    bob = khex(c, direct_vm, direct_bob)
    charlie = khex(c, direct_vm, direct_charlie)

    # Every founding increments the monotonic count and is queryable by slot.
    assert c.get_enclave_count() == "3"
    r0 = c.get_enclave_by_index(0)
    r1 = c.get_enclave_by_index(1)
    r2 = c.get_enclave_by_index(2)
    assert r0["exists"] is True and r0["address"] == alice and r0["name"] == "Citadel Alpha"
    assert r1["address"] == bob and r1["name"] == "Vanguard Nexus"
    assert r2["address"] == charlie and r2["name"] == "Sovereign Enclave"

    # Out-of-range slots revert deterministically.
    with direct_vm.expect_revert("ERR_INVALID_STATE"):
        c.get_enclave_by_index(3)

    # A withdrawn enclave leaves a stable tombstone; the count never rewinds.
    direct_vm.sender = direct_alice
    c.withdraw_collateral()
    assert c.get_enclave_count() == "3"
    r0b = c.get_enclave_by_index(0)
    assert r0b["address"] == alice and r0b["exists"] is False


# --- V3.1-3: claim_payout fund safety (transfer failure preserves balance) --
class _FailingAccount:
    """Stand-in for gl.chain.Account whose emit_transfer raises at enqueue
    time, standing in for a rejected / malformed outbound transfer."""

    def __init__(self, *args, **kwargs):
        pass

    def emit_transfer(self, *args, **kwargs):
        raise RuntimeError("simulated transfer enqueue failure")


def test_claim_payout_fund_safety(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    c = direct_deploy(CONTRACT)

    # Give alice a claimable balance: propose then cancel refunds the bond into
    # the pull-pattern pipeline.
    found(c, direct_vm, direct_alice, "Citadel Alpha")
    found(c, direct_vm, direct_bob, "Vanguard Nexus")
    alice = khex(c, direct_vm, direct_alice)
    bob = khex(c, direct_vm, direct_bob)
    tid = propose(
        c, direct_vm, direct_alice, bob, "NON_AGGRESSION",
        "terms", future_expiry(), params_for("NON_AGGRESSION"),
    )
    direct_vm.sender = direct_alice
    c.cancel_proposal(tid)
    owed = int(c.claimable_of(alice))
    assert owed == BOND
    ov0 = c.get_protocol_overview()
    total0 = int(ov0["total_claimable"])

    # Fund the contract to its tracked liabilities so the solvency predicate is
    # meaningful in direct mode (deposits are not auto-credited to self.balance).
    funded = direct_vm._contract_address is not None
    if funded:
        tracked = (
            int(ov0["total_collateral"]) + int(ov0["locked_escrow"])
            + int(ov0["reserves"]) + total0
        )
        direct_vm.deal(direct_vm._contract_address, tracked)
        assert c.get_protocol_overview()["solvent"] is True

    # Force the outbound transfer to fail. The contract must roll the debit back
    # and surface a classified error rather than a raw VMError.
    import genlayer.chain as chain_mod
    monkeypatch.setattr(chain_mod, "Account", _FailingAccount)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("ERR_TRANSFER_FAILED_RESTORED"):
        c.claim_payout()

    # Nothing was destroyed: the claimable balance and the aggregate are intact,
    # and with the transfer never enqueued the balance is untouched, so the
    # contract is still solvent.
    assert int(c.claimable_of(alice)) == owed
    assert int(c.get_protocol_overview()["total_claimable"]) == total0
    if funded:
        assert c.get_protocol_overview()["solvent"] is True

    # With a working transfer the same balance pays out exactly once.
    monkeypatch.undo()
    direct_vm.sender = direct_alice
    assert c.claim_payout() == str(owed)
    assert c.claimable_of(alice) == "0"
    with direct_vm.expect_revert("ERR_NO_CLAIMABLE_BALANCE"):
        direct_vm.sender = direct_alice
        c.claim_payout()
