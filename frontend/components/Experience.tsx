"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { AppView } from "@/lib/types";
import { useWestphaliaStore } from "@/lib/store";
import HudOverlay from "./HudOverlay";
import TopBar from "./TopBar";
import GlobalFeedback from "./GlobalFeedback";
import FoundRealmModal from "./FoundRealmModal";
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
  const showLabels = !foundOpen && !hudOverlayOpen;

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
          <HudOverlay
            state={s.state}
            selectedId={s.selectedId}
            selectedTreaty={s.selectedTreaty}
            onSelectTreaty={s.setSelectedTreaty}
            onFocusEnclave={s.focusEnclave}
            onPropose={s.proposeTreaty}
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

      {view === "topology" && (
        <TopologyView
          state={s.state}
          selectedZone={s.selectedId}
          selectedTreaty={s.selectedTreaty}
          onSelectZone={s.selectEnclave}
          onSelectTreaty={s.setSelectedTreaty}
        />
      )}

      {view === "tribunal" && <TribunalView state={s.state} />}

      {view === "treasury" && <TreasuryView state={s.state} onClaim={s.claimEscrow} />}

      <TopBar
        state={s.state}
        network={s.network}
        connected={s.connected}
        reviewerMode={s.reviewerMode}
        view={view}
        onView={setView}
        onSetNetwork={s.setNetwork}
        onConnect={s.connectWallet}
        onEnterReviewer={s.enterReviewerMode}
        onFound={() => setFoundOpen(true)}
        cinematic={cinematic}
        onToggleCinematic={toggleCinematic}
      />
      <GlobalFeedback pipeline={s.pipeline} lastReceipt={s.lastReceipt} />

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
    </>
  );
}
