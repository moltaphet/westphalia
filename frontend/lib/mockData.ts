import type { ConsensusAudit, LedgerEvent, Treaty } from "./types";

// The two independent hosts the protocol's oracles are served from: GitHub raw
// and the jsDelivr GitHub CDN. The contract requires the pair to sit on distinct
// hostnames, and because both serve the SAME committed document, every validator
// reads byte-identical bytes.
//
// This file previously advertised a `gl.nondet.web GET` line against the GenLayer
// Studio web app host. That host resolves, but every path under it answers HTTP
// 200 with the same HTML page, so a reader taking the panel at its word would
// find a "feed" serving no telemetry at all. A contract fetching it would parse
// nothing and settle the dispute as a neutral feed conflict. The seeded scene
// now advertises the pair the protocol really reads.
const ORACLE_PRIMARY_BASE = "raw.githubusercontent.com/moltaphet/westphalia/main/telemetry/";
const ORACLE_SECONDARY_BASE = "cdn.jsdelivr.net/gh/moltaphet/westphalia@main/telemetry/";

// The two committed pairs. Each document reports a metric PER PARTY
// (`{"party_a": ..., "party_b": ...}`), and adjudication reads only the accused
// party's own slot.
//
// The seeded treaties below bind one of these pairs, and the pair a treaty binds
// is what decides whether the seeded fiction holds together: the breach pair
// reports the breach on `party_b`, so a seeded treaty whose defendant sits in
// the `party_a` slot would be refuted by its own live telemetry. The seed is
// arranged so every accused party occupies the slot its feed reports.
const oraclePair = (name: "breach" | "calm") => ({
  oraclePrimary: `https://${ORACLE_PRIMARY_BASE}${name}_primary.json`,
  oracleSecondary: `https://${ORACLE_SECONDARY_BASE}${name}_secondary.json`,
});

// The pair the seeded audits narrate, so the audit panel and the bilateral panel
// describe one pair rather than two.
const MOCK_ORACLE_PAIR =
  `gl.nondet.web GET ${ORACLE_PRIMARY_BASE}breach_primary.json` +
  `  |  ${ORACLE_SECONDARY_BASE}breach_secondary.json`;

export const TREATIES: Treaty[] = [
  {
    id: "t1",
    kind: "trade",
    status: "active",
    parties: ["alpha", "vanguard"],
    bondGen: 42000,
    createdBlock: 1840221,
    // A healthy corridor: the calm pair reads both parties well below the
    // negligible threshold, so no corridor would let a filing slash either side.
    ...oraclePair("calm"),
    terms:
      "Reciprocal compute-credit trade corridor with 2 percent settlement fee cap and 24h dispute window.",
  },
  {
    id: "t2",
    kind: "data-sharing",
    status: "active",
    parties: ["vanguard", "enclave"],
    bondGen: 26500,
    createdBlock: 1841004,
    ...oraclePair("calm"),
    terms:
      "Encrypted telemetry exchange with revocation on validated privacy breach.",
  },
  {
    id: "t3",
    // The seeded scene's one adjudicated treaty. `enclave` is `party_a` and the
    // plaintiff; `alpha` is `party_b` and therefore the accused. The order
    // matters: the breach pair reports the breach on the `party_b` slot, so
    // Alpha has to hold that slot for the seed's own live telemetry to corroborate
    // the BREACH verdict below rather than refute it.
    kind: "non-aggression",
    status: "breached",
    parties: ["enclave", "alpha"],
    bondGen: 21500,
    createdBlock: 1842790,
    dispute: {
      validators: 5,
      consensus: 62,
      // `enclave` holds t3's `party_a` slot and filed; Alpha is the accused.
      plaintiff: "enclave",
      // The seeded scene's filing names a committed telemetry document, so the
      // URI the panel prints is one the contract's SSRF gate admits and the
      // contract can actually fetch.
      evidenceUri:
        "https://raw.githubusercontent.com/moltaphet/westphalia/main/telemetry/breach_primary.json",
      openedBlock: 1842991,
    },
    ...oraclePair("breach"),
    terms:
      "Mutual non-aggression across the violet frontier. Contested clause under multi-LLM review.",
  },
  {
    id: "t4",
    kind: "non-aggression",
    status: "breached",
    parties: ["vanguard", "bastion"],
    bondGen: 12800,
    createdBlock: 1839550,
    // Bastion is `party_b` and the accused, matching the breach pair's slot.
    ...oraclePair("breach"),
    terms:
      "Non-aggression pact voided after validated incursion. Bond forfeited to protocol treasury.",
  },
];

