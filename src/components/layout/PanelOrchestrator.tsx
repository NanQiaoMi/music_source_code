"use client";

import React, { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { createLazyPanelComponent, LazyPanel, prefetchPanel } from "@/components/shared/LazyPanel";

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
};

const PANEL_COMPONENTS = Object.fromEntries(
  Object.entries(FACTORIES).map(([name, factory]) => [
    name,
    createLazyPanelComponent(name, factory),
  ])
) as Record<keyof typeof FACTORIES, ReturnType<typeof createLazyPanelComponent>>;

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
      />
      <LazyPanel
        name="visualSettings"
        isOpen={panels.visualSettings}
        onClose={() => closePanel("visualSettings")}
        component={PANEL_COMPONENTS.visualSettings}
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
      />
      <LazyPanel
        name="dsdConverter"
        isOpen={panels.dsdConverter}
        onClose={() => closePanel("dsdConverter")}
        component={PANEL_COMPONENTS.dsdConverter}
      />
      <LazyPanel
        name="trackCutter"
        isOpen={panels.trackCutter}
        onClose={() => closePanel("trackCutter")}
        component={PANEL_COMPONENTS.trackCutter}
      />
      <LazyPanel
        name="crossfadeMixer"
        isOpen={panels.crossfadeMixer}
        onClose={() => closePanel("crossfadeMixer")}
        component={PANEL_COMPONENTS.crossfadeMixer}
      />
      <LazyPanel
        name="fingerprintScanner"
        isOpen={panels.fingerprintScanner}
        onClose={() => closePanel("fingerprintScanner")}
        component={PANEL_COMPONENTS.fingerprintScanner}
      />
      <LazyPanel
        name="libraryHealth"
        isOpen={panels.libraryHealth}
        onClose={() => closePanel("libraryHealth")}
        component={PANEL_COMPONENTS.libraryHealth}
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
    </>
  );
}
