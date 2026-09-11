"""Two-agent autonomous duet on studio-dev.

The full Westphalia lifecycle, run by agents with no human in the loop:

  1. Alice and Bob each fund themselves and found sovereign enclaves.
  2. Alice (proactive) proposes a loose DATA_SHARING treaty.
  3. Bob (conservative) evaluates and REJECTS it -- the transcript shows why.
  4. Alice reads the silence as "not acceptable", tightens, and supersedes
     with a compliant offer.
  5. Bob accepts and ratifies -- treaty ACTIVE on-chain with both bonds locked.
  6. Alice files a dispute. The contract fetches the treaty-bound oracles,
     arbitrates the allegation against them, and GenLayer's validators reach
     equivalence on the verdict -- which then settles the escrow on-chain.

Phase 6 is the part no other chain can do. Phases 1-5 are transactions any
chain could carry; the arbitration is GenLayer's alone.

Run from the repo root:

    .venv/bin/python -m agent.demo
"""

import argparse
import time

from .agent import Agent
from .keys import load_or_create
from .profiles import ALICE, BOB
from .telemetry import BREACH_FEEDS, agreed_bps

# Consensus rounds on studio-dev take a few seconds; keep the pauses generous
# so every tx is decided before the counterparty reasons over fresh state.
SETTLE_S = 25
THINK_S = 12

# The allegation Alice puts to the court. It is a *true* one: the treaty's own
# oracles independently report a breach far above the critical threshold, so
# the verdict is decided by the evidence rather than by the prose.
ALLEGATION = (
    "Meridian's telemetry breached the agreed uptime floor on the primary "
    "oracle. The dual-feed reading is far above the critical threshold, so the "
    "covenant is broken and the bond is forfeit."
)


def _banner() -> None:
    print("\n" + "=" * 72)
    print("  WESTPHALIA -- AUTONOMOUS AGENT DUET (studio-dev)")
    print("  Alice (Halcyon, Autonomous Arbiter) courts Bob (Meridian, Oracle Collective)")
    print("=" * 72)


def _summary(agent: Agent, other: str) -> None:
    me = agent.chain.enclave()
    # Only this agent's own treaties -- the protocol holds everyone's.
    mine = [
        t for t in agent.chain.treaties()
        if agent.chain.address() in (t["party_a"], t["party_b"])
    ]
    active = [t for t in mine if t["status"] == "ACTIVE"]
    proposed = [t for t in mine if t["status"] == "PROPOSED"]
    print(f"\n  [{agent.name}] enclave={agent.chain.address()}")
    print(f"    status={me.get('status')} rep={me.get('reputation')}"
          f" collateral={int(me.get('collateral', 0)) // 10**18} GEN"
          f" balance={agent.chain.balance_wei() // 10**18} GEN"
          f" claimable={agent.chain.claimable() // 10**18} GEN")
    print(f"    treaties: {len(active)} ACTIVE, {len(proposed)} PROPOSED (peer: {other})")
    for t in mine:
        who = "a" if t["party_a"] == agent.chain.address() else "b"
        print(f"      #{t['_id']} {t['kind']:<16} {t['status']:<9} "
              f"bond_a={int(t['bond_a']) // 10**18} GEN party_{who}")


def _active_treaty(agent: Agent, peer_addr: str) -> dict | None:
    """The live treaty binding this agent to the peer, if there is one."""
    for t in agent.chain.treaties():
        if (
            t["status"] == "ACTIVE"
            and {t["party_a"], t["party_b"]} == {agent.chain.address(), peer_addr}
        ):
            return t
    return None


def _outcome(alice: Agent, bob: Agent, tid: int) -> None:
    """What the ruling actually did on-chain -- the consequence, not the prose."""
    t = next((x for x in alice.chain.treaties() if x["_id"] == tid), None)
    print("\n  the ruling, settled on-chain:")
    if t is not None:
        print(f"    treaty #{tid}: {t['status']}"
              f" (bonds released: a={int(t['bond_a']) // 10**18}"
              f" b={int(t['bond_b']) // 10**18} GEN)")
    for agent in (alice, bob):
        e = agent.chain.enclave() or {}
        print(f"    [{agent.name}] status={e.get('status')}"
              f" rep={e.get('reputation')}"
              f" claimable={agent.chain.claimable() // 10**18} GEN")


