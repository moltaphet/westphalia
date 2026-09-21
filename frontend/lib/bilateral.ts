// The bilateral half of adjudication, mirrored from the deployed contract.
//
// A dispute is not a plaintiff's filing that a tribunal then weighs alone. The
// contract treats the DEFENDANT's own telemetry as co-equal evidence: it fetches
// two independent oracles, reads only the accused party's attributed metric from
// each, cross-examines them against each other, and then clamps whatever the
// tribunal returns into the band that metric can support. The plaintiff controls
// the allegation and the evidence document; it does not control the number that
// bounds the outcome.
//
// Every constant and rule below is a mirror of `contracts/westphalia.py`, named
// after its on-chain counterpart so the two can be compared by reading them side
// by side. Nothing here is a second opinion: the board renders what this module
// derives, and this module is only correct insofar as it agrees with the chain.
// The functions are pure so the whole panel is unit-testable without a network.

// `BPS_CRITICAL`, `BPS_ELEVATED`, `BPS_NEGLIGIBLE`, `DIVERGENCE_BPS`.
export const BPS_CRITICAL = 7500;
export const BPS_ELEVATED = 2500;
export const BPS_NEGLIGIBLE = 500;
export const DIVERGENCE_BPS = 500;

// `DISPUTE_COOLDOWN`: seconds between successful disputes on one treaty.
export const DISPUTE_COOLDOWN_SECONDS = 300;

// The two attributed slots an oracle document may carry. Adjudication reads
// exactly one of them: the accused party's.
export type PartyRole = "party_a" | "party_b";

// The role the contract will read when `plaintiff` files. Mirrors
// `target_role = "party_b" if sender == t.party_a else "party_a"`: the defendant
// is always the counterparty of whoever files, so the same corridor protects
// whichever side is accused -- there is no privileged plaintiff slot.
export function defendantRole(plaintiffIsPartyA: boolean): PartyRole {
  return plaintiffIsPartyA ? "party_b" : "party_a";
}

// Python's built-in `round()` is banker's rounding -- half-to-even -- while
// JavaScript's `Math.round` is half-up. They disagree on every exact .5, which
// a metric can land on (`0.00005 * 10000` is exactly 0.5). Since the contract
// quantizes with `round()`, the mirror has to round the same way or the panel
// would print a bps the chain never computed.
function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

// `_quantize_bps`: clamp BEFORE the multiply, so an adversarial magnitude cannot
// overflow, then round to integer basis points. Coarse bucketing keeps two
// validators from splitting on a threshold edge.
export function quantizeBps(rawMetric: number): number {
  if (!Number.isFinite(rawMetric)) return 0;
  if (rawMetric <= 0) return 0;
  if (rawMetric >= 1) return 10000;
  return roundHalfEven(rawMetric * 10000);
}

// One oracle's reading of the defendant. `reachable: false` is the contract's
// "unreachable" state, which is NOT the same as a zero metric: it means the feed
// could not be read, and adjudication settles neutrally rather than acquitting
// the defendant on a number nobody produced.
//
// `transient` is a third state the contract distinguishes and the panel must
// too. A rate-limit (429) or a server fault (5xx) reverts the whole dispute so it
// can be retried; only a definitive non-answer (404, a 200 with a corrupt body,
// a missing attributed key) settles neutrally. Collapsing the two would tell a
// plaintiff whose feed is merely throttled that the round settled -- and, worse,
// that the defendant was cleared.
export interface Reading {
  reachable: boolean;
  transient: boolean;
  bps: number;
  contradiction: boolean;
}

const UNREACHABLE: Reading = {
  reachable: false,
  transient: false,
  bps: 0,
  contradiction: false,
};

const TRANSIENT: Reading = {
  reachable: false,
  transient: true,
  bps: 0,
  contradiction: false,
};

