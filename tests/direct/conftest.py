"""Shared helpers for Westphalia direct-mode tests.

Pure-ASCII. Uses the genlayer-test pytest plugin fixtures: direct_vm,
direct_deploy, direct_alice, direct_bob, direct_charlie.
"""

import json

CONTRACT = "contracts/westphalia.py"

ATTO = 10**18
COLLATERAL = 2000 * ATTO
BOND = 1000 * ATTO
MIN_DISPUTE = 500 * ATTO


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
    """A pinned successful telemetry web response."""
    body = json.dumps({"breach_metric": breach_metric, "contradiction": contradiction})
    return {"status": 200, "body": body}


def mock_telemetry(direct_vm, breach_metric: float, contradiction: bool = False):
    direct_vm.mock_web(r".*", telemetry(breach_metric, contradiction))


def mock_verdict(direct_vm, tier: str):
    direct_vm.mock_llm(r".*", json.dumps({"verdict": tier}))


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


def active_treaty(contract, direct_vm, alice, bob, expires_at=4_000_000_000):
    """Found two enclaves, propose + ratify a NON_AGGRESSION treaty, return its id."""
    found(contract, direct_vm, alice, "Citadel Alpha")
    found(contract, direct_vm, bob, "Vanguard Nexus")

    bob_key = khex(contract, direct_vm, bob)
    direct_vm.sender = alice
    direct_vm.value = BOND
    tid = contract.propose_treaty(bob_key, "NON_AGGRESSION", "no staging within 3 tiles", expires_at)
    direct_vm.value = 0

    direct_vm.sender = bob
    direct_vm.value = BOND
    contract.ratify_treaty(tid)
    direct_vm.value = 0
    return tid


def add_treaty(contract, direct_vm, proposer, counterparty, kind="TRADE_CORRIDOR", expires_at=4_000_000_000):
    """Propose + ratify an additional treaty between two already-founded enclaves."""
    cp = khex(contract, direct_vm, counterparty)
    direct_vm.sender = proposer
    direct_vm.value = BOND
    tid = contract.propose_treaty(cp, kind, "auxiliary terms", expires_at)
    direct_vm.value = 0
    direct_vm.sender = counterparty
    direct_vm.value = BOND
    contract.ratify_treaty(tid)
    direct_vm.value = 0
    return tid
