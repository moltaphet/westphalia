// Core domain types for the Westphalia Diplomatic Board.
// All identifiers and comments are pure ASCII English.

export type ReputationTier = "Sovereign" | "Trusted" | "Neutral" | "Watched" | "Rogue";

export type SovereigntyStatus = "stable" | "allied" | "disputed" | "slashed";

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

export interface Sovereignty {
  id: string;
  name: string;
  agentAddress: string;
  // Grid center of the citadel.
  center: { col: number; row: number };
  // Base terrain tint (hex), independent of status overlays.
  color: string;
  stakeGen: number;
  reputation: number; // 0 - 100
  tier: ReputationTier;
  status: SovereigntyStatus;
  lockedEscrowGen: number;
  // Ids of treaties this sovereignty participates in.
  treatyIds: string[];
  summary: string;
  // Rich telemetry surfaced in the agent dossier.
  complianceScore: number; // 0 - 100 treaty compliance
  activeEnclaves: number;
  slashingHistory: SlashingRecord[];
  hazardPct: number; // 0 - 100 sector hazard level
  yieldApr: number; // escrow yield parameter (percent)
}

export interface Treaty {
  id: string;
  kind: TreatyKind;
  status: TreatyStatus;
  parties: [string, string]; // sovereignty ids
  bondGen: number;
  createdBlock: number;
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
  | "territory-slashed";

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
}

export interface ProtocolState {
  stabilityIndex: number; // 0 - 100
  totalEscrowGen: number;
  sovereignties: Sovereignty[];
  treaties: Treaty[];
  ledger: LedgerEvent[];
}

// Top-level tactical workspace views.
export type AppView = "world" | "topology" | "tribunal" | "treasury";

export interface NetworkConfig {
  key: "studio-dev" | "studio";
  label: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}
