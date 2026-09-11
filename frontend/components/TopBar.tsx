"use client";

import { useState } from "react";
import {
  Activity,
  Banknote,
  ChevronDown,
  Coins,
  Film,
  Gavel,
  Globe2,
  Landmark,
  Network,
  Plus,
  Radio,
  Share2,
  Users,
  Wallet,
} from "lucide-react";
import type { AppView, ChainOverview, NetworkConfig, ProtocolState } from "@/lib/types";
import { attoToGen } from "@/lib/contract";
import { NETWORKS } from "@/lib/networks";

function Divider() {
  return <span className="h-5 w-px bg-zinc-800" />;
}

function StabilityGauge({ value }: { value: number }) {
  const color = value >= 75 ? "#10b981" : value >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[9px] tracking-widest text-slate-400">
        <Activity size={11} /> STABILITY INDEX
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${value}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {value}%
        </span>
      </div>
    </div>
  );
}

const TABS: { id: AppView; label: string; icon: React.ReactNode }[] = [
  { id: "world", label: "Tactical 3D World", icon: <Globe2 size={13} /> },
  { id: "agents", label: "Agent Roster", icon: <Users size={13} /> },
  { id: "topology", label: "Diplomatic Topology", icon: <Share2 size={13} /> },
  { id: "tribunal", label: "Consensus Tribunal", icon: <Gavel size={13} /> },
  { id: "treasury", label: "Treasury & Escrow", icon: <Banknote size={13} /> },
];

