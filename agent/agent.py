"""Autonomous Westphalia agent.

A self-governing on-chain identity: each tick it observes the protocol through
the contract views, reasons against its charter, and acts through consensus
transactions. There is no human in the loop -- the loop is the point.

CLI:
    python -m agent.agent --profile alice --once     # one observe-decide-act pass
    python -m agent.agent --profile bob              # continuous autonomous loop
    python -m agent.agent --profile alice --reset    # regenerate the identity key
"""

import argparse
import time

from .chain import Chain, ChainError
from .decider import ADAPT_COOLDOWN_S, MAX_OUTREACH_ATTEMPTS, HeuristicDecider
from .keys import load_or_create
from .profiles import PROFILES
from .telemetry import evidence_digest

# ANSI colors for the decision ledger.
_B = "\033[1m"
_C = "\033[36m"
_G = "\033[32m"
_R = "\033[31m"
_Y = "\033[33m"
_D = "\033[0m"


def _stamp() -> str:
    return time.strftime("%H:%M:%S")


def _rule(title: str) -> None:
    print(f"\n{_B}{_C}===== {title} ====={_D}")


def _log(agent: str, mark: str, text: str, color: str = "") -> None:
    print(f"  {_B}[{_stamp()}]{_D} {_B}{color}{_C}[{agent}]{_D} {color}{mark} {text}{_D}")


class Agent:
    def __init__(self, profile, account, peer: str | None = None, dry_run: bool = False):
        self.profile = profile
        self.peer = peer
        self.dry_run = dry_run
        self.chain = Chain(account)
        self.decider = HeuristicDecider(profile)
        self.name = profile.name
        self.acted: set[int] = set()  # treaty ids already decided on
        self.last_propose_at: dict[str, float] = {}

    # ------------------------------------------------------------- pipeline
    def tick(self, outreach: bool | None = None, answer: bool = True) -> None:
        """One observe -> decide -> act pass.

        `outreach` forces (True) or suppresses (False) proactive diplomacy for
        this pass; None leaves it to the profile's own posture. `answer` False
        makes the pass bootstrap-only -- the agent founds its enclave and syncs
        state without ruling on offers it finds, which is how the demo keeps
        each phase of the duet legible. Raises ChainError on a reverted tx."""
        _rule(f"{self.name} TICK")
        self.chain.fund(self.profile.top_up_target)

        me = self.chain.enclave()
        if me is None:
            self._found()
            return
        _log(self.name, "ENCLAVE",
             f"rep {me['reputation']} collateral {int(me['collateral']) // 10**18} GEN",
             _Y)

        treaties = self.chain.treaties()
        if answer:
            self._answer_incoming(treaties)
        if self.profile.proactive if outreach is None else outreach:
            self._maybe_propose(treaties)

    # ------------------------------------------------------------ sovereignty
    def _found(self) -> None:
        p = self.profile
        _log(self.name, "DECIDE", "no sovereignty on-chain -> founding enclave", _G)
        if self.dry_run:
            _log(self.name, "FOUND", "(dry-run) skipped transaction", _Y)
            return
        try:
            self.chain.write(
                "found_sovereignty",
                args=[p.name, p.archetype, p.charter],
                value=p.collateral,
                label="found_sovereignty",
            )
        except ChainError as exc:
            _log(self.name, "FOUND", f"failed: {exc}", _R)
            return
        _log(self.name, "FOUND", f"sovereignty established, {p.collateral // 10**18} GEN collateral", _G)

    # ----------------------------------------------------------- diplomacy in
    def _answer_incoming(self, treaties: list[dict]) -> None:
        incoming = [
            t for t in treaties
            if t["party_b"] == self.chain.address()
            and t["status"] == "PROPOSED"
            and t["_id"] not in self.acted
        ]
        for t in incoming:
            self.acted.add(t["_id"])
            peer = self.chain.enclave(t["party_a"]) or {}
            ev = self.decider.evaluate(t, peer, self.chain.balance_wei())
            if ev.accepted:
                _log(self.name, "ACCEPT",
                     f"treaty #{t['_id']} ({t['kind']}) -- " + "; ".join(ev.rationale), _G)
                self._ratify(t)
            else:
                _log(self.name, "REJECT",
                     f"treaty #{t['_id']} ({t['kind']}) -- " + "; ".join(ev.rationale), _R)

    def _ratify(self, t: dict) -> None:
        bond = int(t["bond_a"])
        if self.dry_run:
            _log(self.name, "RATIFY", f"(dry-run) treaty #{t['_id']} bond {bond // 10**18} GEN", _Y)
            return
        try:
            self.chain.fund(bond + 100 * 10**18)  # matching bond plus fee margin
            self.chain.write(
                "ratify_treaty", args=[t["_id"]], value=bond, label=f"ratify #{t['_id']}"
            )
        except ChainError as exc:
            _log(self.name, "RATIFY", f"failed: {exc}", _R)
            return
        _log(self.name, "RATIFIED", f"treaty #{t['_id']} active, {bond // 10**18} GEN escrowed", _G)

    # ---------------------------------------------------------------- justice
    def adjudicate(self, treaty: dict, allegation: str, evidence_uri: str) -> str | None:
        """File a dispute over `treaty` and report the tier GenLayer returns.

        This is the one act no other chain can perform: the contract fetches the
        treaty-bound oracles, arbitrates the allegation against them, and its
        validators reach equivalence on the verdict. The bond is read from the
        contract rather than assumed, because it scales with this agent's
        reputation and a stale figure reverts before any validator runs.

        The filing also commits to its evidence. V4.2 checks the committed digest
        against the document the contract fetches, so the report is read here
        first and hashed exactly as the contract hashes it. A digest that could
        not be read is not filed at all: committing to an invented one would
        still be accepted on-chain and then adjudicated on NO_EVIDENCE, recording
        a wrong verdict permanently rather than failing where it can be seen.
        """
        tid = treaty["_id"]
        bond = self.chain.required_dispute_bond()
        digest = evidence_digest(evidence_uri)
        if digest is None:
            _log(self.name, "DISPUTE",
                 f"evidence unreadable at {evidence_uri} -- not filing", _R)
            return None
        _log(self.name, "DISPUTE", f"treaty #{tid} ({treaty['kind']}): {allegation}", _R)
        _log(self.name, "DISPUTE",
             f"posting {bond // 10**18} GEN bond (reputation-scaled)", _Y)
        _log(self.name, "DISPUTE", f"evidence: {evidence_uri}", _D)
        _log(self.name, "DISPUTE", f"commitment: sha256 {digest}", _D)
        if self.dry_run:
            _log(self.name, "DISPUTE", "(dry-run) skipped transaction", _Y)
            return None
        try:
            self.chain.fund(bond + 100 * 10**18)
            tier = self.chain.dispute(tid, allegation, evidence_uri, digest, bond_wei=bond)
        except ChainError as exc:
            _log(self.name, "DISPUTE", f"failed: {exc}", _R)
            return None
        _log(self.name, "VERDICT", f"treaty #{tid} adjudicated -> {tier}",
             _G if tier == "CRITICAL_BREACH" else _Y)
        return tier

    # ---------------------------------------------------------- diplomacy out
    def _maybe_propose(self, treaties: list[dict]) -> None:
        if not self.peer:
            return
        peer = self.chain.enclave(self.peer)
        if not peer or peer["status"] != "ACTIVE":
            return  # no willing counterparty yet

        open_with_peer = [
            t for t in treaties
            if {t["party_a"], t["party_b"]} == {self.chain.address(), self.peer}
            and t["status"] in ("PROPOSED", "ACTIVE")
        ]
        active_with_peer = [t for t in open_with_peer if t["status"] == "ACTIVE"]
        if active_with_peer:
            _log(self.name, "STATE", f"already bound by treaty #{active_with_peer[0]['_id']} with {peer['name']}", _Y)
            return

        mine = [t for t in open_with_peer if t["party_a"] == self.chain.address()]
        attempts = len(mine)
        if attempts >= MAX_OUTREACH_ATTEMPTS:
            _log(self.name, "STANDDOWN", f"{attempts} offers unanswered by {peer['name']}; holding.", _Y)
            return

        last = self.last_propose_at.get(self.peer, 0.0)
        if mine and time.time() - last < ADAPT_COOLDOWN_S:
            return  # give the peer one full evaluation cycle before adapting

        offer = self.decider.compose_offer(peer, attempts)
        _log(self.name, "PROPOSE",
             f"to {peer['name']}: {offer.rationale}", _C)
        if self.dry_run:
            _log(self.name, "PROPOSE", "(dry-run) skipped transaction", _Y)
            return
        try:
            self.last_propose_at[self.peer] = time.time()
            self.chain.write(
                "propose_treaty",
                args=[
                    self.peer,
                    offer.kind,
                    offer.terms,
                    offer.expires_at,
                    json_dumps(offer.params),
                    offer.oracle_primary,
                    offer.oracle_secondary,
                ],
                value=offer.bond,
                label=f"propose #{offer.kind}",
            )
        except ChainError as exc:
            _log(self.name, "PROPOSE", f"failed: {exc}", _R)
            return
        _log(self.name, "PROPOSED",
             f"treaty sent to {peer['name']}, bond {offer.bond // 10**18} GEN", _C)


