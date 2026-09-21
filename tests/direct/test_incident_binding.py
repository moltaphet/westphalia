"""Incident-report binding and the seeded-scene telemetry guard.

Two things are pinned here.

First, that the evidence a plaintiff files binds to the address it accuses. A
bare ``{"party_a": .., "party_b": ..}`` reading is admissible on chain -- the
contract parses whatever the party-attributed keys hold and its prompt is fixed
at deploy time -- but a reading that names nobody is a number a tribunal cannot
attribute. The incident report in ``telemetry/`` names its target and the treaty
that makes that address a party, and these tests hold it to that shape and prove
a filing of it is admitted and judged rather than discarded as NO_EVIDENCE.

Second, that the seeded (reviewer-mode) board advertises only endpoints that
really serve telemetry. Those two audits used to name
``studio-dev.genlayer.com/feeds/...``, a host that answers HTTP 200 with the
GenLayer Studio web app for every path, so the panel advertised a feed that
returned no telemetry at all. There is no JS test runner in this repo, so the
guard for that lives here.

Run: pytest tests/direct/test_incident_binding.py -v
Pure-ASCII.
"""

import json
import os

from conftest import (
    CONTRACT,
    MIN_DISPUTE,
    active_treaty,
    evidence_digest,
    khex,
    mock_evidence,
    mock_verdict,
    party_telemetry,
)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INCIDENT = os.path.join(ROOT, "telemetry", "incident_meridian_0001.json")
INCIDENT_URI = (
    "https://raw.githubusercontent.com/moltaphet/westphalia/main/"
    "telemetry/incident_meridian_0001.json"
)
MOCK_DATA = os.path.join(ROOT, "frontend", "lib", "mockData.ts")
STORE = os.path.join(ROOT, "frontend", "lib", "store.ts")

# The contract truncates the document it hands the tribunal; a report longer
# than this would reach the judge with its binding cut off.
EVIDENCE_MAX_CHARS = 1500


def _incident_text() -> str:
    with open(INCIDENT, "r", encoding="utf-8") as fh:
        return fh.read()


def _incident_doc() -> dict:
    return json.loads(_incident_text())


# --- Shape: the report is readable by the deployed parser --------------------
def test_incident_parses_the_way_the_contract_reads_it():
    """The contract's _fetch_one requires a JSON object carrying the defendant's
    own party key as a finite non-boolean number, and a `contradiction` flag that
    is a real boolean -- a JSON string "false" is truthy under bool(). An
    incident report that fails any of these is not evidence, it is a feed
    conflict."""
    doc = _incident_doc()

    assert isinstance(doc, dict)
    assert "party_b" in doc
    metric = doc["party_b"]
    assert isinstance(metric, (int, float)) and not isinstance(metric, bool)
    assert 0.0 <= metric <= 1.0
    assert isinstance(doc["contradiction"], bool)


def test_incident_binds_the_target_it_names():
    """The report attributes its reading to an address and to the treaty that
    makes that address a party. Those are the fields a reader checks against
    get_treaty(), so they have to be present and well formed."""
    doc = _incident_doc()

    target = doc["target"]
    address = target["address"]
    assert isinstance(address, str) and address.startswith("0x") and len(address) == 42
    int(address[2:], 16)

    role = target["role"]
    assert role in ("party_a", "party_b")
    # The number and the name must describe the same party.
    assert role in doc and isinstance(doc[role], (int, float))

    treaty = doc["treaty"]
    assert isinstance(treaty["id"], int)
    cp = treaty["counterparty"]
    assert isinstance(cp, str) and cp.startswith("0x") and len(cp) == 42
    assert cp.lower() != address.lower()  # a party cannot be its own counterparty

    # How to verify the binding is part of the document, not tribal knowledge.
    assert doc["binding"]["check"]


def test_incident_reaches_the_tribunal_whole():
    """The document is under the contract's truncation budget, so the address
    and treaty it binds to are still on screen when the tribunal reads it, and
    the target address appears in the text the judge is handed."""
    text = _incident_text()

    assert len(text) < EVIDENCE_MAX_CHARS
    assert _incident_doc()["target"]["address"] in text
    assert text.isascii()


