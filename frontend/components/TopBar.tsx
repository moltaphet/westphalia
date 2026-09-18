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
  Info,
  Network,
  Plus,
  Radio,
  Share2,
  Users,
} from "lucide-react";
import type {
  AppView,
  ChainOverview,
  NetworkConfig,
  ProtocolState,
  StateSource,
} from "@/lib/types";
import { attoToGen } from "@/lib/contract";
import { NETWORKS } from "@/lib/networks";
import type { WalletBundle } from "@/lib/store";
import WalletConnect from "./WalletConnect";

function Divider() {
  return <span className="h-5 w-px bg-zinc-800" />;
}

function StabilityGauge({ value, pending }: { value: number; pending: boolean }) {
  const color = value >= 75 ? "#10b981" : value >= 45 ? "#f59e0b" : "#ef4444";
  // Before the first read resolves there is no index to report. An empty board
  // averages to zero, which would render as a red 0% -- a claim about protocol
  // health that nothing has measured yet.
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[9px] tracking-widest text-slate-400">
        <Activity size={11} /> STABILITY INDEX
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: pending ? "0%" : `${value}%`,
              backgroundColor: pending ? "#71717a" : color,
            }}
          />
        </div>
        <span
          className="text-[11px] font-bold tabular-nums"
          style={{ color: pending ? "#71717a" : color }}
        >
          {pending ? "--" : `${value}%`}
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
  stateSource,
  isSyncing,
  chainOverview,
  view,
  onView,
  onSetNetwork,
  wallet,
  onEnterReviewer,
  onFound,
  cinematic,
  onToggleCinematic,
  onAbout,
}: {
  state: ProtocolState;
  network: NetworkConfig;
  connected: boolean;
  reviewerMode: boolean;
  stateSource: StateSource;
  isSyncing: boolean;
  chainOverview: ChainOverview | null;
  view: AppView;
  onView: (v: AppView) => void;
  onSetNetwork: (n: NetworkConfig) => void;
  wallet: WalletBundle;
  onEnterReviewer: () => void;
  onFound: () => void;
  cinematic: boolean;
  onToggleCinematic: () => void;
  onAbout: () => void;
}) {
  const [netOpen, setNetOpen] = useState(false);
  // Live on-chain escrow (atto -> whole GEN) replaces the simulated TVL
  // whenever the wallet is connected and the overview has synced.
  const liveTvlGen = chainOverview ? attoToGen(chainOverview.lockedEscrow) : null;
  // Nothing has answered the chain yet, so every figure below is the sum of an
  // empty board rather than a measurement. They read as placeholders, not zero.
  const pending = stateSource === "loading";

  return (
    <header className="fixed left-0 right-0 top-0 z-50 w-full border-b border-zinc-800/60 bg-zinc-950/90 font-mono shadow-2xl backdrop-blur-xl">
      {/* Tier 1: tactical command bar */}
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left cluster: brand + live core beacon */}
        <div className="flex items-center gap-3">
          {/* The mark carries its own plate, so it is placed as-is: no tinted
              backing, no padding, and no rounding to crop it against. It is an
              <img> rather than inline SVG because the file defines gradient and
              filter ids (wGlowGrad, heavyGlow, hexBracket); inlining would put
              those in the document's global id space and collide with any
              second copy. */}
          <img src="/w.svg" alt="Westphalia" className="h-9 w-9 object-cover" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-[0.2em] text-slate-100">
                WESTPHALIA
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulseGlow" />
            </div>
            <div className="flex items-center gap-2 text-[9px] tracking-[0.3em] text-slate-500">
              <span>GENLAYER v0.3.0 CORE</span>
              {/* Where the islands and treaties on screen came from. Without
                  this a viewer cannot tell the live archipelago apart from the
                  reviewer-mode seed, and the TVL figure alone does not say. */}
              <span
                title={
                  stateSource === "loading"
                    ? "Reading the deployed contract. The board stays empty until it answers."
                    : stateSource === "simulated"
                      ? "The deployed contract could not be reached, so this board is seed data."
                      : stateSource === "empty"
                        ? "The deployed contract answered and has no sovereignties founded yet."
                        : "Islands and treaties read from the deployed contract."
                }
                className={`rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.2em] ${
                  stateSource === "live"
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                    : stateSource === "empty"
                      ? "border-zinc-600 bg-zinc-800/60 text-slate-400"
                      : stateSource === "loading"
                        ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-300"
                        : "border-amber-400/50 bg-amber-500/15 text-amber-300"
                }`}
              >
                {stateSource === "live"
                  ? "ON-CHAIN"
                  : stateSource === "empty"
                    ? "ON-CHAIN / EMPTY"
                    : stateSource === "loading"
                      ? "READING CHAIN"
                      : "SIMULATED"}
              </span>
              {/* Subtle, non-blocking sync indicator: shown while a background
                  refresh is in flight over the (cached or empty) board. Never an
                  opaque backdrop -- the board stays fully interactive. */}
              {isSyncing && (
                <span
                  title="Refreshing protocol state from the deployed contract."
                  className="flex items-center gap-1 text-[8px] font-bold tracking-[0.2em] text-cyan-300/80"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulseGlow" />
                  SYNCING ON-CHAIN...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center cluster: protocol telemetry with breathing dividers */}
        <div className="hidden items-center gap-4 lg:flex">
          <StabilityGauge value={state.stabilityIndex} pending={pending} />
          <Divider />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[9px] tracking-widest text-slate-400">
              <Coins size={11} /> TOTAL VALUE LOCKED
            </div>
            <div className="text-[13px] font-bold tabular-nums text-cyan-300">
              {pending ? (
                <span className="text-zinc-500">--</span>
              ) : liveTvlGen !== null ? (
                `${liveTvlGen.toLocaleString("en-US", { maximumFractionDigits: 1 })} GEN (chain)`
              ) : (
                `${state.totalEscrowGen.toLocaleString("en-US")} GEN`
              )}
            </div>
          </div>
          <Divider />
          <div className="flex flex-col gap-1">
            <div className="text-[9px] tracking-widest text-slate-400">SOVEREIGNTIES</div>
            <div className="text-[13px] font-bold tabular-nums text-emerald-300">
              {pending ? <span className="text-zinc-500">--</span> : state.enclaves.length}
            </div>
          </div>
          {chainOverview && (
            <>
              <Divider />
              <div className="flex flex-col gap-1">
                <div className="text-[9px] tracking-widest text-slate-400">SOLVENCY</div>
                <div
                  className={`flex w-fit items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-bold tracking-widest tabular-nums ${
                    chainOverview.solvent
                      ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                      : "border-red-500/40 bg-red-950/30 text-red-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      chainOverview.solvent ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
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

          <button
            onClick={onAbout}
            title="What this protocol is, how a dispute settles, and where the source lives"
            className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-[11px] font-bold tracking-widest text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-100"
          >
            <Info size={14} /> <span className="hidden sm:inline">ABOUT</span>
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

          <WalletConnect wallet={wallet} network={network} enclaves={state.enclaves} />
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
