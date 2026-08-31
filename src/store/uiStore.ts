import { create } from "zustand";
import { ThemeColors, defaultColors } from "@/utils/colorExtractor";

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

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
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

  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage["type"], duration?: number) => void;
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

export const useUIStore = create<UIState>((set, get) => ({
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
        const saved = sessionStorage.getItem("mimimusic_active_view") as ViewType;
        if (saved && (saved === "home" || saved === "player" || saved === "visualization" || saved === "emotion")) {
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
  toggleFullscreenLyrics: () => set((state) => ({ isFullscreenLyrics: !state.isFullscreenLyrics })),

  isSettingsOpen: false,
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

  isLyricSettingsOpen: false,
  setIsLyricSettingsOpen: (isOpen) => set({ isLyricSettingsOpen: isOpen }),

  toasts: [],
  showToast: (message, type = "info", duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

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
}));
