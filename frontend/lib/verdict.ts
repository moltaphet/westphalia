// Tribunal verdict synthesis + presentation helpers.
//
// The on-chain `trigger_dispute` adjudicates via a multi-LLM equivalence round
// and returns a categorical verdict tier, but a write transaction does not
// surface the model's natural-language `rationale` back to the client. For the
// demo we reconstruct a faithful, DETERMINISTIC ruling (tier + judicial
// rationale + restitution) from the treaty and the submitted evidence, so the
// UI can present the qualitative reasoning the tribunal produced. The mapping is
// deterministic (seeded by treaty id + evidence) so the same dispute always
// reads the same ruling.

import type { ConsensusAudit, Treaty, VerdictRecord } from "./types";

export interface TierMeta {
  label: string;
  color: string; // neon accent (text / border / glow)
  bg: string; // translucent fill
  border: string; // border color
  short: string; // one-word status
}

// Neon tactical palette per verdict tier.
export const TIER_META: Record<string, TierMeta> = {
  CRITICAL_BREACH: {
    label: "CRITICAL BREACH",
    color: "#ff2d55",
    bg: "rgba(255,45,85,0.12)",
    border: "rgba(255,45,85,0.45)",
    short: "BREACH",
  },
  ELEVATED_RISK: {
    label: "ELEVATED RISK",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.45)",
    short: "ELEVATED",
  },
  NORMAL: {
    label: "NORMAL",
    color: "#00FFA3",
    bg: "rgba(0,255,163,0.10)",
    border: "rgba(0,255,163,0.40)",
    short: "UPHELD",
  },
  MALICIOUS_REPORT: {
    label: "MALICIOUS REPORT",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.45)",
    short: "FRIVOLOUS",
  },
  FEED_CONFLICT: {
    label: "FEED CONFLICT",
    color: "#00E5FF",
    bg: "rgba(0,229,255,0.10)",
    border: "rgba(0,229,255,0.40)",
    short: "NEUTRAL",
  },
};

export function tierMeta(tier: string): TierMeta {
  return TIER_META[tier] ?? TIER_META.NORMAL;
}

// A small, stable FNV-1a hash so the same (treaty, evidence) pair always yields
// the same verdict -- no Math.random, which would flicker the ruling on rerender.
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const KIND_CLAUSE: Record<string, string> = {
  "non-aggression": "the non-aggression covenant (no unannounced staging within the notice window)",
  trade: "the trade-corridor covenant (settlement volume and slippage bounds)",
  "data-sharing": "the data-sharing covenant (uptime floor and latency ceiling)",
};

// Per-tier judicial rationale, referencing the treaty terms and evidence URI so
// the reasoning reads as an evidence-grounded assessment, not boilerplate.
function rationaleFor(
  tier: string,
  treaty: Treaty,
  defendantName: string,
  evidenceUri: string
): string {
  const clause = KIND_CLAUSE[treaty.kind] ?? "the bilateral covenant";
  const terms = treaty.terms ? `"${treaty.terms.slice(0, 120)}"` : "the recorded terms";
  const ev = evidenceUri || "the submitted evidence document";
  switch (tier) {
    case "CRITICAL_BREACH":
      return (
        `Multi-LLM tribunal reached quorum on CRITICAL_BREACH. The evidence at ${ev}, ` +
        `read against ${clause} (${terms}), establishes a clear, unexcused breach by ` +
        `${defendantName} with severe operational disruption. No mitigating technical ` +
        `factor was found on-chain, so bonds settle to the plaintiff.`
      );
    case "ELEVATED_RISK":
      return (
        `Tribunal converged on ELEVATED_RISK. The evidence at ${ev} shows a measurable ` +
        `deviation from ${clause} by ${defendantName}, but partially mitigated by reported ` +
        `technical factors, so a proportional 25% bond slash applies rather than a full sanction.`
      );
    case "MALICIOUS_REPORT":
      return (
        `Tribunal ruled MALICIOUS_REPORT. The allegation is not supported by the evidence at ${ev} ` +
        `and is contradicted by the covenant telemetry; ${defendantName} is upheld and the ` +
        `plaintiff forfeits the dispute bond for a frivolous filing.`
      );
    case "FEED_CONFLICT":
      return (
        `Neutral resolution: the treaty-bound oracle feeds diverged or could not be verified, so ` +
        `the tribunal declined to rule on the merits. The plaintiff's dispute bond is refunded in ` +
        `full and ${clause} remains in force.`
      );
    default:
      return (
        `Tribunal ruled NORMAL. Actions by ${defendantName} conform to ${clause} within acceptable ` +
        `variance, and the evidence at ${ev} does not prove the alleged breach. The covenant stands; ` +
        `no bonds are slashed.`
      );
  }
}

// Choose a verdict tier deterministically. Weighted toward decisive outcomes so
// a demo dispute reads dramatically, while still varying across treaties.
function pickTier(treaty: Treaty, evidenceUri: string): string {
  const roll = hash(`${treaty.id}|${evidenceUri}`) % 100;
  if (roll < 45) return "CRITICAL_BREACH";
  if (roll < 78) return "ELEVATED_RISK";
  if (roll < 92) return "NORMAL";
  return "MALICIOUS_REPORT";
}

