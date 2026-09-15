"use client";

import { X } from "lucide-react";
import { GenLayerTransactionPanel } from "@genlayer/transaction-kit-react";
import type { TrackedStatus } from "@genlayer/transaction-kit";
import type { WritePlan } from "@/lib/contract";
import type { NetworkConfig } from "@/lib/types";
import { useTransactionKit } from "@/lib/kit";

/**
 * The signature gate every live write passes through.
 *
 * It renders the Transaction Kit's own panel rather than a hand-built form, so
 * the caller sees the kit's real fee quote -- the deposit split across time
 * units, execution budget and message fees, the network's current price caps,
 * the pending-queue depth, and whether the quoted fee policy still matches the
 * chain's. The panel owns estimate -> review -> sign -> track; this component
 * only supplies the transaction, waits for the outcome, and offers a way out.
 *
 * `request` is state, not a render-time value, so `request.tx` keeps a stable
 * identity for as long as the gate is open -- which matters, because the panel
 * re-estimates whenever the transaction object changes.
 *
 * On the abort button: the panel does not report the phase it is in, so this
 * gate cannot disable the exit once a signature is in flight. Closing after
 * signing abandons the *tracking*, not the transaction -- it still lands
 * on-chain, and the next chain sync picks it up. Closing before signing, which
 * is what the button is for, cancels cleanly: the store rejects the pending
 * write with `WriteCancelled` and no state is recorded for it.
 */
export default function TransactionGate({
  request,
  network,
  onDone,
  onAbort,
}: {
  request: WritePlan | null;
  network: NetworkConfig;
  onDone: (status: TrackedStatus) => void;
  onAbort: () => void;
}) {
  // Hook order is unconditional; the early return below only skips rendering.
  const { kit, error } = useTransactionKit(network, request !== null);
  if (!request) return null;

  // The panel draws its own card, so the gate deliberately does not wrap it in
  // a second one -- just the backdrop, a caption, and the escape hatch.
  return (
    <div className="pointer-events-auto absolute inset-0 z-[110] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-md font-mono">
      <div className="w-full max-w-[420px]">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.2em] text-cyan-400">
              AWAITING SIGNATURE
            </div>
            <div className="mt-1 truncate text-[11px] text-slate-300">
              {request.summary}
            </div>
          </div>
          <button
            onClick={onAbort}
            aria-label="Abort transaction"
            className="shrink-0 rounded border border-slate-700 p-1 text-slate-500 hover:border-slate-500 hover:text-slate-200"
          >
            <X size={14} />
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-slate-900 p-4">
            <div className="text-[10px] tracking-widest text-red-400">
              NO SIGNING CLIENT
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              {error} Connect an injected wallet on {network.label} to submit
              this write, or abort and continue in reviewer mode.
            </p>
          </div>
        ) : !kit ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-[11px] text-slate-400">
            Building the fee quote against {network.label}...
          </div>
        ) : (
          <GenLayerTransactionPanel
            kit={kit}
            tx={request.tx}
            userValue={request.value}
            network={network.label}
            theme="dark"
            trackUntil="decided"
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );
}
