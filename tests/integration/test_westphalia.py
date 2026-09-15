"""Consensus-level tests for the Westphalia contract.

These run the contract through real GenLayer consensus rather than the
in-memory GenVM used by tests/direct/. Everything the direct suite proves about
business logic is assumed here; what this suite adds is the part only a live
network can answer -- that the non-deterministic arbitration round reaches
agreement between independent validators, and that the verdict it settles on
actually moves escrow.

    genlayer up                                  # in-process simulator
    gltest tests/integration -v -s

    gltest tests/integration -v -s --network studio_devnet

The adjudication round is driven with mock validators: the treaty's two
telemetry oracles are answered from a fixed body and the LLM verdict is pinned,
which is the only way to make a consensus round reproducible. The mocks are
supplied to the validators, not to the contract, so the leader and every
validator still run the real fetch-and-compare path.
"""

import time

import pytest
from gltest import get_contract_factory, get_accounts, get_validator_factory
from gltest.assertions import tx_execution_succeeded
from gltest.clients import get_gl_client
from gltest.helpers import load_fixture
from gltest.types import MockedLLMResponse, MockedWebResponse

from tests.integration.fixtures import (
    BOND,
    COLLATERAL,
    DATA_SHARING_PARAMS,
    EMPTY_OVERVIEW,
    EXPIRY_SECONDS,
    FRESH_DISPUTE_BOND,
    FRESH_REPUTATION,
    METRIC_CRITICAL,
    METRIC_NORMAL,
)

# Oracle endpoints the treaty binds at proposal time. The contract reads the
# URLs off treaty storage during adjudication and never accepts them from the
# disputing caller, so the mock set below is keyed on exactly these two.
ORACLE_PRIMARY = "https://telemetry.westphalia.test/primary/metrics"
ORACLE_SECONDARY = "https://telemetry.westphalia.test/secondary/metrics"

# A distinctive substring of the arbitration prompt built by _build_prompt().
# The mock is matched by substring, so this only has to be unique to that call.
PROMPT_MATCH = "You are a neutral GenLayer treaty arbitrator"

# A distinctive substring of the principle string _adjudicate() hands to
# gl.eq_principle.prompt_comparative.
#
# prompt_comparative runs the leader once and then asks every *validator* a
# second, different question: "does my tier match the leader's under this
# principle". That second question is a separate LLM call against the
# `eq_comparative` template, so a suite that pins only the leader prompt still
# sends the validators to the real provider -- which fails without a key, and
# the round dies as LLM_EXECUTION_ERROR -> VALIDATORS_TIMEOUT -> NO_MAJORITY,
# never reaching a verdict. gltest models this as its own mock table
# (MockedLLMResponse.eq_principle_prompt_comparative maps a principle substring
# to the boolean the validators should return); the value here is True because
# every validator runs the same deterministic mock feeds and so derives the
# same tier as the leader.
PRINCIPLE_MATCH = "verdict tier string must be exactly identical"

# Fee preset. Studio and the simulator derive the deposit from the live fee
# policy; the allocation params are the ones the contract's direct suite
# measured, and either way the value has to be nonzero or consensus rejects the
# transaction with FeeValueMustBeNonZero.
FEE_ESTIMATE_OPTIONS = {
    "leaderTimeunitsAllocation": 100,
    "validatorTimeunitsAllocation": 200,
    "rotations": [1],
}


def transaction_fee_preset():
    estimate = get_gl_client().estimate_transaction_fees(FEE_ESTIMATE_OPTIONS)
    return {"distribution": estimate["distribution"], "feeValue": estimate["feeValue"]}


def telemetry_context(primary_metric: int, secondary_metric: int, verdict: str):
    """Pin both oracle feeds and the verdict for one dispute.

    `contradiction` is deliberately absent from the bodies: the contract
    derives it from the divergence between the two metrics, so a test that
    wants a contradiction should pass two metrics more than 5% apart rather
    than asserting it here.
    """
    mock_llm_response: MockedLLMResponse = {
        "nondet_exec_prompt": {PROMPT_MATCH: f'{{"verdict": "{verdict}"}}'},
        "eq_principle_prompt_comparative": {PRINCIPLE_MATCH: True},
        "eq_principle_prompt_non_comparative": {},
    }
    mock_web_response: MockedWebResponse = {
        "nondet_web_request": {
            ORACLE_PRIMARY: {
                "method": "GET",
                "status": 200,
                "body": f'{{"breach_metric": {primary_metric}}}',
            },
            ORACLE_SECONDARY: {
                "method": "GET",
                "status": 200,
                "body": f'{{"breach_metric": {secondary_metric}}}',
            },
        }
    }
    validators = get_validator_factory().batch_create_mock_validators(
        count=5,
        mock_llm_response=mock_llm_response,
        mock_web_response=mock_web_response,
    )
    return {"validators": [validator.to_dict() for validator in validators]}