export const LEDGER: LedgerEvent[] = [
  {
    id: "e1",
    block: 1842991,
    kind: "dispute-opened",
    actor: "enclave",
    message: "Dispute opened on treaty t3. 5 GenLayer validators empaneled.",
    audit: {
      clause:
        "Neither party shall stage compute or logistics assets within 3 tiles of the counterparty citadel without 24h prior notice.",
      telemetry:
        "positioning feed shows 42 unannounced Alpha logistics assets at range 1.8 tiles from Enclave core for 6h17m.",
      telemetrySource: MOCK_ORACLE_PAIR,
      validators: [
        {
          id: "Validator A",
          model: "gpt-class-a",
          vote: "BREACH",
          rationale:
            "Asset density and dwell time exceed the notice-exempt threshold in clause 2.",
        },
        {
          id: "Validator B",
          model: "claude-class-b",
          vote: "BREACH",
          rationale:
            "No prior-notice attestation found on-chain within the 24h window; staging is unannounced.",
        },
        {
          id: "Validator C",
          model: "mixtral-class-c",
          vote: "COMPLIANT",
          rationale:
            "Assets may be in transit through the neutral corridor; intent is ambiguous from telemetry alone.",
        },
      ],
      finalVote: "BREACH",
      rationale:
        "Equivalence principle: 2 of 3 validators converge on BREACH with agreement above the 0.66 quorum threshold. Minority transit hypothesis is not supported by the dwell-time signal.",
      penalty:
        "Defendant bond forfeited to the plaintiff and the enclave sanctioned: reputation zeroed, collateral moved to protocol reserves. Settlement is final at the verdict -- the contract has no appeal stage, and proceeds are held as a claimable balance the winner withdraws itself.",
      transcript: [
        {
          speaker: "Leader",
          model: "genvm-leader",
          line: "Round opened for treaty t3 clause 2. Ingesting positioning feed via gl.nondet.web.",
        },
        {
          speaker: "Validator A",
          model: "gpt-class-a",
          line: "Dwell time 6h17m at range 1.8 exceeds the notice-exempt threshold. I read BREACH.",
        },
        {
          speaker: "Validator B",
          model: "claude-class-b",
          line: "No prior-notice attestation on-chain in the 24h window. Concur BREACH.",
        },
        {
          speaker: "Validator C",
          model: "mixtral-class-c",
          line: "Transit through the neutral corridor is plausible; I hold COMPLIANT.",
        },
        {
          speaker: "Leader",
          model: "genvm-leader",
          line: "2 of 3 agree within tolerance. Equivalence principle satisfied. Finalizing BREACH.",
        },
      ],
      settlement: [
        { label: "Evidence ingested", block: 1842991, done: true },
        { label: "Quorum deliberation", block: 1842994, done: true },
        { label: "Verdict finalized", block: 1842997, done: true },
        { label: "Bonds released to plaintiff", block: 1842998, done: true },
        { label: "Payout claimable by winner", block: 1842998, done: true },
      ],
    },
  },
  {
    id: "e2",
    block: 1842790,
    kind: "treaty-proposed",
    // `enclave` holds t3's `party_a` slot, and the proposer is `party_a`.
    actor: "enclave",
    message: "Non-aggression treaty t3 proposed to Citadel Alpha.",
    valueGen: 21500,
  },
  {
    id: "e3",
    block: 1841980,
    kind: "territory-slashed",
    actor: "protocol",
    message: "Consensus Bastion slashed after validated breach of treaty t4.",
    valueGen: 12800,
    audit: {
      clause:
        "Signatories pledge mutual non-aggression; no offensive resource denial against counterparty settlement routes.",
      telemetry:
        "route-health feed reports Vanguard settlement path throttled 71% coincident with Bastion egress spike; correlation 0.94.",
      telemetrySource: MOCK_ORACLE_PAIR,
      validators: [
        {
          id: "Validator A",
          model: "gpt-class-a",
          vote: "BREACH",
          rationale:
            "Throttling is temporally locked to Bastion egress; denial-of-route is established.",
        },
        {
          id: "Validator B",
          model: "claude-class-b",
          vote: "BREACH",
          rationale:
            "Correlation 0.94 with no benign maintenance window on record indicates deliberate interference.",
        },
        {
          id: "Validator C",
          model: "mixtral-class-c",
          vote: "BREACH",
          rationale:
            "Independent recomputation of the route-health delta confirms offensive denial.",
        },
      ],
      finalVote: "BREACH",
      rationale:
        "Equivalence principle: unanimous BREACH (3 of 3). Deterministic recomputation of the correlation reproduces the same verdict across validators.",
      penalty:
        "12,800 GEN bond forfeited to protocol treasury. Territory placed under containment grid and reputation reduced to Rogue tier.",
      transcript: [
        {
          speaker: "Leader",
          model: "genvm-leader",
          line: "Round opened for treaty t4. Ingesting settlement-route-health feed.",
        },
        {
          speaker: "Validator A",
          model: "gpt-class-a",
          line: "Throttling is temporally locked to Bastion egress. Denial-of-route established. BREACH.",
        },
        {
          speaker: "Validator B",
          model: "claude-class-b",
          line: "Correlation 0.94 with no maintenance window. Deliberate interference. BREACH.",
        },
        {
          speaker: "Validator C",
          model: "mixtral-class-c",
          line: "Recomputed the route-health delta independently. Reproduces BREACH.",
        },
        {
          speaker: "Leader",
          model: "genvm-leader",
          line: "Unanimous BREACH (3 of 3). Executing forfeiture and containment.",
        },
      ],
      settlement: [
        { label: "Evidence ingested", block: 1841975, done: true },
        { label: "Quorum deliberation", block: 1841977, done: true },
        { label: "Verdict finalized", block: 1841980, done: true },
        { label: "Bond forfeited", block: 1841981, done: true },
        { label: "Containment enforced", block: 1841982, done: true },
      ],
    },
  },
  {
    id: "e4",
    block: 1841004,
    kind: "treaty-signed",
    actor: "vanguard",
    message: "Data-sharing treaty t2 signed with Sovereign Enclave.",
    valueGen: 26500,
  },
  {
    id: "e5",
    block: 1840560,
    kind: "escrow-released",
    actor: "protocol",
    message: "Escrow milestone released to Citadel Alpha under treaty t1.",
    valueGen: 8000,
  },
  {
    id: "e6",
    block: 1840221,
    kind: "treaty-signed",
    actor: "alpha",
    message: "Trade corridor treaty t1 signed with Vanguard Nexus.",
    valueGen: 42000,
  },
  {
    id: "e7",
    block: 1839902,
    kind: "treaty-signed",
    actor: "vanguard",
    message: "Mutual Defense Pact ratified between Vanguard Nexus and Citadel Alpha.",
    valueGen: 15000,
  },
  {
    id: "e8",
    block: 1839640,
    kind: "escrow-released",
    actor: "protocol",
    message: "Escrow tranche released to Sovereign Enclave under treaty t2.",
    valueGen: 6200,
  },
  {
    id: "e9",
    block: 1839310,
    kind: "consensus-verdict",
    actor: "protocol",
    message: "Telemetry heartbeat verified across 4 sovereignties. Quorum healthy.",
  },
];

export function shortAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

// The consensus audit attached to a ledger event, or null when there is none.
//
// This used to synthesize a full GenLayer round -- named validators, model
// labels, votes, a transcript, and a telemetry endpoint -- for any event that
// lacked one. Chain-derived events never carry an `audit`, so on a connected
// board every click on the live treaty feed opened a fabricated validator
// panel printed underneath real on-chain state. Nothing on-chain backs those
// votes, so the inspector now reports their absence instead of inventing them.
// Real audits come from chainState.ts, built only from fields the contract
// actually returns.
export function auditForEvent(ev: LedgerEvent): ConsensusAudit | null {
  return ev.audit ?? null;
}