# --- The binding is refused when it is absent --------------------------------
def test_a_reading_with_no_target_is_refused():
    """The agent-side check that enforces attribution. Each case below is a
    document the contract WOULD accept and a tribunal would rule on -- which is
    exactly why the filing side refuses it."""
    from agent.telemetry import _binding_of

    good = _incident_doc()
    assert _binding_of(good) is not None

    # A bare metric reading: no target, no treaty.
    assert _binding_of({"party_a": 0.0, "party_b": 0.8, "contradiction": False}) is None

    # A target named but no treaty tying it to this dispute.
    no_treaty = json.loads(json.dumps(good))
    del no_treaty["treaty"]
    assert _binding_of(no_treaty) is None

    # An address that is not an address.
    bad_addr = json.loads(json.dumps(good))
    bad_addr["target"]["address"] = "0xnothex"
    assert _binding_of(bad_addr) is None

    # A role that is not a party key, so the metric cannot be matched to the
    # address the report accuses.
    bad_role = json.loads(json.dumps(good))
    bad_role["target"]["role"] = "defendant"
    assert _binding_of(bad_role) is None

    # The binding names a role the document files no metric under, so the
    # address it accuses is not the address the number describes.
    unbacked_role = json.loads(json.dumps(good))
    del unbacked_role["party_a"]
    unbacked_role["target"]["role"] = "party_a"
    assert _binding_of(unbacked_role) is None

    # A boolean metric -- True == 1 in Python, so a naive numeric check would
    # read it as a full-scale breach.
    bool_metric = json.loads(json.dumps(good))
    bool_metric["party_b"] = True
    assert _binding_of(bool_metric) is None


def test_agent_reads_the_binding_out_of_the_shipped_document():
    """The agent's offline view of the shipped report agrees with the file, so a
    client checking the binding needs no network read to do it."""
    from agent.telemetry import INCIDENT_FEEDS, INCIDENT_TARGETS

    assert INCIDENT_URI in INCIDENT_FEEDS
    declared = INCIDENT_TARGETS[INCIDENT_URI]
    doc = _incident_doc()
    assert declared["address"].lower() == doc["target"]["address"].lower()
    assert declared["role"] == doc["target"]["role"]
    assert declared["treaty_id"] == doc["treaty"]["id"]


# --- The binding is cryptographic on chain -----------------------------------
def test_filing_the_incident_is_admitted_and_judged(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A filing that commits to the report's real bytes has its evidence
    admitted, so the tribunal rules on the document that names the target.

    Telemetry is held at 1000 bps (below the 2500 full-sanction ceiling), where
    the clamp only keeps CRITICAL_BREACH when the fetched evidence corroborates
    it: admitted reads ELEVATED_RISK, discarded reads NORMAL. The two adjacent
    tests differ in nothing but the committed digest."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)
    bob = khex(c, direct_vm, direct_bob)

    text = _incident_text()
    direct_vm.mock_web(r".*westphalia\.io.*", party_telemetry(0.0, 0.1))  # 1000 bps
    doc_hash = mock_evidence(direct_vm, r".*incident_meridian.*", text)
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(
        tid, "Breach of the data-sharing covenant by the named counterparty.", INCIDENT_URI, doc_hash
    )
    direct_vm.value = 0

    assert verdict == "ELEVATED_RISK"
    assert c.get_enclave(bob)["status"] == "ACTIVE"


def test_incident_with_a_wrong_digest_is_not_admitted(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The same report, the same verdict, one byte of commitment changed: the
    document is not admitted.

    This is what makes the target binding worth anything. The address the report
    accuses rides on the bytes the contract hashed, so a filer cannot point the
    commitment at an attributed document and have the tribunal read a different
    one."""
    c = direct_deploy(CONTRACT)
    tid = active_treaty(c, direct_vm, direct_alice, direct_bob)

    text = _incident_text()
    direct_vm.mock_web(r".*westphalia\.io.*", party_telemetry(0.0, 0.1))
    mock_evidence(direct_vm, r".*incident_meridian.*", text)
    mock_verdict(direct_vm, "CRITICAL_BREACH")

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_DISPUTE
    verdict = c.trigger_dispute(
        tid,
        "Breach of the data-sharing covenant by the named counterparty.",
        INCIDENT_URI,
        evidence_digest(text + "\n"),  # off by one newline
    )
    direct_vm.value = 0

    assert verdict == "NORMAL"


# --- The seeded board advertises endpoints that answer -----------------------
def test_seeded_audits_advertise_only_resolvable_telemetry():
    """No reviewer-mode audit may advertise a feed host that serves an app shell
    instead of telemetry, and none may promise an appeal the contract cannot
    hold."""
    with open(MOCK_DATA, "r", encoding="utf-8") as fh:
        src = fh.read()

    # The dead host: resolves, but every path returns the Studio web app.
    assert "studio-dev.genlayer.com/feeds" not in src
    # The substitute must be the pair the protocol actually reads.
    assert "raw.githubusercontent.com/moltaphet/westphalia/main/telemetry/" in src
    assert "cdn.jsdelivr.net/gh/moltaphet/westphalia@main/telemetry/" in src

    # No appeal stage exists in the contract, so nothing may advertise one. The
    # check names the two promises that were made rather than the bare word, so
    # an honest note that no appeal exists does not trip it.
    for text in (src, open(STORE, "r", encoding="utf-8").read()):
        assert "Appeal window" not in text
        assert "pending appeal" not in text.lower()
