"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Radio, Scale, ShieldCheck } from "lucide-react";
import {
  BPS_ELEVATED,
  BPS_NEGLIGIBLE,
  DISPUTE_COOLDOWN_SECONDS,
  DIVERGENCE_BPS,
  bandFor,
  defendantRole,
  formatBps,
  readPair,
  type CrossExamination,
  type OraclePair,
  type PartyRole,
} from "@/lib/bilateral";

// The bilateral verification and defense matrix.
//
// A dispute is not one party's filing that a tribunal then weighs alone. The
// contract reads the ACCUSED party's own telemetry from two independently hosted
// oracles, cross-examines them against each other, and clamps whatever the
// tribunal returns into the band that metric supports. The plaintiff chooses the
// allegation and the evidence document; it does not choose the number that
// bounds the outcome, and the defendant supplies that number itself.
//
// This panel shows both halves side by side so the asymmetry is visible: the
// left column is what a plaintiff can assert, the right column is what code will
// independently measure against the party it accuses.

const TONE_TEXT: Record<string, string> = {
  slate: "text-slate-300",
  cyan: "text-cyan-300",
  amber: "text-amber-300",
  red: "text-red-300",
};

const TONE_BORDER: Record<string, string> = {
  slate: "border-slate-600/60 bg-slate-800/40",
  cyan: "border-cyan-500/40 bg-cyan-500/10",
  amber: "border-amber-500/40 bg-amber-500/10",
  red: "border-red-500/40 bg-red-500/10",
};

// A digest is 64 hex characters; the middle is what a reader never needs, so the
// panel prints the committed commitment's head and tail the way an explorer does.
function shortDigest(digest: string): string {
  const d = digest.trim();
  if (d.length <= 20) return d || "(none)";
  return `${d.slice(0, 10)}...${d.slice(-8)}`;
}

function FeedRow({
  label,
  url,
  bps,
  reachable,
  transient,
}: {
  label: string;
  url: string;
  bps: number | null;
  reachable: boolean;
  // A retryable fault reads differently from a definitive non-answer: the first
  // reverts the round, the second settles it. The row says which.
  transient: boolean;
}) {
  const state = reachable ? "ok" : transient ? "transient" : "unreachable";
  const value = reachable && bps !== null ? formatBps(bps) : transient ? "RETRYABLE" : "NO ANSWER";
  const tone =
    state === "ok"
      ? "text-slate-200"
      : state === "transient"
        ? "text-amber-300"
        : "text-slate-500";
  return (
    <div className="rounded border border-slate-700/60 bg-slate-950/40 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {/* The label may wrap; the reading may not. "8,000 bps" carries a space,
            so without this it breaks across lines into "8,000" and a bare "bps"
            -- which reads as a different number than the one on chain. */}
        <span className="min-w-0 text-[9px] tracking-widest text-slate-500">{label}</span>
        <span className={`whitespace-nowrap text-[10px] font-bold tabular-nums ${tone}`}>
          {value}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[9px] text-slate-600" title={url}>
        {url}
      </div>
    </div>
  );
}

