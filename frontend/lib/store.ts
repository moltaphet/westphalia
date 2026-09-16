"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentEnclave,
  Archetype,
  BiomeTheme,
  ChainOverview,
  LedgerEvent,
  NetworkConfig,
  PipelineState,
  ProtocolState,
  ReputationTier,
  StateSource,
  Treaty,
  TreatyKind,
} from "./types";
import { TREATIES, LEDGER } from "./mockData";
import { DEFAULT_NETWORK } from "./networks";
import {
  DiplomaticContract,
  WriteCancelled,
  type TxReceipt,
  type WritePlan,
} from "./contract";
import type { TrackedStatus } from "@genlayer/transaction-kit";
import { fetchChainSnapshot, type ChainSnapshot } from "./chainState";
import { ARCHETYPE_PRESETS } from "./archetypes";
import { orderEnclaves } from "./world";

// Biome + telemetry presets used when founding a new realm of each archetype.
// Defined in ./archetypes so the on-chain state mapper can share one palette
// source; re-exported here because the found-realm modal imports it from the
// store.
export { ARCHETYPE_PRESETS };

// Seed enclaves occupy Ring 1 (indices 0-3) around the Geneva core.
// Addresses are valid 40-char hex (they are passed to the on-chain contract
// as counterparty_hex, which decodes them via Address()).
export const INITIAL_ENCLAVES: AgentEnclave[] = [
  {
    id: "alpha",
    name: "Citadel Alpha",
    archetype: "Oracle Collective",
    address: "0xa1b2c3d4e5f60718293a4b5c6d7e8f9012345a1",
    collateral: 184500,
    reputation: 92,
    tier: "Sovereign",
    biomeTheme: { base: "#0e7490", ridge: "#334155", accent: "#22d3ee", elevationSeed: 1207 },
    status: "Active",
    treaties: ["t1", "t3"],
    lockedEscrowGen: 42000,
    hazardPct: 8,
    yieldApr: 4.2,
    complianceScore: 96,
    activeEnclaves: 3,
    slashingHistory: [],
    summary:
      "Founding signatory of the Westphalia accord. Anchors the cyan trade corridor of the Western Data Federation.",
    governance: "Auto-accept trade and data-sharing pacts with compliance above 85 percent.",
  },
  {
    id: "vanguard",
    name: "Vanguard Nexus",
    archetype: "Liquidity Nexus",
    address: "0xb1c2d3e4f5061728394a5b6c7d8e9f0011223345",
    collateral: 152300,
    reputation: 87,
    tier: "Trusted",
    biomeTheme: { base: "#6d28d9", ridge: "#4c1d95", accent: "#a78bfa", elevationSeed: 4410 },
    status: "Active",
    treaties: ["t1", "t2", "t4"],
    lockedEscrowGen: 38750,
    hazardPct: 21,
    yieldApr: 5.1,
    complianceScore: 91,
    activeEnclaves: 2,
    slashingHistory: [],
    summary:
      "Industrial logistics bloc on the violet amethyst biome, running redundant settlement validators.",
    governance: "Auto-accept liquidity treaties; escalate any non-aggression breach to quorum.",
  },
  {
    id: "enclave",
    name: "Sovereign Enclave",
    archetype: "Autonomous Arbiter",
    address: "0xc1d2e3f405162738495a6b7c8d9e0f1122334455",
    collateral: 98750,
    reputation: 64,
    tier: "Neutral",
    biomeTheme: { base: "#047857", ridge: "#065f46", accent: "#34d399", elevationSeed: 8821 },
    status: "Contested",
    treaties: ["t2", "t3"],
    lockedEscrowGen: 21500,
    hazardPct: 54,
    yieldApr: 3.4,
    complianceScore: 78,
    activeEnclaves: 2,
    slashingHistory: [
      { block: 1802140, reason: "Late telemetry attestation on treaty t2.", amountGen: 1800 },
    ],
    summary:
      "Emerald autonomous enclave of the Sovereign Freeholds, contesting a non-aggression clause under GenLayer arbitration.",
    governance: "Manual review of all treaties; reject clauses lacking a 24h dispute window.",
  },
  {
    id: "bastion",
    name: "Consensus Bastion",
    archetype: "Defense Vanguard",
    address: "0xd1e2f30415263748596a7b8c9d0e1f2233445566",
    collateral: 41200,
    reputation: 23,
    tier: "Rogue",
    biomeTheme: { base: "#1c1917", ridge: "#3f1d1d", accent: "#ef4444", elevationSeed: 2003 },
    status: "Slashed",
    treaties: ["t4"],
    lockedEscrowGen: 6400,
    hazardPct: 92,
    yieldApr: 0,
    complianceScore: 34,
    activeEnclaves: 1,
    slashingHistory: [
      { block: 1841980, reason: "Validated incursion breach of non-aggression treaty t4.", amountGen: 12800 },
      { block: 1820410, reason: "Repeated quorum non-participation as a delegated validator.", amountGen: 3400 },
    ],
    summary:
      "Sanctioned after a validated treaty breach. Stake partially slashed and territory under containment grid.",
    governance: "Sanctioned: treaty automation suspended pending appeal.",
  },
];

