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
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
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
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
        "api.binance.com",
        "api.coingecko.com",
        "data.binance.vision",
    ),
)

# The four below are the wider roster. Alice and Bob carry the duet -- the
# propose / reject / adapt / ratify / arbitrate arc that the demo narrates --
# and these fill the archipelago around them so the protocol is exercised at a
# size where its layout, escrow maths and topology are visible at all. Each is
# a distinct archetype and a distinct risk posture, so a treaty offer means
# something different depending on who is reading it.

# Vantage -- a Liquidity Nexus. Trades settlement corridors; prices slippage.
VANTAGE = Profile(
    name="Vantage",
    archetype="Liquidity Nexus",
    charter=(
        "Open TRADE_CORRIDOR pacts where settlement volume is real and "
        "slippage stays inside 300 bps. Mirror the corridor with a "
        "DATA_SHARING feed so the volumes are checkable, not merely asserted."
    ),
    accepted_kinds=("TRADE_CORRIDOR", "DATA_SHARING"),
    proactive=True,
    bond_target=300 * GEN,
    bond_max=800 * GEN,
    expiry_min_s=days(10),
    expiry_max_s=days(90),
    rep_floor=35,
    param_limits={
        "TRADE_CORRIDOR": {
            "min_settlement_volume": (1000, 100000),
            "max_slippage_bps": (0, 300),
        },
        "DATA_SHARING": {"min_uptime_bps": (9000, 10000), "max_latency_bps": (0, 1000)},
    },
    trusted_oracle_hosts=(
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
        "api.binance.com",
        "api.coingecko.com",
        "data.binance.vision",
    ),
)

# Aegis -- a Defense Vanguard. Reactive by posture: it answers offers, it does
# not court them, because a deterrent that shops for fights is not a deterrent.
AEGIS = Profile(
    name="Aegis",
    archetype="Defense Vanguard",
    charter=(
        "Deter, do not trade. Accept NON_AGGRESSION only where the exploit "
        "ceiling is under 200 bps and MEV exposure under five events, and "
        "refuse any counterparty whose reputation has not held at 45."
    ),
    accepted_kinds=("NON_AGGRESSION",),
    proactive=False,
    bond_target=400 * GEN,
    bond_max=1000 * GEN,
    expiry_min_s=days(21),
    expiry_max_s=days(180),
    rep_floor=45,
    param_limits={
        "NON_AGGRESSION": {"max_exploit_bps": (0, 200), "max_mev_events": (0, 5)},
    },
    trusted_oracle_hosts=(
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
        "api.binance.com",
        "api.coingecko.com",
        "data.binance.vision",
    ),
)

# Quorum -- an Oracle Collective that sells uptime rather than buying it, so its
# posture is the opposite of Meridian's: it courts counterparties and holds
# them to the strictest latency band in the roster.
QUORUM = Profile(
    name="Quorum",
    archetype="Oracle Collective",
    charter=(
        "Sell verifiable uptime. Offer DATA_SHARING at 9700 bps and sub-600 bps "
        "latency, and hold every counterparty to the same band I am judged "
        "against -- the feed that convicts them is the feed that convicts me."
    ),
    accepted_kinds=("DATA_SHARING",),
    proactive=True,
    bond_target=300 * GEN,
    bond_max=700 * GEN,
    expiry_min_s=days(14),
    expiry_max_s=days(120),
    rep_floor=40,
    param_limits={
        "DATA_SHARING": {"min_uptime_bps": (9700, 10000), "max_latency_bps": (0, 600)},
    },
    trusted_oracle_hosts=(
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
        "api.binance.com",
        "api.coingecko.com",
        "data.binance.vision",
    ),
)

# Solstice -- an Autonomous Arbiter with the widest mandate in the roster: it
# will hold any of the three kinds, which makes it the natural second hub once
# the archipelago outgrows a single star.
SOLSTICE = Profile(
    name="Solstice",
    archetype="Autonomous Arbiter",
    charter=(
        "Bind the archipelago together: hold any of the three kinds where the "
        "parameters are honest, and prefer a well-fed counterparty to a "
        "well-funded one. Every escrow stays inside my collateral reach."
    ),
    accepted_kinds=("NON_AGGRESSION", "DATA_SHARING", "TRADE_CORRIDOR"),
    proactive=True,
    bond_target=300 * GEN,
    bond_max=900 * GEN,
    expiry_min_s=days(7),
    expiry_max_s=days(120),
    rep_floor=40,
    param_limits={
        "NON_AGGRESSION": {"max_exploit_bps": (0, 400), "max_mev_events": (0, 8)},
        "DATA_SHARING": {"min_uptime_bps": (9500, 10000), "max_latency_bps": (0, 800)},
        "TRADE_CORRIDOR": {
            "min_settlement_volume": (1000, 100000),
            "max_slippage_bps": (0, 500),
        },
    },
    trusted_oracle_hosts=(
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
        "api.binance.com",
        "api.coingecko.com",
        "data.binance.vision",
    ),
)

PROFILES = {
    "alice": ALICE,
    "bob": BOB,
    "vantage": VANTAGE,
    "aegis": AEGIS,
    "quorum": QUORUM,
    "solstice": SOLSTICE,
}