// A safeguard the protocol applies on its own, without either party asking.
function Safeguard({
  tone,
  title,
  body,
}: {
  tone: "emerald" | "amber" | "cyan" | "slate";
  title: string;
  body: string;
}) {
  const text: Record<string, string> = {
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    cyan: "text-cyan-300",
    slate: "text-slate-300",
  };
  const border: Record<string, string> = {
    emerald: "border-emerald-500/40 bg-emerald-500/10",
    amber: "border-amber-500/40 bg-amber-500/10",
    cyan: "border-cyan-500/40 bg-cyan-500/10",
    slate: "border-slate-600/60 bg-slate-800/40",
  };
  return (
    <div className={`flex flex-col rounded border px-2.5 py-2 ${border[tone]}`}>
      {/* These titles are long and tracked wide, so at narrow column counts they
          run to two or three lines. `text-balance` splits them evenly instead of
          leaving one orphaned word on the last line. */}
      <div className={`text-balance text-[9px] font-bold tracking-widest ${text[tone]}`}>
        {title}
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

// The cross-examination verdict, phrased as what code will do about it.
function agreementSafeguard(x: CrossExamination): {
  tone: "emerald" | "amber" | "slate";
  body: string;
} {
  switch (x.agreement) {
    case "agreed":
      return {
        tone: "emerald",
        body: `Both bound oracles answer and agree within the ${DIVERGENCE_BPS} bps divergence budget. The agreed metric is the conservative mean, so neither feed alone can carry the verdict.`,
      };
    case "diverged":
      return {
        tone: "amber",
        body: `The feeds diverge by ${formatBps(x.divergenceBps ?? 0)}, past the ${DIVERGENCE_BPS} bps budget. Code sets contradiction and the dispute settles NEUTRAL: full bond refund, no fee, no reputation movement -- whatever the tribunal returns.`,
      };
    case "flagged":
      return {
        tone: "amber",
        body: "A bound feed reports contradiction: true. The round settles NEUTRAL before the tribunal is consulted, so a party that controls a feed cannot manufacture a verdict by flagging one.",
      };
    case "transient":
      return {
        tone: "amber",
        body: "A bound oracle answered with a retryable fault -- a rate limit or a server error. The contract does NOT settle on that: it reverts the dispute, so nothing is paid out and the round can be filed again once the feed recovers.",
      };
    default:
      return {
        tone: "slate",
        body: "At least one bound oracle gave a definitive non-answer. Adjudication settles NEUTRAL rather than treating silence as a breach -- an unreachable feed is not the plaintiff's fault, and it is not evidence against the defendant.",
      };
  }
}

export default function BilateralMatrix({
  plaintiffLabel,
  defendantLabel,
  plaintiffIsPartyA,
  allegation,
  evidenceUri,
  evidenceHash,
  oracles,
  evidencePresent,
  treatyOpen,
}: {
  plaintiffLabel: string;
  defendantLabel: string;
  // Which slot the filing party holds on-chain. The defendant is the other one,
  // which is the role the contract will read out of both oracles.
  plaintiffIsPartyA: boolean;
  allegation: string;
  evidenceUri: string;
  evidenceHash: string;
  oracles: OraclePair | null;
  evidencePresent: boolean;
  // Whether the treaty is in a state that carries dispute standing at all.
  treatyOpen: boolean;
}) {
  const role: PartyRole = defendantRole(plaintiffIsPartyA);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<CrossExamination | null>(null);

  const primary = oracles?.primary ?? "";
  const secondary = oracles?.secondary ?? "";

  // Re-read whenever the treaty (and so the bound pair) changes. A pair the
  // browser cannot read resolves to `unreachable`, which the panel reports
  // rather than papering over with a zero.
  useEffect(() => {
    if (!primary || !secondary) {
      setResult(null);
      return;
    }
    let live = true;
    setReading(true);
    void readPair({ primary, secondary }, role)
      .then((r) => {
        if (live) setResult(r);
      })
      .finally(() => {
        if (live) setReading(false);
      });
    return () => {
      live = false;
    };
  }, [primary, secondary, role]);

  const band = result?.reachable ? bandFor(result.bps) : null;
  const guard = result ? agreementSafeguard(result) : null;

  return (
    <section className="@container mb-3 rounded border border-slate-700/60 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Scale size={13} className="text-cyan-400" />
        <span className="text-[10px] font-bold tracking-[0.2em] text-slate-200">
          BILATERAL VERIFICATION &amp; DEFENSE MATRIX
        </span>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
        Two halves decide a dispute. The left column is what a filing can assert.
        The right column is what code independently measures against the party it
        accuses, from feeds neither side can change at dispute time.
      </p>

      {/* Column counts key off the CARD's width, not the viewport's. The board
          mounts this panel twice -- in a 672px modal and in a 344px inspector
          rail -- and viewport breakpoints cannot tell those apart: on any
          desktop the rail got the modal's column count, squeezing three
          safeguards into 133px each. */}
      <div className="grid gap-2 @md:grid-cols-2">
        {/* LEFT -- the plaintiff's side: assertion and commitment. */}
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2.5">
          <div className="text-[9px] font-bold tracking-widest text-amber-300">
            PLAINTIFF ALLEGATION &amp; EVIDENCE HASH
          </div>
          <div className="mt-1.5 space-y-1.5">
            <div>
              <div className="text-[9px] tracking-widest text-slate-500">FILING PARTY</div>
              <div className="text-[11px] text-slate-200">{plaintiffLabel}</div>
            </div>
            <div>
              <div className="text-[9px] tracking-widest text-slate-500">ALLEGATION</div>
              <div className="text-[10px] leading-relaxed text-slate-300">
                {allegation.trim() || "(no allegation entered)"}
              </div>
            </div>
            <div>
              <div className="text-[9px] tracking-widest text-slate-500">EVIDENCE URI</div>
              <div className="truncate text-[10px] text-slate-400" title={evidenceUri}>
                {evidenceUri.trim() || "(none)"}
              </div>
            </div>
            <div>
              <div className="text-[9px] tracking-widest text-slate-500">
                COMMITTED SHA-256
              </div>
              <div
                className="truncate text-[10px] tabular-nums text-cyan-300"
                title={evidenceHash}
              >
                {shortDigest(evidenceHash)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
            A commitment, not a label: the contract re-fetches the document inside
            the consensus round and adjudicates NO_EVIDENCE when the bytes do not
            hash to this digest.
          </p>
        </div>

        {/* RIGHT -- the defendant's side: measured, not asserted. */}
        <div
          className={`rounded border p-2.5 ${
            band ? TONE_BORDER[band.tone] : "border-slate-600/60 bg-slate-800/40"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Radio size={11} className="text-cyan-400" />
            <span className="text-[9px] font-bold tracking-widest text-cyan-300">
              DEFENDANT TELEMETRY &amp; DEFENSE CORRIDOR
            </span>
          </div>
          <div className="mt-1.5 space-y-1.5">
            <div>
              <div className="text-[9px] tracking-widest text-slate-500">
                ACCUSED PARTY
              </div>
              <div className="text-[11px] text-slate-200">{defendantLabel}</div>
            </div>
            <div>
              <div className="text-[9px] tracking-widest text-slate-500">
                ATTRIBUTED ROLE
              </div>
              <div className="text-[10px] tabular-nums text-slate-300">
                {role} -- the slot both oracles are read against
              </div>
            </div>

            {!oracles ? (
              <p className="rounded border border-slate-700/60 bg-slate-950/40 px-2 py-1.5 text-[10px] leading-relaxed text-slate-500">
                No oracle pair is bound to this treaty. The contract requires two
                independent-host feeds at proposal time, so a live treaty always
                carries one; the reviewer-mode seed records it only where the
                chain would.
              </p>
            ) : (
              <>
                <FeedRow
                  label="PRIMARY ORACLE"
                  url={oracles.primary}
                  bps={result ? result.primaryBps : null}
                  reachable={Boolean(result?.primaryReachable)}
                  transient={Boolean(result?.primaryTransient)}
                />
                <FeedRow
                  label="SECONDARY ORACLE"
                  url={oracles.secondary}
                  bps={result ? result.secondaryBps : null}
                  reachable={Boolean(result?.secondaryReachable)}
                  transient={Boolean(result?.secondaryTransient)}
                />
                <div className="rounded border border-slate-700/60 bg-slate-950/40 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 text-[9px] tracking-widest text-slate-500">
                      AGREED METRIC ({role})
                    </span>
                    <span
                      className={`whitespace-nowrap text-[11px] font-bold tabular-nums ${
                        band ? TONE_TEXT[band.tone] : "text-slate-500"
                      }`}
                    >
                      {reading
                        ? "READING..."
                        : result?.reachable
                          ? formatBps(result.bps)
                          : result?.transient
                            ? "RETRYABLE"
                            : result
                              ? "NO READING"
                              : "--"}
                    </span>
                  </div>
                  {result?.divergenceBps !== null && result?.divergenceBps !== undefined && (
                    <div className="mt-0.5 text-[9px] tabular-nums text-slate-500">
                      <span className="whitespace-nowrap">
                        feed divergence {formatBps(result.divergenceBps)}
                      </span>{" "}
                      <span className="whitespace-nowrap">
                        (budget {formatBps(DIVERGENCE_BPS)})
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {band && (
            <p className="mt-2 text-[9px] leading-relaxed text-slate-400">{band.effect}</p>
          )}
        </div>
      </div>

      <div className="mt-2 grid gap-2 @lg:grid-cols-3">
        <Safeguard
          tone={guard?.tone === "amber" ? "amber" : guard?.tone === "emerald" ? "emerald" : "slate"}
          title="DUAL-FEED CROSS-EXAMINATION"
          body={
            guard?.body ??
            `Both bound oracles are read for the same party and compared against a ${formatBps(
              DIVERGENCE_BPS
            )} divergence budget.`
          }
        />
        <Safeguard
          tone={band ? "cyan" : "slate"}
          title="CORRIDOR CLAMP ACTIVE"
          body={
            result?.reachable
              ? `At ${formatBps(result.bps)} the code clamp bounds the tribunal: ${band?.label.toLowerCase()}. ${
                  result.bps < BPS_NEGLIGIBLE
                    ? "No breach finding is reachable at all -- evidence cannot manufacture one out of a metric that shows none."
                    : result.bps < BPS_ELEVATED
                      ? "A full sanction is unreachable; CRITICAL_BREACH caps to ELEVATED_RISK only when the evidence corroborates the claim."
                      : "The full tier range is open, and an honest report at this metric can never be dismissed as malicious."
                }`
              : "The corridor clamp bounds whatever the tribunal returns by the defendant's own measured metric. It is a ceiling on the verdict, not a substitute for it."
          }
        />
        <Safeguard
          tone={treatyOpen ? "emerald" : "slate"}
          title="DEFENSE STANDING &amp; COOLDOWN"
          body={
            treatyOpen
              ? `This covenant carries dispute standing while it is ACTIVE. A successful dispute stamps a ${DISPUTE_COOLDOWN_SECONDS}-second per-treaty cooldown, so neither side can chain filings to drain the other's bond. The defense itself is automatic -- telemetry and the corridor -- not a time-boxed rebuttal the defendant must file.`
              : "This covenant carries no dispute standing in its current state. Only an ACTIVE treaty can be disputed, so a settled or expired pact cannot be re-litigated."
          }
        />
      </div>

      {evidencePresent && result && !result.reachable && (
        <div className="mt-2 flex items-start gap-2 rounded border border-slate-600/60 bg-slate-800/40 px-2.5 py-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-[10px] leading-relaxed text-slate-400">
            {result.transient
              ? "A document is committed, but a bound oracle is faulting right now. This is not a verdict either way: the dispute reverts and can be filed again once the feed answers, and nothing moves in the meantime."
              : "A document is committed, but the defendant's telemetry did not resolve. The evidence does not carry the round on its own: a feed failure settles neutrally, so an unreadable metric cannot become a slash."}
          </p>
        </div>
      )}

      {result?.reachable && (
        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500">
          <ShieldCheck size={11} className="text-emerald-400" />
          <span>
            Readings fetched live from the treaty&apos;s bound oracles in this
            browser, then parsed under the contract&apos;s own strict rules. The
            contract repeats this read independently inside the consensus round.
          </span>
        </div>
      )}
    </section>
  );
}