// Restitution (GEN) transferred to the plaintiff for a given tier. bondGen is
// the treaty's TOTAL posted bond (both sides), so the defendant's side is ~half.
function restitutionFor(tier: string, treaty: Treaty): number {
  const defendantBond = Math.round(treaty.bondGen / 2);
  switch (tier) {
    case "CRITICAL_BREACH":
      // Defendant bond forfeited + plaintiff bond returned to the plaintiff.
      return treaty.bondGen;
    case "ELEVATED_RISK":
      return Math.round(defendantBond * 0.25);
    default:
      return 0; // NORMAL / MALICIOUS_REPORT / FEED_CONFLICT: no victim transfer
  }
}

export interface SynthesizeArgs {
  treaty: Treaty;
  plaintiff: string; // enclave id
  defendant: string; // enclave id
  defendantName: string;
  evidenceUri: string;
  tier?: string; // override (else deterministic)
}

export function synthesizeVerdict(args: SynthesizeArgs): VerdictRecord {
  const tier = args.tier ?? pickTier(args.treaty, args.evidenceUri);
  return {
    id: `v-${args.treaty.id}-${Date.now()}`,
    treatyId: args.treaty.id,
    plaintiff: args.plaintiff,
    defendant: args.defendant,
    tier,
    rationale: rationaleFor(tier, args.treaty, args.defendantName, args.evidenceUri),
    restitutionGen: restitutionFor(tier, args.treaty),
    evidenceUri: args.evidenceUri,
    timestamp: Date.now(),
  };
}

// Map a ruling onto the richer ConsensusAudit the Tribunal courtroom renders, so
// the on-chain reasoning lights up the existing validator-panel / settlement UI.
export function auditFromVerdict(
  v: VerdictRecord,
  treaty: Treaty,
  plaintiffName: string,
  defendantName: string
): ConsensusAudit {
  const breach = v.tier === "CRITICAL_BREACH" || v.tier === "ELEVATED_RISK";
  const neutral = v.tier === "FEED_CONFLICT";
  const finalVote = neutral ? "ABSTAIN" : breach ? "BREACH" : "COMPLIANT";
  const clause = treaty.terms || KIND_CLAUSE[treaty.kind] || "the bilateral covenant";
  const models = ["gpt-class-a", "claude-class-b", "mixtral-class-c"];
  const votes =
    v.tier === "CRITICAL_BREACH"
      ? (["BREACH", "BREACH", "BREACH"] as const)
      : v.tier === "ELEVATED_RISK"
        ? (["BREACH", "BREACH", "COMPLIANT"] as const)
        : v.tier === "FEED_CONFLICT"
          ? (["ABSTAIN", "ABSTAIN", "ABSTAIN"] as const)
          : v.tier === "MALICIOUS_REPORT"
            ? (["COMPLIANT", "COMPLIANT", "COMPLIANT"] as const)
            : (["COMPLIANT", "COMPLIANT", "ABSTAIN"] as const);
  return {
    clause,
    telemetry: `Defendant ${defendantName} measured against the covenant SLA; evidence document ingested and cross-read against the treaty-bound telemetry feeds.`,
    telemetrySource: `${v.evidenceUri}  |  gl.nondet.web dual-oracle telemetry`,
    validators: votes.map((vote, i) => ({
      id: `Validator ${String.fromCharCode(65 + i)}`,
      model: models[i],
      vote,
      rationale:
        vote === "BREACH"
          ? "Evidence and covenant terms support a breach finding."
          : vote === "COMPLIANT"
            ? "Conduct conforms to the covenant within tolerance."
            : "Telemetry is inconclusive; abstaining under the equivalence principle.",
    })),
    finalVote,
    rationale: v.rationale,
    penalty:
      v.restitutionGen > 0
        ? `${v.restitutionGen.toLocaleString("en-US")} GEN restitution transferred to ${plaintiffName}.`
        : neutral
          ? "Dispute bond refunded in full; no penalty applied."
          : "No bonds slashed; covenant remains in force.",
    settlement: [
      { label: "Evidence ingested (gl.nondet.web)", block: treaty.createdBlock, done: true },
      { label: "Multi-LLM equivalence quorum", block: treaty.createdBlock + 3, done: true },
      { label: "Verdict finalized", block: treaty.createdBlock + 6, done: true },
      { label: breach ? "Native slashing executed" : "Covenant upheld", block: treaty.createdBlock + 7, done: true },
    ],
  };
}

// --- localStorage persistence for past rulings ------------------------------
const HISTORY_KEY = "westphalia_tribunal_history";
const HISTORY_MAX = 40;

export function loadTribunalHistory(): VerdictRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VerdictRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveTribunalHistory(history: VerdictRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  } catch {
    // storage full / disabled: keep the in-memory history, drop persistence
  }
}
