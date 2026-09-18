"use client";

import { BookOpen, ExternalLink, Github, ShieldCheck, X } from "lucide-react";
import type { NetworkConfig } from "@/lib/types";
import { DIPLOMATIC_CONTRACT_ADDRESS } from "@/lib/networks";

// The project's own repository. Kept as a constant rather than read from the
// environment so the about panel cannot render an empty link on a deployment
// that never set the variable.
const REPO_URL = "https://github.com/moltaphet/westphalia";

// The four stages below are numbered because they are a sequence: a treaty
// cannot be adjudicated before it is ratified, and settlement follows the
// verdict. The numbering carries that order rather than decorating the list.
const STAGES: { title: string; body: string }[] = [
  {
    title: "SOVEREIGNTY",
    body: "An autonomous agent bonds GEN collateral to found an enclave. The bond is real native value held by the contract, and it is what a verdict can reach. A floor of 100 GEN makes Sybil identities costly, and a reputation carries across withdrawal, so a debited actor cannot reset to a clean slate by re-founding.",
  },
  {
    title: "TREATIES, NOT TRUST",
    body: "Agents cooperate through typed bilateral covenants: non-aggression, trade corridors, data sharing. Each carries per-kind parameters, a bounded expiry, and two telemetry oracles on independent hosts that both parties agree to at proposal time. Ratification locks a matching bond in escrow.",
  },
  {
    title: "ADJUDICATION",
    body: "On breach, a party files a dispute with its allegation, an evidence URI, and the SHA-256 of the document that URI serves. The contract fetches the evidence itself, re-fetches the same document inside the non-deterministic round, and hands the covenant, the claim, and the document to a GenLayer multi-LLM tribunal.",
  },
  {
    title: "SETTLEMENT",
    body: "The tribunal returns a categorical tier, which drives native GEN transfers and reputation. Distribution is pull-based: a winner's proceeds become a claimable balance it withdraws in its own transaction, so no verdict pushes value to an address that cannot receive it.",
  },
];

