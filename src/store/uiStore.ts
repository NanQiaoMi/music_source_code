/**
 * S6-6a：UI 域拆分第一步。toast 状态（toasts/showToast/removeToast）已迁到
 * ./toastStore，本文件只保留 deprecated 兼容转发器（78 处调用点暂不改）。
 * 读取 toasts 请直接用 useToastStore：uiStore 不再持有该状态，
 * 否则 persist 会在每次 toast 变更时写一次 localStorage。
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/lib/storage/safeStorage";
import { ThemeColors, defaultColors } from "@/utils/colorExtractor";
import { useToastStore, type ToastMessage } from "@/store/toastStore";

export type { ToastMessage };

type ViewType = "home" | "player" | "visualization" | "emotion";
type ThemeMode = "light" | "dark" | "auto";

export type PanelName =
  | "queue"
  | "history"
  | "settings"
  | "sleepTimer"
  | "search"
  | "lyricSettings"
  | "eq"
  | "visualSettings"
  | "keyboardShortcuts"
  | "gestureSettings"
  | "listeningHistory"
  | "listeningJournal"
  | "dailyRecommendation"
  | "lyricsImport"
  | "offlineCache"
  | "share"
  | "playerSkins"
  | "lyricsSearch"
  | "libraryManager"
  | "lyricsCoverEditor"
  | "smartPlaylist"
  | "backupRestore"
  | "statsAchievements"
  | "professionalMode"
  | "formatConverter"
  | "dsdConverter"
  | "trackCutter"
  | "crossfadeMixer"
  | "fingerprintScanner"
  | "libraryHealth"
  | "professionalTools"
  | "instantMix"
  | "smartMixSession"
  | "smartRandom"
  | "emotionMatrix"
  | "aiSettings"
  | "aiAgent"
  | "dnaJournal"
  | "shelf3D"
  | "audioSourceManager"
  | "cloudMusic"
  | "accountCenter"
  | "dataManager";

export const PANEL_NAMES: readonly PanelName[] = [
  "queue",
  "history",
  "settings",
  "sleepTimer",
  "search",
  "lyricSettings",
  "eq",
  "visualSettings",
  "keyboardShortcuts",
  "gestureSettings",
  "listeningHistory",
  "listeningJournal",
  "dailyRecommendation",
  "lyricsImport",
  "offlineCache",
  "share",
  "playerSkins",
  "lyricsSearch",
  "libraryManager",
  "lyricsCoverEditor",
  "smartPlaylist",
  "backupRestore",
  "statsAchievements",
  "professionalMode",
  "formatConverter",
  "dsdConverter",
  "trackCutter",
  "crossfadeMixer",
  "fingerprintScanner",
  "libraryHealth",
  "professionalTools",
  "instantMix",
  "smartMixSession",
  "smartRandom",
  "emotionMatrix",
  "aiSettings",
  "aiAgent",
  "dnaJournal",
  "shelf3D",
  "audioSourceManager",
  "cloudMusic",
  "accountCenter",
  "dataManager",
];

const FULLSCREEN_PANELS: readonly PanelName[] = [
  "emotionMatrix",
  "shelf3D",
  "formatConverter",
  "dsdConverter",
  "trackCutter",
  "crossfadeMixer",
  "professionalMode",
  "share",
  "statsAchievements",
  "dnaJournal",
];

function createDefaultPanels(): Record<PanelName, boolean> {
  return Object.fromEntries(PANEL_NAMES.map((name) => [name, false])) as Record<PanelName, boolean>;
}

interface UIState {
  currentView: ViewType;
  themeMode: ThemeMode;
  themeColors: ThemeColors;
  isDynamicTheme: boolean;
  showModal: boolean;
  modalContent: React.ReactNode | null;
  isTransitioning: boolean;
  isNavMenuOpen: boolean;
  setIsNavMenuOpen: (open: boolean) => void;

  panels: Record<PanelName, boolean>;
  openPanel: (name: PanelName) => void;
  closePanel: (name: PanelName) => void;
  togglePanel: (name: PanelName) => void;
  closeAllPanels: () => void;
  isPanelOpen: (name: PanelName) => boolean;

  isFullscreenLyrics: boolean;
  setIsFullscreenLyrics: (isFullscreen: boolean) => void;
  toggleFullscreenLyrics: () => void;

  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;

  isLyricSettingsOpen: boolean;
  setIsLyricSettingsOpen: (isOpen: boolean) => void;

  /**
   * @deprecated since S6-6a. Toast 状态已迁到 @/store/toastStore（useToastStore）。
   * 这里只做转发，uiStore 不再持有 toasts；Removal: 下一 minor 版本。
   */
  showToast: (message: string, type?: ToastMessage["type"], duration?: number) => void;
  /** @deprecated since S6-6a. 用 useToastStore.getState().dismissToast(id)。 */
  removeToast: (id: string) => void;

  isEQOpen: boolean;
  setIsEQOpen: (isOpen: boolean) => void;

  isShelf3DOpen: boolean;
  setIsShelf3DOpen: (isOpen: boolean) => void;
  openShelf3D: () => void;
  closeShelf3D: () => void;
  toggleShelf3D: () => void;

  isFullscreen: boolean;
  setIsFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => void;

  isKeyboardShortcutsOpen: boolean;
  setIsKeyboardShortcutsOpen: (isOpen: boolean) => void;
  showKeyboardShortcuts: () => void;

  setCurrentView: (view: ViewType) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColors: (colors: ThemeColors) => void;
  setIsDynamicTheme: (enabled: boolean) => void;
  toggleTheme: () => void;
  showModalComponent: (content: React.ReactNode) => void;
  hideModal: () => void;
  setIsTransitioning: (transitioning: boolean) => void;
  restorePersistedView: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      currentView: "home",
      themeMode: "dark",
      themeColors: defaultColors,
      isDynamicTheme: true,
      showModal: false,
      modalContent: null,
      isTransitioning: false,
      isNavMenuOpen: false,
      setIsNavMenuOpen: (open) => set({ isNavMenuOpen: open }),

      restorePersistedView: () => {
        if (typeof window !== "undefined") {
          try {
            const saved =
              (localStorage.getItem("mimimusic_active_view") as ViewType) ||
              (sessionStorage.getItem("mimimusic_active_view") as ViewType);
            if (
              saved &&
              (saved === "home" ||
                saved === "player" ||
                saved === "visualization" ||
                saved === "emotion")
            ) {
              set({ currentView: saved });
            }
          } catch {
            // Ignore SSR / storage errors
          }
        }
      },

      panels: createDefaultPanels(),
      isShelf3DOpen: false,
      openShelf3D: () => get().openPanel("shelf3D"),
      closeShelf3D: () => get().closePanel("shelf3D"),
      toggleShelf3D: () => get().togglePanel("shelf3D"),
      setIsShelf3DOpen: (isOpen) => {
        if (isOpen) {
          get().openPanel("shelf3D");
        } else {
          get().closePanel("shelf3D");
        }
      },
      openPanel: (name) =>
        set((state) => {
          const next = { ...state.panels };
          const isFullscreenPanel = FULLSCREEN_PANELS.includes(name);

          if (isFullscreenPanel) {
            FULLSCREEN_PANELS.forEach((panelName) => {
              next[panelName] = false;
            });
          }

          next[name] = true;
          return {
            panels: next,
            isFullscreenLyrics: isFullscreenPanel ? false : state.isFullscreenLyrics,
            isShelf3DOpen: next.shelf3D,
          };
        }),
      closePanel: (name) =>
        set((state) => {
          const next = { ...state.panels, [name]: false };
          return {
            panels: next,
            isShelf3DOpen: next.shelf3D,
          };
        }),
      togglePanel: (name) => {
        const isOpen = get().panels[name];
        if (isOpen) {
          get().closePanel(name);
        } else {
          get().openPanel(name);
        }
      },
      closeAllPanels: () => set({ panels: createDefaultPanels(), isShelf3DOpen: false }),
      isPanelOpen: (name) => get().panels[name],

      isFullscreenLyrics: false,
      setIsFullscreenLyrics: (isFullscreen) => set({ isFullscreenLyrics: isFullscreen }),
      toggleFullscreenLyrics: () =>
        set((state) => ({ isFullscreenLyrics: !state.isFullscreenLyrics })),

      isSettingsOpen: false,
      setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

      isLyricSettingsOpen: false,
      setIsLyricSettingsOpen: (isOpen) => set({ isLyricSettingsOpen: isOpen }),

      // S6-6a：toast 域已迁出（./toastStore），这两个动作只做转发，不再写 uiStore 状态。
      showToast: (message, type = "info", duration) =>
        useToastStore.getState().showToast(message, type, duration),
      removeToast: (id) => useToastStore.getState().dismissToast(id),

      isEQOpen: false,
      setIsEQOpen: (isOpen) => set({ isEQOpen: isOpen }),

      isFullscreen: false,
      setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
      toggleFullscreen: async () => {
        const electronAPI = typeof window !== "undefined" ? window.electronAPI : null;
        if (electronAPI?.toggleFullscreen) {
          const newState = await electronAPI.toggleFullscreen();
          set({ isFullscreen: newState });
        } else {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
              console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            set({ isFullscreen: true });
          } else if (document.exitFullscreen) {
            document.exitFullscreen();
            set({ isFullscreen: false });
          }
        }
      },

      isKeyboardShortcutsOpen: false,
      setIsKeyboardShortcutsOpen: (isOpen) => set({ isKeyboardShortcutsOpen: isOpen }),
      showKeyboardShortcuts: () => set({ isKeyboardShortcutsOpen: true }),
      setCurrentView: (view) => {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("mimimusic_active_view", view);
            sessionStorage.setItem("mimimusic_active_view", view);
          } catch {
            // Ignored
          }
        }
        set({ currentView: view, isNavMenuOpen: false });
      },
      setThemeMode: (mode) => set({ themeMode: mode }),
      setThemeColors: (colors) => set({ themeColors: colors }),
      setIsDynamicTheme: (enabled) => set({ isDynamicTheme: enabled }),
      toggleTheme: () =>
        set((state) => ({
          themeMode: state.themeMode === "light" ? "dark" : "light",
        })),
      showModalComponent: (content) =>
        set({
          showModal: true,
          modalContent: content,
        }),
      hideModal: () =>
        set({
          showModal: false,
          modalContent: null,
        }),
      setIsTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
    }),
    {
      skipHydration: true,
      name: "ui-store-v2",
      version: 2,
      storage: createJSONStorage(() => createSafeStorage("ui-store-v2")),
      partialize: (state) => ({
        currentView: state.currentView,
        themeMode: state.themeMode,
        themeColors: state.themeColors,
        isDynamicTheme: state.isDynamicTheme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.currentView && typeof window !== "undefined") {
          try {
            localStorage.setItem("mimimusic_active_view", state.currentView);
            sessionStorage.setItem("mimimusic_active_view", state.currentView);
          } catch {
            // Ignore
          }
        }
      },
    }
  )
);
