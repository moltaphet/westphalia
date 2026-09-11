"""Deterministic decision engine for the Westphalia agents.

Everything here is pure (no I/O) so an agent's reasoning is auditable and
unit-testable: given the same on-chain state, the same decision comes out.
The heuristic scoring turns a treaty proposal into an accept/reject with a
per-factor rationale, and offer composition turns an agent's mission plus what
it can observe about a peer into a concrete proposal.
"""

import json
import time

from .profiles import Profile, GEN

# Per-kind parameter schemas (must match the on-chain TREATY_PARAM_SCHEMA keys)
# with sane absolute bounds used as a final safety net on top of a profile's
# narrower risk limits.
KIND_PARAM_KEYS = {
    "NON_AGGRESSION": ("max_exploit_bps", "max_mev_events"),
    "TRADE_CORRIDOR": ("min_settlement_volume", "max_slippage_bps"),
    "DATA_SHARING": ("min_uptime_bps", "max_latency_bps"),
}

# Observable peer behavior: archetype -> kind they are most likely to want.
KIND_BY_ARCHETYPE = {
    "Oracle Collective": "DATA_SHARING",
    "Liquidity Nexus": "TRADE_CORRIDOR",
    "Autonomous Arbiter": "NON_AGGRESSION",
    "Defense Vanguard": "NON_AGGRESSION",
}

# A proposal older than this (seconds) that a peer has not acted on is read as
# "not acceptable" and triggers a tightening superseding offer.
ADAPT_COOLDOWN_S = 20
MAX_OUTREACH_ATTEMPTS = 3
# How hard each factor counts toward the final score.
_WEIGHTS = {"bond": 0.30, "expiry": 0.20, "oracle": 0.20, "params": 0.15, "peer_rep": 0.15}

# Conservative posture we retreat to after a peer sits on an offer.
_TIGHT = {
    "DATA_SHARING": {"min_uptime_bps": 9950, "max_latency_bps": 300},
    "NON_AGGRESSION": {"max_exploit_bps": 200, "max_mev_events": 5},
    "TRADE_CORRIDOR": {"min_settlement_volume": 1_000_000_000, "max_slippage_bps": 300},
}


class Evaluation:
    """Verdict on one incoming treaty proposal."""

    def __init__(self, accepted: bool, score: float, rationale: list[str]):
        self.accepted = accepted
        self.score = score
        self.rationale = rationale


class Offer:
    """A concrete treaty proposal the agent is willing to sign."""

    def __init__(self, kind, terms, params, bond, expires_at, oracle_primary,
                 oracle_secondary, rationale):
        self.kind = kind
        self.terms = terms
        self.params = params  # dict, exactly the schema keys for `kind`
        self.bond = bond
        self.expires_at = expires_at
        self.oracle_primary = oracle_primary
        self.oracle_secondary = oracle_secondary
        self.rationale = rationale


def _host(url: str) -> str:
    try:
        return url.strip().split("://", 1)[1].split("/", 1)[0].split(":", 1)[0].lower()
    except Exception:
        return ""


def _fmt_gen(wei: int) -> str:
    return f"{wei // GEN}.{wei % GEN:018d}".rstrip("0").rstrip(".")


