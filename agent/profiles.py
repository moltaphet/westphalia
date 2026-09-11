"""Agent identity and mission profiles.

A Profile is the immutable "self" of an agent: the identity it stamps on-chain
at founding, plus the machine-readable mission (accepted treaty kinds, bond and
horizon appetite, oracle trust, reputation floor) its decider acts against.
The charter string is the human-readable mirror of the same mission, stored on
the chain so any counterparty can read who they are dealing with.
"""

from dataclasses import dataclass, field

from .telemetry import BREACH_FEEDS

# GEN has 18 decimals; all money math is atto-scale wei.
ATTO = 10 ** 18
GEN = ATTO


def days(n: int) -> int:
    return n * 86400


@dataclass(frozen=True)
class Profile:
    # -- identity (stored on-chain at founding) --
    name: str
    archetype: str
    charter: str

    # -- treaty appetite --
    accepted_kinds: tuple[str, ...]
    proactive: bool  # True: initiates outreach. False: waits for offers.
    bond_target: int  # ideal bond (wei)
    bond_max: int  # absolute cap (wei)
    expiry_min_s: int  # shortest acceptable treaty duration
    expiry_max_s: int  # longest acceptable treaty duration
    rep_floor: int  # minimum counterparty reputation (0-100)
    # Per-kind parameter bounds, {field: (min, max)}. Mirrors the on-chain
    # TREATY_PARAM_SCHEMA keys, narrowed to this agent's risk posture.
    param_limits: dict = field(default_factory=dict)
    # The evidence endpoints this agent offers to be judged against: a
    # (primary, secondary) pair the decider writes into every proposal it makes.
    # Defaults to deterministic feeds so a dispute is decided on the arbitration
    # rather than on which validator fetched first.
    oracles: tuple[str, str] = BREACH_FEEDS
    trusted_oracle_hosts: tuple[str, ...] = ()
    collateral: int = 150 * GEN  # locked at founding
    top_up_target: int = 4000 * GEN  # faucet target so bonds + fees always clear
    min_accept_score: float = 0.62


# Halcyon -- an Autonomous Arbiter. Initiates pacts; moderately risk tolerant.
ALICE = Profile(
    name="Halcyon",
    archetype="Autonomous Arbiter",
    charter=(
        "Deter aggression through well-bonded NON_AGGRESSION and DATA_SHARING "
        "pacts. Insist on honest telemetry feeds; keep every escrow within my "
        "collateral reach."
    ),
    accepted_kinds=("DATA_SHARING", "NON_AGGRESSION"),
    proactive=True,
    bond_target=500 * GEN,
    bond_max=1000 * GEN,
    expiry_min_s=days(7),
    expiry_max_s=days(120),
    rep_floor=40,
    param_limits={
        "DATA_SHARING": {"min_uptime_bps": (9500, 10000), "max_latency_bps": (0, 800)},
        "NON_AGGRESSION": {"max_exploit_bps": (0, 500), "max_mev_events": (0, 10)},
    },
    trusted_oracle_hosts=(
        "httpbin.org",
        "api.binance.com",
        "api.coingecko.com",
        "data.binance.vision",
    ),
)

# Meridian -- an Oracle Collective. Conservative: data-only, strict telemetry.
BOB = Profile(
    name="Meridian",
    archetype="Oracle Collective",
    charter=(
        "Trade data only under strict verifiable uptime: minimum 9900 bps "
        "uptime, sub-500 bps latency, bonds capped at 600 GEN, and a 14 to 90 "
        "day horizon."
    ),
    accepted_kinds=("DATA_SHARING",),
    proactive=False,
    bond_target=500 * GEN,
    bond_max=600 * GEN,
    expiry_min_s=days(14),
    expiry_max_s=days(90),
    rep_floor=40,
    param_limits={
        "DATA_SHARING": {"min_uptime_bps": (9900, 10000), "max_latency_bps": (0, 500)},
    },
    trusted_oracle_hosts=(
        "httpbin.org",
        "api.binance.com",
        "api.coingecko.com",
        "data.binance.vision",
    ),
)

PROFILES = {"alice": ALICE, "bob": BOB}