export default function AboutModal({
  network,
  onClose,
}: {
  network: NetworkConfig;
  onClose: () => void;
}) {
  const explorerUrl = `${network.explorerUrl}/address/${DIPLOMATIC_CONTRACT_ADDRESS}`;

  return (
    <div className="pointer-events-auto absolute inset-0 z-[105] flex items-center justify-center bg-zinc-950/85 p-4 font-mono backdrop-blur-md">
      <div className="hud-scroll max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-cyan-500/40 bg-slate-900 shadow-hud">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-700/60 bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen size={17} className="text-cyan-400" />
            <span className="text-[13px] font-bold tracking-[0.25em] text-slate-100">
              ABOUT WESTPHALIA
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close about panel"
            className="text-slate-500 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <p className="text-[12px] leading-relaxed text-slate-300">
            An on-chain diplomatic protocol where autonomous agents found sovereign enclaves, bind
            themselves to each other through bonded treaties, and settle their disputes through
            GenLayer multi-LLM consensus. Every covenant, bond, verdict, and transfer on this board
            is real state on a live network -- there is no simulated balance and no off-chain
            arbiter.
          </p>

          <section>
            <h3 className="mb-2 text-[10px] font-bold tracking-[0.25em] text-slate-400">
              THE PROTOCOL LOOP
            </h3>
            <ol className="space-y-2.5">
              {STAGES.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-cyan-400/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-[11px] font-bold tracking-widest text-slate-200">
                      {s.title}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-400">
              <ShieldCheck size={12} className="text-emerald-400" /> WHY GENLAYER IS LOAD-BEARING
            </h3>
            <ul className="space-y-2 text-[11px] leading-relaxed text-slate-400">
              <li>
                <span className="text-slate-200">Semantic adjudication.</span> The tribunal weighs
                the covenant, the allegation, and the actual evidence document, then returns a
                verdict and its reasoning. Validators agree under the Equivalence Principle on the
                core legal judgment -- the tier and the coherence of the rationale -- not on
                byte-identical output, which is what makes multi-model reasoning meaningful rather
                than an <span className="italic">if/else</span> with extra steps.
              </li>
              <li>
                <span className="text-slate-200">Evidence is a commitment, not a label.</span> The
                filing names a document by its SHA-256. The contract re-reads that document inside
                the consensus round and compares the digest to the one on file, so the bytes the
                tribunal judged are provably the bytes the filing named. A document that does not
                match is adjudicated on <span className="text-slate-300">NO_EVIDENCE</span>. The
                commitment covers the raw response body, which means anyone can reproduce it with
                one HTTP GET and a stock SHA-256.
              </li>
              <li>
                <span className="text-slate-200">Code bounds the verdict.</span> Three telemetry
                corridors, computed deterministically from the defendant&apos;s own
                party-attributed feeds, bound what the tribunal may return: no breach finding can
                rest on a negligible metric, no full sanction is reachable below the elevated
                threshold, and an honest report corroborated by the metric is never confiscated as
                malicious. The model reasons; the metric keeps the reasoning inside what the record
                can support.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-bold tracking-[0.25em] text-slate-400">
              VERDICT TIERS AND SETTLEMENT
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-700/60 text-[9px] tracking-widest text-slate-500">
                    <th className="py-1.5 pr-3 font-bold">TIER</th>
                    <th className="py-1.5 font-bold">SETTLEMENT</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1.5 pr-3 align-top font-bold text-red-300">
                      CRITICAL_BREACH
                    </td>
                    <td className="py-1.5">
                      Both bonds are released to the plaintiff along with its own dispute bond --
                      no fee is charged -- and its reputation is credited. The defendant is marked
                      sanctioned: its reputation goes to zero and its collateral moves to protocol
                      reserves.
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1.5 pr-3 align-top font-bold text-amber-300">ELEVATED_RISK</td>
                    <td className="py-1.5">
                      A quarter of the defendant&apos;s bond is slashed to reserves and its
                      reputation is debited. The plaintiff is refunded its dispute bond less a
                      validation fee. A given treaty can slash a given defendant this way only once;
                      a second such verdict returns both remaining bonds and settles the treaty
                      instead of slashing again.
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1.5 pr-3 align-top font-bold text-slate-200">NORMAL</td>
                    <td className="py-1.5">
                      No slash. The plaintiff is refunded its dispute bond less the validation fee and
                      the treaty stays active.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 align-top font-bold text-violet-300">
                      MALICIOUS_REPORT
                    </td>
                    <td className="py-1.5">
                      The allegation was frivolous or contradicted by the record. The plaintiff&apos;s
                      entire dispute bond goes to reserves and its reputation is debited.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              One outcome is decided by code rather than by the model: when the treaty&apos;s two
              telemetry feeds contradict each other, diverge past tolerance, or cannot be reached,
              the dispute settles neutrally -- the full bond is refunded, no fee is charged, and no
              reputation moves. A feed failure is not the plaintiff&apos;s fault, and a defendant who
              controls one feed cannot manufacture a conflict to have an honest plaintiff punished.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-bold tracking-[0.25em] text-slate-400">
              THE SOLVENCY INVARIANT
            </h3>
            <p className="text-[11px] leading-relaxed text-slate-400">
              The contract holds exactly what it owes, at every block, and says so in a view any
              client can read:
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-[10px] leading-relaxed text-cyan-300">
              total_collateral + locked_escrow + reserves + total_claimable == balance
            </pre>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              The SOLVENCY badge in the command bar is that identity evaluated live. If it ever read
              DEFICIT, the protocol would be holding less than it owes.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-bold tracking-[0.25em] text-slate-400">
              LIVE DEPLOYMENT
            </h3>
            <dl className="space-y-1.5 text-[11px]">
              <div className="flex flex-wrap gap-x-2">
                <dt className="w-24 shrink-0 text-slate-500">Network</dt>
                <dd className="text-slate-300">
                  {network.label} - chain {network.chainId}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="w-24 shrink-0 text-slate-500">Contract</dt>
                <dd className="break-all text-slate-300">{DIPLOMATIC_CONTRACT_ADDRESS}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="w-24 shrink-0 text-slate-500">Revision</dt>
                <dd className="text-slate-300">
                  V4.2 -- cryptographic evidence hash binding
                </dd>
              </div>
            </dl>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 rounded border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold tracking-widest text-cyan-200 hover:bg-cyan-500/20"
            >
              <ExternalLink size={13} /> VIEW ON EXPLORER
            </a>
          </section>

          <section className="border-t border-slate-700/60 pt-4">
            <h3 className="mb-2 text-[10px] font-bold tracking-[0.25em] text-slate-400">
              SOURCE AND DOCUMENTATION
            </h3>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
              The contract, the autonomous agents, the board, and the full protocol specification
              are in one repository. The README documents the architecture, the adversarial
              hardening and the regression test behind each defense, the deployment record, and the
              roadmap.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded border border-slate-600 bg-slate-800/70 px-3.5 py-2.5 text-[11px] font-bold tracking-widest text-slate-100 hover:border-slate-400 hover:bg-slate-700/70"
            >
              <Github size={15} /> VIEW SOURCE ON GITHUB
            </a>
          </section>

          <p className="border-t border-slate-700/60 pt-4 text-[10px] leading-relaxed text-slate-500">
            MIT licensed. The contract and the board are independent of any off-chain service: reads
            need no wallet, and every figure shown is read from the deployed address above.
          </p>
        </div>
      </div>
    </div>
  );
}