class HeuristicDecider:
    def __init__(self, profile: Profile):
        self.profile = profile

    # ------------------------------------------------------------- evaluate
    def evaluate(self, treaty: dict, peer: dict | None, my_balance: int) -> Evaluation:
        """Score an incoming PROPOSED treaty addressed to me (party_b)."""
        p = self.profile
        reasons: list[str] = []
        hard_fail = False

        # kind must be inside the mission.
        kind = treaty.get("kind", "")
        if kind not in p.accepted_kinds:
            return Evaluation(False, 0.0, [f"kind {kind} outside charter"])

        # typed parameters must parse and stay within mission limits.
        params = self._parse_params(kind, treaty.get("params", ""), reasons)
        if params is None:
            hard_fail = True

        # bond: must be postable from liquid balance and within the cap.
        bond = int(treaty.get("bond_a", "0"))
        if bond <= 0:
            reasons.append("bond is zero")
            hard_fail = True
        elif bond > p.bond_max:
            reasons.append(f"bond {_fmt_gen(bond)} GEN exceeds charter cap {_fmt_gen(p.bond_max)} GEN")
            hard_fail = True
        elif bond > my_balance:
            reasons.append(f"bond {_fmt_gen(bond)} GEN exceeds liquid balance {_fmt_gen(my_balance)} GEN")
            hard_fail = True

        # expiry: duration must fit the mission horizon.
        now = int(time.time())
        expires = int(treaty.get("expires_at", "0"))
        horizon = expires - now
        if horizon < p.expiry_min_s:
            reasons.append(f"horizon {horizon // 86400}d below charter minimum {p.expiry_min_s // 86400}d")
            hard_fail = True
        elif horizon > p.expiry_max_s:
            reasons.append(f"horizon {horizon // 86400}d above charter maximum {p.expiry_max_s // 86400}d")
            hard_fail = True

        # oracles: fail closed on anything unsafe or untrusted.
        oracle_ok = self._score_oracles(treaty, reasons)
        if oracle_ok is None:
            hard_fail = True

        # peer reputation floor.
        peer_rep = int(peer.get("reputation", "0")) if peer else 0
        if peer_rep < p.rep_floor:
            reasons.append(f"peer reputation {peer_rep} below floor {p.rep_floor}")
            hard_fail = True

        score = self._weighted(kind, bond, horizon, oracle_ok or 0.0, peer_rep, params)
        if hard_fail or score < p.min_accept_score:
            verdict = "reject" if hard_fail else f"score {score:.2f} below {p.min_accept_score}"
            return Evaluation(False, score, reasons + [verdict])
        return Evaluation(True, score, reasons + [f"score {score:.2f}"])

    def _parse_params(self, kind, params_json: str, reasons: list) -> dict | None:
        try:
            parsed = json.loads(params_json) if params_json else {}
        except Exception:
            reasons.append("params are not valid JSON")
            return None
        if not isinstance(parsed, dict):
            reasons.append("params are not an object")
            return None
        expected = set(KIND_PARAM_KEYS.get(kind, ()))
        if set(parsed.keys()) != expected:
            reasons.append(f"params keys {sorted(parsed)} != {sorted(expected)}")
            return None
        out: dict = {}
        bad = False
        limits = self.profile.param_limits.get(kind, {})
        for field, value in parsed.items():
            try:
                v = int(value)
            except (TypeError, ValueError):
                reasons.append(f"param {field} not numeric")
                bad = True
                continue
            lo, hi = limits.get(field, (v, v))
            if v < lo or v > hi:
                reasons.append(f"param {field}={v} outside mission [{lo}, {hi}]")
                bad = True
            else:
                out[field] = v
        return None if bad else out

    def _score_oracles(self, treaty: dict, reasons: list) -> float | None:
        """Return 0..1 oracle trust score, or None for a hard-fail."""
        primary = treaty.get("oracle_primary", "")
        secondary = treaty.get("oracle_secondary", "")
        host = _host(primary)
        if not primary.startswith("https://"):
            reasons.append(f"oracle primary not https: {host or primary[:40]}")
            return None
        if host in ("", "localhost"):
            reasons.append(f"oracle primary unsafe host: {primary[:40]}")
            return None
        score = 1.0 if host in self.profile.trusted_oracle_hosts else 0.6
        if secondary:
            if secondary == primary:
                reasons.append("oracle feeds are identical")
                return None
            if not secondary.startswith("https://"):
                reasons.append("oracle secondary not https")
                return None
        else:
            score -= 0.15  # single-feed treaties are weaker
        return max(0.0, score)

    def _weighted(self, kind, bond, horizon, oracle_score, peer_rep, params) -> float:
        p = self.profile
        # Bond: peak at the mission's ideal bond, decay on either side.
        bond_score = max(0.0, 1.0 - abs(bond - p.bond_target) / max(1, p.bond_target))
        # Horizon: peak at the middle of the mission window.
        mid = (p.expiry_min_s + p.expiry_max_s) / 2.0
        span = max(1, (p.expiry_max_s - p.expiry_min_s) / 2.0)
        expiry_score = max(0.0, 1.0 - abs(horizon - mid) / span)
        rep_score = max(0.0, min(1.0, peer_rep / 100.0))
        # Params: fraction of constrained fields inside the mission limits.
        params_score = 0.0
        if params:
            limits = p.param_limits.get(kind, {})
            ok = sum(
                1 for f, v in params.items()
                if f not in limits or limits[f][0] <= v <= limits[f][1]
            )
            params_score = ok / max(1, len(params))
        return (
            _WEIGHTS["bond"] * bond_score
            + _WEIGHTS["expiry"] * expiry_score
            + _WEIGHTS["oracle"] * oracle_score
            + _WEIGHTS["params"] * params_score
            + _WEIGHTS["peer_rep"] * rep_score
        )

    # ------------------------------------------------------------- outreach
    def compose_offer(self, peer: dict, attempts: int) -> Offer:
        """Build a proposal aimed at `peer`, tightening as attempts accumulate
        (a peer sitting on an earlier offer reads as 'not acceptable')."""
        p = self.profile
        kind = KIND_BY_ARCHETYPE.get(peer.get("archetype", ""), "NON_AGGRESSION")
        if kind not in p.accepted_kinds:
            kind = p.accepted_kinds[0]
        keys = KIND_PARAM_KEYS[kind]

        params: dict = {}
        for field in keys:
            lo, hi = p.param_limits.get(kind, {}).get(field, (0, 0))
            # First attempt: the mission's own (lenient) bounds, at the risky
            # edge. Later attempts retreat toward the conservative posture.
            if attempts == 0:
                value = lo if field.startswith("min_") else hi
            else:
                value = _TIGHT[kind][field]
            params[field] = max(lo, min(hi, value))

        # Bond: ambitious early, disciplined later. Bonds are paid from liquid
        # balance (not collateral), so the profile's bond_max is the posture.
        if attempts == 0:
            bond = min(p.bond_target + 200 * GEN, p.bond_max)
        else:
            bond = p.bond_target

        horizon = p.expiry_min_s if attempts == 0 else (p.expiry_min_s + p.expiry_max_s) // 2
        expires_at = int(time.time()) + horizon

        terms = (
            f"{kind.lower()} between {p.name} and {peer.get('name', 'peer')}: "
            + ", ".join(f"{k}={v}" for k, v in params.items())
        )

        primary, secondary = p.oracles

        rationale = (
            f"outreach attempt {attempts + 1}: kind={kind} bond={_fmt_gen(bond)} "
            f"GEN horizon={horizon // 86400}d params={params}"
        )
        return Offer(kind, terms, params, bond, expires_at, primary, secondary, rationale)