// `_fetch_one`'s extraction, over a parsed JSON payload instead of an HTTP
// response. The rules are deliberately strict and are the reason a malformed
// feed cannot be used to steer a verdict:
//
//  * a non-object payload is malformed;
//  * the defendant's OWN key must be present (directly, or under `breaches`) --
//    there is no single-aggregate fallback, which is what stops a plaintiff
//    aiming one number at the counterparty;
//  * a JSON boolean is rejected, because `true` would otherwise quantize to a
//    real breach metric;
//  * Infinity / NaN are corrupt, not "no breach", so they are unreachable rather
//    than a silent acquittal;
//  * `contradiction` counts only as a real boolean or the integer 1, because a
//    JSON string "false" is truthy under a truthiness test.
export function parseReading(payload: unknown, role: PartyRole): Reading {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return UNREACHABLE;
  }
  const doc = payload as Record<string, unknown>;
  const nested = doc.breaches;
  const source =
    nested !== null && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : doc;

  if (!Object.prototype.hasOwnProperty.call(source, role)) return UNREACHABLE;
  const raw = source[role];

  if (typeof raw === "boolean" || typeof raw !== "number") return UNREACHABLE;
  if (!Number.isFinite(raw)) return UNREACHABLE;

  const flag = doc.contradiction;
  return {
    reachable: true,
    // The payload layer only ever runs on a body that already arrived with a 2xx,
    // so nothing it extracts can be transient.
    transient: false,
    bps: quantizeBps(raw),
    contradiction: flag === true || flag === 1,
  };
}

// The result of reading both bound oracles for the same defendant.
export interface CrossExamination {
  reachable: boolean;
  // A bound feed is throttled or faulting. The dispute reverts and is retryable;
  // no verdict is reached and nothing is settled.
  transient: boolean;
  bps: number; // the conservative agreed metric
  contradiction: boolean; // settles neutrally, whatever the tribunal says
  divergenceBps: number | null; // null when the feeds could not both be read
  primaryReachable: boolean;
  secondaryReachable: boolean;
  // Per-feed fault state. Carried alongside `transient` because the pair-level
  // flag cannot say WHICH feed faulted, and a row that blamed both for one
  // feed's outage would be wrong about the other.
  primaryTransient: boolean;
  secondaryTransient: boolean;
  // Each feed's own reading, carried through so the panel can show the two
  // measurements beside the mean rather than only their agreement.
  primaryBps: number;
  secondaryBps: number;
  agreement: "agreed" | "diverged" | "flagged" | "unreachable" | "transient";
}

// `_fetch_dual_telemetry`. Two independent measurements of the SAME party's
// conduct: divergence beyond the budget is a contradiction, and a contradiction
// settles neutrally (full refund, no fee, treaty stays ACTIVE). That is the
// defense against a defendant who controls a feed and wants to manufacture a
// conflict -- and equally against a plaintiff who wants to pick the feed that
// reads worst.
export function crossExamine(primary: Reading, secondary: Reading): CrossExamination {
  const base = {
    primaryReachable: primary.reachable,
    secondaryReachable: secondary.reachable,
    primaryTransient: primary.transient,
    secondaryTransient: secondary.transient,
    primaryBps: primary.bps,
    secondaryBps: secondary.bps,
  };

  if (!primary.reachable || !secondary.reachable) {
    // Either feed faulting reverts the round outright, and the contract checks
    // that BEFORE it looks at whether the other one answered -- so a transient
    // fault outranks an unreachable peer.
    const transient = primary.transient || secondary.transient;
    return {
      ...base,
      reachable: false,
      transient,
      bps: 0,
      // The transient path reverts before the flags are consulted and reports
      // none, even when the other feed raised one. Only the settle-neutral path
      // carries a flag through.
      contradiction: transient
        ? false
        : primary.contradiction || secondary.contradiction,
      divergenceBps: null,
      agreement: transient ? "transient" : "unreachable",
    };
  }

  const divergenceBps = Math.abs(primary.bps - secondary.bps);
  const flagged = primary.contradiction || secondary.contradiction;
  const diverged = divergenceBps > DIVERGENCE_BPS;
  return {
    ...base,
    reachable: true,
    transient: false,
    // The conservative mean: adjudication cannot be steered by reading the
    // higher of the two.
    bps: Math.floor((primary.bps + secondary.bps) / 2),
    contradiction: flagged || diverged,
    divergenceBps,
    agreement: flagged ? "flagged" : diverged ? "diverged" : "agreed",
  };
}

