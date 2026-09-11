"""Unit tests for receipt/return-value extraction (no chain, no I/O).

`_decoded_result` reads a contract's return value back out of a decided
transaction. Both shapes below are taken from real studio-dev responses, and
they differ in a way that is easy to get wrong: the return value lives on the
*transaction* rather than the receipt, and GenVM marks a return payload with a
leading `|` while an error payload carries no marker.
"""

import base64

from agent.chain import _decoded_result

# A real successful arbitration: the tier came back marked as a return payload.
RETURNED_TIER = {
    "consensus_data": {
        "leader_receipt": [
            {"execution_result": "SUCCESS", "result": {"status": "return", "payload": "|CRITICAL_BREACH"}},
        ]
    }
}

# A real reverted dispute: the bond precondition failed before any validator ran.
REVERTED_BOND = {
    "consensus_data": {
        "leader_receipt": [
            {
                "execution_result": "ERROR",
                "result": {
                    "raw": base64.b64encode(
                        b"ERR_INSUFFICIENT_BOND required 600000000000000000000"
                    ).decode(),
                    "status": "rollback",
                    "payload": "ERR_INSUFFICIENT_BOND required 600000000000000000000",
                },
            }
        ]
    }
}


def test_reads_a_returned_tier_without_its_marker():
    assert _decoded_result(RETURNED_TIER) == "CRITICAL_BREACH"


def test_reads_a_rollback_reason_verbatim():
    assert _decoded_result(REVERTED_BOND) == (
        "ERR_INSUFFICIENT_BOND required 600000000000000000000"
    )


def test_falls_back_to_the_base64_raw_field():
    tx = {
        "consensus_data": {
            "leader_receipt": [
                {"result": {"raw": base64.b64encode(b"|ELEVATED_RISK").decode()}}
            ]
        }
    }
    assert _decoded_result(tx) == "ELEVATED_RISK"


def test_accepts_a_bare_string_result():
    tx = {"consensus_data": {"leader_receipt": [{"result": "NORMAL"}]}}
    assert _decoded_result(tx) == "NORMAL"


def test_quorum_cancelled_validators_yield_none():
    """Validators cancelled after quorum leave no result -- and a settlement
    that already happened is not an extraction failure."""
    tx = {
        "consensus_data": {
            "leader_receipt": [
                {"execution_result": "SUCCESS", "result": {"status": "return", "payload": ""}},
                {"execution_result": "ERROR", "genvm_result": {"raw_error": None}},
            ]
        }
    }
    assert _decoded_result(tx) is None


def test_missing_consensus_data_yields_none():
    assert _decoded_result({}) is None
    assert _decoded_result({"consensus_data": {}}) is None
