"""Found the wider archipelago and wire the treaties that give it a shape.

``agent.demo`` runs the two-agent duet: propose, reject, adapt, ratify,
arbitrate. That arc needs exactly two identities and narrates the whole
protocol, but two islands is not a size at which the archipelago shows what it
is -- the orbital layout never leaves its inner ring, escrow maths stay trivial,
and a topology is indistinguishable from a line.

This module adds the roster around the duet. Four identities, each a distinct
archetype and a distinct risk posture, plus the treaties that connect them into
a star with a mesh inside it.

Two facts about the deployed contract shape what "wiring them in" has to mean:

1. The contract enumerates enclaves, so founding alone does put an island on the
   board: ``get_enclave_count`` gives the total and ``get_enclave_by_index``
   resolves each roster slot, and the board reads the set from those rather than
   inferring it from treaty parties. (Before that index existed the contract
   answered ``get_enclave`` for an address and nothing listed addresses, so the
   board walked the treaties and collected both parties instead -- and an
   enclave that had never been party to a treaty existed on-chain and was
   invisible.) A treaty is still what makes an identity legible as a sovereign
   rather than a dot, which is why this script does both.

2. A PROPOSED treaty already records both party addresses, so the board sees
   both parties the moment a proposal lands. Ratification is what turns the
   pact ACTIVE and locks the counterparty's matching bond -- which is what the
   board's escrow column counts. This script ratifies by default so the
   archipelago reads as a set of live agreements rather than a pile of offers,
   and ``--no-ratify`` exists for a cheaper run that only needs the islands
   drawn.

Every step re-reads chain state before it acts, so the script is idempotent and
resumable: a run interrupted after six of eighteen transactions picks up at the
seventh. That re-read is also how transport failures are handled -- see
``_confirmed``.

Run from the repo root:

    .venv/bin/python -m agent.seed --dry-run    # print the plan, submit nothing
    .venv/bin/python -m agent.seed              # found and wire the roster
"""

import argparse
import json
import time
from dataclasses import dataclass, field

from .chain import Chain, ChainError
from .keys import load_or_create
from .profiles import PROFILES
from .telemetry import CALM_FEEDS

GEN = 10 ** 18

# The identities this script is responsible for. Alice and Bob are the duet and
# are expected to exist already; they are referenced as counterparties but
# never founded here.
ROSTER = ("vantage", "aegis", "quorum", "solstice")

ALICE = "alice"

# Founding collateral for the new identities, matching the duet's so the
# board's collateral column reads one number rather than five. Well above the
# contract's 100 GEN anti-Sybil floor.
COLLATERAL = 150 * GEN

# Headroom funded on top of each transaction's face value, so the consensus fee
# and distribution always clear without a second faucet round trip.
FEE_HEADROOM = 60 * GEN

# Every pact here carries the same horizon. The value is unremarkable on
# purpose: it has to sit inside the narrowest window any party in this roster
# accepts -- Vantage's 10 to 90 days -- so no link is one an agent would have
# refused on duration alone.
HORIZON_S = 45 * 86400

# The duet's staged dispute is adjudicated against BREACH_FEEDS, a pair whose
# reading sits above the contract's critical threshold. These pacts are
# peacetime agreements, so they bind the calm pair instead: if one is ever
# dragged into arbitration, the evidence it is judged against should say what
# the treaty actually is. Both pairs are served by the same host and are
# byte-identical for every validator, so neither introduces fetch-order
# variance into a consensus round.
ORACLES = CALM_FEEDS

# How many times a single write is attempted before the step is called failed.
# Each attempt is preceded by a fresh chain read, so this is not a retry count
# in the usual sense -- see _confirmed.
ATTEMPTS = 3


