"""Thin GenLayer client wrapper: funding, views, writes, receipt handling.

All money amounts are atto-scale wei. A Chain instance is bound to one agent
account and one contract address.
"""

import base64
import json
import time
from typing import cast

from eth_typing import ChecksumAddress
from genlayer_py import create_client
from genlayer_py.chains import studio_devnet  # type: ignore[reportAttributeAccessIssue]

# Westphalia V4.2 contract deployed on GenLayer Studio Next (valid EIP-55 checksum).
CONTRACT = cast(ChecksumAddress, "0xdef36428f9789a7Ee4daD24a1A8B6997D475cA1E")

_OK_EXEC = "FINISHED_WITH_RETURN"
_OK_CONSENSUS = "MAJORITY_AGREE"


class ChainError(Exception):
    pass


def _short_tx(tx_hash) -> str:
    try:
        return tx_hash.hex()[:18] + "..."
    except Exception:
        return str(tx_hash)[:18] + "..."


def _policy_fee_estimate(client) -> dict:
    """The SDK's policy-derived fee estimate, computed without any simulation."""
    from genlayer_py.contracts.actions import (  # noqa: PLC0415
        _estimate_transaction_fees_with_policy,
        get_current_fee_policy,
    )

    return _estimate_transaction_fees_with_policy(client, None, get_current_fee_policy(client))


def _fees_from(estimate: dict) -> dict:
    fees: dict = {
        "distribution": estimate["distribution"],
        "feeValue": estimate.get("feeValue") or estimate.get("fee_value") or 0,
    }
    if estimate.get("messageAllocations") is not None:
        fees["messageAllocations"] = estimate["messageAllocations"]
    return fees


_TIERS = ("CRITICAL_BREACH", "ELEVATED_RISK", "NORMAL", "MALICIOUS_REPORT")


def _decoded_result(tx: dict) -> str | None:
    """The value the contract returned, as agreed by consensus.

    Read from the *transaction*, not the receipt: the receipt reports status,
    while `consensus_data.leader_receipt` carries what the contract actually
    returned. GenVM marks a return payload with a leading ``|`` (error payloads
    carry no marker), so the marker is stripped to leave the bare value.
    Validators cancelled after quorum leave no result, and a settlement that
    already happened is not an error, so None is a legitimate answer.
    """
    consensus = tx.get("consensus_data") or {}
    for leader in consensus.get("leader_receipt") or []:
        res = leader.get("result")
        value: str | None = None
        if isinstance(res, str):
            value = res
        elif isinstance(res, dict):
            payload = res.get("payload")
            if isinstance(payload, str) and payload:
                value = payload
            else:
                raw = res.get("raw")
                if isinstance(raw, str) and raw:
                    try:
                        value = base64.b64decode(raw).decode("utf-8", "replace")
                    except Exception:
                        value = None
        if not value:
            continue
        # The contract's verdict is one of a closed set of tier tokens, so look
        # for the token rather than guessing at the framing GenVM wraps it in
        # (a return payload arrives as "|CRITICAL_BREACH" plus, on some paths, a
        # leading control byte). An error string matches no tier and is returned
        # verbatim as a revert reason.
        for tier in _TIERS:
            if tier in value:
                return tier
        cleaned = value.strip()
        if cleaned:
            return cleaned
    # Last resort: the agreed data carries a tier token but not in a shape this
    # SDK version documents.
    blob = json.dumps(consensus)
    for tier in _TIERS:
        if tier in blob:
            return tier
    return None


def _retry(fn, attempts: int = 4, wait_s: float = 6.0):
    """studio-dev occasionally drops a connection (SSL EOF). Retry transient
    transport failures with a short backoff instead of failing the autonomous
    loop. A ChainError is a verdict about the transaction, not a transport
    problem, so it propagates immediately."""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except ChainError:
            raise
        except Exception as exc:  # noqa: BLE001 - transient network errors
            last = exc
            if i + 1 < attempts:
                time.sleep(wait_s * (i + 1))
    raise ChainError(f"transient RPC failure after {attempts} attempts: {last}")


