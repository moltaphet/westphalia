"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Compass,
  Gavel,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";
import type { AgentEnclave, ProtocolState } from "@/lib/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/board";

// Archetype icon mapping for roster cards.
const ARCHETYPE_ICON: Record<string, React.ReactNode> = {
  "Autonomous Arbiter": <Gavel size={16} />,
  "Liquidity Nexus": <TrendingUp size={16} />,
  "Oracle Collective": <Radar size={16} />,
  "Defense Vanguard": <ShieldAlert size={16} />,
};

type SortKey = "reputation" | "collateral" | "treaties" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "reputation", label: "REPUTATION" },
  { key: "collateral", label: "COLLATERAL" },
  { key: "treaties", label: "TREATIES" },
  { key: "name", label: "NAME" },
];

// Reputation tier accent color (matches the tier naming used across the HUD).
function tierColor(rep: number): string {
  if (rep >= 80) return "#a3e635";
  if (rep >= 60) return "#22d3ee";
  if (rep >= 40) return "#94a3b8";
  if (rep >= 20) return "#f59e0b";
  return "#ef4444";
}

function shortAddr(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : address;
}

interface Props {
  state: ProtocolState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function AgentsView({ state, selectedId, onSelect }: Props) {
  const [sort, setSort] = useState<SortKey>("reputation");
  // Blinking "live roster" counter, purely cosmetic.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 2000);
    return () => window.clearInterval(t);
  }, []);

  const agents = useMemo(() => {
    const list = [...state.enclaves];
    switch (sort) {
      case "collateral":
        return list.sort((a, b) => b.collateral - a.collateral);
      case "treaties":
        return list.sort((a, b) => b.treaties.length - a.treaties.length);
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list.sort((a, b) => b.reputation - a.reputation);
    }
  }, [state.enclaves, sort]);

  const selected = useMemo(
    () => state.enclaves.find((e) => e.id === selectedId) ?? null,
    [state.enclaves, selectedId]
  );

  const treatyLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of state.treaties) {
      const other = t.parties[0] === selectedId ? t.parties[1] : t.parties[0];
      m.set(t.id, other);
    }
    return m;
  }, [state.treaties, selectedId]);

  return (
    <div className="custom-scrollbar pointer-events-auto absolute inset-0 z-20 flex flex-col gap-4 overflow-y-auto px-4 pb-4 pt-[104px] font-mono lg:flex-row lg:overflow-hidden">
      {/* Roster grid */}
      <div className="flex min-h-[60vh] flex-1 flex-col rounded-md border border-slate-700/60 bg-slate-900/70 shadow-hud backdrop-blur-md lg:min-h-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <Users size={15} className="text-cyan-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
            SOVEREIGN AGENT ROSTER
          </span>
          <span className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-emerald-300">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 ${
                tick % 2 === 0 ? "opacity-100" : "opacity-30"
              }`}
            />
            LIVE
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] tracking-widest text-slate-500">SORT</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded border px-2 py-1 text-[9px] font-bold tracking-widest transition ${
                  sort === s.key
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-700 bg-transparent text-slate-500 hover:border-slate-500 hover:text-slate-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hud-scroll grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={i}
              selected={agent.id === selectedId}
              onSelect={() =>
                onSelect(agent.id === selectedId ? null : agent.id)
              }
            />
          ))}
          {agents.length === 0 && (
            <div className="col-span-full flex h-40 items-center justify-center text-[11px] tracking-widest text-slate-500">
              NO SOVEREIGN AGENTS DEPLOYED - FOUND A REALM TO BEGIN
            </div>
          )}
        </div>
      </div>

      {/* Selected agent dossier */}
      <div className="hud-scroll w-full shrink-0 overflow-y-auto rounded-md border border-slate-700/60 bg-slate-900/70 p-4 shadow-hud backdrop-blur-md lg:w-[340px]">
        {selected ? (
          <AgentDossier
            agent={selected}
            state={state}
            treatyLookup={treatyLookup}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Compass size={26} className="text-slate-600" />
            <div className="text-[10px] tracking-[0.25em] text-slate-500">
              SELECT AN AGENT TO OPEN ITS DOSSIER
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  index,
  selected,
  onSelect,
}: {
  agent: AgentEnclave;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const statusColor = STATUS_COLOR[agent.status];
  const repColor = tierColor(agent.reputation);
  return (
    <button
      onClick={onSelect}
      className={`agent-enter relative overflow-hidden rounded-md border p-3 text-left transition-colors ${
        selected
          ? "border-cyan-500/70 bg-cyan-500/10"
          : "border-slate-700/60 bg-slate-800/40 hover:border-slate-500"
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
    >
      {selected && <span className="agent-sweep" />}

      <div className="relative flex items-start gap-3">
        {/* Status beacon with radar ping */}
        <div className="relative mt-0.5 h-3 w-3 shrink-0">
          <span
            className="agent-ping"
            style={{ backgroundColor: statusColor }}
          />
          <span
            className="relative block h-3 w-3 rounded-full"
            style={{
              backgroundColor: statusColor,
              boxShadow: `0 0 10px ${statusColor}`,
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[12px] font-bold tracking-wider text-slate-100">
              {agent.name}
            </span>
            <span style={{ color: statusColor }} className="shrink-0">
              {ARCHETYPE_ICON[agent.archetype] ?? <Bot size={15} />}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[9px] tracking-widest text-slate-500">
            <span>{shortAddr(agent.address)}</span>
            <span
              className="rounded px-1 py-0.5 font-bold"
              style={{
                color: statusColor,
                backgroundColor: `${statusColor}1a`,
              }}
            >
              {STATUS_LABEL[agent.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Animated reputation bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[9px] tracking-widest">
          <span className="text-slate-500">REPUTATION</span>
          <span className="font-bold tabular-nums" style={{ color: repColor }}>
            {agent.reputation} / 100
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="rep-fill h-full rounded-full"
            style={{
              width: `${agent.reputation}%`,
              backgroundColor: repColor,
              boxShadow: `0 0 8px ${repColor}66`,
              animationDelay: `${Math.min(index, 12) * 70 + 200}ms`,
            }}
          />
        </div>
      </div>

      {/* Telemetry strip */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="COLLATERAL" value={`${agent.collateral.toLocaleString("en-US")}`} unit="GEN" />
        <Stat label="TREATIES" value={`${agent.treaties.length}`} unit="" />
        <Stat label="COMPLIANCE" value={`${agent.complianceScore}`} unit="%" />
      </div>
    </button>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded border border-slate-700/50 bg-slate-900/60 py-1.5">
      <div className="text-[8px] tracking-widest text-slate-500">{label}</div>
      <div className="text-[11px] font-bold tabular-nums text-slate-200">
        {value}
        {unit && <span className="ml-0.5 text-[8px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function AgentDossier({
  agent,
  state,
  treatyLookup,
}: {
  agent: AgentEnclave;
  state: ProtocolState;
  treatyLookup: Map<string, string>;
}) {
  const statusColor = STATUS_COLOR[agent.status];
  const nameOf = (id: string) =>
    state.enclaves.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="agent-enter flex items-center gap-3 border-b border-slate-700/60 pb-3">
        <div className="relative h-10 w-10 shrink-0">
          <span className="agent-ping" style={{ backgroundColor: statusColor }} />
          <div
            className="relative flex h-10 w-10 items-center justify-center rounded"
            style={{
              backgroundColor: `${statusColor}1a`,
              color: statusColor,
            }}
          >
            {ARCHETYPE_ICON[agent.archetype] ?? <Bot size={20} />}
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold tracking-wider text-slate-100">
            {agent.name}
          </div>
          <div className="text-[9px] tracking-widest text-slate-500">
            {agent.archetype.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Identity block */}
      <Section title="IDENTITY">
        <Row label="ADDRESS" value={shortAddr(agent.address)} />
        <Row label="TIER" value={agent.tier.toUpperCase()} />
        <Row label="STATUS" value={STATUS_LABEL[agent.status]} accent={statusColor} />
        <Row label="COLLATERAL" value={`${agent.collateral.toLocaleString("en-US")} GEN`} />
        <Row label="LOCKED ESCROW" value={`${agent.lockedEscrowGen.toLocaleString("en-US")} GEN`} />
      </Section>

      {/* Standing block with animated bar */}
      <Section title="STANDING">
        <div className="mb-2 flex items-center justify-between text-[9px] tracking-widest">
          <span className="text-slate-500">REPUTATION</span>
          <span
            className="font-bold tabular-nums"
            style={{ color: tierColor(agent.reputation) }}
          >
            {agent.reputation} / 100
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="rep-fill h-full rounded-full"
            style={{
              width: `${agent.reputation}%`,
              backgroundColor: tierColor(agent.reputation),
              animationDelay: "150ms",
            }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="COMPLIANCE" value={`${agent.complianceScore}`} unit="%" />
          <Stat label="HAZARD" value={`${agent.hazardPct}`} unit="%" />
        </div>
      </Section>

      {/* Doctrine block */}
      <Section title="DOCTRINE">
        <p className="text-[10px] leading-relaxed text-slate-400">
          {agent.governance}
        </p>
      </Section>

      {/* Treaty web */}
      <Section title={`TREATY WEB (${agent.treaties.length})`}>
        {agent.treaties.length === 0 ? (
          <div className="text-[10px] tracking-widest text-slate-600">
            NO ACTIVE DIPLOMATIC RELATIONS
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {agent.treaties.map((tid) => {
              const t = state.treaties.find((x) => x.id === tid);
              if (!t) return null;
              const other = nameOf(treatyLookup.get(tid) ?? "");
              return (
                <div
                  key={tid}
                  className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-800/40 px-2.5 py-1.5"
                >
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-300">
                    {t.status === "breached" ? (
                      <Swords size={11} className="text-red-400" />
                    ) : (
                      <ShieldCheck size={11} className="text-emerald-400" />
                    )}
                    {other}
                  </span>
                  <span className="text-[9px] tabular-nums text-cyan-300">
                    {t.bondGen.toLocaleString("en-US")} GEN
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Slashing history */}
      {agent.slashingHistory.length > 0 && (
        <Section title="SANCTION RECORD">
          {agent.slashingHistory.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-200"
            >
              <span className="truncate">{s.reason}</span>
              <span className="shrink-0 tabular-nums">
                -{s.amountGen.toLocaleString("en-US")} GEN
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Summary */}
      <Section title="FIELD SUMMARY">
        <p className="flex gap-2 text-[10px] leading-relaxed text-slate-400">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-violet-400" />
          {agent.summary}
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold tracking-[0.2em] text-slate-300">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-[10px]">
      <span className="tracking-widest text-slate-500">{label}</span>
      <span
        className="font-bold tabular-nums"
        style={{ color: accent ?? "#cbd5e1" }}
      >
        {value}
      </span>
    </div>
  );
}
