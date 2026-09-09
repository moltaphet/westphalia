"use client";

import { useState } from "react";
import {
  Activity,
  Banknote,
  ChevronDown,
  Coins,
  Gavel,
  Globe2,
  Landmark,
  Network,
  Plus,
  Radio,
  Share2,
  Wallet,
} from "lucide-react";
import type { AppView, NetworkConfig, ProtocolState } from "@/lib/types";
import { NETWORKS } from "@/lib/networks";

function StabilityGauge({ value }: { value: number }) {
  const color = value >= 75 ? "#10b981" : value >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400">
        <Activity size={12} /> PROTOCOL STABILITY INDEX
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${value}%`, backgroundColor: color }}
          />
        </div>
        <span className="font-bold tabular-nums" style={{ color }}>
          {value}%
        </span>
      </div>
    </div>
  );
}

const TABS: { id: AppView; label: string; icon: React.ReactNode }[] = [
  { id: "world", label: "Tactical 3D World", icon: <Globe2 size={13} /> },
  { id: "topology", label: "Diplomatic Topology", icon: <Share2 size={13} /> },
  { id: "tribunal", label: "Consensus Tribunal", icon: <Gavel size={13} /> },
  { id: "treasury", label: "Treasury & Escrow", icon: <Banknote size={13} /> },
];

export default function TopBar({
  state,
  network,
  connected,
  reviewerMode,
  view,
  onView,
  onSetNetwork,
  onConnect,
  onEnterReviewer,
  onFound,
}: {
  state: ProtocolState;
  network: NetworkConfig;
  connected: boolean;
  reviewerMode: boolean;
  view: AppView;
  onView: (v: AppView) => void;
  onSetNetwork: (n: NetworkConfig) => void;
  onConnect: () => void;
  onEnterReviewer: () => void;
  onFound: () => void;
}) {
  const [netOpen, setNetOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex flex-col items-center gap-2 px-4 pt-4 font-mono">
      <div className="pointer-events-auto relative z-30 flex w-full max-w-7xl items-center justify-between gap-5 rounded-md border border-slate-700/60 bg-slate-900/85 px-5 py-3 shadow-hud backdrop-blur-md">
        {/* Scanline clips itself via its own overflow-hidden container so it
            never clips the network dropdown that overflows the command bar. */}
        <div className="scanline rounded-md" />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
            <Landmark size={18} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-[0.2em] text-slate-100">WESTPHALIA</div>
            <div className="text-[9px] tracking-[0.3em] text-slate-500">DIPLOMATIC PROTOCOL</div>
          </div>
        </div>

        <StabilityGauge value={state.stabilityIndex} />

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400">
            <Coins size={12} /> TOTAL VALUE LOCKED
          </div>
          <div className="font-bold tabular-nums text-cyan-300">
            {state.totalEscrowGen.toLocaleString("en-US")} GEN
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[10px] tracking-widest text-slate-400">SOVEREIGNTIES</div>
          <div className="font-bold tabular-nums text-emerald-300">{state.enclaves.length}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onFound}
            className="flex items-center gap-1.5 rounded border border-emerald-400/60 bg-emerald-500/20 px-3 py-2 text-[11px] font-bold tracking-widest text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.35)] hover:bg-emerald-500/30"
          >
            <Plus size={14} /> FOUND SOVEREIGNTY
          </button>

          <div className="relative">
            <button
              onClick={() => setNetOpen((o) => !o)}
              className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/70 px-3 py-2 text-[11px] text-slate-200 hover:border-cyan-500/60"
            >
              <Network size={13} className="text-cyan-400" />
              <span className="hidden lg:inline">{network.label}</span>
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"} animate-pulseGlow`}
              />
              <ChevronDown size={12} />
            </button>
            {netOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded border border-slate-700 bg-slate-900 p-1 shadow-hud">
                {NETWORKS.map((n) => (
                  <button
                    key={n.key}
                    onClick={() => {
                      onSetNetwork(n);
                      setNetOpen(false);
                    }}
                    className={`flex w-full flex-col items-start rounded px-3 py-2 text-left hover:bg-slate-800 ${
                      n.key === network.key ? "bg-slate-800" : ""
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
              className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-bold tracking-widest text-amber-300 hover:bg-amber-500/20"
            >
              <Radio size={13} /> REVIEWER
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

      <div className="pointer-events-auto relative z-10 flex w-full max-w-7xl items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/70 p-1 shadow-hud backdrop-blur-md">
        {TABS.map((t) => {
          const active = t.id === view;
          return (
            <button
              key={t.id}
              onClick={() => onView(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-[11px] font-bold tracking-widest transition ${
                active
                  ? "bg-cyan-500/15 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
