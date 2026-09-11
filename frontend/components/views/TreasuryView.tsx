"use client";

import { useMemo } from "react";
import { Banknote, Coins, HandCoins, Landmark, ShieldAlert, TrendingUp, Vault } from "lucide-react";
import type { ChainOverview, ProtocolState } from "@/lib/types";
import { attoToGen } from "@/lib/contract";
import { STATUS_COLOR } from "@/lib/board";

export default function TreasuryView({
  state,
  chainOverview,
  onClaim,
  onWithdrawCollateral,
}: {
  state: ProtocolState;
  chainOverview: ChainOverview | null;
  onClaim: (treatyId: string) => void;
  onWithdrawCollateral: () => void;
}) {
  const treasury = useMemo(
    () => state.treaties.filter((t) => t.status === "breached").reduce((s, t) => s + t.bondGen, 0),
    [state.treaties]
  );
  const avgYield = useMemo(() => {
    const arr = state.enclaves.map((s) => s.yieldApr);
    return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  }, [state.enclaves]);
  const slashingReserve = useMemo(
    () =>
      state.enclaves.reduce(
        (sum, e) => sum + e.slashingHistory.reduce((a, r) => a + r.amountGen, 0),
        0
      ),
    [state.enclaves]
  );
  const maxEscrow = useMemo(
    () => Math.max(...state.enclaves.map((s) => s.lockedEscrowGen), 1),
    [state.enclaves]
  );

  const claimable = state.treaties.filter((t) => t.status === "active" || t.status === "resolved");

  return (
    <div className="custom-scrollbar pointer-events-auto absolute left-0 right-0 top-24 z-20 flex h-[calc(100vh-6.5rem)] flex-col gap-4 overflow-y-auto px-8 py-6 pb-20 font-mono">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Coins size={16} className="text-cyan-400" />}
          label="TOTAL VALUE LOCKED"
          value={`${state.totalEscrowGen.toLocaleString("en-US")} GEN`}
          tone="#22d3ee"
        />
        <SummaryCard
          icon={<Vault size={16} className="text-red-400" />}
          label="PROTOCOL TREASURY (FORFEITED)"
          value={`${treasury.toLocaleString("en-US")} GEN`}
          tone="#ef4444"
        />
        <SummaryCard
          icon={<ShieldAlert size={16} className="text-amber-400" />}
          label="SLASHING RESERVE"
          value={`${slashingReserve.toLocaleString("en-US")} GEN`}
          tone="#f59e0b"
        />
        <SummaryCard
          icon={<TrendingUp size={16} className="text-emerald-400" />}
          label="AVERAGE ESCROW YIELD"
          value={`${avgYield.toFixed(2)}% APR`}
          tone="#10b981"
        />
      </div>

      {/* Live on-chain sync: replaces the simulated treasury figures with the
          contract's own accounting whenever a live client is connected. */}
      {chainOverview && (
        <div className="rounded-md border border-cyan-500/40 bg-slate-900/70 p-4 shadow-hud backdrop-blur-md">
          <div className="mb-3 flex items-center gap-2">
            <Landmark size={15} className="text-cyan-400" />
            <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
              ON-CHAIN PROTOCOL ACCOUNTS
            </span>
            <span className="ml-auto text-[9px] tracking-widest text-cyan-300">
              SYNCED - SOLVENT: {chainOverview.solvent ? "YES" : "NO"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              icon={<Vault size={16} className="text-cyan-400" />}
              label="CONTRACT BALANCE"
              value={`${attoToGen(chainOverview.balance).toLocaleString("en-US", { maximumFractionDigits: 1 })} GEN`}
              tone="#22d3ee"
            />
            <SummaryCard
              icon={<Coins size={16} className="text-emerald-400" />}
              label="TOTAL COLLATERAL"
              value={`${attoToGen(chainOverview.totalCollateral).toLocaleString("en-US", { maximumFractionDigits: 1 })} GEN`}
              tone="#10b981"
            />
            <SummaryCard
              icon={<Banknote size={16} className="text-amber-400" />}
              label="PROTOCOL RESERVES"
              value={`${attoToGen(chainOverview.reserves).toLocaleString("en-US", { maximumFractionDigits: 1 })} GEN`}
              tone="#f59e0b"
            />
            <SummaryCard
              icon={<HandCoins size={16} className="text-violet-400" />}
              label="CLAIMABLE (ALL PARTIES)"
              value={`${attoToGen(chainOverview.totalClaimable).toLocaleString("en-US", { maximumFractionDigits: 1 })} GEN`}
              tone="#a78bfa"
            />
          </div>
          <button
            onClick={onWithdrawCollateral}
            className="mt-3 w-full rounded border border-red-500/50 bg-red-500/10 py-2 text-[11px] font-bold tracking-widest text-red-200 hover:bg-red-500/20"
          >
            WITHDRAW SOVEREIGN COLLATERAL (DISSOLVE ENCLAVE)
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Collateral breakdown */}
        <div className="rounded-md border border-slate-700/60 bg-slate-900/70 shadow-hud backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
            <Banknote size={15} className="text-cyan-400" />
            <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
              LOCKED GEN COLLATERAL
            </span>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {state.enclaves.map((s) => {
              const color = STATUS_COLOR[s.status];
              const pct = (s.lockedEscrowGen / maxEscrow) * 100;
              return (
                <div key={s.id} className="rounded border border-slate-700/60 bg-slate-800/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-slate-100">{s.name}</span>
                    <span className="text-[11px] tabular-nums text-cyan-300">
                      {s.lockedEscrowGen.toLocaleString("en-US")} GEN
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>yield {s.yieldApr.toFixed(1)}% APR</span>
                    <span>hazard {s.hazardPct}%</span>
                    <span>stake {s.collateral.toLocaleString("en-US")} GEN</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pull-pattern withdrawals */}
        <div className="rounded-md border border-slate-700/60 bg-slate-900/70 shadow-hud backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
            <HandCoins size={15} className="text-emerald-400" />
            <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200">
              PULL-PATTERN WITHDRAWALS
            </span>
          </div>
          <div className="flex flex-col gap-2 p-4">
            <p className="mb-1 text-[10px] leading-relaxed text-slate-500">
              Released escrow is withdrawn on demand via the contract pull pattern. Each claim
              routes through the transaction pipeline.
            </p>
            {claimable.map((t) => {
              const names = t.parties
                .map((p) => state.enclaves.find((s) => s.id === p)?.name ?? p)
                .join("  x  ");
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded border border-slate-700/60 bg-slate-800/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-200">
                      {t.id.toUpperCase()} - {t.kind}
                    </div>
                    <div className="truncate text-[10px] text-slate-500">{names}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] tabular-nums text-cyan-300">
                      {t.bondGen.toLocaleString("en-US")} GEN
                    </span>
                    <button
                      onClick={() => onClaim(t.id)}
                      className="rounded border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 text-[10px] font-bold tracking-widest text-cyan-200 hover:bg-cyan-500/25"
                    >
                      CLAIM
                    </button>
                  </div>
                </div>
              );
            })}
            {claimable.length === 0 && (
              <span className="text-[10px] text-slate-600">No claimable escrow.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-900/70 p-4 shadow-hud backdrop-blur-md">
      <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}