export default function TopBar({
  state,
  network,
  connected,
  reviewerMode,
  chainOverview,
  view,
  onView,
  onSetNetwork,
  onConnect,
  onEnterReviewer,
  onFound,
  cinematic,
  onToggleCinematic,
}: {
  state: ProtocolState;
  network: NetworkConfig;
  connected: boolean;
  reviewerMode: boolean;
  chainOverview: ChainOverview | null;
  view: AppView;
  onView: (v: AppView) => void;
  onSetNetwork: (n: NetworkConfig) => void;
  onConnect: () => void;
  onEnterReviewer: () => void;
  onFound: () => void;
  cinematic: boolean;
  onToggleCinematic: () => void;
}) {
  const [netOpen, setNetOpen] = useState(false);
  // Live on-chain escrow (atto -> whole GEN) replaces the simulated TVL
  // whenever the wallet is connected and the overview has synced.
  const liveTvlGen = chainOverview ? attoToGen(chainOverview.lockedEscrow) : null;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 w-full border-b border-zinc-800/60 bg-zinc-950/90 font-mono shadow-2xl backdrop-blur-xl">
      {/* Tier 1: tactical command bar */}
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left cluster: brand + live core beacon */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
            <Landmark size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-[0.2em] text-slate-100">
                WESTPHALIA
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulseGlow" />
            </div>
            <div className="text-[9px] tracking-[0.3em] text-slate-500">
              GENLAYER v0.3.0 CORE
            </div>
          </div>
        </div>

        {/* Center cluster: protocol telemetry with breathing dividers */}
        <div className="hidden items-center gap-4 lg:flex">
          <StabilityGauge value={state.stabilityIndex} />
          <Divider />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[9px] tracking-widest text-slate-400">
              <Coins size={11} /> TOTAL VALUE LOCKED
            </div>
            <div className="text-[13px] font-bold tabular-nums text-cyan-300">
              {liveTvlGen !== null
                ? `${liveTvlGen.toLocaleString("en-US", { maximumFractionDigits: 1 })} GEN (chain)`
                : `${state.totalEscrowGen.toLocaleString("en-US")} GEN`}
            </div>
          </div>
          <Divider />
          <div className="flex flex-col gap-1">
            <div className="text-[9px] tracking-widest text-slate-400">SOVEREIGNTIES</div>
            <div className="text-[13px] font-bold tabular-nums text-emerald-300">
              {state.enclaves.length}
            </div>
          </div>
          {chainOverview && (
            <>
              <Divider />
              <div className="flex flex-col gap-1">
                <div className="text-[9px] tracking-widest text-slate-400">SOLVENCY</div>
                <div
                  className={`text-[13px] font-bold tabular-nums ${
                    chainOverview.solvent ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {chainOverview.solvent ? "OK" : "DEFICIT"}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right cluster: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onFound}
            className="flex items-center gap-1.5 rounded border border-emerald-400/60 bg-emerald-500/15 px-3 py-2 text-[11px] font-bold tracking-widest text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.35)] hover:bg-emerald-500/25"
          >
            <Plus size={14} /> <span className="hidden xl:inline">FOUND SOVEREIGNTY</span>
            <span className="xl:hidden">FOUND</span>
          </button>

          <button
            onClick={onToggleCinematic}
            title="Collapse both side panels for a full-viewport cinematic view"
            className={`flex items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-bold tracking-widest transition ${
              cinematic
                ? "border-violet-400/60 bg-violet-500/25 text-violet-100 shadow-[0_0_16px_rgba(167,139,250,0.4)]"
                : "border-zinc-700 bg-zinc-900/70 text-slate-300 hover:border-violet-400/60 hover:text-violet-100"
            }`}
          >
            <Film size={14} /> <span className="hidden md:inline">CINEMATIC</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setNetOpen((o) => !o)}
              className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-[11px] text-slate-200 hover:border-cyan-500/60"
            >
              <Network size={13} className="text-cyan-400" />
              <span className="hidden xl:inline">{network.label}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-amber-400"
                } animate-pulseGlow`}
              />
              <ChevronDown size={12} />
            </button>
            {netOpen && (
              <div className="absolute right-0 top-full z-[60] mt-1 w-64 rounded border border-zinc-700 bg-zinc-950 p-1 shadow-2xl">
                {NETWORKS.map((n) => (
                  <button
                    key={n.key}
                    onClick={() => {
                      onSetNetwork(n);
                      setNetOpen(false);
                    }}
                    className={`flex w-full flex-col items-start rounded px-3 py-2 text-left hover:bg-zinc-800 ${
                      n.key === network.key ? "bg-zinc-800" : ""
                    }`}
                  >
                    <span className="text-[11px] text-slate-200">{n.label}</span>
                    <span className="text-[9px] text-slate-500">
                      chain {n.chainId} - {n.rpcUrl}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {reviewerMode && !connected && (
            <button
              onClick={onEnterReviewer}
              title="Read-only simulation mode"
              className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-bold tracking-widest text-amber-300 hover:bg-amber-500/20"
            >
              <Radio size={12} /> <span className="hidden md:inline">REVIEWER</span>
            </button>
          )}

          {connected ? (
            <span className="flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
              <Wallet size={13} /> LINKED
            </span>
          ) : (
            <button
              onClick={onConnect}
              className="flex items-center gap-1 rounded border border-cyan-500/50 bg-cyan-500/15 px-3 py-2 text-[11px] text-cyan-200 hover:bg-cyan-500/25"
            >
              <Wallet size={13} /> CONNECT
            </button>
          )}
        </div>
      </div>

      {/* Tier 2: workspace tab strip */}
      <div className="flex h-10 items-center gap-2 border-t border-zinc-900 bg-zinc-950/60 px-6">
        {TABS.map((t) => {
          const active = t.id === view;
          return (
            <button
              key={t.id}
              onClick={() => onView(t.id)}
              className={`flex items-center gap-2 rounded px-4 py-1.5 text-[11px] font-bold tracking-widest transition ${
                active
                  ? "bg-cyan-500/15 text-cyan-200 shadow-[inset_0_-2px_0_0_rgba(34,211,238,0.9)]"
                  : "text-slate-400 hover:bg-zinc-900/70 hover:text-slate-200"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
