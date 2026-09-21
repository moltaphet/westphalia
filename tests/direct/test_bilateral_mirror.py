"""The frontend's bilateral mirror, held against the contract it mirrors.

``frontend/lib/bilateral.ts`` re-implements four things the contract computes on
chain: the telemetry bands, the quantizer, the dual-feed cross-examination, and
the corridor clamp. The panel that renders it tells the reader those numbers are
what the chain will do, so a drift between the two is not a cosmetic bug -- it
is the board misreporting a verdict.

There is no JS test runner in this repository, so the guard lives here, as the
seeded-telemetry guard in ``test_incident_binding.py`` does.

What is pinned, and why each one is a real failure rather than a style rule:

* The four band constants and the dispute cooldown. A threshold edited on one
  side only moves the panel's bands off the chain's.
* That the quantizer rounds half-to-even. Python's ``round()`` is banker's
  rounding and JavaScript's ``Math.round`` is half-up, so the obvious
  transcription is wrong on every exact .5 -- reachable in practice because
  ``0.00005 * 10000`` is exactly 0.5.
* That a retryable feed fault stays distinct from a definitive non-answer. The
  contract reverts on 429/5xx and settles neutrally on everything else;
  collapsing the two tells a plaintiff that a throttled feed cleared the
  defendant.
* That the seeded board's adjudicated treaty puts the party it accuses in the
  oracle slot the committed feed actually reports. The breach pair reports
  ``party_b``, so a seed that accuses ``party_a`` is refuted by its own live
  telemetry the moment the panel reads it.

Run: pytest tests/direct/test_bilateral_mirror.py -v
Pure-ASCII.
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTRACT = os.path.join(ROOT, "contracts", "westphalia.py")
MIRROR = os.path.join(ROOT, "frontend", "lib", "bilateral.ts")
MOCK_DATA = os.path.join(ROOT, "frontend", "lib", "mockData.ts")
TELEMETRY = os.path.join(ROOT, "telemetry")


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _py_const(name: str) -> int:
    m = re.search(rf"^{name}\s*=\s*(\d+)", _read(CONTRACT), re.M)
    assert m, f"{name} is not defined in the contract"
    return int(m.group(1))


def _ts_const(name: str) -> int:
    m = re.search(rf"^export const {name}\s*=\s*(\d+);", _read(MIRROR), re.M)
    assert m, f"{name} is not exported from the mirror"
    return int(m.group(1))


# --- The bands -----------------------------------------------------------------
def test_band_constants_match_the_contract():
    """Each band threshold is the contract's own number, not a lookalike."""
    for py_name, ts_name in (
        ("BPS_CRITICAL", "BPS_CRITICAL"),
        ("BPS_ELEVATED", "BPS_ELEVATED"),
        ("BPS_NEGLIGIBLE", "BPS_NEGLIGIBLE"),
        ("DIVERGENCE_BPS", "DIVERGENCE_BPS"),
    ):
        assert _ts_const(ts_name) == _py_const(py_name), (
            f"{ts_name} in the mirror disagrees with {py_name} in the contract"
        )


def test_dispute_cooldown_matches_the_contract():
    """The standing note quotes a cooldown, so it has to be the chain's."""
    assert _ts_const("DISPUTE_COOLDOWN_SECONDS") == _py_const("DISPUTE_COOLDOWN")


# --- The quantizer -------------------------------------------------------------
def test_quantizer_rounds_half_to_even():
    """``_quantize_bps`` calls Python's ``round()``, which is banker's rounding.

    ``Math.round`` is half-up, so for an exact .5 the two disagree: Python gives
    0 and JavaScript gives 1 for 0.00005, and the panel would print a basis-point
    figure the chain never computed. The mirror has to carry its own
    half-to-even step to stay exact."""
    src = _read(MIRROR)
    m = re.search(r"export function quantizeBps\(.*?\n\}", src, re.S)
    assert m, "quantizeBps is not exported from the mirror"
    body = m.group(0)

    assert "Math.round" not in body, (
        "quantizeBps uses Math.round, which is half-up; the contract's round() is "
        "half-to-even and the two diverge on every exact .5"
    )
    assert "roundHalfEven" in body, "quantizeBps must round half-to-even"


