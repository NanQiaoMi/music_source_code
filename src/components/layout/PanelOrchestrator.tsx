"use client";

import React, { useEffect } from "react";
import { PANEL_NAMES, usePanelStore } from "@/store/panelStore";
import type { PanelName } from "@/store/panelStore";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { createLazyPanelComponent, LazyPanel, prefetchPanel } from "@/components/shared/LazyPanel";
import { PanelRetentionProvider } from "@/components/shared/panelLifecycle";
import type { PanelKeepAlive } from "@/components/shared/panelLifecycle";

// ─── Module Factories (Extracted for prefetching) ─────────────────
const FACTORIES = {
  queue: () => import("@/components/player/QueuePanel").then((m) => ({ default: m.QueuePanel })),
  history: () =>
    import("@/components/library/HistoryPanel").then((m) => ({ default: m.HistoryPanel })),
  settings: () =>
    import("@/components/settings/SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
  sleepTimer: () =>
    import("@/components/widgets/SleepTimerPanel").then((m) => ({ default: m.SleepTimerPanel })),
  search: () => import("@/components/player/SearchPanel").then((m) => ({ default: m.SearchPanel })),
  lyricSettings: () =>
    import("@/components/lyrics/LyricSettingsPanel").then((m) => ({
      default: m.LyricSettingsPanel,
    })),
  lyricsSearch: () => import("@/components/lyrics/LyricsSearchPanel"),
  lyricsImport: () =>
    import("@/components/lyrics/LyricsImportPanel").then((m) => ({ default: m.LyricsImportPanel })),
  lyricsCoverEditor: () =>
    import("@/components/lyrics/LyricsCoverEditor").then((m) => ({ default: m.LyricsCoverEditor })),
  eq: () =>
    import("@/components/audio/AudioEqualizer").then((m) => ({ default: m.AudioEqualizer })),
  visualSettings: () =>
    import("@/components/settings/VisualSettings").then((m) => ({
      default: m.VisualSettingsPanel,
    })),
  listeningHistory: () =>
    import("@/components/library/ListeningHistory").then((m) => ({ default: m.ListeningHistory })),
  listeningJournal: () =>
    import("@/components/widgets/JournalDayPanel").then((m) => ({ default: m.JournalDayPanel })),
  dailyRecommendation: () =>
    import("@/components/widgets/DailyRecommendation").then((m) => ({
      default: m.DailyRecommendation,
    })),
  libraryManager: () =>
    import("@/components/library/LibraryManagerPanel").then((m) => ({
      default: m.LibraryManagerPanel,
    })),
  smartPlaylist: () =>
    import("@/components/library/SmartPlaylistPanel").then((m) => ({
      default: m.SmartPlaylistPanel,
    })),
  offlineCache: () =>
    import("@/components/library/OfflineCachePanel").then((m) => ({
      default: m.OfflineCachePanel,
    })),
  share: () => import("@/components/social/SharePanel").then((m) => ({ default: m.SharePanel })),
  playerSkins: () =>
    import("@/components/player/PlayerSkinsPanel").then((m) => ({ default: m.PlayerSkinsPanel })),
  keyboardShortcuts: () =>
    import("@/components/settings/KeyboardShortcutsHelp").then((m) => ({
      default: m.KeyboardShortcutsHelp,
    })),
  gestureSettings: () =>
    import("@/components/settings/GestureSettings").then((m) => ({
      default: m.GestureSettings,
    })),
  backupRestore: () =>
    import("@/components/library/BackupRestorePanel").then((m) => ({
      default: m.BackupRestorePanel,
    })),
  statsAchievements: () =>
    import("@/components/widgets/StatsAchievementsPanel").then((m) => ({
      default: m.StatsAchievementsPanel,
    })),
  professionalMode: () =>
    import("@/components/widgets/ProfessionalModeToggle").then((m) => ({
      default: m.ProfessionalModePanel,
    })),
  professionalTools: () =>
    import("@/components/features-v7/ProfessionalToolsPanel").then((m) => ({
      default: m.ProfessionalToolsPanel,
    })),
  formatConverter: () => import("@/components/audio/FormatConverter"),
  dsdConverter: () => import("@/components/audio/DSDConverter"),
  trackCutter: () => import("@/components/audio/TrackCutter"),
  crossfadeMixer: () => import("@/components/audio/CrossfadeMixer"),
  fingerprintScanner: () =>
    import("@/components/interaction/FingerprintScannerPanel").then((m) => ({
      default: m.FingerprintScannerPanel,
    })),
  libraryHealth: () =>
    import("@/components/library/LibraryHealthPanel").then((m) => ({
      default: m.LibraryHealthPanel,
    })),
  instantMix: () =>
    import("@/components/widgets/InstantMix").then((m) => ({ default: m.InstantMix })),
  smartMixSession: () =>
    import("@/components/widgets/SmartMixSessionPanel").then((m) => ({
      default: m.SmartMixSessionPanel,
    })),
  smartRandom: () =>
    import("@/components/shared/SmartRandomModal").then((m) => ({ default: m.SmartRandomModal })),
  dnaJournal: () =>
    import("@/components/widgets/DNAJournal").then((m) => ({ default: m.DNAJournal })),
  emotionMatrix: () => import("@/components/emotion/EmotionMatrixView"),
  aiSettings: () => import("@/components/settings/AISettingsPanel"),
  aiAgent: () =>
    import("@/components/ai-agent/AIAgentPanel").then((m) => ({ default: m.AIAgentPanel })),
  shelf3D: () =>
    import("@/components/library/Shelf3DView").then((m) => ({ default: m.Shelf3DView })),
  audioSourceManager: () =>
    import("@/components/player/AudioSourceManagerModal").then((m) => ({
      default: m.AudioSourceManagerModal,
    })),
  cloudMusic: () =>
    import("@/components/library/CloudMusicPanel").then((m) => ({
      default: m.CloudMusicPanel,
    })),
  accountCenter: () =>
    import("@/components/account/MultiPlatformAccountModal").then((m) => ({
      default: m.MultiPlatformAccountModal,
    })),
  dataManager: () =>
    import("@/components/library/UnifiedDataManagerHub").then((m) => ({
      default: m.UnifiedDataManagerHub,
    })),
};

export { FACTORIES };

/**
 * Panel lifecycle tiers (S3-6). Keep this map exhaustive over PanelName:
 * always = keep the instance after close, lru = only the two most recently
 * opened stay warm, never = unmount on close.
 */
export const KEEPALIVE_CONFIG = {
  queue: "lru",
  history: "lru",
  settings: "lru",
  sleepTimer: "lru",
  search: "lru",
  lyricSettings: "lru",
  lyricsSearch: "lru",
  lyricsImport: "lru",
  lyricsCoverEditor: "lru",
  eq: "always",
  visualSettings: "always",
  listeningHistory: "lru",
  listeningJournal: "lru",
  dailyRecommendation: "lru",
  libraryManager: "lru",
  smartPlaylist: "lru",
  offlineCache: "lru",
  share: "lru",
  playerSkins: "lru",
  keyboardShortcuts: "lru",
  gestureSettings: "lru",
  backupRestore: "lru",
  statsAchievements: "lru",
  professionalMode: "lru",
  professionalTools: "lru",
  formatConverter: "never",
  dsdConverter: "never",
  trackCutter: "never",
  crossfadeMixer: "never",
  fingerprintScanner: "never",
  libraryHealth: "never",
  instantMix: "lru",
  smartMixSession: "lru",
  smartRandom: "lru",
  dnaJournal: "lru",
  emotionMatrix: "lru",
  aiSettings: "lru",
  aiAgent: "lru",
  shelf3D: "always",
  audioSourceManager: "never",
  cloudMusic: "lru",
  accountCenter: "lru",
  dataManager: "never",
} as const satisfies Record<PanelName, PanelKeepAlive>;

const PANEL_COMPONENTS = Object.fromEntries(
  Object.entries(FACTORIES).map(([name, factory]) => [
    name,
    createLazyPanelComponent(name, factory),
  ])
) as Record<keyof typeof FACTORIES, ReturnType<typeof createLazyPanelComponent>>;

// ─── S3-9 prefetch policy (idle + intent) ────────────────────────
// Only the two likeliest panels are warmed after idle; every other panel waits
// for a pointer intent on a [data-panel-prefetch] entry.
const IDLE_PREFETCH_PANELS = ["queue", "search"] as const;
const IDLE_PREFETCH_TIMEOUT_MS = 2000;
const IDLE_FALLBACK_DELAY_MS = 3000;
const PANEL_PREFETCH_ATTR = "data-panel-prefetch";

function isDataSaverEnabled(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Run after the browser is idle; Safari lacks requestIdleCallback, so fall back to a timer. */
function runWhenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: IDLE_PREFETCH_TIMEOUT_MS });

    return () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
    };
  }

  const timer = window.setTimeout(callback, IDLE_FALLBACK_DELAY_MS);
  return () => window.clearTimeout(timer);
}

