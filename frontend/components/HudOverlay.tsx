"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Gavel,
  HandCoins,
  Radio,
  Rocket,
  Scale,
  ScrollText,
  Shield,
  Swords,
  TriangleAlert,
  X,
} from "lucide-react";
import type {
  AgentEnclave,
  ConsensusAudit,
  LedgerEvent,
  ProtocolState,
  ReputationTier,
  Treaty,
  TreatyKind,
  ValidatorVote,
} from "@/lib/types";
import { auditForEvent, shortAddress } from "@/lib/mockData";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/board";
import RealmDirectory from "./RealmDirectory";

interface Props {
  state: ProtocolState;
  selectedId: string | null;
  selectedTreaty: string | null;
  onSelectTreaty: (id: string | null) => void;
  onFocusEnclave: (id: string) => void;
  onPropose: (partnerId: string, kind: TreatyKind, terms: string, bond: number) => void;
  onDispute: (treatyId: string, evidence: string) => void;
  onClaim: (treatyId: string) => void;
  onOverlayChange: (open: boolean) => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

type ModalKind = "propose" | "dispute" | "claim" | null;

const TIER_COLOR: Record<ReputationTier, string> = {
  Sovereign: "text-emerald-300 border-emerald-500/50 bg-emerald-500/10",
  Trusted: "text-cyan-300 border-cyan-500/50 bg-cyan-500/10",
  Neutral: "text-slate-200 border-slate-500/50 bg-slate-500/10",
  Watched: "text-amber-300 border-amber-500/50 bg-amber-500/10",
  Rogue: "text-red-300 border-red-500/50 bg-red-500/10",
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-auto rounded-md border border-slate-700/60 bg-slate-900/85 backdrop-blur-md shadow-hud ${className}`}
    >
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "cyan" | "emerald" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-100",
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    red: "text-red-300",
  };
  return (
    <div className="rounded border border-slate-700/60 bg-slate-800/40 p-2">
      <div className="text-[9px] tracking-widest text-slate-500">{label}</div>
      <div className={`mt-0.5 text-[13px] font-bold tabular-nums ${tones[tone]}`}>
        {value}
      </div>
    </div>
  );
}

function MeterBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 55 ? "#f59e0b" : "#ef4444";
  return (
    <div className="rounded border border-slate-700/60 bg-slate-800/40 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] tracking-widest text-slate-500">{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {score}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TreatyRow({
  treaty,
  state,
  onSelect,
  active,
}: {
  treaty: Treaty;
  state: ProtocolState;
  onSelect: () => void;
  active: boolean;
}) {
  const names = treaty.parties
    .map((p) => state.enclaves.find((s) => s.id === p)?.name ?? p)
    .join("  x  ");
  const statusColor =
    treaty.status === "active"
      ? "text-emerald-400"
      : treaty.status === "pending"
      ? "text-amber-400"
      : treaty.status === "breached"
      ? "text-red-400"
      : "text-slate-400";
  return (
    <button
      onClick={onSelect}
      className={`flex w-full flex-col gap-0.5 rounded border px-3 py-2 text-left transition ${
        active
          ? "border-cyan-500/60 bg-cyan-500/10"
          : "border-slate-700/60 bg-slate-800/40 hover:border-slate-500"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-400">
          {treaty.kind}
        </span>
        <span className={`text-[10px] font-bold uppercase ${statusColor}`}>
          {treaty.status}
        </span>
      </div>
      <span className="text-[11px] text-slate-200">{names}</span>
      <span className="text-[10px] tabular-nums text-cyan-300">
        bond {treaty.bondGen.toLocaleString("en-US")} GEN
      </span>
    </button>
  );
}

function Dossier({
  state,
  selectedId,
  selectedTreaty,
  collapsed,
  onSelectTreaty,
}: {
  state: ProtocolState;
  selectedId: string | null;
  selectedTreaty: string | null;
  collapsed: boolean;
  onSelectTreaty: (id: string | null) => void;
}) {
  const sov: AgentEnclave | null =
    state.enclaves.find((s) => s.id === selectedId) ?? null;
  const treaty = state.treaties.find((t) => t.id === selectedTreaty) ?? null;

  const sovTreaties = useMemo(() => {
    if (!sov) return [];
    return state.treaties.filter((t) => t.parties.includes(sov.id));
  }, [sov, state.treaties]);

  return (
    <div
      className={`pointer-events-none absolute right-4 top-24 flex h-[calc(100vh-6.5rem)] w-[344px] flex-col gap-3 transition-all duration-300 ease-in-out ${
        collapsed ? "translate-x-[372px] opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <Panel className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <Shield size={15} className="text-cyan-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
            AGENT DOSSIER
          </span>
        </div>

        <div className="hud-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!sov ? (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Select a sovereignty citadel on the archipelago to inspect its agent
              address, stake, reputation tier, and active covenants.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-100">{sov.name}</h2>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-[9px] font-bold tracking-widest"
                    style={{
                      color: STATUS_COLOR[sov.status],
                      backgroundColor: `${STATUS_COLOR[sov.status]}22`,
                    }}
                  >
                    {STATUS_LABEL[sov.status]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded border border-slate-700 bg-slate-800/70 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                    {shortAddress(sov.address)}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[9px] font-bold ${TIER_COLOR[sov.tier]}`}
                  >
                    {sov.tier.toUpperCase()}
                  </span>
                  <span className="rounded border border-slate-600/50 bg-slate-800/50 px-2 py-0.5 text-[9px] font-bold tracking-widest text-slate-300">
                    {sov.archetype.toUpperCase()}
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-400">{sov.summary}</p>

              <div className="grid grid-cols-2 gap-2">
                <Stat label="COLLATERAL" value={`${sov.collateral.toLocaleString("en-US")} GEN`} tone="emerald" />
                <Stat label="LOCKED ESCROW" value={`${sov.lockedEscrowGen.toLocaleString("en-US")} GEN`} tone="cyan" />
                <Stat label="REPUTATION" value={`${sov.reputation} / 100`} />
                <Stat label="ACTIVE ENCLAVES" value={`${sov.activeEnclaves}`} />
                <Stat label="ESCROW YIELD" value={`${sov.yieldApr.toFixed(1)}% APR`} tone="emerald" />
                <Stat
                  label="SECTOR HAZARD"
                  value={`${sov.hazardPct}%`}
                  tone={sov.hazardPct >= 60 ? "red" : sov.hazardPct >= 30 ? "amber" : "slate"}
                />
              </div>

              <MeterBar label="TREATY COMPLIANCE SCORE" score={sov.complianceScore} />

              <div>
                <div className="mb-1 text-[10px] tracking-widest text-slate-500">
                  SLASHING HISTORY ({sov.slashingHistory.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {sov.slashingHistory.length === 0 ? (
                    <span className="text-[10px] text-emerald-500/80">
                      Clean record. No slashing events on file.
                    </span>
                  ) : (
                    sov.slashingHistory.map((s, i) => (
                      <div
                        key={i}
                        className="rounded border border-red-500/30 bg-red-500/5 px-2 py-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-slate-500">#{s.block}</span>
                          <span className="text-[10px] font-bold tabular-nums text-red-400">
                            -{s.amountGen.toLocaleString("en-US")} GEN
                          </span>
                        </div>
                        <p className="text-[10px] leading-snug text-slate-400">{s.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] tracking-widest text-slate-500">
                  ACTIVE COVENANTS ({sovTreaties.length})
                </div>
                <div className="flex flex-col gap-2">
                  {sovTreaties.map((t) => (
                    <TreatyRow
                      key={t.id}
                      treaty={t}
                      state={state}
                      active={t.id === selectedTreaty}
                      onSelect={() => onSelectTreaty(t.id)}
                    />
                  ))}
                  {sovTreaties.length === 0 && (
                    <span className="text-[10px] text-slate-600">No covenants on record.</span>
                  )}
                </div>
              </div>

              {treaty && (
                <div className="rounded border border-cyan-500/40 bg-cyan-500/5 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] tracking-widest text-cyan-300">
                      TREATY INSPECTOR - {treaty.id.toUpperCase()}
                    </span>
                    <button
                      onClick={() => onSelectTreaty(null)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">{treaty.terms}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <span>kind: {treaty.kind}</span>
                    <span>status: {treaty.status}</span>
                    <span>block: {treaty.createdBlock}</span>
                    <span>bond: {treaty.bondGen.toLocaleString("en-US")} GEN</span>
                  </div>
                  {treaty.dispute && (
                    <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2">
                      <div className="text-[10px] tracking-widest text-amber-300">
                        GENLAYER LLM ARBITRATION
                      </div>
                      <div className="mt-1 text-[10px] text-slate-300">
                        {treaty.dispute.validators} validators - consensus{" "}
                        {treaty.dispute.consensus}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

const KIND_ICON: Record<LedgerEvent["kind"], React.ReactNode> = {
  "treaty-proposed": <Shield size={12} className="text-emerald-400" />,
  "treaty-signed": <Shield size={12} className="text-cyan-400" />,
  "dispute-opened": <Swords size={12} className="text-amber-400" />,
  "consensus-verdict": <Gavel size={12} className="text-violet-400" />,
  "escrow-released": <HandCoins size={12} className="text-cyan-400" />,
  "territory-slashed": <TriangleAlert size={12} className="text-red-400" />,
  "realm-founded": <Rocket size={12} className="text-emerald-400" />,
};

function LedgerFeed({
  ledger,
  onSelectEvent,
}: {
  ledger: LedgerEvent[];
  onSelectEvent: (ev: LedgerEvent) => void;
}) {
  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
        <Radio size={15} className="text-emerald-400 animate-pulseGlow" />
        <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
          LIVE TREATY FEED
        </span>
        <span className="ml-auto text-[8px] tracking-widest text-slate-500">CLICK TO AUDIT</span>
      </div>
      <div className="hud-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2 pb-6">
        <div className="flex flex-col gap-1.5">
            {ledger.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                className="group flex gap-2 rounded border border-slate-800 bg-slate-800/30 px-3 py-2 text-left transition hover:border-cyan-500/50 hover:bg-cyan-500/5"
              >
                <div className="mt-0.5">{KIND_ICON[ev.kind]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] uppercase tracking-widest text-slate-500">
                      {ev.kind.replace(/-/g, " ")}
                    </span>
                    <span className="font-mono text-[9px] text-slate-600">#{ev.block}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-300">{ev.message}</p>
                  {ev.valueGen !== undefined && (
                    <span className="text-[10px] tabular-nums text-cyan-400">
                      {ev.valueGen.toLocaleString("en-US")} GEN
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
    </Panel>
  );
}

// Docked as a static footer inside the left column (not a floating overlay),
// so feed cards never collide with it.
function Legend() {
  const items: [string, string][] = [
    ["#10b981", "Alliance / trade link"],
    ["#f59e0b", "LLM dispute under review"],
    ["#ef4444", "Slashed / sanctioned"],
    ["#22d3ee", "Geneva escrow hub"],
  ];
  return (
    <Panel className="shrink-0 px-3 py-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map(([c, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }}
            />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// Redesigned bottom tactical action bar with hotkey indicators.
function ActionBar({ onAction }: { onAction: (m: ModalKind) => void }) {
  const buttons: {
    m: Exclude<ModalKind, null>;
    icon: React.ReactNode;
    label: string;
    hotkey: string;
    tone: string;
  }[] = [
    {
      m: "propose",
      icon: <Shield size={16} />,
      label: "PROPOSE TREATY",
      hotkey: "C",
      tone: "border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/20",
    },
    {
      m: "dispute",
      icon: <Swords size={16} />,
      label: "TRIGGER DISPUTE",
      hotkey: "D",
      tone: "border-amber-500/50 text-amber-200 hover:bg-amber-500/20",
    },
    {
      m: "claim",
      icon: <HandCoins size={16} />,
      label: "CLAIM ESCROW",
      hotkey: "E",
      tone: "border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/20",
    },
  ];
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
      <Panel className="flex items-center gap-2 p-2">
        {buttons.map((b) => (
          <button
            key={b.m}
            onClick={() => onAction(b.m)}
            className={`pointer-events-auto flex items-center gap-2 rounded border bg-slate-800/50 px-4 py-2.5 text-[11px] font-bold tracking-widest transition ${b.tone}`}
          >
            {b.icon}
            {b.label}
            <span className="ml-1 rounded border border-current/40 px-1.5 py-0.5 text-[9px] opacity-70">
              {b.hotkey}
            </span>
          </button>
        ))}
      </Panel>
    </div>
  );
}

// --- Consensus Audit inspector -------------------------------------------

const VOTE_STYLE: Record<ValidatorVote, string> = {
  BREACH: "text-red-400 border-red-500/40 bg-red-500/10",
  COMPLIANT: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  ABSTAIN: "text-slate-400 border-slate-500/40 bg-slate-500/10",
};

function VoteBadge({ vote }: { vote: ValidatorVote }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest ${VOTE_STYLE[vote]}`}
    >
      {vote}
    </span>
  );
}

function ConsensusAuditModal({
  event,
  audit,
  onClose,
}: {
  event: LedgerEvent;
  audit: ConsensusAudit;
  onClose: () => void;
}) {
  const breachCount = audit.validators.filter((v) => v.vote === "BREACH").length;
  return (
    <div className="pointer-events-auto absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md">
      <div className="hud-scroll max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-lg border border-cyan-500/40 bg-slate-900 shadow-hud">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-700/60 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-cyan-400" />
            <span className="text-[12px] font-bold tracking-[0.2em] text-slate-100">
              CONSENSUS AUDIT
            </span>
            <span className="font-mono text-[9px] text-slate-500">#{event.block}</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <section>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
              <ScrollText size={12} className="text-cyan-400" /> EVALUATED CLAUSE
            </div>
            <p className="rounded border border-slate-700/60 bg-slate-800/40 p-3 text-[11px] leading-relaxed text-slate-200">
              {audit.clause}
            </p>
          </section>

          <section>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
              <Activity size={12} className="text-amber-400" /> EXTERNAL TELEMETRY (gl.nondet.web)
            </div>
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="mb-1 font-mono text-[9px] text-amber-300/80">
                {audit.telemetrySource}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">{audit.telemetry}</p>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-400">
              <Cpu size={12} className="text-violet-400" /> MULTI-LLM VALIDATOR VOTES
            </div>
            <div className="flex flex-col gap-2">
              {audit.validators.map((v) => (
                <div key={v.id} className="rounded border border-slate-700/60 bg-slate-800/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-100">{v.id}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-slate-500">{v.model}</span>
                      <VoteBadge vote={v.vote} />
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">{v.rationale}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-cyan-500/40 bg-cyan-500/5 p-3">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-cyan-300">
                <Scale size={12} /> EQUIVALENCE PRINCIPLE CONSENSUS
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500">
                  {breachCount}/{audit.validators.length} breach
                </span>
                <VoteBadge vote={audit.finalVote} />
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-200">{audit.rationale}</p>
            <div className="mt-2 flex items-start gap-1.5 border-t border-cyan-500/20 pt-2">
              <Gavel size={12} className="mt-0.5 shrink-0 text-violet-400" />
              <p className="text-[10px] leading-relaxed text-slate-300">
                <span className="text-slate-500">PENALTY EXECUTION: </span>
                {audit.penalty}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// --- Action modals ---------------------------------------------------------

function ModalShell({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 shadow-hud">
        <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-[12px] font-bold tracking-[0.2em] text-slate-100">{title}</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[10px] tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded border border-slate-700 bg-slate-800/70 px-3 py-2 text-[12px] text-slate-100 outline-none focus:border-cyan-500/60";

function ProposeModal({
  state,
  selfId,
  onClose,
  onSubmit,
}: {
  state: ProtocolState;
  selfId: string | null;
  onClose: () => void;
  onSubmit: (partnerId: string, kind: TreatyKind, terms: string, bond: number) => void;
}) {
  const partners = state.enclaves.filter((s) => s.id !== selfId);
  const [partner, setPartner] = useState(partners[0]?.id ?? "");
  const [kind, setKind] = useState<TreatyKind>("non-aggression");
  const [terms, setTerms] = useState("Mutual non-aggression with 24h dispute window.");
  const [bond, setBond] = useState(10000);

  return (
    <ModalShell title="PROPOSE TREATY" icon={<Shield size={15} className="text-emerald-400" />} onClose={onClose}>
      <Field label="PARTNER SOVEREIGNTY">
        <select className={inputCls} value={partner} onChange={(e) => setPartner(e.target.value)}>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="TREATY CONDITION">
        <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as TreatyKind)}>
          <option value="non-aggression">Non-aggression</option>
          <option value="trade">Trade</option>
          <option value="data-sharing">Data sharing</option>
        </select>
      </Field>
      <Field label="TERMS">
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
        />
      </Field>
      <Field label="GEN BOND (locked via payable call)">
        <input
          type="number"
          className={inputCls}
          value={bond}
          min={0}
          onChange={(e) => setBond(Number(e.target.value))}
        />
      </Field>
      <button
        onClick={() => onSubmit(partner, kind, terms, bond)}
        className="mt-2 w-full rounded border border-emerald-500/50 bg-emerald-500/15 py-2 text-[12px] font-bold tracking-widest text-emerald-200 hover:bg-emerald-500/25"
      >
        LOCK BOND AND PROPOSE
      </button>
    </ModalShell>
  );
}

function DisputeModal({
  treaties,
  onClose,
  onSubmit,
}: {
  treaties: Treaty[];
  onClose: () => void;
  onSubmit: (treatyId: string, evidence: string) => void;
}) {
  const [treatyId, setTreatyId] = useState(treaties[0]?.id ?? "");
  const [evidence, setEvidence] = useState("ipfs://bafy...breach-evidence");
  return (
    <ModalShell title="TRIGGER DISPUTE" icon={<Swords size={15} className="text-amber-400" />} onClose={onClose}>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
        Submit evidence of a treaty breach to empanel GenLayer multi-LLM validators for consensus
        arbitration.
      </p>
      <Field label="TARGET TREATY">
        <select className={inputCls} value={treatyId} onChange={(e) => setTreatyId(e.target.value)}>
          {treaties.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id.toUpperCase()} - {t.kind}
            </option>
          ))}
        </select>
      </Field>
      <Field label="EVIDENCE URI">
        <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      </Field>
      <button
        onClick={() => onSubmit(treatyId, evidence)}
        disabled={!treatyId}
        className="mt-2 w-full rounded border border-amber-500/50 bg-amber-500/15 py-2 text-[12px] font-bold tracking-widest text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
      >
        SUBMIT TO VALIDATOR CONSENSUS
      </button>
    </ModalShell>
  );
}

function ClaimModal({
  treaties,
  onClose,
  onSubmit,
}: {
  treaties: Treaty[];
  onClose: () => void;
  onSubmit: (treatyId: string) => void;
}) {
  const [treatyId, setTreatyId] = useState(treaties[0]?.id ?? "");
  return (
    <ModalShell title="CLAIM / WITHDRAW" icon={<HandCoins size={15} className="text-cyan-400" />} onClose={onClose}>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
        Pull-pattern withdrawal of released escrow or bounty rewards for a settled treaty.
      </p>
      <Field label="TREATY">
        <select className={inputCls} value={treatyId} onChange={(e) => setTreatyId(e.target.value)}>
          {treaties.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id.toUpperCase()} - {t.bondGen.toLocaleString("en-US")} GEN
            </option>
          ))}
        </select>
      </Field>
      <button
        onClick={() => onSubmit(treatyId)}
        disabled={!treatyId}
        className="mt-2 w-full rounded border border-cyan-500/50 bg-cyan-500/15 py-2 text-[12px] font-bold tracking-widest text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40"
      >
        WITHDRAW RELEASED ESCROW
      </button>
    </ModalShell>
  );
}

export default function HudOverlay({
  state,
  selectedId,
  selectedTreaty,
  onSelectTreaty,
  onFocusEnclave,
  onPropose,
  onDispute,
  onClaim,
  onOverlayChange,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
}: Props) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [auditEvent, setAuditEvent] = useState<LedgerEvent | null>(null);

  // Report open state upward so the 3D scene can suppress its Html labels.
  useEffect(() => {
    onOverlayChange(modal !== null || auditEvent !== null);
  }, [modal, auditEvent, onOverlayChange]);

  const disputableTreaties = state.treaties.filter(
    (t) => t.status === "active" || t.status === "pending"
  );

  // Tactical hotkeys: P propose, D dispute, C claim, Escape closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "Escape") {
        setModal(null);
        setAuditEvent(null);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "c") setModal("propose");
      else if (k === "d") setModal("dispute");
      else if (k === "e") setModal("claim");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* HUD panels sit below the top command bar (z-10). Modals below are
          rendered as root-level siblings so their z-[100] backdrops layer
          above the top bar and every scene label. */}
      <div className="pointer-events-none absolute inset-0 z-10 font-mono">
        {/* Left column: directory, feed, and docked legend stacked vertically
            so nothing overlaps. Slides out under cinematic / collapse. */}
        <div
          className={`pointer-events-none absolute left-4 top-24 flex h-[calc(100vh-6.5rem)] w-[320px] flex-col gap-2 transition-all duration-300 ease-in-out ${
            leftCollapsed ? "-translate-x-[360px] opacity-0" : "translate-x-0 opacity-100"
          }`}
        >
          <RealmDirectory
            enclaves={state.enclaves}
            selectedId={selectedId}
            onFocus={onFocusEnclave}
          />
          <LedgerFeed ledger={state.ledger} onSelectEvent={setAuditEvent} />
          <Legend />
        </div>

        {/* Persistent left toggle: slides between the feed's right edge and the
            screen edge so the panel can always be reopened. */}
        <button
          onClick={onToggleLeft}
          title={leftCollapsed ? "Show treaty feed" : "Hide treaty feed"}
          className={`pointer-events-auto absolute top-1/2 z-20 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-r border border-slate-700/60 bg-slate-900/90 text-slate-300 shadow-hud backdrop-blur-md transition-all duration-300 ease-in-out hover:text-cyan-300 ${
            leftCollapsed ? "left-0" : "left-[332px]"
          }`}
        >
          {leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <Dossier
          state={state}
          selectedId={selectedId}
          selectedTreaty={selectedTreaty}
          collapsed={rightCollapsed}
          onSelectTreaty={onSelectTreaty}
        />

        {/* Persistent right toggle for the dossier. */}
        <button
          onClick={onToggleRight}
          title={rightCollapsed ? "Show dossier" : "Hide dossier"}
          className={`pointer-events-auto absolute top-1/2 z-20 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l border border-slate-700/60 bg-slate-900/90 text-slate-300 shadow-hud backdrop-blur-md transition-all duration-300 ease-in-out hover:text-cyan-300 ${
            rightCollapsed ? "right-0" : "right-[356px]"
          }`}
        >
          {rightCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <ActionBar onAction={setModal} />
      </div>

      {auditEvent && (
        <ConsensusAuditModal
          event={auditEvent}
          audit={auditForEvent(auditEvent)}
          onClose={() => setAuditEvent(null)}
        />
      )}

      {modal === "propose" && (
        <ProposeModal
          state={state}
          selfId={selectedId}
          onClose={() => setModal(null)}
          onSubmit={(p, k, t, b) => {
            onPropose(p, k, t, b);
            setModal(null);
          }}
        />
      )}
      {modal === "dispute" && (
        <DisputeModal
          treaties={disputableTreaties}
          onClose={() => setModal(null)}
          onSubmit={(id, ev) => {
            onDispute(id, ev);
            setModal(null);
          }}
        />
      )}
      {modal === "claim" && (
        <ClaimModal
          treaties={state.treaties}
          onClose={() => setModal(null)}
          onSubmit={(id) => {
            onClaim(id);
            setModal(null);
          }}
        />
      )}
    </>
  );
}
