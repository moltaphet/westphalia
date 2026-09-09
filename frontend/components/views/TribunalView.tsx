"use client";

import { useMemo, useState } from "react";
import { Activity, Cpu, Gavel, MessageSquare, Scale, ScrollText } from "lucide-react";
import type { LedgerEvent, ProtocolState, ValidatorVote } from "@/lib/types";
import { auditForEvent } from "@/lib/mockData";

const CASE_KINDS = ["dispute-opened", "territory-slashed", "consensus-verdict"];

const VOTE_COLOR: Record<ValidatorVote, string> = {
  BREACH: "#ef4444",
  COMPLIANT: "#10b981",
  ABSTAIN: "#94a3b8",
};

// Case severity derived from the ledger event kind.
function severityFor(kind: string): { label: string; color: string } {
  if (kind === "territory-slashed") return { label: "CRITICAL", color: "#ef4444" };
  if (kind === "dispute-opened") return { label: "HIGH", color: "#f59e0b" };
  return { label: "INFO", color: "#22d3ee" };
}

function SeverityBadge({ kind }: { kind: string }) {
  const s = severityFor(kind);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[8px] font-bold tracking-widest"
      style={{ color: s.color, backgroundColor: `${s.color}22`, border: `1px solid ${s.color}55` }}
    >
      {s.label}
    </span>
  );
}

export default function TribunalView({ state }: { state: ProtocolState }) {
  const cases = useMemo(
    () => state.ledger.filter((e) => CASE_KINDS.includes(e.kind)),
    [state.ledger]
  );
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);
  const selected: LedgerEvent | null =
    cases.find((c) => c.id === selectedId) ?? cases[0] ?? null;
  const audit = selected ? auditForEvent(selected) : null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex gap-4 px-4 pb-4 pt-[144px] font-mono">
      {/* Docket */}
      <div className="hud-scroll w-[300px] shrink-0 overflow-y-auto rounded-md border border-slate-700/60 bg-slate-900/70 shadow-hud backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <Gavel size={15} className="text-violet-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">DOCKET</span>
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          {cases.map((c) => {
            const active = c.id === selected?.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`rounded border px-3 py-2 text-left transition ${
                  active
                    ? "border-violet-500/60 bg-violet-500/10"
                    : "border-slate-700/60 bg-slate-800/40 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500">
                    <SeverityBadge kind={c.kind} />
                    {c.kind.replace(/-/g, " ")}
                  </span>
                  <span className="font-mono text-[9px] text-slate-600">#{c.block}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-300">{c.message}</p>
              </button>
            );
          })}
          {cases.length === 0 && (
            <span className="text-[10px] text-slate-600">No active tribunal cases.</span>
          )}
        </div>
      </div>

      {/* Courtroom */}
      <div className="hud-scroll min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-700/60 bg-slate-900/70 shadow-hud backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <Scale size={15} className="text-cyan-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
            CONSENSUS TRIBUNAL
          </span>
          <span className="ml-auto text-[9px] tracking-widest text-slate-500">
            GENVM MULTI-LLM ARBITRATION
          </span>
        </div>

        {!audit || !selected ? (
          <div className="p-6 text-[12px] text-slate-500">Select a case from the docket.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            {/* Left column: clause + telemetry + transcript */}
            <div className="flex flex-col gap-4">
              <section>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                  <ScrollText size={12} className="text-cyan-400" /> SUBMITTED TREATY BREACH
                </div>
                <p className="rounded border border-slate-700/60 bg-slate-800/40 p-3 text-[11px] leading-relaxed text-slate-200">
                  {audit.clause}
                </p>
              </section>

              <section>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                  <Activity size={12} className="text-amber-400" /> INGESTED TELEMETRY (gl.nondet.web)
                </div>
                <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="mb-1 font-mono text-[9px] text-amber-300/80">
                    {audit.telemetrySource}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">{audit.telemetry}</p>
                </div>
              </section>

              <section>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                  <MessageSquare size={12} className="text-violet-400" /> GENVM DELIBERATION LOG
                </div>
                <div className="flex flex-col gap-2 rounded border border-slate-700/60 bg-slate-950/50 p-3">
                  {(audit.transcript ?? []).map((line, i) => (
                    <div key={i} className="text-[10px] leading-snug">
                      <span className="text-cyan-300">{line.speaker}</span>
                      <span className="text-slate-600"> [{line.model}]</span>
                      <span className="text-slate-600">: </span>
                      <span className="text-slate-300">{line.line}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right column: votes + settlement + penalty */}
            <div className="flex flex-col gap-4">
              <section>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                  <Cpu size={12} className="text-violet-400" /> VALIDATOR PANEL
                </div>
                <div className="flex flex-col gap-2">
                  {audit.validators.map((v) => (
                    <div key={v.id} className="rounded border border-slate-700/60 bg-slate-800/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-100">{v.id}</span>
                        <span
                          className="rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest"
                          style={{
                            color: VOTE_COLOR[v.vote],
                            borderColor: `${VOTE_COLOR[v.vote]}66`,
                            backgroundColor: `${VOTE_COLOR[v.vote]}1a`,
                          }}
                        >
                          {v.vote}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-snug text-slate-400">{v.rationale}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Real-time equivalence consensus meter */}
              {(() => {
                const total = audit.validators.length || 1;
                const breach = audit.validators.filter((v) => v.vote === "BREACH").length;
                const compliant = audit.validators.filter((v) => v.vote === "COMPLIANT").length;
                const majority = Math.round((Math.max(breach, compliant) / total) * 100);
                const verdictColor = VOTE_COLOR[audit.finalVote];
                return (
                  <section>
                    <div className="mb-2 flex items-center justify-between text-[10px] tracking-widest text-slate-400">
                      <span>EQUIVALENCE CONSENSUS METER</span>
                      <span className="font-bold" style={{ color: verdictColor }}>
                        {majority}% {audit.finalVote}
                      </span>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-700 bg-slate-900">
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${(breach / total) * 100}%`, backgroundColor: "#ef4444" }}
                      />
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${(compliant / total) * 100}%`, backgroundColor: "#10b981" }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-slate-500">
                      <span className="text-red-400">{breach} BREACH</span>
                      <span>quorum threshold 66%</span>
                      <span className="text-emerald-400">{compliant} COMPLIANT</span>
                    </div>
                  </section>
                );
              })()}

              <section>
                <div className="mb-2 text-[10px] tracking-widest text-slate-400">
                  EQUIVALENCE PRINCIPLE SETTLEMENT TIMELINE
                </div>
                <div className="flex flex-col gap-2">
                  {(audit.settlement ?? []).map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${
                          s.done
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                            : "border-slate-700 bg-slate-800 text-slate-500"
                        }`}
                      >
                        {s.done ? "+" : i + 1}
                      </span>
                      <span className={`text-[11px] ${s.done ? "text-slate-200" : "text-slate-500"}`}>
                        {s.label}
                      </span>
                      <span className="ml-auto font-mono text-[9px] text-slate-600">#{s.block}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded border border-cyan-500/40 bg-cyan-500/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-cyan-300">
                  <Scale size={12} /> CONSENSUS VERDICT: {audit.finalVote}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-200">{audit.rationale}</p>
                <div className="mt-2 flex items-start gap-1.5 border-t border-cyan-500/20 pt-2">
                  <Gavel size={12} className="mt-0.5 shrink-0 text-violet-400" />
                  <p className="text-[10px] leading-relaxed text-slate-300">
                    <span className="text-slate-500">ESCROW PENALTY: </span>
                    {audit.penalty}
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
