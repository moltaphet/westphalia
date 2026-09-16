"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
  LogOut,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import type { AgentEnclave, NetworkConfig } from "@/lib/types";
import type { WalletBundle } from "@/lib/store";

// 0x2e...d930 -- first four chars (0x + two nibbles) and the last four.
const short = (addr: string): string =>
  addr.length > 8 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;

// The wallet control in the tactical command bar. One component renders every
// lifecycle state -- disconnected, wrong network, and the connected pill with
// its dropdown -- so the top bar just drops it in and hands over the wallet
// slice. All connection logic lives in the store; this is purely the surface.
export default function WalletConnect({
  wallet,
  network,
  enclaves,
}: {
  wallet: WalletBundle;
  network: NetworkConfig;
  enclaves: AgentEnclave[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { address, balanceGen, chainId, connecting } = wallet;
  // The wallet is on the wrong chain once it reports a chain that is not the
  // app's selected target. Unknown chain (null) is not treated as wrong.
  const wrongNetwork =
    address !== null && chainId !== null && chainId !== network.chainId;

  // The founded sovereignty owned by the linked wallet, if any.
  const ownEnclave =
    address === null
      ? undefined
      : enclaves.find((e) => e.address.toLowerCase() === address.toLowerCase());

  // Close the dropdown on an outside click or the Escape key.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Drop the "Copied!" flash whenever the dropdown closes.
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (insecure origin / permissions): leave the label as-is
    }
  };

  // --- Disconnected ---------------------------------------------------------
  if (address === null) {
    return (
      <button
        onClick={wallet.connect}
        disabled={connecting}
        className="flex items-center gap-1.5 rounded border border-emerald-500/40 px-3 py-2 text-[11px] font-bold tracking-widest text-emerald-400 transition hover:bg-emerald-500/10 disabled:cursor-wait disabled:opacity-70"
      >
        {connecting ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            <span>CONNECTING...</span>
          </>
        ) : (
          <>
            <Wallet size={13} />
            <span className="hidden md:inline">CONNECT SOVEREIGN</span>
            <span className="md:hidden">CONNECT</span>
          </>
        )}
      </button>
    );
  }

  // --- Connected, wrong network --------------------------------------------
  if (wrongNetwork) {
    return (
      <button
        onClick={wallet.switchNetwork}
        title={`Switch your wallet to ${network.label} (chain ${network.chainId}).`}
        className="flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-bold tracking-widest text-amber-300 transition hover:bg-amber-500/20"
      >
        <ShieldAlert size={13} />
        <span className="hidden md:inline">WRONG NETWORK (SWITCH)</span>
        <span className="md:hidden">SWITCH</span>
      </button>
    );
  }

  // --- Connected, correct network: pill + tactical dropdown -----------------
  const explorerHref = `${network.explorerUrl}/address/${address}`;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 transition hover:bg-emerald-500/15"
      >
        {/* Online indicator dot */}
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-bold tabular-nums">{short(address)}</span>
        {balanceGen !== null && (
          <span className="hidden text-emerald-300/80 sm:inline">{balanceGen} GEN</span>
        )}
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-[60] mt-2 w-72 rounded-lg border p-1 font-mono shadow-2xl backdrop-blur-md"
          // Tactical panel: near-opaque #070C18 (alpha lets the backdrop blur
          // read through), hairline #16273F border, neon accents on hover.
          style={{ backgroundColor: "rgba(7,12,24,0.92)", borderColor: "#16273F" }}
        >
          {/* Full address + copy */}
          <div
            className="rounded-md border bg-black/30 p-3"
            style={{ borderColor: "#16273F" }}
          >
            <div className="mb-1 text-[8px] font-bold tracking-[0.3em] text-emerald-400/70">
              ACTIVE ADDRESS
            </div>
            <div className="break-all text-[11px] leading-relaxed text-slate-200">
              {address}
            </div>
            <button
              onClick={copyAddress}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[10px] font-bold tracking-widest text-slate-300 transition hover:text-[#00FFA3]"
              style={{ borderColor: "#16273F" }}
            >
              {copied ? (
                <>
                  <Check size={12} /> COPIED!
                </>
              ) : (
                <>
                  <Copy size={12} /> COPY ADDRESS
                </>
              )}
            </button>
          </div>

          {balanceGen !== null && (
            <div className="flex items-center justify-between px-3 py-2 text-[10px]">
              <span className="tracking-widest text-slate-500">BALANCE</span>
              <span className="tabular-nums text-emerald-300">{balanceGen} GEN</span>
            </div>
          )}

          <a
            href={explorerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded px-3 py-2 text-[10px] tracking-widest text-slate-300 transition hover:bg-white/5 hover:text-cyan-300"
          >
            <ExternalLink size={12} /> VIEW ON GENLAYER EXPLORER
          </a>

          {/* Active realm/enclave indicator */}
          <div className="flex items-center gap-2 px-3 py-2 text-[10px]">
            <Landmark
              size={12}
              className={ownEnclave ? "text-emerald-400" : "text-slate-600"}
            />
            {ownEnclave ? (
              <span className="text-slate-300">
                Sovereignty:{" "}
                <span className="font-bold text-emerald-300">{ownEnclave.name}</span>
              </span>
            ) : (
              <span className="text-slate-500">No sovereignty on this wallet.</span>
            )}
          </div>

          <div className="my-1 h-px" style={{ backgroundColor: "#16273F" }} />

          <button
            onClick={() => {
              setOpen(false);
              wallet.disconnect();
            }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-[10px] font-bold tracking-widest text-rose-400 transition hover:bg-rose-500/10"
          >
            <LogOut size={12} /> DISCONNECT
          </button>
        </div>
      )}
    </div>
  );
}
