"use client";

import { Gavel, Scale, ShieldCheck, Swords, X } from "lucide-react";
import type { AgentEnclave, VerdictRecord } from "@/lib/types";
import { tierMeta } from "@/lib/verdict";

// Post-dispute adjudication card. Surfaces the multi-LLM tribunal's categorical
// verdict tier AND its natural-language judicial rationale, so the qualitative
// reasoning behind a slashing / upholding is visible for the demo and review.
export default function TribunalVerdictModal({
  verdict,
  enclaves,
  onClose,
}: {
  verdict: VerdictRecord | null;
  enclaves: AgentEnclave[];
  onClose: () => void;
}) {
  if (!verdict) return null;

  const meta = tierMeta(verdict.tier);
  const nameOf = (id: string) => enclaves.find((e) => e.id === id)?.name ?? id;
  const breach = verdict.tier === "CRITICAL_BREACH" || verdict.tier === "ELEVATED_RISK";
  const when = new Date(verdict.timestamp).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="pointer-events-auto absolute inset-0 z-[105] flex items-center justify-center bg-zinc-950/85 p-4 font-mono backdrop-blur-md">
      <div
        className="agent-enter w-full max-w-xl overflow-hidden rounded-lg border bg-zinc-950/95 shadow-hud"
        style={{ borderColor: meta.border, boxShadow: `0 0 40px ${meta.bg}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: meta.border, backgroundColor: meta.bg }}
        >
          <div className="flex items-center gap-2">
            <Gavel size={16} style={{ color: meta.color }} />
            <span className="text-[12px] font-bold tracking-[0.22em] text-slate-100">
              GENLAYER CONSENSUS TRIBUNAL VERDICT
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 transition hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Tier badge + case meta */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[13px] font-bold tracking-[0.15em]"
              style={{ color: meta.color, borderColor: meta.border, backgroundColor: meta.bg }}
            >
              {breach ? <Swords size={14} /> : <ShieldCheck size={14} />}
              {meta.label}
            </span>
            <div className="text-right text-[9px] tracking-widest text-slate-500">
              <div>
                CASE {verdict.treatyId.toUpperCase()} &middot; {when}
              </div>
              <div className="text-slate-600">MULTI-LLM EQUIVALENCE QUORUM (3 VALIDATORS)</div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-zinc-800/60 bg-zinc-900/50 px-3 py-2">
              <div className="text-[8px] tracking-[0.2em] text-slate-500">PLAINTIFF (VICTIM)</div>
              <div className="truncate text-[12px] font-bold text-[#00E5FF]">
                {nameOf(verdict.plaintiff)}
              </div>
            </div>
            <div className="rounded border border-zinc-800/60 bg-zinc-900/50 px-3 py-2">
              <div className="text-[8px] tracking-[0.2em] text-slate-500">DEFENDANT (ON TRIAL)</div>
              <div className="truncate text-[12px] font-bold" style={{ color: meta.color }}>
                {nameOf(verdict.defendant)}
              </div>
            </div>
          </div>

          {/* Restitution summary */}
          <div
            className="flex items-center justify-between rounded border px-3 py-2.5"
            style={{ borderColor: meta.border, backgroundColor: meta.bg }}
          >
            <span className="flex items-center gap-1.5 text-[10px] tracking-widest text-slate-300">
              <Scale size={13} style={{ color: meta.color }} /> RESTITUTION TO PLAINTIFF
            </span>
            {verdict.restitutionGen > 0 ? (
              <span className="text-[14px] font-bold tabular-nums" style={{ color: meta.color }}>
                {verdict.restitutionGen.toLocaleString("en-US")} GEN
              </span>
            ) : (
              <span className="text-[11px] font-bold tracking-widest text-slate-500">
                NO TRANSFER (COVENANT UPHELD)
              </span>
            )}
          </div>

          {/* Judicial rationale box -- terminal/legal monospace, cyan border */}
          <div className="rounded border border-[#00E5FF]/40 bg-[#001b1f]/40">
            <div className="flex items-center gap-1.5 border-b border-[#00E5FF]/20 px-3 py-2 text-[10px] font-bold tracking-[0.2em] text-[#00E5FF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] animate-pulseGlow" />
              EVIDENCE &amp; COVENANT ASSESSMENT
            </div>
            <p className="px-3 py-3 font-mono text-[11px] leading-relaxed text-[#a5f3fc]">
              {verdict.rationale}
            </p>
            <div className="border-t border-[#00E5FF]/10 px-3 py-1.5 text-[8px] tracking-widest text-slate-600">
              EVIDENCE: {verdict.evidenceUri}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded border border-zinc-700 bg-zinc-900/70 py-2 text-[11px] font-bold tracking-[0.2em] text-slate-300 transition hover:border-[#00FFA3]/50 hover:text-[#00FFA3]"
          >
            ACKNOWLEDGE RULING
          </button>
        </div>
      </div>
    </div>
  );
}