def deploy_westphalia():
    """Named (not a lambda) so gltest's load_fixture can snapshot it."""
    factory = get_contract_factory("Westphalia")
    return factory.deploy(fees=transaction_fee_preset())


def as_account(contract, account):
    """The same deployed contract, viewed as a different signing party."""
    return get_contract_factory("Westphalia").build_contract(
        contract_address=contract.address, account=account
    )


def party_hex(contract, account):
    """The storage key the contract uses for an enclave.

    Read back through whoami() rather than derived from account.address, so the
    test keys on exactly the string the contract wrote.
    """
    return as_account(contract, account).whoami(args=[]).call()


def found(contract, account, name, archetype="Autonomous Arbiter"):
    result = as_account(contract, account).found_sovereignty(
        args=[name, archetype, "test charter"]
    ).transact(value=COLLATERAL, fees=transaction_fee_preset())
    assert tx_execution_succeeded(result), f"found_sovereignty failed for {name}"
    return result


def propose(contract, proposer, counterparty_hex, params=DATA_SHARING_PARAMS):
    expiry = int(time.time()) + EXPIRY_SECONDS
    result = as_account(contract, proposer).propose_treaty(
        args=[
            counterparty_hex,
            "DATA_SHARING",
            "both parties serve uptime telemetry to the bound oracles",
            expiry,
            params,
            ORACLE_PRIMARY,
            ORACLE_SECONDARY,
        ]
    ).transact(value=BOND, fees=transaction_fee_preset())
    assert tx_execution_succeeded(result), "propose_treaty failed"
    # The contract's counter is next_treaty_id *after* the write.
    overview = contract.get_protocol_overview(args=[]).call()
    return int(overview["next_treaty_id"]) - 1


def ratify(contract, counterparty, treaty_id):
    result = as_account(contract, counterparty).ratify_treaty(
        args=[treaty_id]
    ).transact(value=BOND, fees=transaction_fee_preset())
    assert tx_execution_succeeded(result), "ratify_treaty failed"
    return result


@pytest.mark.integration
def test_fresh_contract_is_empty_and_solvent():
    contract = load_fixture(deploy_westphalia)

    overview = contract.get_protocol_overview(args=[]).call()
    assert overview == EMPTY_OVERVIEW


@pytest.mark.integration
def test_found_enclave_is_readable_and_collateralized():
    contract = load_fixture(deploy_westphalia)
    accounts = get_accounts()
    founder = accounts[2]

    found(contract, founder, "Consensus Bastion")
    key = party_hex(contract, founder)

    enclave = contract.get_enclave(args=[key]).call()
    assert enclave["name"] == "Consensus Bastion"
    assert enclave["status"] == "ACTIVE"
    assert int(enclave["reputation"]) == FRESH_REPUTATION
    assert int(enclave["collateral"]) == COLLATERAL

    overview = contract.get_protocol_overview(args=[]).call()
    assert int(overview["total_collateral"]) == COLLATERAL
    assert overview["solvent"] is True


@pytest.mark.integration
def test_dispute_bond_scales_with_reputation():
    contract = load_fixture(deploy_westphalia)
    accounts = get_accounts()
    founder = accounts[3]

    found(contract, founder, "Sovereign Enclave")
    key = party_hex(contract, founder)

    required = contract.required_dispute_bond(args=[key]).call()
    assert int(required) == FRESH_DISPUTE_BOND