def json_dumps(obj) -> str:
    import json

    return json.dumps(obj, sort_keys=True)


# --------------------------------------------------------------------- CLI
def main() -> None:
    parser = argparse.ArgumentParser(description="Autonomous Westphalia agent")
    parser.add_argument("--profile", choices=sorted(PROFILES), default="alice")
    parser.add_argument("--once", action="store_true", help="run a single tick")
    parser.add_argument("--peer", help="counterparty address to court")
    parser.add_argument("--poll", type=int, default=30, help="seconds between ticks")
    parser.add_argument("--dry-run", action="store_true", help="reason but never submit")
    parser.add_argument("--reset", action="store_true", help="regenerate identity key")
    args = parser.parse_args()

    profile = PROFILES[args.profile]
    account = load_or_create(args.profile, reset=args.reset)
    agent = Agent(profile, account, peer=args.peer, dry_run=args.dry_run)

    print(f"{_B}Westphalia autonomous agent: {profile.name} ({profile.archetype}){_D}")
    print(f"  identity: {account.address}")

    if args.once:
        agent.tick(outreach=True)
        return
    print("  entering autonomous loop (Ctrl-C to stop)")
    try:
        while True:
            agent.tick()
            time.sleep(args.poll)
    except KeyboardInterrupt:
        print("\n  agent halted by operator.")


if __name__ == "__main__":
    main()
