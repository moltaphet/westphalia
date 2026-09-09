"use client";

import { useMemo } from "react";
import { Share2 } from "lucide-react";
import type { ProtocolState, Treaty } from "@/lib/types";
import { KIND_COLOR, STATUS_COLOR } from "@/lib/board";

interface Props {
  state: ProtocolState;
  selectedZone: string | null;
  selectedTreaty: string | null;
  onSelectZone: (id: string | null) => void;
  onSelectTreaty: (id: string | null) => void;
}

// Fixed 2D layout mirroring the archipelago geography.
const NODE_POS: Record<string, [number, number]> = {
  central: [400, 300],
  alpha: [150, 300],
  vanguard: [400, 100],
  enclave: [400, 500],
  bastion: [650, 300],
};

function statusColorFor(status: string) {
  return STATUS_COLOR[status as keyof typeof STATUS_COLOR] ?? "#64748b";
}

export default function TopologyView({
  state,
  selectedZone,
  selectedTreaty,
  onSelectZone,
  onSelectTreaty,
}: Props) {
  const maxBond = useMemo(
    () => Math.max(...state.treaties.map((t) => t.bondGen), 1),
    [state.treaties]
  );

  const edge = (t: Treaty) => {
    const a = NODE_POS[t.parties[0]] ?? NODE_POS.central;
    const b = NODE_POS[t.parties[1]] ?? NODE_POS.central;
    const width = 1.5 + (t.bondGen / maxBond) * 6;
    const color = KIND_COLOR[t.kind] ?? "#22d3ee";
    const disputed = t.status === "pending" || t.status === "breached";
    const strokeColor = t.status === "breached" ? "#ef4444" : disputed ? "#f59e0b" : color;
    return { a, b, width, strokeColor, animated: t.status === "active" };
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex gap-4 px-4 pb-4 pt-[132px] font-mono">
      {/* Node graph */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border border-slate-700/60 bg-slate-900/70 shadow-hud backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <Share2 size={15} className="text-cyan-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
            DIPLOMATIC TOPOLOGY
          </span>
          <span className="ml-auto text-[9px] tracking-widest text-slate-500">
            MULTILATERAL TREATY VECTORS - EDGE WIDTH = TRADE VOLUME
          </span>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <svg viewBox="0 0 800 600" className="h-full w-full">
            {/* edges */}
            {state.treaties.map((t) => {
              const { a, b, width, strokeColor, animated } = edge(t);
              const active = t.id === selectedTreaty;
              return (
                <g key={t.id} onClick={() => onSelectTreaty(t.id)} style={{ cursor: "pointer" }}>
                  <line
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                    stroke={strokeColor}
                    strokeWidth={active ? width + 2 : width}
                    strokeOpacity={active ? 1 : 0.7}
                    className={animated ? "flow-dash" : undefined}
                  />
                </g>
              );
            })}

            {/* nodes */}
            {Object.entries(NODE_POS).map(([id, [x, y]]) => {
              const sov = state.sovereignties.find((s) => s.id === id);
              const isCentral = id === "central";
              const color = isCentral ? "#22d3ee" : statusColorFor(sov?.status ?? "stable");
              const active = id === selectedZone;
              const r = isCentral ? 30 : 26;
              return (
                <g
                  key={id}
                  onClick={() => onSelectZone(isCentral ? null : id)}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={x} cy={y} r={r + (active ? 6 : 0)} fill={`${color}22`} stroke={color} strokeWidth={active ? 3 : 1.5} />
                  <circle cx={x} cy={y} r={6} fill={color} />
                  <text x={x} y={y + r + 16} textAnchor="middle" fill="#cbd5e1" fontSize={12} fontFamily="ui-monospace, monospace">
                    {isCentral ? "GENEVA HUB" : sov?.name ?? id}
                  </text>
                  {sov && (
                    <text x={x} y={y + r + 30} textAnchor="middle" fill="#64748b" fontSize={10} fontFamily="ui-monospace, monospace">
                      {sov.stakeGen.toLocaleString("en-US")} GEN staked
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Matrix + flows */}
      <div className="hud-scroll w-[320px] shrink-0 overflow-y-auto rounded-md border border-slate-700/60 bg-slate-900/70 p-4 shadow-hud backdrop-blur-md">
        <div className="mb-2 text-[11px] font-bold tracking-[0.2em] text-slate-200">
          NON-AGGRESSION MATRIX
        </div>
        <NonAggressionMatrix state={state} />

        <div className="mb-2 mt-5 text-[11px] font-bold tracking-[0.2em] text-slate-200">
          TRADE VOLUME FLOWS
        </div>
        <div className="flex flex-col gap-2">
          {state.treaties.map((t) => {
            const color = KIND_COLOR[t.kind] ?? "#22d3ee";
            const names = t.parties
              .map((p) => state.sovereignties.find((s) => s.id === p)?.name ?? p)
              .join(" -> ");
            return (
              <button
                key={t.id}
                onClick={() => onSelectTreaty(t.id)}
                className={`rounded border px-3 py-2 text-left transition ${
                  t.id === selectedTreaty
                    ? "border-cyan-500/60 bg-cyan-500/10"
                    : "border-slate-700/60 bg-slate-800/40 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
                    {t.kind}
                  </span>
                  <span className="text-[10px] tabular-nums text-cyan-300">
                    {t.bondGen.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="text-[11px] text-slate-200">{names}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NonAggressionMatrix({ state }: { state: ProtocolState }) {
  const ids = state.sovereignties.map((s) => s.id);
  const label = (id: string) => state.sovereignties.find((s) => s.id === id)?.name.split(" ")[0] ?? id;

  const relation = (a: string, b: string): { txt: string; color: string } => {
    if (a === b) return { txt: "-", color: "#334155" };
    const t = state.treaties.find(
      (tt) => tt.parties.includes(a) && tt.parties.includes(b)
    );
    if (!t) return { txt: ".", color: "#475569" };
    if (t.status === "breached") return { txt: "X", color: "#ef4444" };
    if (t.status === "pending") return { txt: "?", color: "#f59e0b" };
    return { txt: "+", color: "#10b981" };
  };

  return (
    <div className="overflow-hidden rounded border border-slate-700/60">
      <table className="w-full border-collapse text-center text-[10px]">
        <thead>
          <tr className="bg-slate-800/60 text-slate-400">
            <th className="p-1.5" />
            {ids.map((id) => (
              <th key={id} className="p-1.5 font-normal">
                {label(id).slice(0, 4)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((a) => (
            <tr key={a}>
              <td className="bg-slate-800/60 p-1.5 text-slate-400">{label(a).slice(0, 4)}</td>
              {ids.map((b) => {
                const r = relation(a, b);
                return (
                  <td key={b} className="p-1.5 font-bold" style={{ color: r.color }}>
                    {r.txt}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
