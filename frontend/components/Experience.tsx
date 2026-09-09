"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { buildProtocolState } from "@/lib/mockData";
import { generateWorld } from "@/lib/world";
import { DEFAULT_NETWORK } from "@/lib/networks";
import { DiplomaticContract, type TxReceipt } from "@/lib/contract";
import type {
  AppView,
  LedgerEvent,
  NetworkConfig,
  PipelineState,
  ProtocolState,
  Treaty,
  TreatyKind,
} from "@/lib/types";
import HudOverlay from "./HudOverlay";
import TopBar from "./TopBar";
import GlobalFeedback from "./GlobalFeedback";
import TopologyView from "./views/TopologyView";
import TribunalView from "./views/TribunalView";
import TreasuryView from "./views/TreasuryView";

// The WebGL board is browser-only; disable SSR so the build never renders a
// canvas on the server.
const DiplomaticBoard = dynamic(() => import("./DiplomaticBoard"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="font-mono text-xs tracking-widest text-cyan-400 animate-pulseGlow">
        INITIALIZING DIPLOMATIC BOARD...
      </div>
    </div>
  ),
});

// Tactical transaction pipeline stages shown for propose / dispute flows.
const PIPELINE_STEPS = [
  "Signature Verified",
  "Studio Devnet Ingested",
  "Multi-LLM Quorum Round",
  "Consensus Finalized",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ExperienceApi {
  network: NetworkConfig;
  connected: boolean;
  reviewerMode: boolean;
  lastReceipt: TxReceipt | null;
  pipeline: PipelineState | null;
  setNetwork: (n: NetworkConfig) => void;
  connectWallet: () => Promise<void>;
  enterReviewerMode: () => void;
  proposeTreaty: (
    partnerId: string,
    kind: TreatyKind,
    terms: string,
    bondGen: number
  ) => Promise<void>;
  triggerDispute: (treatyId: string, evidence: string) => Promise<void>;
  claimEscrow: (treatyId: string) => Promise<void>;
}

let ledgerSeq = 100;

export default function Experience() {
  const initial = useMemo(() => buildProtocolState(), []);
  const [state, setState] = useState<ProtocolState>(initial);
  const tiles = useMemo(() => generateWorld(), []);
  const [view, setView] = useState<AppView>("world");

  // Auto-select the active slashed / contested territory on mount so the
  // dossier is never empty.
  const defaultZone = useMemo(() => {
    const slashed = initial.sovereignties.find((s) => s.status === "slashed");
    const disputed = initial.sovereignties.find((s) => s.status === "disputed");
    return (slashed ?? disputed ?? initial.sovereignties[0])?.id ?? null;
  }, [initial]);

  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(defaultZone);
  const [selectedTreaty, setSelectedTreaty] = useState<string | null>(null);
  // Camera focus is decoupled from dossier selection: the board opens framed
  // on the whole archipelago and only tightens on an explicit citadel click.
  const [focusZone, setFocusZone] = useState<string | null>(null);

  const [network, setNetwork] = useState<NetworkConfig>(DEFAULT_NETWORK);
  const [connected, setConnected] = useState(false);
  const [reviewerMode, setReviewerMode] = useState(true);
  const [lastReceipt, setLastReceipt] = useState<TxReceipt | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);

  const contractRef = useRef<DiplomaticContract>(new DiplomaticContract(network));

  const pushLedger = useCallback((ev: Omit<LedgerEvent, "id">) => {
    setState((prev) => ({
      ...prev,
      ledger: [{ ...ev, id: `l${ledgerSeq++}` }, ...prev.ledger].slice(0, 40),
    }));
  }, []);

  // Drive the multi-step tactical progress overlay, then run the finalizer
  // that commits the state change once the round is "finalized".
  const runPipeline = useCallback(
    async (label: string, finalize: () => Promise<void>) => {
      setPipeline({ active: true, label, step: 0, steps: PIPELINE_STEPS, done: false });
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        setPipeline((p) => (p ? { ...p, step: i } : p));
        await sleep(i === 2 ? 1000 : 650);
      }
      await finalize();
      setPipeline((p) =>
        p ? { ...p, step: PIPELINE_STEPS.length - 1, done: true } : p
      );
      await sleep(1000);
      setPipeline(null);
    },
    []
  );

  const connectWallet = useCallback(async () => {
    const contract = new DiplomaticContract(network);
    contractRef.current = contract;
    const ok = await contract.connect();
    setConnected(ok);
    setReviewerMode(!ok);
    pushLedger({
      block: 1843000 + ledgerSeq,
      kind: "consensus-verdict",
      actor: "protocol",
      message: ok
        ? `Wallet linked to ${network.label}.`
        : `No wallet detected. Reviewer simulation active on ${network.label}.`,
    });
  }, [network, pushLedger]);

  const enterReviewerMode = useCallback(() => {
    setReviewerMode(true);
    setConnected(false);
    pushLedger({
      block: 1843000 + ledgerSeq,
      kind: "consensus-verdict",
      actor: "protocol",
      message: "Ephemeral reviewer mode engaged. Read-only simulation data loaded.",
    });
  }, [pushLedger]);

  const proposeTreaty = useCallback(
    async (partnerId: string, kind: TreatyKind, terms: string, bondGen: number) => {
      await runPipeline(`Propose ${kind} treaty`, async () => {
        const receipt = await contractRef.current.proposeTreaty(
          partnerId,
          kind,
          terms,
          bondGen
        );
        setLastReceipt(receipt);
        const partner = state.sovereignties.find((s) => s.id === partnerId);
        const newId = `t${ledgerSeq}`;
        const treaty: Treaty = {
          id: newId,
          kind,
          status: "pending",
          parties: [selectedZone ?? "alpha", partnerId],
          bondGen,
          createdBlock: 1843000 + ledgerSeq,
          terms,
        };
        setState((prev) => ({
          ...prev,
          treaties: [...prev.treaties, treaty],
          totalEscrowGen: prev.totalEscrowGen + bondGen,
        }));
        pushLedger({
          block: treaty.createdBlock,
          kind: "treaty-proposed",
          actor: selectedZone ?? "alpha",
          message: `Proposed ${kind} treaty to ${partner?.name ?? partnerId}. Bond locked.`,
          valueGen: bondGen,
        });
      });
    },
    [runPipeline, pushLedger, selectedZone, state.sovereignties]
  );

  const triggerDispute = useCallback(
    async (treatyId: string, evidence: string) => {
      await runPipeline(`Dispute ${treatyId.toUpperCase()}`, async () => {
        const receipt = await contractRef.current.triggerDispute(treatyId, evidence);
        setLastReceipt(receipt);
        setState((prev) => ({
          ...prev,
          treaties: prev.treaties.map((t) =>
            t.id === treatyId
              ? {
                  ...t,
                  status: "pending",
                  dispute: {
                    validators: 5,
                    consensus: 50,
                    evidenceUri: evidence,
                    openedBlock: 1843000 + ledgerSeq,
                  },
                }
              : t
          ),
        }));
        pushLedger({
          block: 1843000 + ledgerSeq,
          kind: "dispute-opened",
          actor: selectedZone ?? "protocol",
          message: `Dispute opened on ${treatyId}. GenLayer validators empaneled.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedZone]
  );

  const claimEscrow = useCallback(
    async (treatyId: string) => {
      const receipt = await contractRef.current.claimEscrow(treatyId);
      setLastReceipt(receipt);
      pushLedger({
        block: 1843000 + ledgerSeq,
        kind: "escrow-released",
        actor: selectedZone ?? "protocol",
        message: `Escrow released for ${treatyId} via pull-pattern withdrawal.`,
      });
    },
    [pushLedger, selectedZone]
  );

  const api: ExperienceApi = {
    network,
    connected,
    reviewerMode,
    lastReceipt,
    pipeline,
    setNetwork,
    connectWallet,
    enterReviewerMode,
    proposeTreaty,
    triggerDispute,
    claimEscrow,
  };

  return (
    <>
      {view === "world" && (
        <>
          <DiplomaticBoard
            state={state}
            tiles={tiles}
            hoveredZone={hoveredZone}
            selectedZone={selectedZone}
            focusZone={focusZone}
            selectedTreaty={selectedTreaty}
            onHoverZone={setHoveredZone}
            onSelectZone={(id) => {
              setSelectedZone(id);
              setFocusZone(id);
              setSelectedTreaty(null);
            }}
            onSelectTreaty={(id) => setSelectedTreaty(id)}
          />
          <HudOverlay
            state={state}
            api={api}
            selectedZone={selectedZone}
            selectedTreaty={selectedTreaty}
            onSelectZone={setSelectedZone}
            onSelectTreaty={setSelectedTreaty}
          />
        </>
      )}

      {view === "topology" && (
        <TopologyView
          state={state}
          selectedZone={selectedZone}
          selectedTreaty={selectedTreaty}
          onSelectZone={setSelectedZone}
          onSelectTreaty={setSelectedTreaty}
        />
      )}

      {view === "tribunal" && <TribunalView state={state} />}

      {view === "treasury" && <TreasuryView state={state} api={api} />}

      <TopBar state={state} api={api} view={view} onView={setView} />
      <GlobalFeedback api={api} />
    </>
  );
}