@dataclass(frozen=True)
class Link:
    """One treaty to establish, as the offer its proposer would make.

    `params` is narrowed to the counterparty's own declared band in profiles.py
    -- not because the contract checks that, but because a proposal outside the
    band is one the counterparty's own charter obliges it to refuse, and a
    seeded offer that contradicts the charters it is stored beside would make
    the on-chain record read as a fabrication rather than a history.
    """

    proposer: str
    counterparty: str
    kind: str
    bond: int
    params: dict = field(default_factory=dict)

    @property
    def terms(self) -> str:
        pairs = ", ".join(f"{k}={v}" for k, v in sorted(self.params.items()))
        return (
            f"{self.kind} between {PROFILES[self.proposer].name} and "
            f"{PROFILES[self.counterparty].name} ({pairs}); "
            f"{self.bond // GEN} GEN posted by each side."
        )

    @property
    def label(self) -> str:
        return f"{PROFILES[self.proposer].name} -> {PROFILES[self.counterparty].name} ({self.kind})"


# A star centred on Halcyon -- the duet's proactive arbiter -- so every new
# island is one hop from the hub the demo already narrates around.
STAR = (
    Link(ALICE, "vantage", "TRADE_CORRIDOR", 300 * GEN,
         {"min_settlement_volume": 25000, "max_slippage_bps": 200}),
    Link(ALICE, "aegis", "NON_AGGRESSION", 300 * GEN,
         {"max_exploit_bps": 150, "max_mev_events": 4}),
    Link(ALICE, "quorum", "DATA_SHARING", 300 * GEN,
         {"min_uptime_bps": 9800, "max_latency_bps": 500}),
    Link(ALICE, "solstice", "NON_AGGRESSION", 300 * GEN,
         {"max_exploit_bps": 250, "max_mev_events": 6}),
)

# The mesh inside the ring. Three links among the new identities, each rotated
# so no identity is only ever a leaf: Vantage and Quorum sell to each other,
# Aegis and Solstice deter each other, and Quorum buys from Aegis. That makes
# the board's topology a star with a triangle hanging off it rather than a pure
# hub, which is the shape a viewer can actually read as a network.
MESH = (
    Link("vantage", "quorum", "DATA_SHARING", 200 * GEN,
         {"min_uptime_bps": 9800, "max_latency_bps": 500}),
    Link("aegis", "solstice", "NON_AGGRESSION", 200 * GEN,
         {"max_exploit_bps": 150, "max_mev_events": 4}),
    Link("quorum", "aegis", "DATA_SHARING", 200 * GEN,
         {"min_uptime_bps": 9800, "max_latency_bps": 500}),
)

LINKS = STAR + MESH


# ------------------------------------------------------------------ printing
def _stamp() -> str:
    return time.strftime("%H:%M:%S")


def _log(mark: str, text: str) -> None:
    print(f"  [{_stamp()}] {mark:<10} {text}", flush=True)


def _rule(title: str) -> None:
    print(f"\n===== {title} =====", flush=True)


# --------------------------------------------------------------- chain state
def _enclave_exists(chain: Chain) -> bool:
    return chain.enclave() is not None


def _link_exists(treaties: list[dict], link: Link, addresses: dict[str, str]) -> bool:
    """True when this pair already holds an open pact of this kind.

    Expired and dissolved treaties do not count: those are history, and the
    archipelago is drawn from what is currently live.
    """
    pair = {addresses[link.proposer], addresses[link.counterparty]}
    return any(
        {t["party_a"], t["party_b"]} == pair
        and t["kind"] == link.kind
        and t["status"] in ("PROPOSED", "ACTIVE")
        for t in treaties
    )


def _newest_proposal(treaties: list[dict], link: Link, addresses: dict[str, str]) -> dict | None:
    """The proposal this link just created, or None if it is not visible yet.

    Matching is by party pair, kind, proposer and status: the contract assigns
    the id, so it is read back rather than assumed, and a proposal that has not
    propagated yet must not be mistaken for a missing one.
    """
    pair = {addresses[link.proposer], addresses[link.counterparty]}
    candidates = [
        t for t in treaties
        if {t["party_a"], t["party_b"]} == pair
        and t["kind"] == link.kind
        and t["status"] == "PROPOSED"
        and t["party_a"] == addresses[link.proposer]
    ]
    return max(candidates, key=lambda t: t["_id"]) if candidates else None


def _treaty_status(chain: Chain, tid: int) -> str:
    for t in chain.treaties():
        if t["_id"] == tid:
            return str(t["status"])
    return ""


