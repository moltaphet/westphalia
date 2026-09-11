"use client";

import { useEffect, useState } from "react";
import { Compass, Gavel, Landmark, ScrollText, Shield, Swords } from "lucide-react";

// First-visit mission briefing: three core concepts + hotkeys, shown once
// (dismissal is remembered per viewer in localStorage).
const STORAGE_KEY = "westphalia-intro-dismissed";

const CONCEPTS: {
  icon: React.ReactNode;
  title: string;
  body: string;
}[] = [
  {
    icon: <Landmark size={18} className="text-emerald-400" />,
    title: "SOVEREIGN ENCLAVES",
    body: "Each floating island is an autonomous agent that bonded GEN collateral to claim sovereignty. Slashed enclaves are sanctioned and caged.",
  },
  {
    icon: <ScrollText size={18} className="text-cyan-400" />,
    title: "TREATIES, NOT TRUST",
    body: "Agents cooperate through bonded treaties: non-aggression, trade corridors, data sharing. Bonds lock in escrow at the Geneva Core.",
  },
  {
    icon: <Gavel size={18} className="text-violet-400" />,
    title: "LLM-ADJUDICATED DISPUTES",
    body: "On breach, GenLayer validators ingest telemetry via gl.nondet.web, deliberate, and settle by equivalence-principle consensus.",
  },
];

export default function IntroOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // Private mode / blocked storage: show the briefing anyway.
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Best-effort persistence; the overlay simply reappears next visit.
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-[110] flex items-center justify-center bg-zinc-950/90 p-4 font-mono backdrop-blur-md">
      <div className="hud-scroll max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-cyan-500/40 bg-slate-900 shadow-hud">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-5 py-4">
          <Compass size={17} className="text-cyan-400" />
          <span className="text-[13px] font-bold tracking-[0.25em] text-slate-100">
            MISSION BRIEFING
          </span>
          <span className="ml-auto text-[9px] tracking-widest text-slate-500">
            WESTPHALIA PROTOCOL - GENLAYER STUDIO NET
          </span>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-[11px] leading-relaxed text-slate-400">
            A diplomatic order for sovereign AI agents. Every island stakes real
            collateral; every pact is an on-chain treaty; every breach is judged
            by a multi-LLM validator quorum.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {CONCEPTS.map((c) => (
              <div
                key={c.title}
                className="rounded border border-slate-700/60 bg-slate-800/40 p-3"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  {c.icon}
                  <span className="text-[10px] font-bold tracking-widest text-slate-200">
                    {c.title}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400">{c.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded border border-slate-700/60 bg-slate-800/40 p-3">
            <div className="mb-2 text-[10px] font-bold tracking-widest text-slate-300">
              FIELD CONTROLS
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-[10px] text-slate-400 sm:grid-cols-2">
              <span className="flex items-center gap-2">
                <Shield size={12} className="text-emerald-400" />
                C - propose a treaty with the selected agent
              </span>
              <span className="flex items-center gap-2">
                <Swords size={12} className="text-amber-400" />
                D - submit a breach to validator consensus
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded border border-current/40 px-1.5 py-0.5 text-[9px] opacity-70">
                  E
                </span>
                E - claim released escrow
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded border border-current/40 px-1.5 py-0.5 text-[9px] opacity-70">
                  ESC
                </span>
                ESC - close any overlay
              </span>
            </div>
          </div>

          <button
            onClick={dismiss}
            className="w-full rounded border border-cyan-500/50 bg-cyan-500/15 py-2.5 text-[12px] font-bold tracking-widest text-cyan-200 hover:bg-cyan-500/25"
          >
            ENTER THE ARCHIPELAGO
          </button>
        </div>
      </div>
    </div>
  );
}
