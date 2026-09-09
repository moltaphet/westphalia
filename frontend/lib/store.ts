"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  AgentEnclave,
  Archetype,
  BiomeTheme,
  LedgerEvent,
  NetworkConfig,
  PipelineState,
  ProtocolState,
  ReputationTier,
  Treaty,
  TreatyKind,
} from "./types";
import { TREATIES, LEDGER } from "./mockData";
import { DEFAULT_NETWORK } from "./networks";
import { DiplomaticContract, type TxReceipt } from "./contract";

// Biome + telemetry presets used when founding a new realm of each archetype.
export const ARCHETYPE_PRESETS: Record<
  Archetype,
  { biome: Omit<BiomeTheme, "elevationSeed">; yieldApr: number; blurb: string }
> = {
  "Autonomous Arbiter": {
    biome: { base: "#047857", ridge: "#065f46", accent: "#34d399" },
    yieldApr: 3.6,
    blurb: "Impartial dispute adjudication and treaty parsing.",
  },
  "Liquidity Nexus": {
    biome: { base: "#6d28d9", ridge: "#4c1d95", accent: "#a78bfa" },
    yieldApr: 5.4,
    blurb: "Cross-border settlement and market-making corridors.",
  },
  "Oracle Collective": {
    biome: { base: "#0e7490", ridge: "#334155", accent: "#22d3ee" },
    yieldApr: 4.1,
    blurb: "High-uptime data ingestion and attestation.",
  },
  "Defense Vanguard": {
    biome: { base: "#7c2d12", ridge: "#3f1d1d", accent: "#fb7185" },
    yieldApr: 2.8,
    blurb: "Perimeter defense and containment enforcement.",
  },
};

// Seed enclaves occupy Ring 1 (indices 0-3) around the Geneva core.
export const INITIAL_ENCLAVES: AgentEnclave[] = [
  {
    id: "alpha",
    name: "Citadel Alpha",
    archetype: "Oracle Collective",
    address: "0xA1pha00c3D4e5F60718293A4b5C6D7E8f9012345",
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
    address: "0xV4nguard5F60718293A4b5C6D7E8f9012345aBcD",
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
    address: "0xEncl4ve718293A4b5C6D7E8f9012345aBcDeF012",
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
    address: "0xB4stion93A4b5C6D7E8f9012345aBcDeF0123456",
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
  const [enclaves, setEnclaves] = useState<AgentEnclave[]>(INITIAL_ENCLAVES);
  const [treaties, setTreaties] = useState<Treaty[]>(TREATIES);
  const [ledger, setLedger] = useState<LedgerEvent[]>(LEDGER);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>("enclave");
  const [selectedTreaty, setSelectedTreaty] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const [network, setNetwork] = useState<NetworkConfig>(DEFAULT_NETWORK);
  const [connected, setConnected] = useState(false);
  const [reviewerMode, setReviewerMode] = useState(true);
  const [lastReceipt, setLastReceipt] = useState<TxReceipt | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);

  const contractRef = useRef<DiplomaticContract>(new DiplomaticContract(network));

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

  const runPipeline = useCallback(
    async (label: string, finalize: () => Promise<void>) => {
      setPipeline({ active: true, label, step: 0, steps: PIPELINE_STEPS, done: false });
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        setPipeline((p) => (p ? { ...p, step: i } : p));
        await sleep(i === 2 ? 1000 : 650);
      }
      await finalize();
      setPipeline((p) => (p ? { ...p, step: PIPELINE_STEPS.length - 1, done: true } : p));
      await sleep(1000);
      setPipeline(null);
    },
    []
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

  const connectWallet = useCallback(async () => {
    const contract = new DiplomaticContract(network);
    contractRef.current = contract;
    const ok = await contract.connect();
    setConnected(ok);
    setReviewerMode(!ok);
    pushLedger({
      block: 1843000 + seq,
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
      block: 1843000 + seq,
      kind: "consensus-verdict",
      actor: "protocol",
      message: "Ephemeral reviewer mode engaged. Read-only simulation data loaded.",
    });
  }, [pushLedger]);

  const proposeTreaty = useCallback(
    async (partnerId: string, kind: TreatyKind, terms: string, bondGen: number) => {
      await runPipeline(`Propose ${kind} treaty`, async () => {
        const receipt = await contractRef.current.proposeTreaty(partnerId, kind, terms, bondGen);
        setLastReceipt(receipt);
        const self = selectedId ?? "alpha";
        const partner = enclaves.find((e) => e.id === partnerId);
        const id = `t${seq}`;
        const treaty: Treaty = {
          id,
          kind,
          status: "pending",
          parties: [self, partnerId],
          bondGen,
          createdBlock: 1843000 + seq,
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

  const triggerDispute = useCallback(
    async (treatyId: string, evidence: string) => {
      await runPipeline(`Dispute ${treatyId.toUpperCase()}`, async () => {
        const receipt = await contractRef.current.triggerDispute(treatyId, evidence);
        setLastReceipt(receipt);
        setTreaties((prev) =>
          prev.map((t) =>
            t.id === treatyId
              ? {
                  ...t,
                  status: "pending",
                  dispute: {
                    validators: 5,
                    consensus: 50,
                    evidenceUri: evidence,
                    openedBlock: 1843000 + seq,
                  },
                }
              : t
          )
        );
        pushLedger({
          block: 1843000 + seq,
          kind: "dispute-opened",
          actor: selectedId ?? "protocol",
          message: `Dispute opened on ${treatyId}. GenLayer validators empaneled.`,
        });
      });
    },
    [runPipeline, pushLedger, selectedId]
  );

  const claimEscrow = useCallback(
    async (treatyId: string) => {
      const receipt = await contractRef.current.claimEscrow(treatyId);
      setLastReceipt(receipt);
      pushLedger({
        block: 1843000 + seq,
        kind: "escrow-released",
        actor: selectedId ?? "protocol",
        message: `Escrow released for ${treatyId} via pull-pattern withdrawal.`,
      });
    },
    [pushLedger, selectedId]
  );

  // Deploy a brand new sovereign enclave into the next orbital slot.
  const foundRealm = useCallback(
    async (input: FoundRealmInput) => {
      await runPipeline(`Found Sovereignty ${input.name}`, async () => {
        const receipt = await contractRef.current.proposeTreaty(
          input.name,
          "non-aggression",
          input.governance,
          input.collateral
        );
        setLastReceipt(receipt);
        const preset = ARCHETYPE_PRESETS[input.archetype];
        const id = `realm-${seq}`;
        const enclave: AgentEnclave = {
          id,
          name: input.name,
          archetype: input.archetype,
          address: `0x${(seq * 48271).toString(16).padStart(8, "0")}...${id.slice(-4)}`,
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
        setEnclaves((prev) => [...prev, enclave]);
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
    lastReceipt,
    pipeline,
    setHoveredId,
    selectEnclave,
    focusEnclave,
    setSelectedTreaty,
    setNetwork,
    connectWallet,
    enterReviewerMode,
    proposeTreaty,
    triggerDispute,
    claimEscrow,
    foundRealm,
  };
}

export type WestphaliaStore = ReturnType<typeof useWestphaliaStore>;