# ---------------------------------------------------------------- transport
def _confirmed(step, landed, label: str) -> bool:
    """Run one write, and decide from the chain -- not from the error -- whether
    it worked.

    studio-dev drops connections mid-request. An SSL EOF during submission is
    ambiguous: the transaction may have been accepted with only the response
    lost. Blindly re-submitting is how a duplicate treaty gets created, which
    is the one mistake a write cannot take back, so a failure is never retried
    on its own say-so. The chain is re-read first; only work that is genuinely
    absent is attempted again. That is also why this is safe for a step that
    was interrupted rather than failed: re-running the script lands here, sees
    the work already done, and moves on.
    """
    for attempt in range(1, ATTEMPTS + 1):
        try:
            step()
            return True
        except ChainError as exc:
            try:
                done = landed()
            except ChainError:
                done = False  # chain unreadable; the next attempt re-reads
            if done:
                _log("LANDED", f"{label}: reached the chain despite a transport error")
                return True
            if attempt == ATTEMPTS:
                _log("FAIL", f"{label}: {exc}")
                return False
            _log("RETRY", f"{label}: attempt {attempt} of {ATTEMPTS} did not land ({exc})")
            time.sleep(6.0 * attempt)
    return False


# ------------------------------------------------------------------ actions
def _found(chain: Chain, key: str) -> None:
    """Submit the founding transaction. Raises ChainError on failure."""
    profile = PROFILES[key]
    chain.fund(COLLATERAL + FEE_HEADROOM)
    chain.write(
        "found_sovereignty",
        args=[profile.name, profile.archetype, profile.charter],
        value=COLLATERAL,
        label=f"found {profile.name}",
    )


def _propose(chain: Chain, addresses: dict[str, str], link: Link) -> None:
    chain.fund(link.bond + FEE_HEADROOM)
    chain.write(
        "propose_treaty",
        args=[
            addresses[link.counterparty],
            link.kind,
            link.terms,
            int(time.time()) + HORIZON_S,
            json.dumps(link.params, sort_keys=True),
            ORACLES[0],
            ORACLES[1],
        ],
        value=link.bond,
        label=f"propose {link.kind}",
    )


def _ratify(chain: Chain, tid: int, bond: int) -> None:
    chain.fund(bond + FEE_HEADROOM)
    chain.write("ratify_treaty", args=[tid], value=bond, label=f"ratify #{tid}")


