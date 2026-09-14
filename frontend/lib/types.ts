// Core domain types for the Westphalia Diplomatic Board.
// All identifiers and comments are pure ASCII English.

export type ReputationTier = "Sovereign" | "Trusted" | "Neutral" | "Watched" | "Rogue";

// Dynamic agent enclave status used across the scalable archipelago.
export type EnclaveStatus = "Active" | "Contested" | "Slashed";

// Sovereign agent archetypes selectable when founding a new realm.
export type Archetype =
  | "Autonomous Arbiter"
  | "Liquidity Nexus"
  | "Oracle Collective"
  | "Defense Vanguard";

export type TreatyKind = "non-aggression" | "trade" | "data-sharing";

export type TreatyStatus = "active" | "pending" | "breached" | "resolved";

export type Biome = "plain" | "river" | "mountain" | "core";

export interface GridTile {
  // Board grid coordinates (column, row).
  col: number;
  row: number;
  // Discrete voxel stack height.
  height: number;
  biome: Biome;
  // Owning sovereignty id, or null for neutral wilderness.
  zoneId: string | null;
}

export interface SlashingRecord {
  block: number;
  reason: string;
  amountGen: number;
}

// Per-enclave biome, driving procedural terrain palette and elevation.
export interface BiomeTheme {
  base: string; // primary voxel tint
  ridge: string; // ridge / cliff tint
  accent: string; // emissive rune + citadel accent
  elevationSeed: number; // deterministic terrain seed
}

// A dynamic, state-driven agent sovereignty. Enclaves are created at runtime
// (seed set plus on-demand "found realm" deployments) and positioned by the
// orbital layout algorithm around the central Geneva core.
export interface AgentEnclave {
  id: string;
  name: string;
  archetype: Archetype;
  address: string;
  collateral: number; // sovereign collateral (GEN)
  reputation: number; // 0 - 100
  tier: ReputationTier;
  biomeTheme: BiomeTheme;
  status: EnclaveStatus;
  treaties: string[]; // ids of treaties this enclave participates in
  // Rich telemetry surfaced in the agent dossier.
  lockedEscrowGen: number;
  hazardPct: number; // 0 - 100 sector hazard level
  yieldApr: number; // escrow yield parameter (percent)
  complianceScore: number; // 0 - 100 treaty compliance
  activeEnclaves: number;
  slashingHistory: SlashingRecord[];
  summary: string;
  governance: string; // natural-language governance philosophy
  spawnedAt?: number; // epoch ms when founded at runtime (drives spawn FX)
}

export interface Treaty {
  id: string;
  kind: TreatyKind;
  status: TreatyStatus;
  parties: [string, string]; // sovereignty ids
  bondGen: number;
  createdBlock: number;
  // On-chain treaty id (contracts index treaties from 1). Captured from the
  // protocol counter after a live propose; undefined in simulated mode.
  chainId?: number;
  // True once the local actor has registered a unilateral exit notice
  // (exit_treaty phase 1); the second call executes it post-notice.
  exitRequested?: boolean;
  // Optional dispute metadata when under GenLayer LLM arbitration.
  dispute?: {
    validators: number;
    consensus: number; // 0 - 100 percent in favor
    evidenceUri: string;
    openedBlock: number;
  };
  terms: string;
}

export type LedgerEventKind =
  | "treaty-proposed"
  | "treaty-signed"
  | "dispute-opened"
  | "consensus-verdict"
  | "escrow-released"
  | "territory-slashed"
  | "realm-founded";

export type ValidatorVote = "BREACH" | "COMPLIANT" | "ABSTAIN";

export interface ValidatorOpinion {
  id: string; // e.g. "Validator A"
  model: string; // labeled LLM backing the validator
  vote: ValidatorVote;
  rationale: string;
}

// A single line in the GenVM validator deliberation transcript.
export interface TranscriptLine {
  speaker: string; // e.g. "Validator A" or "Leader"
  model: string;
  line: string;
}

// A stage in the equivalence-principle settlement timeline.
export interface SettlementStage {
  label: string;
  block: number;
  done: boolean;
}

// A reconstructed GenLayer consensus round for the audit inspector.
export interface ConsensusAudit {
  clause: string; // natural-language treaty clause evaluated
  telemetry: string; // raw external data ingested via gl.nondet.web
  telemetrySource: string; // the endpoint / feed the web block read
  validators: ValidatorOpinion[];
  finalVote: ValidatorVote;
  rationale: string; // equivalence-principle consensus rationale
  penalty: string; // penalty execution summary
  transcript?: TranscriptLine[]; // GenVM deliberation log
  settlement?: SettlementStage[]; // settlement timeline
}

export interface LedgerEvent {
  id: string;
  block: number;
  kind: LedgerEventKind;
  actor: string; // sovereignty id or "protocol"
  message: string;
  valueGen?: number;
  audit?: ConsensusAudit;
}

// A single stage in the tactical transaction pipeline overlay.
export interface PipelineState {
  active: boolean;
  label: string; // action being executed
  step: number; // 0-based index of the in-flight step
  steps: string[];
  done: boolean;
  error?: string; // revert message when the underlying transaction failed
}

// On-chain protocol overview (get_protocol_overview), synced whenever a live
// client is connected. Amounts are atto-scale strings from the contract.
export interface ChainOverview {
  balance: string;
  totalCollateral: string;
  lockedEscrow: string;
  reserves: string;
  totalClaimable: string;
  nextTreatyId: string;
  solvent: boolean;
}

export interface ProtocolState {
  stabilityIndex: number; // 0 - 100
  totalEscrowGen: number;
  enclaves: AgentEnclave[];
  treaties: Treaty[];
  ledger: LedgerEvent[];
}

// Where the board's islands and treaties came from. "live" and "empty" both
// mean the deployed contract answered the read; "empty" means it answered and
// nothing has been founded on it yet. "simulated" means the contract could not
// be reached, so the reviewer-mode seed data is on screen instead.
export type StateSource = "live" | "empty" | "simulated";

// Top-level tactical workspace views.
export type AppView = "world" | "agents" | "topology" | "tribunal" | "treasury";

export interface NetworkConfig {
  key: "studio-dev" | "studio";
  label: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}
