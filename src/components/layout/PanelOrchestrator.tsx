"use client";

import React, { useEffect } from "react";
import { useUIStore, PanelName } from "@/store/uiStore";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { LazyPanel, prefetchPanel } from "@/components/shared/LazyPanel";

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
  smartRandom: () =>
    import("@/components/shared/SmartRandomModal").then((m) => ({ default: m.SmartRandomModal })),
  emotionMatrix: () => import("@/components/emotion/EmotionMatrixView"),
  aiSettings: () => import("@/components/settings/AISettingsPanel"),
};

/**
 * PanelOrchestrator - Central controller for all feature panels.
 *
 * Each panel is wrapped in LazyPanel which provides:
 * - Code splitting (JS loads only when panel opens)
 * - Error isolation (crash in one panel won't affect others)
 * - Consistent loading state
 *
 * All panel visibility is driven by uiStore.panels.
 */
export function PanelOrchestrator() {
  const panels = useStoreWithEqualityFn(useUIStore, (s) => s.panels, shallow);
  const closePanel = useUIStore((s) => s.closePanel);
  const openPanel = useUIStore((s) => s.openPanel);

  // Prefetch priority modules on mount
  useEffect(() => {
    const prefetchModules = async () => {
      // Delay prefetching slightly to not compete with initial page load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // High priority (User likely to click)
      prefetchPanel("queue", FACTORIES.queue);
      prefetchPanel("search", FACTORIES.search);
      prefetchPanel("settings", FACTORIES.settings);
      prefetchPanel("history", FACTORIES.history);

      // Medium priority (Secondary tools)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      prefetchPanel("eq", FACTORIES.eq);
      prefetchPanel("visualSettings", FACTORIES.visualSettings);
      prefetchPanel("lyricsSearch", FACTORIES.lyricsSearch);
      prefetchPanel("smartPlaylist", FACTORIES.smartPlaylist);
      prefetchPanel("playerSkins", FACTORIES.playerSkins);
    };

    prefetchModules();
  }, []);

  return (
    <>
      {/* ─── Core Panels ───────────────────────────────────────── */}
      <LazyPanel
        name="queue"
        isOpen={panels.queue}
        onClose={() => closePanel("queue")}
        factory={FACTORIES.queue}
      />
      <LazyPanel
        name="history"
        isOpen={panels.history}
        onClose={() => closePanel("history")}
        factory={FACTORIES.history}
      />
      <LazyPanel
        name="settings"
        isOpen={panels.settings}
        onClose={() => closePanel("settings")}
        factory={FACTORIES.settings}
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
        factory={FACTORIES.sleepTimer}
      />
      <LazyPanel
        name="search"
        isOpen={panels.search}
        onClose={() => closePanel("search")}
        factory={FACTORIES.search}
      />

      {/* ─── Lyrics Panels ─────────────────────────────────────── */}
      <LazyPanel
        name="lyricSettings"
        isOpen={panels.lyricSettings}
        onClose={() => closePanel("lyricSettings")}
        factory={FACTORIES.lyricSettings}
      />
      <LazyPanel
        name="lyricsSearch"
        isOpen={panels.lyricsSearch}
        onClose={() => closePanel("lyricsSearch")}
        factory={FACTORIES.lyricsSearch}
      />
      <LazyPanel
        name="lyricsImport"
        isOpen={panels.lyricsImport}
        onClose={() => closePanel("lyricsImport")}
        factory={FACTORIES.lyricsImport}
      />
      <LazyPanel
        name="lyricsCoverEditor"
        isOpen={panels.lyricsCoverEditor}
        onClose={() => closePanel("lyricsCoverEditor")}
        factory={FACTORIES.lyricsCoverEditor}
      />

      {/* ─── Audio & Visual Settings ──────────────────────────── */}
      <LazyPanel
        name="eq"
        isOpen={panels.eq}
        onClose={() => closePanel("eq")}
        factory={FACTORIES.eq}
      />
      <LazyPanel
        name="visualSettings"
        isOpen={panels.visualSettings}
        onClose={() => closePanel("visualSettings")}
        factory={FACTORIES.visualSettings}
      />

      {/* ─── Library & Discovery ──────────────────────────────── */}
      <LazyPanel
        name="listeningHistory"
        isOpen={panels.listeningHistory}
        onClose={() => closePanel("listeningHistory")}
        factory={FACTORIES.listeningHistory}
      />
      <LazyPanel
        name="dailyRecommendation"
        isOpen={panels.dailyRecommendation}
        onClose={() => closePanel("dailyRecommendation")}
        factory={FACTORIES.dailyRecommendation}
      />
      <LazyPanel
        name="libraryManager"
        isOpen={panels.libraryManager}
        onClose={() => closePanel("libraryManager")}
        factory={FACTORIES.libraryManager}
      />
      <LazyPanel
        name="smartPlaylist"
        isOpen={panels.smartPlaylist}
        onClose={() => closePanel("smartPlaylist")}
        factory={FACTORIES.smartPlaylist}
      />

      {/* ─── Sharing & Customization ──────────────────────────── */}
      <LazyPanel
        name="offlineCache"
        isOpen={panels.offlineCache}
        onClose={() => closePanel("offlineCache")}
        factory={FACTORIES.offlineCache}
      />
      <LazyPanel
        name="share"
        isOpen={panels.share}
        onClose={() => closePanel("share")}
        factory={FACTORIES.share}
      />
      <LazyPanel
        name="playerSkins"
        isOpen={panels.playerSkins}
        onClose={() => closePanel("playerSkins")}
        factory={FACTORIES.playerSkins}
      />
      <LazyPanel
        name="keyboardShortcuts"
        isOpen={panels.keyboardShortcuts}
        onClose={() => closePanel("keyboardShortcuts")}
        factory={FACTORIES.keyboardShortcuts}
      />

      {/* ─── Data & Stats ─────────────────────────────────────── */}
      <LazyPanel
        name="backupRestore"
        isOpen={panels.backupRestore}
        onClose={() => closePanel("backupRestore")}
        factory={FACTORIES.backupRestore}
      />
      <LazyPanel
        name="statsAchievements"
        isOpen={panels.statsAchievements}
        onClose={() => closePanel("statsAchievements")}
        factory={FACTORIES.statsAchievements}
      />

      {/* ─── Professional Tools ────────────────────────────────── */}
      <LazyPanel
        name="professionalMode"
        isOpen={panels.professionalMode}
        onClose={() => closePanel("professionalMode")}
        factory={FACTORIES.professionalMode}
      />
      <LazyPanel
        name="formatConverter"
        isOpen={panels.formatConverter}
        onClose={() => closePanel("formatConverter")}
        factory={FACTORIES.formatConverter}
      />
      <LazyPanel
        name="dsdConverter"
        isOpen={panels.dsdConverter}
        onClose={() => closePanel("dsdConverter")}
        factory={FACTORIES.dsdConverter}
      />
      <LazyPanel
        name="trackCutter"
        isOpen={panels.trackCutter}
        onClose={() => closePanel("trackCutter")}
        factory={FACTORIES.trackCutter}
      />
      <LazyPanel
        name="crossfadeMixer"
        isOpen={panels.crossfadeMixer}
        onClose={() => closePanel("crossfadeMixer")}
        factory={FACTORIES.crossfadeMixer}
      />
      <LazyPanel
        name="fingerprintScanner"
        isOpen={panels.fingerprintScanner}
        onClose={() => closePanel("fingerprintScanner")}
        factory={FACTORIES.fingerprintScanner}
      />
      <LazyPanel
        name="libraryHealth"
        isOpen={panels.libraryHealth}
        onClose={() => closePanel("libraryHealth")}
        factory={FACTORIES.libraryHealth}
      />

      {/* ─── Mix & Intelligence ────────────────────────────────── */}
      <LazyPanel
        name="instantMix"
        isOpen={panels.instantMix}
        onClose={() => closePanel("instantMix")}
        factory={FACTORIES.instantMix}
      />
      <LazyPanel
        name="smartRandom"
        isOpen={panels.smartRandom}
        onClose={() => closePanel("smartRandom")}
        factory={FACTORIES.smartRandom}
        extraProps={{ currentSong: undefined }}
      />

      {/* ─── Emotion Matrix (Full Page) ────────────────────────── */}
      <LazyPanel
        name="emotionMatrix"
        isOpen={panels.emotionMatrix}
        onClose={() => closePanel("emotionMatrix")}
        factory={FACTORIES.emotionMatrix}
      />

      <LazyPanel
        name="aiSettings"
        isOpen={panels.aiSettings}
        onClose={() => closePanel("aiSettings")}
        factory={FACTORIES.aiSettings}
      />
    </>
  );
}
