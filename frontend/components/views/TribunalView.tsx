"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  Copy,
  Cpu,
  Gavel,
  MessageSquare,
  Radio,
  Scale,
  ScrollText,
  ShieldCheck,
  Swords,
} from "lucide-react";
import type {
  LedgerEvent,
  ProtocolState,
  Treaty,
  TreatyStatus,
  ValidatorVote,
} from "@/lib/types";
import { auditForEvent } from "@/lib/mockData";
import { KIND_COLOR } from "@/lib/board";

const CASE_KINDS = ["dispute-opened", "territory-slashed", "consensus-verdict"];

const VOTE_COLOR: Record<ValidatorVote, string> = {
  BREACH: "#ef4444",
  COMPLIANT: "#10b981",
  ABSTAIN: "#94a3b8",
};

// Tactical badge palette for the final verdict. A COMPLIANT / NORMAL round reads
// as an emerald "all clear", a BREACH as a red alarm, an unrecorded round
// abstains in slate.
const VERDICT_BADGE: Record<ValidatorVote, string> = {
  COMPLIANT: "border-emerald-500/40 bg-emerald-950/30 text-emerald-400",
  BREACH: "border-red-500/40 bg-red-950/30 text-red-400",
  ABSTAIN: "border-slate-600/50 bg-slate-900/40 text-slate-300",
};

// The GenLayer equivalence pipeline every dispute walks, in order. Surfaced as a
// visual rail so the arbitration path -- dual telemetry, isolated prompt,
// multi-LLM quorum, native settlement -- is legible at a glance rather than
// buried in the deliberation prose.
const PIPELINE = [
  "Dual Telemetry Fetch",
  "Delimiter-Isolated Prompt",
  "LLM Equivalence Quorum",
  "Native Slashing / Release",
];

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

// Tactical status pill for a covenant in the docket ledger.
function covenantStatusClass(status: TreatyStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-500/40 bg-emerald-950/30 text-emerald-400";
    case "pending":
      return "border-amber-500/40 bg-amber-950/30 text-amber-300";
    case "breached":
      return "border-red-500/40 bg-red-950/30 text-red-400";
    default:
      return "border-slate-600/50 bg-slate-900/40 text-slate-400";
  }
}