def test_quantizer_clamps_before_multiplying():
    """``_quantize_bps`` saturates before the multiply so an adversarial
    magnitude cannot overflow to infinity inside round(). A transcription that
    multiplies first reopens that."""
    src = _read(MIRROR)
    m = re.search(r"export function quantizeBps\(.*?\n\}", src, re.S)
    assert m, "quantizeBps is not exported from the mirror"
    body = m.group(0)
    assert re.search(r">=\s*1\)\s*return 10000", body), (
        "quantizeBps must saturate at 1 BEFORE the multiply"
    )
    # Anchored on the multiply rather than on the rounding call, so renaming the
    # rounding helper does not turn this into an accidental error.
    assert body.index(">= 1") < body.index("* 10000"), (
        "the saturation check has to precede the multiply, not follow it"
    )


# --- Transient faults are not non-answers --------------------------------------
def test_retryable_faults_stay_distinct_from_non_answers():
    """429 and 5xx revert the dispute; every other failure settles it neutrally.

    Reporting a rate limit as a neutral settlement would tell a plaintiff the
    round closed -- and that the accused was cleared -- when in fact nothing
    happened and the filing can simply be retried."""
    src = _read(MIRROR)
    assert re.search(r"status === 429", src), "the mirror must special-case 429"
    assert re.search(r"status >= 500 && res\.status < 600", src), (
        "the mirror must special-case 5xx"
    )
    assert "TRANSIENT" in src and "UNREACHABLE" in src, (
        "both feed-fault states must exist, not just one"
    )


def test_transient_path_reports_no_contradiction():
    """The contract returns on the transient branch before it reads either
    feed's contradiction flag, so it reports none even when the other feed
    raised one. Carrying the flag through would hand the panel a contradiction
    the chain never returned."""
    src = _read(MIRROR)
    block = re.search(r"if \(!primary\.reachable \|\| !secondary\.reachable\) \{.*?\n  \}", src, re.S)
    assert block, "the non-reachable branch is missing from crossExamine"
    body = block.group(0)
    assert re.search(r"transient\s*\?\s*false", body), (
        "the transient branch must report contradiction: false"
    )


# --- The seeded board is refutable by its own feeds ----------------------------
def test_seeded_accused_party_matches_the_slot_its_feed_reports():
    """The committed breach feeds report a breach on ``party_b``.

    A treaty is ``[party_a, party_b]``, so an adjudicated seed that accuses the
    party holding slot 0 is contradicted by the very telemetry its panel fetches:
    the right-hand column would read 0 bps while the audit beside it narrated a
    breach. The seed has to put the accused in the slot the feed reports."""
    primary = json.loads(_read(os.path.join(TELEMETRY, "breach_primary.json")))
    secondary = json.loads(_read(os.path.join(TELEMETRY, "breach_secondary.json")))

    # The slot the committed breach pair actually reports a breach on.
    reported = {r for r in ("party_a", "party_b") if primary[r] >= 0.5}
    assert reported, "the breach feeds report no breach at all"
    assert reported == {r for r in ("party_a", "party_b") if secondary[r] >= 0.5}, (
        "the two breach feeds disagree about which slot reports the breach"
    )
    slot = reported.pop()
    index = 0 if slot == "party_a" else 1

    src = _read(MOCK_DATA)
    # The seeded treaty that carries the adjudicated audit is the only one with
    # a dispute block; take its parties and its plaintiff.
    disputed = re.search(r"parties:\s*\[([^\]]+)\](?:(?!parties:).)*?dispute:", src, re.S)
    assert disputed, "no seeded treaty carries a dispute block"
    parties = [p.strip().strip('"') for p in disputed.group(1).split(",")]
    assert len(parties) == 2, f"a treaty is two parties, found {parties}"

    plaintiff = re.search(r"dispute:\s*\{.*?plaintiff:\s*\"([^\"]+)\"", src, re.S)
    assert plaintiff, "the seeded dispute records no plaintiff"
    plaintiff_id = plaintiff.group(1)

    assert plaintiff_id in parties, (
        f"the seeded plaintiff {plaintiff_id!r} is not a party to the treaty it "
        f"filed against: {parties}"
    )
    defendant = parties[0] if parties[1] == plaintiff_id else parties[1]
    assert parties.index(defendant) == index, (
        f"the seeded defendant {defendant!r} holds slot {parties.index(defendant)} "
        f"but the committed breach feeds report the breach on {slot!r}; the "
        f"bilateral panel would read 0 bps under an audit that narrates a breach"
    )
