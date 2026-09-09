"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { PipelineState } from "@/lib/types";
import type { TxReceipt } from "@/lib/contract";

// Multi-step tactical progress bar for the transaction pipeline. Rendered
// globally so it appears regardless of the active workspace view.
function TxPipelineOverlay({ pipeline: p }: { pipeline: PipelineState | null }) {
  if (!p) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-cyan-500/40 bg-slate-900 p-5 shadow-hud">
        <div className="mb-4 flex items-center gap-2">
          {p.done ? (
            <Check size={16} className="text-emerald-400" />
          ) : (
            <Loader2 size={16} className="animate-spin text-cyan-400" />
          )}
          <span className="text-[12px] font-bold tracking-[0.2em] text-slate-100">
            {p.label.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {p.steps.map((label, i) => {
            const complete = i < p.step || (p.done && i <= p.step);
            const current = i === p.step && !p.done;
            return (
              <div key={label} className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                    complete
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : current
                      ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                      : "border-slate-700 bg-slate-800 text-slate-600"
                  }`}
                >
                  {complete ? <Check size={12} /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[11px] ${
                      complete
                        ? "text-emerald-300"
                        : current
                        ? "text-cyan-200"
                        : "text-slate-500"
                    }`}
                  >
                    {label}
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        complete
                          ? "w-full bg-emerald-500"
                          : current
                          ? "w-2/3 bg-cyan-400 animate-pulseGlow"
                          : "w-0"
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center font-mono text-[9px] tracking-widest text-slate-500">
          {p.done
            ? "ROUND FINALIZED - LEDGER UPDATED"
            : "DO NOT CLOSE - GENLAYER QUORUM IN PROGRESS"}
        </div>
      </div>
    </div>
  );
}

function Toast({ receipt }: { receipt: TxReceipt | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!receipt) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 5200);
    return () => clearTimeout(id);
  }, [receipt]);

  if (!visible || !receipt) return null;
  const r = receipt;
  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-md border border-cyan-500/40 bg-slate-900/95 px-4 py-3 shadow-hud">
        <span
          className={`h-2 w-2 rounded-full ${
            r.simulated ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
        <div>
          <div className="font-mono text-[11px] text-slate-200">{r.summary}</div>
          <div className="font-mono text-[9px] text-slate-500">
            {r.simulated ? "SIMULATED" : "BROADCAST"} - {r.hash.slice(0, 18)}...
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GlobalFeedback({
  pipeline,
  lastReceipt,
}: {
  pipeline: PipelineState | null;
  lastReceipt: TxReceipt | null;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 font-mono">
      <TxPipelineOverlay pipeline={pipeline} />
      <Toast receipt={lastReceipt} />
    </div>
  );
}