/**
 * PanelOrchestrator - Central controller for all feature panels.
 *
 * Each panel is wrapped in LazyPanel which provides:
 * - Code splitting (JS loads only when panel opens)
 * - Error isolation (crash in one panel won't affect others)
 * - Consistent loading state
 *
 * All panel visibility is driven by panelStore.panels (S6-6b).
 */
export function PanelOrchestrator() {
  const panels = useStoreWithEqualityFn(usePanelStore, (s) => s.panels, shallow);
  const closePanel = usePanelStore((s) => s.closePanel);
  const openPanel = usePanelStore((s) => s.openPanel);

  // LRU order only tracks lru-tier panels; always/never panels never consume a slot
  const openLruPanels = React.useMemo(
    () => PANEL_NAMES.filter((name) => panels[name] && KEEPALIVE_CONFIG[name] === "lru"),
    [panels]
  );

  // S3-9: warm only the two likeliest panels once the page is idle.
  useEffect(() => {
    if (isDataSaverEnabled()) return;

    return runWhenIdle(() => {
      for (const name of IDLE_PREFETCH_PANELS) {
        prefetchPanel(name, FACTORIES[name]);
      }
    });
  }, []);

  // S3-9: hovering a marked entry loads its panel chunk before the click.
  useEffect(() => {
    const seen = new WeakSet<Element>();

    const handlePointerOver = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const entry = target.closest<HTMLElement>(`[${PANEL_PREFETCH_ATTR}]`);
      if (!entry || seen.has(entry)) return;

      const name = entry.dataset.panelPrefetch;
      if (!name || !(name in FACTORIES)) return;

      seen.add(entry);
      prefetchPanel(name, FACTORIES[name as keyof typeof FACTORIES]);
    };

    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    return () => document.removeEventListener("pointerover", handlePointerOver);
  }, []);

  return (
    <PanelRetentionProvider lruPanels={openLruPanels}>
      <>
        {/* Core panels */}
        <LazyPanel
          name="queue"
          isOpen={panels.queue}
          onClose={() => closePanel("queue")}
          component={PANEL_COMPONENTS.queue}
        />
        <LazyPanel
          name="history"
          isOpen={panels.history}
          onClose={() => closePanel("history")}
          component={PANEL_COMPONENTS.history}
        />
        <LazyPanel
          name="settings"
          isOpen={panels.settings}
          onClose={() => closePanel("settings")}
          component={PANEL_COMPONENTS.settings}
          extraProps={{
            onOpenEQ: () => {
              closePanel("settings");
              openPanel("eq");
            },
            onOpenVisualSettings: () => {
              closePanel("settings");
              openPanel("visualSettings");
            },
          }}
        />
        <LazyPanel
          name="sleepTimer"
          isOpen={panels.sleepTimer}
          onClose={() => closePanel("sleepTimer")}
          component={PANEL_COMPONENTS.sleepTimer}
        />
        <LazyPanel
          name="search"
          isOpen={panels.search}
          onClose={() => closePanel("search")}
          component={PANEL_COMPONENTS.search}
        />

        {/* Lyrics panels */}
        <LazyPanel
          name="lyricSettings"
          isOpen={panels.lyricSettings}
          onClose={() => closePanel("lyricSettings")}
          component={PANEL_COMPONENTS.lyricSettings}
        />
        <LazyPanel
          name="lyricsSearch"
          isOpen={panels.lyricsSearch}
          onClose={() => closePanel("lyricsSearch")}
          component={PANEL_COMPONENTS.lyricsSearch}
        />
        <LazyPanel
          name="lyricsImport"
          isOpen={panels.lyricsImport}
          onClose={() => closePanel("lyricsImport")}
          component={PANEL_COMPONENTS.lyricsImport}
        />
        <LazyPanel
          name="lyricsCoverEditor"
          isOpen={panels.lyricsCoverEditor}
          onClose={() => closePanel("lyricsCoverEditor")}
          component={PANEL_COMPONENTS.lyricsCoverEditor}
        />

        {/* Audio and visual settings */}
        <LazyPanel
          name="eq"
          isOpen={panels.eq}
          onClose={() => closePanel("eq")}
          component={PANEL_COMPONENTS.eq}
          keepAlive={KEEPALIVE_CONFIG.eq}
        />
        <LazyPanel
          name="visualSettings"
          isOpen={panels.visualSettings}
          onClose={() => closePanel("visualSettings")}
          component={PANEL_COMPONENTS.visualSettings}
          keepAlive={KEEPALIVE_CONFIG.visualSettings}
        />

        {/* Library and discovery */}
        <LazyPanel
          name="listeningHistory"
          isOpen={panels.listeningHistory}
          onClose={() => closePanel("listeningHistory")}
          component={PANEL_COMPONENTS.listeningHistory}
        />
        <LazyPanel
          name="listeningJournal"
          isOpen={panels.listeningJournal}
          onClose={() => closePanel("listeningJournal")}
          component={PANEL_COMPONENTS.listeningJournal}
        />
        <LazyPanel
          name="dailyRecommendation"
          isOpen={panels.dailyRecommendation}
          onClose={() => closePanel("dailyRecommendation")}
          component={PANEL_COMPONENTS.dailyRecommendation}
        />
        <LazyPanel
          name="libraryManager"
          isOpen={panels.libraryManager}
          onClose={() => closePanel("libraryManager")}
          component={PANEL_COMPONENTS.libraryManager}
        />
        <LazyPanel
          name="smartPlaylist"
          isOpen={panels.smartPlaylist}
          onClose={() => closePanel("smartPlaylist")}
          component={PANEL_COMPONENTS.smartPlaylist}
        />

        {/* Sharing and customization */}
        <LazyPanel
          name="offlineCache"
          isOpen={panels.offlineCache}
          onClose={() => closePanel("offlineCache")}
          component={PANEL_COMPONENTS.offlineCache}
        />
        <LazyPanel
          name="share"
          isOpen={panels.share}
          onClose={() => closePanel("share")}
          component={PANEL_COMPONENTS.share}
        />
        <LazyPanel
          name="playerSkins"
          isOpen={panels.playerSkins}
          onClose={() => closePanel("playerSkins")}
          component={PANEL_COMPONENTS.playerSkins}
        />
        <LazyPanel
          name="keyboardShortcuts"
          isOpen={panels.keyboardShortcuts}
          onClose={() => closePanel("keyboardShortcuts")}
          component={PANEL_COMPONENTS.keyboardShortcuts}
        />
        <LazyPanel
          name="gestureSettings"
          isOpen={panels.gestureSettings}
          onClose={() => closePanel("gestureSettings")}
          component={PANEL_COMPONENTS.gestureSettings}
        />

        {/* Data and stats */}
        <LazyPanel
          name="backupRestore"
          isOpen={panels.backupRestore}
          onClose={() => closePanel("backupRestore")}
          component={PANEL_COMPONENTS.backupRestore}
        />
        <LazyPanel
          name="statsAchievements"
          isOpen={panels.statsAchievements}
          onClose={() => closePanel("statsAchievements")}
          component={PANEL_COMPONENTS.statsAchievements}
        />

        {/* Professional tools */}
        <LazyPanel
          name="professionalMode"
          isOpen={panels.professionalMode}
          onClose={() => closePanel("professionalMode")}
          component={PANEL_COMPONENTS.professionalMode}
        />
        <LazyPanel
          name="professionalTools"
          isOpen={panels.professionalTools}
          onClose={() => closePanel("professionalTools")}
          component={PANEL_COMPONENTS.professionalTools}
          extraProps={{
            onOpenFormatConverter: () => openPanel("formatConverter"),
            onOpenTrackCutter: () => openPanel("trackCutter"),
            onOpenFingerprintScanner: () => openPanel("fingerprintScanner"),
            onOpenDSDConverter: () => openPanel("dsdConverter"),
            onOpenCrossfadeMixer: () => openPanel("crossfadeMixer"),
            onOpenLibraryHealth: () => openPanel("libraryHealth"),
          }}
        />
        <LazyPanel
          name="formatConverter"
          isOpen={panels.formatConverter}
          onClose={() => closePanel("formatConverter")}
          component={PANEL_COMPONENTS.formatConverter}
          keepAlive={KEEPALIVE_CONFIG.formatConverter}
        />
        <LazyPanel
          name="dsdConverter"
          isOpen={panels.dsdConverter}
          onClose={() => closePanel("dsdConverter")}
          component={PANEL_COMPONENTS.dsdConverter}
          keepAlive={KEEPALIVE_CONFIG.dsdConverter}
        />
        <LazyPanel
          name="trackCutter"
          isOpen={panels.trackCutter}
          onClose={() => closePanel("trackCutter")}
          component={PANEL_COMPONENTS.trackCutter}
          keepAlive={KEEPALIVE_CONFIG.trackCutter}
        />
        <LazyPanel
          name="crossfadeMixer"
          isOpen={panels.crossfadeMixer}
          onClose={() => closePanel("crossfadeMixer")}
          component={PANEL_COMPONENTS.crossfadeMixer}
          keepAlive={KEEPALIVE_CONFIG.crossfadeMixer}
        />
        <LazyPanel
          name="fingerprintScanner"
          isOpen={panels.fingerprintScanner}
          onClose={() => closePanel("fingerprintScanner")}
          component={PANEL_COMPONENTS.fingerprintScanner}
          keepAlive={KEEPALIVE_CONFIG.fingerprintScanner}
        />
        <LazyPanel
          name="libraryHealth"
          isOpen={panels.libraryHealth}
          onClose={() => closePanel("libraryHealth")}
          component={PANEL_COMPONENTS.libraryHealth}
          keepAlive={KEEPALIVE_CONFIG.libraryHealth}
        />

        {/* Mix and intelligence */}
        <LazyPanel
          name="instantMix"
          isOpen={panels.instantMix}
          onClose={() => closePanel("instantMix")}
          component={PANEL_COMPONENTS.instantMix}
        />
        <LazyPanel
          name="smartMixSession"
          isOpen={panels.smartMixSession}
          onClose={() => closePanel("smartMixSession")}
          component={PANEL_COMPONENTS.smartMixSession}
        />
        <LazyPanel
          name="smartRandom"
          isOpen={panels.smartRandom}
          onClose={() => closePanel("smartRandom")}
          component={PANEL_COMPONENTS.smartRandom}
          extraProps={{ currentSong: undefined }}
        />
        <LazyPanel
          name="dnaJournal"
          isOpen={panels.dnaJournal}
          onClose={() => closePanel("dnaJournal")}
          component={PANEL_COMPONENTS.dnaJournal}
        />

        {/* Emotion Matrix */}
        <LazyPanel
          name="emotionMatrix"
          isOpen={panels.emotionMatrix}
          onClose={() => closePanel("emotionMatrix")}
          component={PANEL_COMPONENTS.emotionMatrix}
        />

        <LazyPanel
          name="aiSettings"
          isOpen={panels.aiSettings}
          onClose={() => closePanel("aiSettings")}
          component={PANEL_COMPONENTS.aiSettings}
        />
        <LazyPanel
          name="aiAgent"
          isOpen={panels.aiAgent}
          onClose={() => closePanel("aiAgent")}
          component={PANEL_COMPONENTS.aiAgent}
        />

        <LazyPanel
          name="shelf3D"
          isOpen={panels.shelf3D}
          onClose={() => closePanel("shelf3D")}
          component={PANEL_COMPONENTS.shelf3D}
          keepAlive={KEEPALIVE_CONFIG.shelf3D}
        />

        <LazyPanel
          name="audioSourceManager"
          isOpen={panels.audioSourceManager}
          onClose={() => closePanel("audioSourceManager")}
          component={PANEL_COMPONENTS.audioSourceManager}
          keepAlive={KEEPALIVE_CONFIG.audioSourceManager}
        />
        <LazyPanel
          name="cloudMusic"
          isOpen={panels.cloudMusic}
          onClose={() => closePanel("cloudMusic")}
          component={PANEL_COMPONENTS.cloudMusic}
        />
        <LazyPanel
          name="accountCenter"
          isOpen={panels.accountCenter}
          onClose={() => closePanel("accountCenter")}
          component={PANEL_COMPONENTS.accountCenter}
        />
        <LazyPanel
          name="dataManager"
          isOpen={panels.dataManager}
          onClose={() => closePanel("dataManager")}
          component={PANEL_COMPONENTS.dataManager}
          keepAlive={KEEPALIVE_CONFIG.dataManager}
        />
      </>
    </PanelRetentionProvider>
  );
}