function tierForCollateral(c: number): ReputationTier {
  if (c >= 150000) return "Sovereign";
  if (c >= 80000) return "Trusted";
  if (c >= 30000) return "Neutral";
  return "Watched";
}

const PIPELINE_STEPS = [
  "Signature Verified",
  "Studio Devnet Ingested",
  "Multi-LLM Quorum Round",
  "Consensus Finalized",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The injected EIP-1193 wallet, plus the event surface MetaMask exposes for the
// account/chain listeners. `on`/`removeListener` are optional because a bare
// provider may lack them; the listeners are only bound when they exist.
interface InjectedProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

const getEthereum = (): InjectedProvider | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { ethereum?: InjectedProvider }).ethereum;

// Marks that this origin linked a wallet, so a reload silently re-links it (via
// eth_accounts, which never prompts) instead of dropping to reviewer mode.
// Cleared on an explicit disconnect.
const WALLET_STORAGE_KEY = "westphalia:wallet-linked";

// A hex wei balance (native GEN, 18 decimals) -> a short fixed-point GEN string.
function formatBalanceGen(weiHex: string): string {
  try {
    const wei = BigInt(weiHex);
    const whole = wei / 10n ** 18n;
    const frac = (wei % 10n ** 18n) / 10n ** 14n; // keep four decimal places
    return `${whole.toString()}.${frac.toString().padStart(4, "0")}`;
  } catch {
    return "0.0000";
  }
}

const shortAddress = (addr: string): string =>
  addr.length > 8 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;

// The wallet slice the top bar consumes: the linked account's identity plus the
// three lifecycle actions. Bundled so the connection UI can be lifted out of the
// store into its own component without a long prop list.
export interface WalletBundle {
  address: string | null;
  balanceGen: string | null;
  chainId: number | null;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  switchNetwork: () => void;
}

// Stale-while-revalidate cache of the last good chain snapshot. The board paints
// this on mount (see the hydration effect) so a returning visitor gets the real
// archipelago on frame ~0 instead of an empty board behind a blocking sync;
// syncChain then refreshes it in place and rewrites the cache.
const SNAPSHOT_KEY = "westphalia_last_snapshot";
const SNAPSHOT_VERSION = 1;

function saveSnapshot(snap: ChainSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: SNAPSHOT_VERSION, snap }));
  } catch {
    // storage blocked / full: the cache is best-effort
  }
}

