import type { ConsensusAudit, LedgerEvent, Treaty } from "./types";

export const TREATIES: Treaty[] = [
  {
    id: "t1",
    kind: "trade",
    status: "active",
    parties: ["alpha", "vanguard"],
    bondGen: 42000,
    createdBlock: 1840221,
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
    terms:
      "Encrypted telemetry exchange with revocation on validated privacy breach.",
  },
  {
    id: "t3",
    kind: "non-aggression",
    status: "pending",
    parties: ["alpha", "enclave"],
    bondGen: 21500,
    createdBlock: 1842790,
    dispute: {
      validators: 5,
      consensus: 62,
      evidenceUri: "ipfs://bafy...treaty-t3-breach-evidence",
      openedBlock: 1842991,
    },
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
      telemetrySource: "gl.nondet.web GET studio-dev.genlayer.com/feeds/frontier-positioning",
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
        "Bond of 21,500 GEN placed in protective escrow pending appeal window. Reputation debit queued for Citadel Alpha.",
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
        { label: "Appeal window (open)", block: 1843600, done: false },
        { label: "Escrow settlement", block: 1843600, done: false },
      ],
    },
  },
  {
    id: "e2",
    block: 1842790,
    kind: "treaty-proposed",
    actor: "alpha",
    message: "Non-aggression treaty t3 proposed to Sovereign Enclave.",
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
      telemetrySource: "gl.nondet.web GET studio-dev.genlayer.com/feeds/settlement-route-health",
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

// Ensure every ledger event can open the Consensus Audit inspector by
// synthesizing a deterministic GenLayer round when none is attached.
export function auditForEvent(ev: LedgerEvent): ConsensusAudit {
  if (ev.audit) return ev.audit;

  const compliantRounds: Record<string, string> = {
    "treaty-proposed": "proposed clause set is internally consistent and funded",
    "treaty-signed": "counter-signature and bond lock verified on-chain",
    "escrow-released": "milestone predicate satisfied; release is authorized",
    "consensus-verdict": "prior verdict re-attested; no new evidence ingested",
  };
  const summary =
    compliantRounds[ev.kind] ?? "state transition validated under quorum";

  return {
    clause: `Automated attestation for event ${ev.id.toUpperCase()}: ${ev.message}`,
    telemetry: `on-chain state proof + escrow ledger snapshot at block ${ev.block}; ${summary}.`,
    telemetrySource: "gl.nondet.web GET studio-dev.genlayer.com/state/attestation",
    validators: [
      {
        id: "Validator A",
        model: "gpt-class-a",
        vote: "COMPLIANT",
        rationale: "Deterministic predicate holds against the ingested snapshot.",
      },
      {
        id: "Validator B",
        model: "claude-class-b",
        vote: "COMPLIANT",
        rationale: "Independent recomputation reproduces the same state root.",
      },
      {
        id: "Validator C",
        model: "mixtral-class-c",
        vote: "COMPLIANT",
        rationale: "No contradicting external telemetry found in the review window.",
      },
    ],
    finalVote: "COMPLIANT",
    rationale:
      "Equivalence principle: unanimous COMPLIANT (3 of 3). All validators agree within the leader's tolerance, so the round finalizes without penalty.",
    penalty: "No penalty. Event finalized and appended to the diplomatic ledger.",
    transcript: [
      {
        speaker: "Leader",
        model: "genvm-leader",
        line: `Round opened for event ${ev.id.toUpperCase()} at block ${ev.block}.`,
      },
      {
        speaker: "Validator A",
        model: "gpt-class-a",
        line: "Deterministic predicate holds against the ingested snapshot. COMPLIANT.",
      },
      {
        speaker: "Validator B",
        model: "claude-class-b",
        line: "Independent recomputation reproduces the same state root. COMPLIANT.",
      },
      {
        speaker: "Validator C",
        model: "mixtral-class-c",
        line: "No contradicting external telemetry in the review window. COMPLIANT.",
      },
      {
        speaker: "Leader",
        model: "genvm-leader",
        line: "Unanimous COMPLIANT. Finalizing without penalty.",
      },
    ],
    settlement: [
      { label: "Snapshot ingested", block: ev.block, done: true },
      { label: "Quorum deliberation", block: ev.block + 2, done: true },
      { label: "Round finalized", block: ev.block + 4, done: true },
    ],
  };
}