@pytest.mark.integration
def test_critical_breach_verdict_sanctions_defendant_and_moves_escrow():
    """The whole protocol in one test.

    Two enclaves found, a DATA_SHARING treaty is proposed and ratified with both
    bonds locked, then one party disputes it. The treaty-bound oracles answer
    with a breach metric above the critical threshold, the arbitration round
    agrees on CRITICAL_BREACH, and escrow settles: the defendant is sanctioned,
    the plaintiff is credited defendant + plaintiff bond + its own dispute bond,
    and the protocol's solvency identity still holds afterwards.
    """
    contract = load_fixture(deploy_westphalia)
    accounts = get_accounts()
    plaintiff, defendant = accounts[4], accounts[5]

    found(contract, plaintiff, "Halcyon")
    found(contract, defendant, "Meridian")
    defendant_hex = party_hex(contract, defendant)

    treaty_id = propose(contract, plaintiff, defendant_hex)
    ratify(contract, defendant, treaty_id)

    active = contract.get_treaty(args=[treaty_id]).call()
    assert active["status"] == "ACTIVE"
    assert int(active["bond_a"]) == BOND
    assert int(active["bond_b"]) == BOND

    locked = contract.get_protocol_overview(args=[]).call()
    assert int(locked["locked_escrow"]) == BOND * 2
    assert locked["solvent"] is True

    # Both feeds agree on a critical breach: 9800bps on each, well inside the
    # 500bps divergence budget, so the verdict survives the code-side guardrail.
    #
    # No explicit wait_interval/wait_retries here: the polling window comes from
    # gltest.config.yaml's localnet entry, which is the one place that knows how
    # long this simulator can take. Overriding it locally would cap the round
    # shorter than every ordinary write in the same suite, which is backwards.
    context = telemetry_context(METRIC_CRITICAL, METRIC_CRITICAL, "CRITICAL_BREACH")
    dispute = as_account(contract, plaintiff).trigger_dispute(
        args=[
            treaty_id,
            "counterparty is below the contracted uptime floor",
            "ipfs://evidence/uptime-report",
            "ev-uptime-1",
        ]
    ).transact(
        value=FRESH_DISPUTE_BOND,
        fees=transaction_fee_preset(),
        transaction_context=context,
    )
    assert tx_execution_succeeded(dispute), "trigger_dispute failed"

    settled = contract.get_treaty(args=[treaty_id]).call()
    assert settled["status"] == "SETTLED"
    assert int(settled["bond_a"]) == 0
    assert int(settled["bond_b"]) == 0

    sanctioned = contract.get_enclave(args=[defendant_hex]).call()
    assert sanctioned["status"] == "SANCTIONED"
    assert int(sanctioned["reputation"]) == 0

    # The plaintiff is credited both bonds plus its own dispute bond; the
    # defendant's claimable stays zero. Money moved as a withdrawal right, not
    # as a push -- claim_payout is what actually transfers.
    plaintiff_hex = party_hex(contract, plaintiff)
    assert int(contract.claimable_of(args=[plaintiff_hex]).call()) == BOND * 2 + FRESH_DISPUTE_BOND
    assert int(contract.claimable_of(args=[defendant_hex]).call()) == 0

    final = contract.get_protocol_overview(args=[]).call()
    assert int(final["locked_escrow"]) == 0
    assert final["solvent"] is True
    # Solvency identity: collateral + escrow + reserves + claimable == balance.
    assert (
        int(final["total_collateral"])
        + int(final["locked_escrow"])
        + int(final["reserves"])
        + int(final["total_claimable"])
        == int(final["balance"])
    )


@pytest.mark.integration
def test_normal_verdict_leaves_the_treaty_active():
    """The counterpart to the breach test: below the elevated threshold the
    contract must not slash anyone, and the treaty stays in force."""
    contract = load_fixture(deploy_westphalia)
    accounts = get_accounts()
    plaintiff, defendant = accounts[6], accounts[7]

    found(contract, plaintiff, "Vanguard Nexus")
    found(contract, defendant, "Citadel Alpha")
    defendant_hex = party_hex(contract, defendant)

    treaty_id = propose(contract, plaintiff, defendant_hex)
    ratify(contract, defendant, treaty_id)

    context = telemetry_context(METRIC_NORMAL, METRIC_NORMAL, "NORMAL")
    dispute = as_account(contract, plaintiff).trigger_dispute(
        args=[treaty_id, "uptime looked degraded", "ipfs://evidence/uptime-report-2", "ev-uptime-2"]
    ).transact(
        value=FRESH_DISPUTE_BOND,
        fees=transaction_fee_preset(),
        transaction_context=context,
    )
    assert tx_execution_succeeded(dispute), "trigger_dispute failed"

    still_active = contract.get_treaty(args=[treaty_id]).call()
    assert still_active["status"] == "ACTIVE"
    assert int(still_active["bond_a"]) == BOND
    assert int(still_active["bond_b"]) == BOND

    defendant_enclave = contract.get_enclave(args=[defendant_hex]).call()
    assert defendant_enclave["status"] == "ACTIVE"

    overview = contract.get_protocol_overview(args=[]).call()
    assert int(overview["locked_escrow"]) == BOND * 2
    assert overview["solvent"] is True