class Chain:
    def __init__(self, account):
        self.account = account
        self.client = create_client(chain=studio_devnet, account=account)

    def address(self) -> ChecksumAddress:
        return self.account.address

    # ------------------------------------------------------------- accounts
    def balance_wei(self) -> int:
        def call():
            resp = self.client.provider.make_request(
                "eth_getBalance", [self.address(), "latest"]
            )
            return int(resp.get("result", "0x0"), 16)

        return _retry(call)

    def fund(self, target_wei: int) -> bool:
        """Top up from the local faucet (confirmed working on studio-dev) until
        the wallet holds at least target_wei, so collateral + bonds + fees
        always clear. Returns True if a top-up was sent."""
        current = self.balance_wei()
        if current >= target_wei:
            return False
        _retry(lambda: self.client.fund_account(self.address(), target_wei - current + 1))
        return True

    # ----------------------------------------------------------------- views
    def overview(self) -> dict:
        return _retry(
            lambda: cast(
                dict, self.client.read_contract(CONTRACT, "get_protocol_overview")
            )
        )

    def enclave(self, addr: str | None = None) -> dict | None:
        """The enclave record for `addr` (default: this agent), or None when
        that address has not founded a sovereignty yet."""
        key = cast(ChecksumAddress, addr or self.address())
        try:
            return _retry(
                lambda: cast(
                    dict, self.client.read_contract(CONTRACT, "get_enclave", args=[key])
                )
            )
        except ChainError:
            return None  # unknown enclave -> fresh identity

    def treaties(self) -> list[dict]:
        """Every treaty, oldest to newest, with its id in `_id`."""
        try:
            n = int(self.overview()["next_treaty_id"])
        except Exception:
            return []
        out: list[dict] = []
        for tid in range(1, n):
            try:
                t = _retry(
                    lambda: cast(
                        dict,
                        self.client.read_contract(CONTRACT, "get_treaty", args=[tid]),
                    )
                )
                t["_id"] = tid
                out.append(t)
            except ChainError:
                pass
        return out

    def required_dispute_bond(self, addr: str | None = None) -> int:
        """The reputation-scaled bond `addr` must post to open a dispute.

        Read from the contract rather than assumed. The bond scales with the
        plaintiff's reputation (``500 * (150 - min(rep, 100)) / 100``), and a
        dispute cannot be attempted and then corrected: a stale figure reverts
        ``ERR_INSUFFICIENT_BOND`` at the cost of a submitted transaction.
        """
        key = cast(ChecksumAddress, addr or self.address())
        raw = _retry(
            lambda: cast(
                str,
                self.client.read_contract(
                    CONTRACT, "required_dispute_bond", args=[key]
                ),
            )
        )
        return int(raw)

    def claimable(self, addr: str | None = None) -> int:
        """Settlement credit awaiting a pull-pattern withdrawal."""
        key = cast(ChecksumAddress, addr or self.address())
        raw = _retry(
            lambda: cast(
                str, self.client.read_contract(CONTRACT, "claimable_of", args=[key])
            )
        )
        return int(raw)

    # ----------------------------------------------------------------- writes
    def dispute(
        self,
        treaty_id: int,
        allegation: str,
        evidence_uri: str,
        evidence_hash: str,
        bond_wei: int | None = None,
    ) -> str | None:
        """Open a dispute on `treaty_id` and return the tier consensus reached.

        `evidence_hash` is the SHA-256 of the document `evidence_uri` actually
        serves, read by the caller from the same URL the contract will fetch (see
        ``telemetry.evidence_digest``). It is a COMMITMENT, not a label: the
        non-deterministic round admits the document only when it hashes to this
        value, so a digest derived from anything else -- the treaty id, the
        allegation, a paraphrase of the report -- makes the filing's own evidence
        inadmissible and the dispute is adjudicated on NO_EVIDENCE.

        It is passed in rather than derived here because reading the document is
        I/O with a failure mode the caller must handle: this layer transports the
        filing, it does not decide what the filing commits to.
        """
        bond = self.required_dispute_bond() if bond_wei is None else bond_wei
        receipt = self.write(
            "trigger_dispute",
            args=[treaty_id, allegation, evidence_uri, evidence_hash],
            value=bond,
            label=f"dispute #{treaty_id}",
        )
        tx = _retry(
            lambda: cast(dict, self.client.get_transaction(receipt["_tx_hash"]))
        )
        return _decoded_result(tx)

    def _fees_for(self, method: str, args: list, value: int) -> dict:
        """Fee estimate for one write.

        Pre-flight simulation is the accurate path, but it runs the contract
        against a simulation clock that is not the block clock. Any write whose
        logic compares against `_now()` -- treaty expiry, enclave maturation --
        therefore reverts *inside the simulation* even though the real
        transaction, which carries a real block timestamp, succeeds. So a
        failed simulation is not evidence about the transaction: fall back to
        the SDK's policy-derived estimate, which needs no simulation at all.
        """
        try:
            estimate = _retry(
                lambda: self.client.estimate_transaction_fees_for_write(
                    CONTRACT, method, args=args, value=value
                ),
                attempts=1,
            )
        except ChainError as exc:
            print(f"        note: {method} fee simulation unavailable ({exc})")
            print("        note: falling back to policy-derived fee estimate")
            estimate = _retry(lambda: _policy_fee_estimate(self.client))
        return _fees_from(estimate)

    def write(self, method: str, args=None, value: int = 0, label: str = "") -> dict:
        """Submit a write through consensus and block until it is decided.
        Raises ChainError when the execution reverted or consensus disagreed."""
        args = args or []
        fees = self._fees_for(method, args, value)

        # Submissions are never retried: a duplicate write would create a
        # second treaty. On a transport failure the agent simply tries again
        # on its next tick.
        tx_hash = cast(
            object,
            _retry(
                lambda: self.client.write_contract(
                    CONTRACT, method, args=args, value=value, fees=fees
                ),
                attempts=1,
            ),
        )
        print(
            f"        tx {label or method} {_short_tx(tx_hash)} "
            f"-> waiting for consensus..."
        )
        receipt = _retry(
            lambda: cast(
                dict,
                self.client.wait_for_transaction_receipt(
                    tx_hash,
                    wait_until="decided",  # type: ignore[reportCallIssue]
                    interval=4,
                    retries=120,
                ),
            ),
            attempts=3,
        )
        # The receipt uses camelCase (txExecutionResultName); reading the
        # snake_case spelling silently yields None and lets a reverted
        # transaction pass as a success.
        exec_name = receipt.get("txExecutionResultName") or receipt.get(
            "tx_execution_result_name"
        )
        consensus = receipt.get("result_name")
        if exec_name is not None and exec_name != _OK_EXEC:
            raise ChainError(f"{label or method} execution failed ({exec_name})")
        if consensus is not None and consensus != _OK_CONSENSUS:
            raise ChainError(f"{label or method} consensus {consensus}")
        # The receipt reports status; the return value lives on the transaction,
        # so callers that need it must be able to look the hash back up.
        receipt["_tx_hash"] = tx_hash
        return receipt
