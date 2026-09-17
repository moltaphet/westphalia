"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { AppView } from "@/lib/types";
import { useWestphaliaStore } from "@/lib/store";
import HudOverlay from "./HudOverlay";
import IntroOverlay from "./IntroOverlay";
import TopBar from "./TopBar";
import GlobalFeedback from "./GlobalFeedback";
import FoundRealmModal from "./FoundRealmModal";
import TribunalVerdictModal from "./TribunalVerdictModal";
import TransactionGate from "./TransactionGate";
import TopologyView from "./views/TopologyView";
import TribunalView from "./views/TribunalView";
import TreasuryView from "./views/TreasuryView";
import AgentsView from "./views/AgentsView";

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

export default function Experience() {
  const s = useWestphaliaStore();
  const [view, setView] = useState<AppView>("world");
  const [foundOpen, setFoundOpen] = useState(false);
  // True while any HUD modal / audit inspector is open (reported by HudOverlay).
  const [hudOverlayOpen, setHudOverlayOpen] = useState(false);
  // Collapsible side panels + cinematic mode (collapse both).
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const cinematic = leftCollapsed && rightCollapsed;
  const toggleCinematic = () => {
    const next = !cinematic;
    setLeftCollapsed(next);
    setRightCollapsed(next);
  };

  // Suppress Drei Html scene labels whenever a modal/dialog is open so they
  // never bleed through the blurred backdrop. (Non-world views unmount the
  // board entirely, so labels are already gone there.)
  const showLabels = !foundOpen && !hudOverlayOpen && !s.txRequest && !s.latestVerdict;

  return (
    <>
      {view === "world" && (
        <>
          <DiplomaticBoard
            state={s.state}
            hoveredId={s.hoveredId}
            selectedId={s.selectedId}
            focusId={s.focusId}
            selectedTreaty={s.selectedTreaty}
            showLabels={showLabels}
            onHover={s.setHoveredId}
            onSelect={s.selectEnclave}
            onSelectTreaty={s.setSelectedTreaty}
          />
          {/* No blocking overlay: the board mounts and renders immediately over
              a cached or empty archipelago. Sync progress is reported by the
              subtle "SYNCING ON-CHAIN..." indicator in the top bar instead of an
              opaque backdrop that traps the whole viewport. */}
          <HudOverlay
            state={s.state}
            selectedId={s.selectedId}
            selectedTreaty={s.selectedTreaty}
            onSelectTreaty={s.setSelectedTreaty}
            onFocusEnclave={s.focusEnclave}
            onPropose={s.proposeTreaty}
            onRatify={s.ratifyTreaty}
            onDissolve={s.dissolveTreaty}
            onExit={s.exitTreaty}
            onDispute={s.triggerDispute}
            onClaim={s.claimEscrow}
            onOverlayChange={setHudOverlayOpen}
            leftCollapsed={leftCollapsed}
            rightCollapsed={rightCollapsed}
            onToggleLeft={() => setLeftCollapsed((v) => !v)}
            onToggleRight={() => setRightCollapsed((v) => !v)}
          />
        </>
      )}

      {view === "agents" && (
        <AgentsView
          state={s.state}
          selectedId={s.selectedId}
          onSelect={s.selectEnclave}
        />
      )}

      {view === "topology" && (
        <TopologyView
          state={s.state}
          selectedZone={s.selectedId}
          selectedTreaty={s.selectedTreaty}
          onSelectZone={s.selectEnclave}
          onSelectTreaty={s.setSelectedTreaty}
        />
      )}

      {view === "tribunal" && <TribunalView state={s.state} history={s.tribunalHistory} />}

      {view === "treasury" && (
        <TreasuryView
          state={s.state}
          chainOverview={s.chainOverview}
          onClaim={s.claimEscrow}
          onWithdrawCollateral={s.withdrawCollateral}
        />
      )}

      <TopBar
        state={s.state}
        network={s.network}
        connected={s.connected}
        reviewerMode={s.reviewerMode}
        stateSource={s.stateSource}
        isSyncing={s.isSyncing}
        chainOverview={s.chainOverview}
        view={view}
        onView={setView}
        onSetNetwork={s.setNetwork}
        wallet={s.wallet}
        onEnterReviewer={s.enterReviewerMode}
        onFound={() => setFoundOpen(true)}
        cinematic={cinematic}
        onToggleCinematic={toggleCinematic}
      />
      <GlobalFeedback pipeline={s.pipeline} lastReceipt={s.lastReceipt} />
      <IntroOverlay />

      {/* Every live write parks here until it is signed or abandoned. Rendered
          above the HUD (z-110) so the approval surface is never occluded. */}
      <TransactionGate
        request={s.txRequest}
        network={s.network}
        onDone={s.settleWrite}
        onAbort={s.abortWrite}
      />

      {foundOpen && (
        <FoundRealmModal
          onClose={() => setFoundOpen(false)}
          onSubmit={(input) => {
            void s.foundRealm(input);
            setFoundOpen(false);
            setView("world");
          }}
        />
      )}

      {/* Post-dispute adjudication card: shows the tribunal's verdict tier and
          the multi-LLM judicial rationale once a dispute resolves. */}
      <TribunalVerdictModal
        verdict={s.latestVerdict}
        enclaves={s.enclaves}
        onClose={s.dismissVerdict}
      />
    </>
  );
}