// `_clamp_tier`: the three corridors, transcribed so the UI can say what code
// will do to any tier the tribunal returns at a given metric.
export function applyCorridor(
  tier: string,
  bps: number,
  evidencePresent: boolean
): string {
  // Corridor 1, floor: at or above the elevated threshold an objective breach
  // exists, so an honest plaintiff can never be ruled malicious.
  if (bps >= BPS_ELEVATED && tier === "MALICIOUS_REPORT") return "NORMAL";
  // Corridor 2, ceiling: negligible telemetry supports no breach at all.
  // Evidence cannot manufacture one out of a metric that shows none.
  if (bps < BPS_NEGLIGIBLE && (tier === "CRITICAL_BREACH" || tier === "ELEVATED_RISK")) {
    return "NORMAL";
  }
  // Corridor 3, ceiling: below the elevated threshold a full sanction is
  // forbidden outright, corroborated evidence or not.
  if (bps < BPS_ELEVATED && tier === "CRITICAL_BREACH") {
    return evidencePresent ? "ELEVATED_RISK" : "NORMAL";
  }
  return tier;
}

export interface Band {
  label: string;
  tone: "slate" | "cyan" | "amber" | "red";
  // What the code will do at this metric, in the contract's own terms.
  effect: string;
}

// The three telemetry bands, named for what they allow rather than for their
// numbers, so the panel reads as a defense posture.
export function bandFor(bps: number): Band {
  if (bps >= BPS_ELEVATED) {
    const critical = bps >= BPS_CRITICAL;
    return {
      label: critical ? "CRITICAL BAND" : "ELEVATED BAND",
      tone: critical ? "red" : "amber",
      effect: critical
        ? "Telemetry corroborates a severe breach. The full tier range is reachable: the tribunal may return CRITICAL_BREACH, and corridor 1 forbids dismissing the report as malicious."
        : "Telemetry corroborates a real deviation. A breach finding is available, but a full sanction is not: corridor 1 floors MALICIOUS_REPORT to NORMAL, and corridor 3 caps CRITICAL_BREACH to ELEVATED_RISK.",
    };
  }
  if (bps >= BPS_NEGLIGIBLE) {
    return {
      label: "SUB-ELEVATED BAND",
      tone: "cyan",
      effect: "Corridor 3 is active: CRITICAL_BREACH is unreachable below 2500 bps and is capped to ELEVATED_RISK when the evidence corroborates the claim, else to NORMAL. Corridor 2 does not apply above 500 bps.",
    };
  }
  return {
    label: "NEGLIGIBLE BAND",
    tone: "slate",
    effect: "Corridor 2 is active: below 500 bps the telemetry supports no breach finding whatsoever, and both CRITICAL_BREACH and ELEVATED_RISK floor to NORMAL. No document the plaintiff uploads can change that.",
  };
}

// A display-ready bps string. Kept here so the panel and the inspector agree.
export function formatBps(bps: number): string {
  return `${bps.toLocaleString("en-US")} bps`;
}

// The oracle pair bound to a treaty at proposal time. Both arrive from contract
// storage: they are the parties' agreed inputs and cannot be changed by a filing.
export interface OraclePair {
  primary: string;
  secondary: string;
}

// Reads one oracle the way the contract does -- a plain GET, then the strict
// extraction above. The status decides which failure this is, and the two are
// not interchangeable: 429 and 5xx are the contract's retryable faults, and
// everything else -- a non-2xx status, or an unparseable body -- is a definitive
// non-answer that settles neutrally. A zero is never a fallback for either.
export async function readOracle(url: string, role: PartyRole): Promise<Reading> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    // The request never completed. The contract treats a thrown web call as
    // transient, so this is the browser's nearest equivalent.
    return TRANSIENT;
  }

  if (res.status === 429 || (res.status >= 500 && res.status < 600)) return TRANSIENT;
  if (!res.ok) return UNREACHABLE;

  // Past this point the status was a 2xx, so anything that goes wrong is a
  // corrupt body rather than an outage -- unreachable, matching `_fetch_one`.
  try {
    return parseReading(JSON.parse(await res.text()), role);
  } catch {
    return UNREACHABLE;
  }
}

// Both bound oracles for one defendant, cross-examined. Sequential on purpose:
// the panel is read by a human watching two feeds resolve, and a burst of four
// parallel requests on every keystroke buys nothing.
export async function readPair(
  pair: OraclePair,
  role: PartyRole
): Promise<CrossExamination> {
  const primary = await readOracle(pair.primary, role);
  const secondary = await readOracle(pair.secondary, role);
  return crossExamine(primary, secondary);
}
