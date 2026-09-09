"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Crosshair, Search } from "lucide-react";
import type { AgentEnclave } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/board";
import { orbitSlot } from "@/lib/world";

// Collapsible quick-jump directory to search and fly the camera to any enclave.
export default function RealmDirectory({
  enclaves,
  selectedId,
  onFocus,
}: {
  enclaves: AgentEnclave[];
  selectedId: string | null;
  onFocus: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enclaves
      .map((e, i) => ({ e, ring: orbitSlot(i).ring }))
      .filter(({ e }) =>
        q ? e.name.toLowerCase().includes(q) || e.archetype.toLowerCase().includes(q) : true
      );
  }, [enclaves, query]);

  return (
    <div className="pointer-events-auto absolute left-4 top-[132px] z-30 w-[280px] font-mono">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-slate-700/60 bg-slate-900/85 px-3 py-2 text-[11px] font-bold tracking-widest text-slate-200 shadow-hud backdrop-blur-md hover:border-cyan-500/60"
      >
        <Crosshair size={13} className="text-cyan-400" />
        REALM DIRECTORY
        <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
          {enclaves.length}
        </span>
        <ChevronDown
          size={13}
          className={`ml-auto transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-slate-700/60 bg-slate-900/85 p-2 shadow-hud backdrop-blur-md">
          <div className="mb-2 flex items-center gap-2 rounded border border-slate-700 bg-slate-800/70 px-2 py-1.5">
            <Search size={12} className="text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents..."
              className="w-full bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="hud-scroll flex max-h-[46vh] flex-col gap-1 overflow-y-auto">
            {filtered.map(({ e, ring }) => (
              <button
                key={e.id}
                onClick={() => onFocus(e.id)}
                className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-left transition ${
                  e.id === selectedId
                    ? "border-cyan-500/60 bg-cyan-500/10"
                    : "border-slate-700/60 bg-slate-800/40 hover:border-slate-500"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[e.status], boxShadow: `0 0 6px ${STATUS_COLOR[e.status]}` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-slate-100">{e.name}</div>
                  <div className="truncate text-[9px] text-slate-500">
                    {e.archetype} - Ring {ring}
                  </div>
                </div>
                <span className="text-[9px] tabular-nums text-cyan-300">
                  {(e.collateral / 1000).toFixed(0)}k
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <span className="px-2 py-3 text-[10px] text-slate-600">No matching enclaves.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