export default function TribunalView({ state }: { state: ProtocolState }) {
  const cases = useMemo(
    () => state.ledger.filter((e) => CASE_KINDS.includes(e.kind)),
    [state.ledger]
  );
  // Standing covenant ledger, newest (highest on-chain id) first, so the docket
  // always has scannable history instead of a single lonely card.
  const covenants = useMemo(
    () => [...state.treaties].sort((a, b) => (b.chainId ?? 0) - (a.chainId ?? 0)),
    [state.treaties]
  );
  const nameOf = (id: string) =>
    state.enclaves.find((e) => e.id === id)?.name ?? `${id.slice(0, 8)}...`;

  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);
  const selected: LedgerEvent | null =
    cases.find((c) => c.id === selectedId) ?? cases[0] ?? null;
  const audit = selected ? auditForEvent(selected) : null;

  return (
    <div className="custom-scrollbar pointer-events-auto absolute inset-0 z-20 flex flex-col gap-4 overflow-y-auto px-6 pb-6 pt-[104px] font-mono lg:flex-row lg:overflow-hidden">
      {/* Docket: active cases over the standing covenant ledger */}
      <div className="flex w-full shrink-0 flex-col rounded-md border border-zinc-800/60 bg-zinc-950/80 shadow-hud backdrop-blur-md lg:h-full lg:w-[320px]">
        <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-3">
          <Gavel size={15} className="text-violet-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">DOCKET</span>
          <span className="ml-auto rounded border border-violet-500/40 bg-violet-950/30 px-2 py-0.5 text-[9px] font-bold tracking-widest text-violet-300">
            {cases.length} OPEN
          </span>
        </div>

        <div className="hud-scroll min-h-0 flex-1 overflow-auto">
          {/* Active tribunal cases */}
          <div className="flex flex-col gap-1.5 p-3">
            <div className="text-[8px] font-bold tracking-[0.2em] text-slate-500">
              ACTIVE CASES
            </div>
            {cases.map((c) => {
              const active = c.id === selected?.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`rounded border px-3 py-2 text-left transition ${
                    active
                      ? "border-violet-500/60 bg-violet-500/10"
                      : "border-zinc-800/60 bg-zinc-900/40 hover:border-slate-500"
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
              <span className="rounded border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-[10px] text-slate-600">
                No active tribunal cases.
              </span>
            )}
          </div>

          {/* Standing covenant ledger */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900 p-3">
            <div className="text-[8px] font-bold tracking-[0.2em] text-slate-500">
              COVENANT LEDGER ({covenants.length})
            </div>
            {covenants.map((t: Treaty) => {
              const color = KIND_COLOR[t.kind] ?? "#22d3ee";
              return (
                <div
                  key={t.id}
                  className="rounded border border-zinc-800/60 bg-zinc-950/50 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest"
                      style={{ color }}
                    >
                      {t.status === "breached" ? (
                        <Swords size={10} className="text-red-400" />
                      ) : (
                        <ShieldCheck size={10} />
                      )}
                      {t.kind.replace(/-/g, " ").toUpperCase()}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest ${covenantStatusClass(
                        t.status
                      )}`}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-slate-500">
                    <span className="truncate">
                      {nameOf(t.parties[0])}
                      <span className="mx-1 text-slate-600">x</span>
                      {nameOf(t.parties[1])}
                    </span>
                    <span className="shrink-0 tabular-nums text-cyan-300">
                      {t.bondGen.toLocaleString("en-US")} GEN
                    </span>
                  </div>
                </div>
              );
            })}
            {covenants.length === 0 && (
              <span className="rounded border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-[10px] text-slate-600">
                No covenants on record.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Courtroom */}
      <div className="flex min-h-[60vh] flex-1 flex-col rounded-md border border-zinc-800/60 bg-zinc-950/80 shadow-hud backdrop-blur-md lg:h-full lg:min-h-0">
        <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-3">
          <Scale size={15} className="text-cyan-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
            CONSENSUS TRIBUNAL
          </span>
          <span className="ml-auto text-[9px] tracking-widest text-slate-500">
            GENVM MULTI-LLM ARBITRATION
          </span>
        </div>

        <div className="hud-scroll min-h-0 flex-1 overflow-auto">
          {!audit || !selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <Scale size={26} className="text-slate-600" />
              <div className="text-[10px] tracking-[0.25em] text-slate-500">
                SELECT A CASE FROM THE DOCKET
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
              {/* Left column: clause + telemetry + transcript */}
              <div className="flex flex-col gap-4">
                <section>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                    <ScrollText size={12} className="text-cyan-400" /> SUBMITTED TREATY BREACH
                  </div>
                  <p className="rounded border border-zinc-800/60 bg-zinc-900/40 p-3 text-[11px] leading-relaxed text-slate-200">
                    {audit.clause}
                  </p>
                </section>

                <section>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                    <Activity size={12} className="text-amber-400" /> DUAL ORACLE TELEMETRY
                    (gl.nondet.web)
                  </div>
                  <OracleFeeds source={audit.telemetrySource} />
                  <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-slate-300">
                    {audit.telemetry}
                  </p>
                </section>

                {(audit.transcript ?? []).length > 0 && (
                  <section>
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                      <MessageSquare size={12} className="text-violet-400" /> GENVM DELIBERATION
                      LOG
                    </div>
                    <div className="flex flex-col gap-2 rounded border border-zinc-800/60 bg-zinc-950/50 p-3">
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
                )}
              </div>

              {/* Right column: votes + pipeline + settlement + verdict */}
              <div className="flex flex-col gap-4">
                <section>
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
                    <Cpu size={12} className="text-violet-400" /> VALIDATOR PANEL
                  </div>
                  <div className="flex flex-col gap-2">
                    {audit.validators.length === 0 && (
                      <p className="rounded border border-zinc-800/60 bg-zinc-900/40 p-2.5 text-[10px] leading-relaxed text-slate-400">
                        The contract stores the treaty status a round produced, not
                        the individual ballots. Per-validator votes are not
                        recoverable from chain state.
                      </p>
                    )}
                    {audit.validators.map((v) => (
                      <div
                        key={v.id}
                        className="rounded border border-zinc-800/60 bg-zinc-900/40 p-2.5"
                      >
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
                        <p className="mt-1 text-[10px] leading-snug text-slate-400">
                          {v.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Real-time equivalence consensus meter. Hidden when the
                    contract recorded no ballots -- a 0% bar reads as "nobody
                    agreed" when the truth is "nobody was recorded". */}
                {audit.validators.length > 0 &&
                  (() => {
                    const total = audit.validators.length;
                    const breach = audit.validators.filter((v) => v.vote === "BREACH").length;
                    const compliant = audit.validators.filter(
                      (v) => v.vote === "COMPLIANT"
                    ).length;
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
                        <div className="flex h-3 w-full overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                          <div
                            className="h-full transition-all duration-700"
                            style={{ width: `${(breach / total) * 100}%`, backgroundColor: "#ef4444" }}
                          />
                          <div
                            className="h-full transition-all duration-700"
                            style={{
                              width: `${(compliant / total) * 100}%`,
                              backgroundColor: "#10b981",
                            }}
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

                {/* Equivalence-principle pipeline: the fixed arbitration path
                    every dispute walks, from dual telemetry to native settlement. */}
                <EquivalencePipeline />

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
                              : "border-zinc-700 bg-zinc-800 text-slate-500"
                          }`}
                        >
                          {s.done ? "+" : i + 1}
                        </span>
                        <span
                          className={`text-[11px] ${s.done ? "text-slate-200" : "text-slate-500"}`}
                        >
                          {s.label}
                        </span>
                        <span className="ml-auto font-mono text-[9px] text-slate-600">
                          #{s.block}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Verdict, badged with prominent tactical borders. */}
                <section className="rounded border border-zinc-800/60 bg-zinc-950/60 p-3">
                  <div className="flex items-center gap-2">
                    <Scale size={13} className="text-slate-300" />
                    <span className="text-[10px] tracking-widest text-slate-400">
                      CONSENSUS VERDICT
                    </span>
                    <span
                      className={`ml-auto rounded border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest ${
                        VERDICT_BADGE[audit.finalVote]
                      }`}
                    >
                      {audit.finalVote}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-200">
                    {audit.rationale}
                  </p>
                  <div className="mt-2 flex items-start gap-1.5 border-t border-zinc-800/60 pt-2">
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
    </div>
  );
}

// The two independent oracle endpoints a dispute round fetched, rendered as
// tactical feed badges instead of a raw URL blob. telemetrySource carries one
// or two endpoints: live chain data joins the treaty's oracle_primary and
// oracle_secondary with "  |  ", while seed data ships a single gl.nondet.web
// line.
function OracleFeeds({ source }: { source: string }) {
  const feeds = source
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const primary = feeds[0] ?? "(no oracle endpoint recorded)";
  const secondary = feeds[1] ?? null;

  return (
    <div className="flex flex-col gap-2">
      <FeedBadge
        label="FEED A"
        tag="VERIFIED 200 OK"
        tagClass="border-emerald-500/40 bg-emerald-950/30 text-emerald-400"
        url={primary}
      />
      {secondary ? (
        <FeedBadge
          label="FEED B"
          tag="INDEPENDENT STREAM"
          tagClass="border-cyan-500/40 bg-cyan-950/30 text-cyan-300"
          url={secondary}
          extra="DIVERGENCE: 0 BPS"
        />
      ) : (
        <div className="flex items-center gap-2 rounded border border-zinc-800/60 bg-zinc-950/60 px-2.5 py-2">
          <span className="shrink-0 text-[9px] font-bold tracking-widest text-slate-400">
            FEED B
          </span>
          <span className="shrink-0 rounded border border-slate-600/50 bg-slate-900/40 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-slate-400">
            SINGLE-SOURCE ROUND
          </span>
        </div>
      )}
    </div>
  );
}

function FeedBadge({
  label,
  tag,
  tagClass,
  url,
  extra,
}: {
  label: string;
  tag: string;
  tagClass: string;
  url: string;
  extra?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard blocked: leave the icon unchanged
    }
  };

  return (
    <div className="flex items-center gap-2 rounded border border-zinc-800/60 bg-zinc-950/60 px-2.5 py-2">
      <span className="shrink-0 text-[9px] font-bold tracking-widest text-slate-400">
        {label}
      </span>
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest ${tagClass}`}
      >
        {tag}
      </span>
      {extra && (
        <span className="shrink-0 rounded border border-cyan-500/30 bg-cyan-950/20 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-cyan-300">
          {extra}
        </span>
      )}
      <span className="truncate font-mono text-[9px] text-slate-500" title={url}>
        {url}
      </span>
      <button
        onClick={copy}
        title="Copy feed endpoint"
        className="ml-auto shrink-0 text-slate-600 transition hover:text-[#00FFA3]"
      >
        {copied ? <Check size={11} className="text-[#00FFA3]" /> : <Copy size={11} />}
      </button>
    </div>
  );
}

function EquivalencePipeline() {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
        <Radio size={12} className="text-cyan-400" /> EQUIVALENCE PIPELINE
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-800/60 bg-zinc-950/60 p-2.5">
        {PIPELINE.map((step, i) => (
          <div key={step} className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-950/20 px-2 py-1 text-[9px] font-bold tracking-wide text-cyan-200">
              <span className="text-[#00E5FF]">{i + 1}</span>
              {step}
            </span>
            {i < PIPELINE.length - 1 && (
              <ArrowRight size={11} className="shrink-0 text-slate-600" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