// Read the cached snapshot, or null when absent, unparseable, or from an older
// schema. Every array the store reads back is checked, so a corrupt or
// stale-shape entry degrades to a normal cold load instead of throwing at
// render time.
function loadSnapshot(): ChainSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; snap?: ChainSnapshot };
    if (parsed?.v !== SNAPSHOT_VERSION) return null;
    const snap = parsed.snap;
    if (
      !snap ||
      !snap.overview ||
      !Array.isArray(snap.enclaves) ||
      !Array.isArray(snap.treaties) ||
      !Array.isArray(snap.ledger)
    ) {
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export interface FoundRealmInput {
  name: string;
  archetype: Archetype;
  collateral: number;
  governance: string;
}

let seq = 1000;

// Central state hub for the dynamic archipelago. Owns enclaves, treaties,
// ledger, selection/focus, network/wallet, and the transaction pipeline.
export function useWestphaliaStore() {
  // The board starts EMPTY, not seeded.
  //
  // It used to start on INITIAL_ENCLAVES and swap to the live archipelago when
  // the first chain read landed a few seconds later. Because the seed holds a
  // different number of enclaves than the chain does, that swap did not read as
  // a refresh -- islands appeared out of nowhere and others changed identity
  // under the viewer, with the seed's names and telemetry gone. Every visitor
  // got a flash of fabricated protocol state before the real one, on a board
  // whose entire claim is that it is not a mock.
  //
  // An empty archipelago plus a "loading" source says the same thing honestly
  // and renders the same islands steady. The seed still appears, but only once
  // a read has actually failed -- see syncChain, and the reviewer-mode path it
  // has always had.
  const [enclaves, setEnclaves] = useState<AgentEnclave[]>([]);
  const [treaties, setTreaties] = useState<Treaty[]>([]);
  const [ledger, setLedger] = useState<LedgerEvent[]>([]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTreaty, setSelectedTreaty] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const [network, setNetwork] = useState<NetworkConfig>(DEFAULT_NETWORK);
  const [connected, setConnected] = useState(false);
  // True while no wallet write path exists, so every action resolves to a
  // simulated receipt. This is about *writes*, not about where the displayed
  // data came from -- see stateSource for that.
  const [reviewerMode, setReviewerMode] = useState(true);

  // Injected-wallet lifecycle. `connected`/`reviewerMode` above gate *writes*
  // (whether a live signer exists); these describe the linked account itself.
  const [address, setAddress] = useState<string | null>(null);
  const [balanceGen, setBalanceGen] = useState<string | null>(null);
  // The chain the injected wallet is currently on (from eth_chainId /
  // chainChanged), distinct from `network` (the app's selected read target).
  // They differ exactly when the wallet is on the wrong network.
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Where the board's islands and treaties came from. Starts at "loading"
  // because the initial board is empty and nothing has answered yet; the first
  // syncChain resolution moves it to live / empty / simulated.
  const [stateSource, setStateSource] = useState<StateSource>("loading");
  // True while a background syncChain is in flight, surfaced as a subtle
  // "SYNCING ON-CHAIN..." indicator in the header. Distinct from stateSource:
  // the board can be showing a cached-but-real archipelago (stateSource "live")
  // while a refresh runs behind it, so this must never gate the board's render.
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<TxReceipt | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [chainOverview, setChainOverview] = useState<ChainOverview | null>(null);

  // The write currently waiting for a signature, if any. Non-null exactly while
  // the Transaction Kit's approval panel is on screen.
  const [txRequest, setTxRequest] = useState<WritePlan | null>(null);
  // The other half of that handshake: the promise the contract's write() is
  // awaiting, resolved by the panel's outcome and rejected by an abort.
  const pendingWrite = useRef<{
    resolve: (status: TrackedStatus) => void;
    reject: (err: unknown) => void;
  } | null>(null);

  const contractRef = useRef<DiplomaticContract>(new DiplomaticContract(network));

  // Mirrors of state read by the EIP-1193 event handlers. The handlers are
  // bound to the provider once (see the listeners effect) and must not close
  // over a stale network or address, so they read these instead.
  const networkRef = useRef(network);
  const addressRef = useRef<string | null>(null);
  useEffect(() => {
    networkRef.current = network;
  }, [network]);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  // Supply a write to the approval panel and wait for what the user decides.
  //
  // Writes are triggered from all over the board -- the HUD, the treasury view,
  // the found-realm modal -- so the gate is driven by this one piece of state
  // rather than owned by any of those components. Every live write therefore
  // passes through the same fee quote, fee-policy verification and signature.
  const authorizeWrite = useCallback((plan: WritePlan) => {
    return new Promise<TrackedStatus>((resolve, reject) => {
      pendingWrite.current = { resolve, reject };
      setTxRequest(plan);
    });
  }, []);

  const settleWrite = useCallback((status: TrackedStatus) => {
    setTxRequest(null);
    const pending = pendingWrite.current;
    pendingWrite.current = null;
    pending?.resolve(status);
  }, []);

  const abortWrite = useCallback(() => {
    setTxRequest(null);
    const pending = pendingWrite.current;
    pendingWrite.current = null;
    pending?.reject(new WriteCancelled());
  }, []);

  // Every contract instance the store builds is wired to the gate before it is
  // used, including the one rebuilt on a network change.
  const bindContract = useCallback(
    (contract: DiplomaticContract) => {
      contract.setAuthorizer(authorizeWrite);
      contractRef.current = contract;
      return contract;
    },
    [authorizeWrite]
  );

  const state: ProtocolState = useMemo(() => {
    const totalEscrowGen = enclaves.reduce((s, x) => s + x.lockedEscrowGen, 0);
    const avgRep = enclaves.reduce((s, x) => s + x.reputation, 0) / (enclaves.length || 1);
    const stressed = enclaves.filter(
      (e) => e.status === "Contested" || e.status === "Slashed"
    ).length;
    const stabilityIndex = Math.round(Math.max(0, Math.min(100, avgRep - stressed * 6)));
    return { stabilityIndex, totalEscrowGen, enclaves, treaties, ledger };
  }, [enclaves, treaties, ledger]);

  const pushLedger = useCallback((ev: Omit<LedgerEvent, "id">) => {
    setLedger((prev) => [{ ...ev, id: `l${seq++}` }, ...prev].slice(0, 48));
  }, []);

  // Sync the board against the chain: the protocol overview plus the islands
  // and treaties themselves. Runs on mount, on network change, and after every
  // write so a new treaty appears without a reload.
  //
  // Reads need no wallet (GenLayer answers views over gen_call), so this is not
  // gated on a connection. Three outcomes, each rendered honestly:
  //   - contract answered with enclaves -> the live archipelago
  //   - contract answered, nothing founded -> an empty board, not a mock one
  //   - contract unreachable -> on a first read the reviewer seed, labelled
  //     simulated; on a later one nothing is replaced, so a live board that
  //     misses a refresh stays on screen rather than rolling back to the seed.
  // Whether anything has been put on the board yet -- a chain snapshot, or the
  // reviewer seed standing in for one. Until it is true the board is
  // legitimately empty and a failed read has something it may fall back to.
  const settled = useRef(false);

  // The sync currently in flight, or null. syncChain is triggered from several
  // places -- mount, a network switch, connectWallet, and after every confirmed
  // write -- and React re-runs mount effects in development, so two of these can
  // fire at once. Each sync is a burst of gen_call reads and the public RPC caps
  // a client at 30 per minute, so overlapping syncs were a direct route to a
  // 429. A second caller now awaits the sync already running instead of starting
  // its own. There is deliberately no interval poller: the board reads the chain
  // only on mount, on a network change, and after a confirmed transaction.
  const syncing = useRef<Promise<void> | null>(null);

  const syncChain = useCallback(async () => {
    if (syncing.current) return syncing.current;
    setIsSyncing(true);
    const run = (async () => {
      const snap = await fetchChainSnapshot(contractRef.current);
      if (!snap) {
        // A refresh that could not read the chain is not evidence that the
        // protocol is empty. If something is already on screen it remains the
        // best account of the protocol on hand, so leave it and its source
        // alone -- "live" for a board that is stale but real. If nothing is,
        // then this is the FIRST read failing, and the reviewer seed is exactly
        // what it exists for.
        if (settled.current) return;
        settled.current = true;
        setEnclaves(orderEnclaves(INITIAL_ENCLAVES));
        setTreaties(TREATIES);
        setLedger(LEDGER);
        setSelectedId(INITIAL_ENCLAVES[0]?.id ?? null);
        setStateSource("simulated");
        return;
      }
      settled.current = true;
      // Persist the fresh snapshot so the next cold load hydrates instantly.
      saveSnapshot(snap);
      setChainOverview(snap.overview);
      // Merge the on-chain roster with any enclave founded in THIS browser
      // session that the snapshot does not yet include, so a just-founded realm
      // is not wiped by the next sync before it is indexed on-chain. A session-
      // founded enclave carries `spawnedAt` (see foundRealm) and a `realm-` id;
      // once the chain reports that same id the chain copy wins.
      setEnclaves((prev) => {
        const incoming = new Set(snap.enclaves.map((e) => e.id));
        const localPending = prev.filter(
          (e) => e.spawnedAt !== undefined && !incoming.has(e.id)
        );
        return orderEnclaves([...snap.enclaves, ...localPending]);
      });
      setTreaties(snap.treaties);
      // The feed is replaced with it. Leaving the simulated seed in place would
      // print fabricated history under real islands -- events naming enclaves
      // the contract has never heard of.
      setLedger(snap.ledger);
      // Keep the selection pointing at an enclave that still exists -- one the
      // chain returned, or a realm founded this session (kept above). Otherwise
      // fall back to the first on-chain enclave, or leave it where it is when
      // the chain is empty so a fresh local realm stays selected.
      setSelectedId((prev) =>
        prev && (snap.enclaves.some((e) => e.id === prev) || prev.startsWith("realm-"))
          ? prev
          : (snap.enclaves[0]?.id ?? prev ?? null)
      );
      setStateSource(snap.enclaves.length > 0 ? "live" : "empty");
    })().finally(() => {
      syncing.current = null;
      setIsSyncing(false);
    });
    syncing.current = run;
    return run;
  }, []);

  // Zero-wait hydration (stale-while-revalidate): paint the last good snapshot
  // from localStorage on mount, before the network read returns, so a returning
  // visitor gets the real archipelago immediately instead of an empty board.
  // This runs only on the client -- localStorage is untouched during SSR and
  // the initial client render, which both start from the empty board -- so it
  // introduces no hydration mismatch. settled is set so that a first read which
  // then FAILS keeps this cached board rather than dropping to the reviewer
  // seed; a read that SUCCEEDS overwrites it in place (no clear, no flash).
  useEffect(() => {
    const cached = loadSnapshot();
    if (!cached) return;
    settled.current = true;
    setChainOverview(cached.overview);
    setEnclaves(orderEnclaves(cached.enclaves));
    setTreaties(cached.treaties);
    setLedger(cached.ledger);
    setSelectedId((prev) => prev ?? cached.enclaves[0]?.id ?? null);
    setStateSource(cached.enclaves.length > 0 ? "live" : "empty");
  }, []);

  // Hydrate the board from the deployed contract on mount, and re-read whenever
  // the selected network changes. No wallet is required: GenLayer answers views
  // over gen_call, so a first-time visitor sees real protocol state rather than
  // seed data. This runs in the background over the cached board above.
  useEffect(() => {
    void syncChain();
  }, [network, syncChain]);

  // Rebind the contract client whenever the network changes, so a live
  // connection follows the selected RPC instead of staying pinned to the
  // chain it was originally opened against.
  useEffect(() => {
    const wasConnected = contractRef.current.connected;
    const contract = bindContract(new DiplomaticContract(network));
    if (!wasConnected) return;
    // Rebind the signer to the new RPC for the account already linked, without
    // reopening the wallet (the address is known, so no request is made).
    void contract.connect(addressRef.current ?? undefined).then((ok) => {
      setConnected(ok);
      setReviewerMode(!ok);
    });
  }, [network, syncChain, bindContract]);

  // Transaction pipeline: the on-chain call runs FIRST (step 0, while the UI
  // shows "Signature Verified"); a revert aborts the animation and surfaces
  // the error instead of faking success.
  const runPipeline = useCallback(
    async (label: string, finalize: () => Promise<void>) => {
      setPipeline({ active: true, label, step: 0, steps: PIPELINE_STEPS, done: false });
      try {
        await finalize();
      } catch (err) {
        // A dismissed approval panel is an abort, not a failure. Clearing the
        // pipeline without a banner also stops the callback where it stands, so
        // nothing downstream records state for a write that never happened.
        if (err instanceof WriteCancelled) {
          setPipeline(null);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setPipeline({
          active: true,
          label,
          step: 0,
          steps: PIPELINE_STEPS,
          done: true,
          error: msg,
        });
        await sleep(2600);
        setPipeline(null);
        return;
      }
      for (let i = 1; i < PIPELINE_STEPS.length; i++) {
        setPipeline((p) => (p ? { ...p, step: i } : p));
        await sleep(i === 2 ? 1000 : 650);
      }
      setPipeline((p) => (p ? { ...p, step: PIPELINE_STEPS.length - 1, done: true } : p));
      void syncChain();
      await sleep(1000);
      setPipeline(null);
    },
    [syncChain]
  );

  // Selection / camera focus.
  const selectEnclave = useCallback((id: string | null) => {
    setSelectedId(id);
    setFocusId(id);
    setSelectedTreaty(null);
  }, []);
  const focusEnclave = useCallback((id: string) => {
    setSelectedId(id);
    setFocusId(id);
  }, []);

  // Read the native GEN balance for `addr` from the injected wallet and format
  // it for the pill. A failed read keeps the prior figure rather than flashing
  // a zero the chain never reported.
  const refreshBalance = useCallback(async (addr: string) => {
    const eth = getEthereum();
    if (!eth) return;
    try {
      const wei = (await eth.request({
        method: "eth_getBalance",
        params: [addr, "latest"],
      })) as string;
      setBalanceGen(formatBalanceGen(wei));
    } catch {
      // keep the last known balance
    }
  }, []);

  // Bring the store to the connected state for an already-authorized `account`:
  // record the address, chain, and balance, then build a live signer so writes
  // stop simulating. Used by the connect button, the account-switch listener,
  // and the on-mount silent re-link -- none of which should re-prompt, so the
  // account is handed to contract.connect() rather than re-requested.
  const applyConnection = useCallback(
    async (account: string) => {
      setAddress(account);
      setConnected(true);
      setReviewerMode(false);
      const eth = getEthereum();
      if (eth) {
        try {
          const cidHex = (await eth.request({ method: "eth_chainId" })) as string;
          setWalletChainId(parseInt(cidHex, 16));
        } catch {
          setWalletChainId(null);
        }
      }
      void refreshBalance(account);
      const contract = bindContract(new DiplomaticContract(networkRef.current));
      await contract.connect(account);
      try {
        localStorage.setItem(WALLET_STORAGE_KEY, "1");
      } catch {
        // best-effort; a reload simply starts disconnected
      }
      void syncChain();
    },
    [bindContract, refreshBalance, syncChain]
  );

  // Tear the wallet link down without a page reload: clear the account, revert
  // to an account-less contract (writes simulate again), and forget the
  // auto-reconnect flag so the next load starts disconnected.
  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setBalanceGen(null);
    setWalletChainId(null);
    setConnected(false);
    setReviewerMode(true);
    bindContract(new DiplomaticContract(networkRef.current));
    try {
      localStorage.removeItem(WALLET_STORAGE_KEY);
    } catch {
      // ignore
    }
    pushLedger({
      block: 1843000 + seq,
      kind: "consensus-verdict",
      actor: "protocol",
      message: "Wallet unlinked. Reviewer read-only mode active.",
    });
  }, [bindContract, pushLedger]);

  // Prompt the wallet to move to the app's selected network, adding the chain
  // first when the wallet does not recognize it (error 4902).
  const switchNetwork = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;
    const target = networkRef.current;
    const chainIdHex = `0x${target.chainId.toString(16)}`;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: target.label,
                rpcUrls: [target.rpcUrl],
                nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                blockExplorerUrls: [target.explorerUrl],
              },
            ],
          });
        } catch {
          // user declined the add; the wrong-network badge stays up
        }
      }
      // any other error (e.g. the user rejected the switch) leaves the badge up
    }
  }, []);

  // Connect button: prompt for access, then link the first returned account.
  // With no injected wallet, stay in reviewer mode and say so.
  const connectWallet = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setReviewerMode(true);
      setConnected(false);
      pushLedger({
        block: 1843000 + seq,
        kind: "consensus-verdict",
        actor: "protocol",
        message: `No wallet detected. Reviewer simulation active on ${networkRef.current.label}.`,
      });
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[] | undefined;
      const account = accounts?.[0];
      if (!account) {
        setReviewerMode(true);
        setConnected(false);
        return;
      }
      await applyConnection(account);
      pushLedger({
        block: 1843000 + seq,
        kind: "consensus-verdict",
        actor: "protocol",
        message: `Wallet ${shortAddress(account)} linked to ${networkRef.current.label}.`,
      });
    } catch {
      // The user rejected the connection request: remain in reviewer mode.
      setReviewerMode(true);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [applyConnection, pushLedger]);

  // EIP-1193 account switch: relink the new account, or -- when the array is
  // empty (the wallet was locked or every account revoked) -- disconnect.
  const handleAccountsChanged = useCallback(
    (accounts: string[]) => {
      const account = accounts?.[0];
      if (!account) {
        disconnectWallet();
        return;
      }
      if (account.toLowerCase() === (addressRef.current ?? "").toLowerCase()) return;
      void applyConnection(account);
    },
    [applyConnection, disconnectWallet]
  );

  // EIP-1193 chain switch: record the wallet's new chain (which drives the
  // wrong-network badge) and refresh the balance for it.
  const handleChainChanged = useCallback(
    (chainIdHex: string) => {
      const cid =
        typeof chainIdHex === "string" ? parseInt(chainIdHex, 16) : Number(chainIdHex);
      setWalletChainId(Number.isFinite(cid) ? cid : null);
      const addr = addressRef.current;
      if (addr) void refreshBalance(addr);
    },
    [refreshBalance]
  );

  // Bind the wallet's EIP-1193 events once, and silently re-link on mount if
  // this origin connected before (eth_accounts never prompts). The handlers are
  // stable (they read live values through refs), so this binds a single time.
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    const onAccounts = (...args: unknown[]) =>
      handleAccountsChanged((args[0] as string[]) ?? []);
    const onChain = (...args: unknown[]) => handleChainChanged(args[0] as string);
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);

    let reconnect = false;
    try {
      reconnect = localStorage.getItem(WALLET_STORAGE_KEY) === "1";
    } catch {
      reconnect = false;
    }
    if (reconnect) {
      void (async () => {
        try {
          const accounts = (await eth.request({ method: "eth_accounts" })) as
            | string[]
            | undefined;
          const account = accounts?.[0];
          if (account) {
            await applyConnection(account);
          } else {
            try {
              localStorage.removeItem(WALLET_STORAGE_KEY);
            } catch {
              // ignore
            }
          }
        } catch {
          // no silent reconnect available; stay disconnected
        }
      })();
    }

    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [handleAccountsChanged, handleChainChanged, applyConnection]);

  const enterReviewerMode = useCallback(() => {
    setReviewerMode(true);
    setConnected(false);
    // Reviewer mode is read-only, not simulated: it changes no data. Say only
    // what is actually on screen -- the seed is installed by syncChain when a
    // read fails, not by the mode switch, so on a live board this must not
    // claim simulated data was loaded.
    pushLedger({
      block: 1843000 + seq,
      kind: "consensus-verdict",
      actor: "protocol",
      message:
        stateSource === "simulated"
          ? "Ephemeral reviewer mode engaged. Read-only simulation data loaded."
          : "Ephemeral reviewer mode engaged. Reading only; no wallet attached.",
    });
  }, [pushLedger, stateSource]);

  const proposeTreaty = useCallback(
    async (partnerId: string, kind: TreatyKind, terms: string, bondGen: number) => {
      await runPipeline(`Propose ${kind} treaty`, async () => {
        // The proposer is the selected enclave, or the first one when nothing
        // is selected. Never a hardcoded seed id: once the board has hydrated
        // from chain that id belongs to no island, and the treaty would name a
        // party the protocol cannot resolve.
        const self = selectedId ?? enclaves[0]?.id ?? "";
        const partner = enclaves.find((e) => e.id === partnerId);
        // Oracle feeds are treaty-bound on-chain (V3): the proposer picks the
        // telemetry sources, the counterparty inspects them before ratifying.
        const oracle = `https://telemetry.westphalia.example/${partnerId}/metrics`;
        const receipt = await contractRef.current.proposeTreaty(
          {
            counterpartyHex: partner?.address ?? partnerId,
            kind,
            terms,
            // 90-day bounded expiry (the contract rejects 0 / unbounded).
            expiresAt: BigInt(Math.floor(Date.now() / 1000) + 90 * 86400),
            oraclePrimary: oracle,
            // Independent second feed so adjudication has a cross-check.
            oracleSecondary: `https://telemetry.westphalia.example/${partnerId}/metrics?feed=b`,
          },
          bondGen
        );
        setLastReceipt(receipt);
        // Capture the on-chain treaty id: the contract's counter is
        // next_treaty_id AFTER the write, so this proposal is counter - 1.
        let chainTreatyId: number | undefined;
        const ov = await contractRef.current.read<Record<string, unknown>>(
          "get_protocol_overview"
        );
        const next = ov ? Number(ov.next_treaty_id) : NaN;
        if (Number.isFinite(next) && next > 1) chainTreatyId = next - 1;
        const id = `t${seq}`;
        const treaty: Treaty = {
          id,
          kind,
          status: "pending",
          parties: [self, partnerId],
          bondGen,
          createdBlock: 1843000 + seq,
          chainId: chainTreatyId,
          terms,
        };
        setTreaties((prev) => [...prev, treaty]);
        setEnclaves((prev) =>
          prev.map((e) =>
            e.id === self || e.id === partnerId
              ? { ...e, treaties: [...e.treaties, id], lockedEscrowGen: e.lockedEscrowGen + bondGen / 2 }
              : e
          )
        );
        pushLedger({
          block: treaty.createdBlock,
          kind: "treaty-proposed",
          actor: self,
          message: `Proposed ${kind} treaty to ${partner?.name ?? partnerId}. Bond locked.`,
          valueGen: bondGen,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, enclaves]
  );

  // Counterparty signs a pending treaty and locks its matching bond.
  const ratifyTreaty = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Ratify ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        if (!t || t.chainId === undefined) return; // simulated treaties
        const receipt = await contractRef.current.ratifyTreaty(
          BigInt(t.chainId),
          t.bondGen
        );
        setLastReceipt(receipt);
        setTreaties((prev) =>
          prev.map((x) => (x.id === treatyId ? { ...x, status: "active" } : x))
        );
        pushLedger({
          block: 1843000 + seq,
          kind: "treaty-signed",
          actor: selectedId ?? "protocol",
          message: `Treaty ${treatyId.toUpperCase()} ratified. Matching bond locked.`,
          valueGen: t.bondGen,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  // Amicable mutual dissolution: both signatures refund both bonds intact.
  const dissolveTreaty = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Dissolve ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        if (!t) return;
        if (t.chainId !== undefined) {
          const receipt = await contractRef.current.dissolveTreaty(BigInt(t.chainId));
          setLastReceipt(receipt);
        }
        setTreaties((prev) =>
          prev.map((x) => (x.id === treatyId ? { ...x, status: "resolved" } : x))
        );
        pushLedger({
          block: 1843000 + seq,
          kind: "escrow-released",
          actor: selectedId ?? "protocol",
          message: `Dissolution signed for ${treatyId.toUpperCase()}. Bonds refund on both signatures.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  // Unilateral exit with penalty (P2 fix): first call registers the notice,
  // second call (after the 3-day window) executes at 10% penalty to reserves.
  const exitTreaty = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Exit ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        if (!t) return;
        if (t.chainId !== undefined) {
          const receipt = await contractRef.current.exitTreaty(BigInt(t.chainId));
          setLastReceipt(receipt);
        }
        const alreadyRequested = t.exitRequested === true;
        setTreaties((prev) =>
          prev.map((x) =>
            x.id === treatyId
              ? alreadyRequested
                ? { ...x, status: "resolved", exitRequested: false }
                : { ...x, exitRequested: true }
              : x
          )
        );
        pushLedger({
          block: 1843000 + seq,
          kind: alreadyRequested ? "escrow-released" : "treaty-proposed",
          actor: selectedId ?? "protocol",
          message: alreadyRequested
            ? `Unilateral exit executed on ${treatyId.toUpperCase()}. 10% penalty to reserves.`
            : `Exit notice registered on ${treatyId.toUpperCase()}. Counterparty retains dispute standing for 3 days.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  const triggerDispute = useCallback(
    async (treatyId: string, evidence: string) => {
      await runPipeline(`Dispute ${treatyId.toUpperCase()}`, async () => {
        const t = treaties.find((x) => x.id === treatyId);
        // V3: adjudication runs against the treaty-bound oracles; the caller
        // supplies only the allegation and its evidence hash.
        const bond = t
          ? Math.max(500, Math.ceil(t.bondGen * 0.05))
          : 500;
        const receipt = await contractRef.current.triggerDispute(
          BigInt(t?.chainId ?? 0),
          evidence,
          `ipfs://evidence/${treatyId}`,
          `ev-${treatyId}-${Date.now()}`,
          bond
        );
        setLastReceipt(receipt);
        setTreaties((prev) =>
          prev.map((x) =>
            x.id === treatyId
              ? {
                  ...x,
                  status: "pending",
                  dispute: {
                    validators: 5,
                    consensus: 50,
                    evidenceUri: evidence,
                    openedBlock: 1843000 + seq,
                  },
                }
              : x
          )
        );
        pushLedger({
          block: 1843000 + seq,
          kind: "dispute-opened",
          actor: selectedId ?? "protocol",
          message: `Dispute opened on ${treatyId.toUpperCase()}. GenLayer validators empaneled.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId, treaties]
  );

  const claimEscrow = useCallback(
    async (treatyId: string) => {
      await runPipeline(`Claim ${treatyId.toUpperCase()}`, async () => {
        // claim_payout withdraws the caller's full claimable balance
        // (pull-pattern), not a per-treaty amount.
        const receipt = await contractRef.current.claimPayout();
        setLastReceipt(receipt);
        pushLedger({
          block: 1843000 + seq,
          kind: "escrow-released",
          actor: selectedId ?? "protocol",
          message: `Payout claimed via pull-pattern withdrawal (${treatyId.toUpperCase()} context).`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId]
  );

  // Sovereign exit: withdraw the caller's enclave collateral (the enclave
  // is dissolved on-chain once its escrow obligations are clear).
  const withdrawCollateral = useCallback(async () => {
    await runPipeline("Withdraw sovereign collateral", async () => {
      const receipt = await contractRef.current.withdrawCollateral();
      setLastReceipt(receipt);
      pushLedger({
        block: 1843000 + seq,
        kind: "escrow-released",
        actor: selectedId ?? "protocol",
        message:
          "Sovereign collateral withdrawal executed. Enclave dissolved and stake returned.",
      });
    });
  }, [runPipeline, pushLedger, selectedId]);

  // Deploy a brand new sovereign enclave into the next orbital slot.
  const foundRealm = useCallback(
    async (input: FoundRealmInput) => {
      await runPipeline(`Found Sovereignty ${input.name}`, async () => {
        const receipt = await contractRef.current.foundSovereignty(
          input.name,
          input.archetype,
          input.governance,
          input.collateral
        );
        setLastReceipt(receipt);
        const preset = ARCHETYPE_PRESETS[input.archetype];
        const id = `realm-${seq}`;
        // Deterministic valid 40-char hex address: founded realms must be
        // usable as live treaty counterparties (the contract parses the full
        // string with Address(); a truncated pseudo-address would revert).
        const h = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
        const address =
          "0x" +
          [2654435761, 40503, 48271, 1103515245, 3266489917]
            .map((k, i) => h(Math.imul(seq + i + 1, k)))
            .join("");
        const enclave: AgentEnclave = {
          id,
          name: input.name,
          archetype: input.archetype,
          address,
          collateral: input.collateral,
          reputation: 70,
          tier: tierForCollateral(input.collateral),
          biomeTheme: { ...preset.biome, elevationSeed: (seq * 131) % 99999 },
          status: "Active",
          treaties: [],
          lockedEscrowGen: Math.round(input.collateral * 0.15),
          hazardPct: 12,
          yieldApr: preset.yieldApr,
          complianceScore: 100,
          activeEnclaves: 0,
          slashingHistory: [],
          summary: `${input.archetype}. ${preset.blurb}`,
          governance: input.governance,
          spawnedAt: Date.now(),
        };
        // Inserted in canonical order rather than appended, so the island this
        // renders at is the same slot the next chain sync will put it in. An
        // append would place it last and then hop it into place a moment later.
        setEnclaves((prev) => orderEnclaves([...prev, enclave]));
        pushLedger({
          block: 1843000 + seq,
          kind: "realm-founded",
          actor: id,
          message: `Sovereignty ${input.name} deployed as ${input.archetype}. Collateral bonded.`,
          valueGen: input.collateral,
        });
        // Fly camera to and select the new realm.
        setSelectedId(id);
        setFocusId(id);
        setSelectedTreaty(null);
      });
    },
    [runPipeline, pushLedger]
  );

  return {
    state,
    enclaves,
    treaties,
    ledger,
    hoveredId,
    selectedId,
    selectedTreaty,
    focusId,
    network,
    connected,
    reviewerMode,
    stateSource,
    isSyncing,
    lastReceipt,
    pipeline,
    chainOverview,
    txRequest,
    // The linked account and its lifecycle actions, bundled for the top bar's
    // wallet component.
    wallet: {
      address,
      balanceGen,
      chainId: walletChainId,
      connecting,
      connect: connectWallet,
      disconnect: disconnectWallet,
      switchNetwork,
    } satisfies WalletBundle,
    setHoveredId,
    selectEnclave,
    focusEnclave,
    setSelectedTreaty,
    setNetwork,
    connectWallet,
    enterReviewerMode,
    settleWrite,
    abortWrite,
    proposeTreaty,
    ratifyTreaty,
    dissolveTreaty,
    exitTreaty,
    triggerDispute,
    claimEscrow,
    withdrawCollateral,
    foundRealm,
    syncChain,
  };
}

export type WestphaliaStore = ReturnType<typeof useWestphaliaStore>;
