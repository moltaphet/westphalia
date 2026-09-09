"use client";

import { useState } from "react";
import { Rocket, X } from "lucide-react";
import type { Archetype } from "@/lib/types";
import type { FoundRealmInput } from "@/lib/store";
import { ARCHETYPE_PRESETS } from "@/lib/store";

const ARCHETYPES: Archetype[] = [
  "Autonomous Arbiter",
  "Liquidity Nexus",
  "Oracle Collective",
  "Defense Vanguard",
];

const inputCls =
  "w-full rounded border border-slate-700 bg-slate-800/70 px-3 py-2 text-[12px] text-slate-100 outline-none focus:border-cyan-500/60";

export default function FoundRealmModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: FoundRealmInput) => void;
}) {
  const [name, setName] = useState("Aegis Sentinel Omega");
  const [archetype, setArchetype] = useState<Archetype>("Defense Vanguard");
  const [collateral, setCollateral] = useState(60000);
  const [governance, setGovernance] = useState(
    "Auto-accept non-aggression and trade pacts with counterparties above 80 percent compliance; route any breach to GenLayer quorum."
  );

  return (
    <div className="pointer-events-auto absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md font-mono">
      <div className="w-full max-w-lg rounded-lg border border-emerald-500/40 bg-slate-900 shadow-hud">
        <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Rocket size={16} className="text-emerald-400" />
            <span className="text-[12px] font-bold tracking-[0.2em] text-slate-100">
              FOUND SOVEREIGNTY
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] tracking-widest text-slate-400">
              ENCLAVE / AGENT NAME
            </span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] tracking-widest text-slate-400">
              SOVEREIGN ARCHETYPE
            </span>
            <select
              className={inputCls}
              value={archetype}
              onChange={(e) => setArchetype(e.target.value as Archetype)}
            >
              {ARCHETYPES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-slate-500">
              {ARCHETYPE_PRESETS[archetype].blurb} - base yield{" "}
              {ARCHETYPE_PRESETS[archetype].yieldApr}% APR
            </span>
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] tracking-widest text-slate-400">
              INITIAL SOVEREIGN COLLATERAL (GEN)
            </span>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={collateral}
              onChange={(e) => setCollateral(Number(e.target.value))}
            />
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] tracking-widest text-slate-400">
              GOVERNANCE PHILOSOPHY / AUTO-ACCEPT TREATY RULES
            </span>
            <textarea
              className={`${inputCls} h-24 resize-none`}
              value={governance}
              onChange={(e) => setGovernance(e.target.value)}
            />
            <span className="mt-1 block text-[10px] text-slate-500">
              Parsed by GenLayer validators to auto-evaluate incoming treaties.
            </span>
          </label>

          <button
            onClick={() => onSubmit({ name, archetype, collateral, governance })}
            disabled={!name.trim() || collateral <= 0}
            className="mt-1 w-full rounded border border-emerald-500/50 bg-emerald-500/15 py-2.5 text-[12px] font-bold tracking-widest text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
          >
            DEPLOY SOVEREIGNTY TO ORBIT
          </button>
        </div>
      </div>
    </div>
  );
}