def _open_offer_from(agent: Agent, peer_addr: str) -> list[dict]:
    """Offers this agent already has standing with the peer, oldest first."""
    return [
        t for t in agent.chain.treaties()
        if t["party_a"] == agent.chain.address()
        and t["party_b"] == peer_addr
        and t["status"] == "PROPOSED"
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Two-agent autonomous duet")
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="mint two brand-new identities and run the whole lifecycle from scratch",
    )
    parser.add_argument(
        "--no-adjudicate",
        action="store_true",
        help="stop after ratification; skip the dispute that sanctions the counterparty",
    )
    args = parser.parse_args()

    alice_acct = load_or_create("alice", reset=args.fresh)
    bob_acct = load_or_create("bob", reset=args.fresh)
    alice = Agent(ALICE, alice_acct, peer=bob_acct.address)
    bob = Agent(BOB, bob_acct, peer=alice_acct.address)

    _banner()
    print(f"  Alice identity: {alice_acct.address}")
    print(f"  Bob   identity: {bob_acct.address}")
    print(f"  contract: {alice.chain.client.__class__.__name__} @ studio-dev")

    # -- 1. founding --
    # Bootstrap only: each agent funds itself and writes its own charter. No
    # diplomacy yet, so the phases below stay legible.
    print("\n>>> FOUNDING")
    alice.tick(outreach=False, answer=False)
    bob.tick(answer=False)
    time.sleep(SETTLE_S)

    # -- 2. first outreach (deliberately loose) --
    # Alice's opening offer may already be standing on-chain from an earlier
    # run. The duet is state-driven, so it resumes from whatever is really
    # there instead of stacking a duplicate proposal.
    print("\n>>> ALICE PROPOSES (attempt 1: loose)")
    standing = _open_offer_from(alice, bob_acct.address)
    if standing:
        t = standing[0]
        print(f"    offer already standing: treaty #{t['_id']} "
              f"bond {int(t['bond_a']) // 10**18} GEN -- resuming the duet")
    else:
        alice.tick(outreach=True)
    time.sleep(SETTLE_S)

    # -- 3. Bob evaluates and rejects --
    print("\n>>> BOB EVALUATES")
    bob.tick()
    time.sleep(THINK_S)

    # -- 4. Alice adapts and supersedes --
    print("\n>>> ALICE ADAPTS (attempt 2: compliant)")
    alice.tick()
    time.sleep(SETTLE_S)

    # -- 5. Bob accepts and ratifies --
    print("\n>>> BOB ACCEPTS")
    bob.tick()
    time.sleep(SETTLE_S)

    # -- 6. adjudication: GenLayer rules on the breach --
    # The turn no other chain can take. The evidence endpoints travel with the
    # treaty, so neither party can substitute them at dispute time; the contract
    # fetches both, and its validators reach equivalence on the verdict before
    # any escrow moves.
    print("\n>>> ALICE FILES A DISPUTE (GenLayer arbitrates)")
    print(f"    treaty-bound oracles (byte-identical for every validator):")
    for url in BREACH_FEEDS:
        print(f"      {url}")
    print(f"    agreed reading: {agreed_bps(BREACH_FEEDS)} bps breach "
          f"(critical threshold 7500)")
    disputed = _active_treaty(alice, bob_acct.address)
    if args.no_adjudicate:
        print("    --no-adjudicate: stopping before the dispute")
    elif disputed is None:
        print("    no ACTIVE treaty to dispute -- skipping arbitration")
    else:
        alice.adjudicate(disputed, ALLEGATION, BREACH_FEEDS[0])
        time.sleep(SETTLE_S)
        _outcome(alice, bob, disputed["_id"])

    print("\n" + "=" * 72)
    print("  FINAL ON-CHAIN STATE")
    print("=" * 72)
    _summary(alice, bob.name)
    _summary(bob, alice.name)
    print("\n  done.")


if __name__ == "__main__":
    main()