# --------------------------------------------------------------------- run
def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the wider Westphalia archipelago")
    parser.add_argument("--dry-run", action="store_true", help="print the plan, submit nothing")
    parser.add_argument(
        "--no-ratify",
        action="store_true",
        help="propose only; islands appear but the pacts stay PROPOSED",
    )
    args = parser.parse_args()

    keys = (ALICE,) + ROSTER
    chains: dict[str, Chain] = {k: Chain(load_or_create(k)) for k in keys}
    addresses: dict[str, str] = {k: c.address() for k, c in chains.items()}
    failures: list[str] = []

    # A full run is eighteen consensus transactions and can take twenty
    # minutes, so every line is flushed: a buffered log would show nothing at
    # all until the first one landed, which is exactly when it is least useful.
    print("\n" + "=" * 72)
    print("  WESTPHALIA -- ARCHIPELAGO SEED (studio-dev)")
    print(f"  founding {len(ROSTER)} identities, wiring {len(LINKS)} treaties")
    print("=" * 72, flush=True)

    _rule("IDENTITIES")
    for key in keys:
        p = PROFILES[key]
        print(f"  {key:<9} {p.name:<9} {p.archetype:<20} {addresses[key]}", flush=True)

    _rule("FOUNDING")
    # Alice is the hub every star link leaves from; without her there is nothing
    # to connect to, so this is a hard stop rather than a skip.
    if not args.dry_run and not _enclave_exists(chains[ALICE]):
        _log("ABORT", f"{PROFILES[ALICE].name} has no enclave; run the duet first")
        return 1

    for key in ROSTER:
        chain = chains[key]
        profile = PROFILES[key]
        if _enclave_exists(chain):
            _log("SKIP", f"{profile.name} already holds an enclave at {chain.address()}")
            continue
        _log("FOUND", f"{profile.name} ({profile.archetype}) -> {chain.address()}")
        if args.dry_run:
            _log("DRY", f"would fund to {COLLATERAL // GEN} GEN and call found_sovereignty")
            continue
        if _confirmed(
            lambda c=chain, k=key: _found(c, k),
            lambda c=chain: _enclave_exists(c),
            f"found {profile.name}",
        ):
            _log("OK", f"{profile.name} founded, {COLLATERAL // GEN} GEN collateral locked")
        else:
            failures.append(f"found {profile.name}")

    _rule("TREATIES")
    for link in LINKS:
        # A link needs both enclaves to exist. A founding that failed above
        # takes its links with it, and saying so is more useful than submitting
        # a proposal the contract is certain to revert.
        missing = [
            PROFILES[k].name
            for k in (link.proposer, link.counterparty)
            if not args.dry_run and not _enclave_exists(chains[k])
        ]
        if missing:
            _log("SKIP", f"{link.label}: {', '.join(missing)} not founded")
            failures.append(f"{link.label} (party not founded)")
            continue

        try:
            if _link_exists(chains[ALICE].treaties(), link, addresses):
                _log("SKIP", f"{link.label} already bound")
                continue
        except ChainError as exc:
            _log("FAIL", f"{link.label}: could not read the treaty list ({exc})")
            failures.append(link.label)
            continue

        _log("PROPOSE", link.label)
        if args.dry_run:
            _log("DRY", f"would post {link.bond // GEN} GEN bond: {link.terms}")
            continue

        if not _confirmed(
            lambda c=chains[link.proposer]: _propose(c, addresses, link),
            lambda l=link: _link_exists(chains[ALICE].treaties(), l, addresses),
            f"propose {link.label}",
        ):
            failures.append(f"propose {link.label}")
            continue

        # Treaty ids are read back rather than assumed: a proposal submitted
        # moments ago may not be visible to the next read, and an id guessed
        # from a stale list would ratify the wrong pact.
        try:
            proposal = _newest_proposal(chains[ALICE].treaties(), link, addresses)
        except ChainError as exc:
            _log("FAIL", f"{link.label}: treaty list unreadable ({exc})")
            failures.append(f"ratify {link.label}")
            continue
        if proposal is None:
            _log("FAIL", f"{link.label}: proposal not visible; re-run to ratify it")
            failures.append(f"ratify {link.label}")
            continue
        if args.no_ratify:
            _log("OK", f"proposal #{proposal['_id']} open, awaiting {PROFILES[link.counterparty].name}")
            continue

        tid = proposal["_id"]
        _log("RATIFY", f"{PROFILES[link.counterparty].name} matches bond on treaty #{tid}")
        if _confirmed(
            lambda c=chains[link.counterparty], t=tid: _ratify(c, t, link.bond),
            lambda c=chains[ALICE], t=tid: _treaty_status(c, t) == "ACTIVE",
            f"ratify #{tid}",
        ):
            _log("OK", f"treaty #{tid} ACTIVE, {2 * link.bond // GEN} GEN locked")
        else:
            failures.append(f"ratify #{tid}")

    _rule("RESULT")
    if args.dry_run:
        print("  dry run: nothing was submitted.", flush=True)
        return 0

    overview = chains[ALICE].overview()
    treaties = chains[ALICE].treaties()
    reachable = {t[s] for t in treaties for s in ("party_a", "party_b")}
    active = sum(1 for t in treaties if t["status"] == "ACTIVE")
    print(f"  sovereignties reachable from treaties : {len(reachable)}", flush=True)
    print(f"  treaties                              : {len(treaties)} ({active} ACTIVE)", flush=True)
    print(f"  total collateral                      : {int(overview['total_collateral']) // GEN} GEN", flush=True)
    print(f"  locked escrow                         : {int(overview['locked_escrow']) // GEN} GEN", flush=True)
    print(f"  solvent                               : {overview['solvent']}", flush=True)

    if failures:
        # Re-running is the fix, and it is safe to say so: every step above
        # re-reads the chain before acting, so a second pass does only what is
        # still missing.
        print(f"\n  {len(failures)} step(s) did not complete:", flush=True)
        for f in failures:
            print(f"    - {f}", flush=True)
        print("  re-run the same command to finish them.", flush=True)
        return 1
    print("\n  archipelago complete.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
