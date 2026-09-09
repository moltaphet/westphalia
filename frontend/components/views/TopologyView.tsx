"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import type { ProtocolState, Treaty, TreatyKind } from "@/lib/types";
import { KIND_COLOR, STATUS_COLOR } from "@/lib/board";
import { orbitSlot } from "@/lib/world";

const KIND_FILTERS: { kind: TreatyKind; label: string }[] = [
  { kind: "trade", label: "TRADE" },
  { kind: "non-aggression", label: "NON-AGGRESSION" },
  { kind: "data-sharing", label: "ALLIANCE" },
];

interface Props {
  state: ProtocolState;
  selectedZone: string | null;
  selectedTreaty: string | null;
  onSelectZone: (id: string | null) => void;
  onSelectTreaty: (id: string | null) => void;
}

const K = 5.0; // world-units -> svg-units scale
const CX = 400;
const CY = 300;

export default function TopologyView({
  state,
  selectedZone,
  selectedTreaty,
  onSelectZone,
  onSelectTreaty,
}: Props) {
  // Project each enclave's orbital slot into 2D svg space.
  const pos = useMemo(() => {
    const m = new Map<string, [number, number]>();
    m.set("central", [CX, CY]);
    state.enclaves.forEach((e, i) => {
      const s = orbitSlot(i);
      m.set(e.id, [CX + s.x * K, CY + s.z * K]);
    });
    return m;
  }, [state.enclaves]);

  const maxBond = useMemo(
    () => Math.max(...state.treaties.map((t) => t.bondGen), 1),
    [state.treaties]
  );

  const [active, setActive] = useState<Set<TreatyKind>>(
    () => new Set<TreatyKind>(["trade", "non-aggression", "data-sharing"])
  );
  const toggleKind = (k: TreatyKind) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const visibleTreaties = state.treaties.filter((t) => active.has(t.kind));

  // Node hover: highlight bilateral treaties and dim unrelated nodes/edges.
  const [hovered, setHovered] = useState<string | null>(null);
  const connected = useMemo(() => {
    const set = new Set<string>();
    if (!hovered) return set;
    for (const t of state.treaties) {
      if (t.parties.includes(hovered)) {
        set.add(t.parties[0]);
        set.add(t.parties[1]);
      }
    }
    return set;
  }, [hovered, state.treaties]);

  const edge = (t: Treaty) => {
    const a = pos.get(t.parties[0]) ?? [CX, CY];
    const b = pos.get(t.parties[1]) ?? [CX, CY];
    const width = 1.5 + (t.bondGen / maxBond) * 6;
    const color = KIND_COLOR[t.kind] ?? "#22d3ee";
    const disputed = t.status === "pending" || t.status === "breached";
    const strokeColor = t.status === "breached" ? "#ef4444" : disputed ? "#f59e0b" : color;
    return { a, b, width, strokeColor, animated: t.status === "active" };
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex gap-4 px-4 pb-4 pt-[104px] font-mono">
      <div className="flex min-h-0 flex-1 flex-col rounded-md border border-slate-700/60 bg-slate-900/70 shadow-hud backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <Share2 size={15} className="text-cyan-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
            DIPLOMATIC TOPOLOGY
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {KIND_FILTERS.map((f) => {
              const on = active.has(f.kind);
              const c = KIND_COLOR[f.kind];
              return (
                <button
                  key={f.kind}
                  onClick={() => toggleKind(f.kind)}
                  className="flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] font-bold tracking-widest transition"
                  style={{
                    color: on ? c : "#64748b",
                    borderColor: on ? `${c}66` : "#334155",
                    backgroundColor: on ? `${c}1a` : "transparent",
                  }}
                >
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: on ? c : "#475569" }} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <svg viewBox="0 0 800 600" className="h-full w-full">
            <defs>
              <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {visibleTreaties.map((t) => {
              const { a, b, width, strokeColor, animated } = edge(t);
              const sel = t.id === selectedTreaty;
              const dim = hovered !== null && !t.parties.includes(hovered);
              const op = dim ? 0.1 : sel ? 1 : 0.72;
              return (
                <g key={t.id} opacity={op}>
                  <line
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                    stroke={strokeColor}
                    strokeWidth={sel ? width + 2 : width}
                    className={animated && !dim ? "flow-dash" : undefined}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSelectTreaty(t.id)}
                  />
                  {!dim && (
                    <circle r={sel ? 4 : 3} fill={strokeColor} style={{ pointerEvents: "none" }}>
                      <animateMotion
                        dur={`${2.4 + (t.bondGen % 5) * 0.3}s`}
                        repeatCount="indefinite"
                        path={`M${a[0]},${a[1]} L${b[0]},${b[1]}`}
                      />
                      <animate
                        attributeName="opacity"
                        values="0.2;1;0.2"
                        dur="1.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* central hub */}
            <g onClick={() => onSelectZone(null)} style={{ cursor: "pointer" }} opacity={hovered ? 0.4 : 1}>
              <circle cx={CX} cy={CY} r={26} fill="#22d3ee22" stroke="#22d3ee" strokeWidth={1.5} filter="url(#nodeGlow)" />
              <circle cx={CX} cy={CY} r={6} fill="#22d3ee" />
              <text x={CX} y={CY + 42} textAnchor="middle" fill="#cbd5e1" fontSize={12} fontFamily="ui-monospace, monospace">
                GENEVA HUB
              </text>
            </g>

            {state.enclaves.map((e) => {
              const [x, y] = pos.get(e.id) ?? [CX, CY];
              const color = STATUS_COLOR[e.status];
              const active = e.id === selectedZone;
              const r = 24;
              const dim = hovered !== null && hovered !== e.id && !connected.has(e.id);
              return (
                <g
                  key={e.id}
                  opacity={dim ? 0.25 : 1}
                  onClick={() => onSelectZone(e.id)}
                  onMouseEnter={() => setHovered(e.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={r + (active || hovered === e.id ? 6 : 0)}
                    fill={`${color}22`}
                    stroke={color}
                    strokeWidth={active || hovered === e.id ? 3 : 1.5}
                    filter="url(#nodeGlow)"
                  />
                  <circle cx={x} cy={y} r={6} fill={color} />
                  <text x={x} y={y + r + 14} textAnchor="middle" fill="#cbd5e1" fontSize={11} fontFamily="ui-monospace, monospace">
                    {e.name}
                  </text>
                  <text x={x} y={y + r + 27} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="ui-monospace, monospace">
                    {e.collateral.toLocaleString("en-US")} GEN
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

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
              .map((p) => state.enclaves.find((s) => s.id === p)?.name ?? p)
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
  const ids = state.enclaves.map((s) => s.id);
  const label = (id: string) => state.enclaves.find((s) => s.id === id)?.name.split(" ")[0] ?? id;

  const relation = (a: string, b: string): { txt: string; color: string } => {
    if (a === b) return { txt: "-", color: "#334155" };
    const t = state.treaties.find((tt) => tt.parties.includes(a) && tt.parties.includes(b));
    if (!t) return { txt: ".", color: "#475569" };
    if (t.status === "breached") return { txt: "X", color: "#ef4444" };
    if (t.status === "pending") return { txt: "?", color: "#f59e0b" };
    return { txt: "+", color: "#10b981" };
  };

  return (
    <div className="hud-scroll overflow-auto rounded border border-slate-700/60">
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
