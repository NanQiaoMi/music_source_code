import { create } from "zustand";
import { ThemeColors, defaultColors } from "@/utils/colorExtractor";

type ViewType = "home" | "player" | "visualization" | "emotion";
type ThemeMode = "light" | "dark" | "auto";

// ─── Centralized Panel Names ───────────────────────────────────
export type PanelName =
  | "queue" | "history" | "settings" | "sleepTimer" | "search"
  | "lyricSettings" | "eq" | "visualSettings" | "keyboardShortcuts"
  | "listeningHistory" | "dailyRecommendation" | "lyricsImport"
  | "offlineCache" | "share" | "playerSkins" | "lyricsSearch"
  | "libraryManager" | "lyricsCoverEditor" | "smartPlaylist"
  | "backupRestore" | "statsAchievements" | "professionalMode"
  | "formatConverter" | "dsdConverter" | "trackCutter" | "crossfadeMixer"
  | "fingerprintScanner" | "libraryHealth" | "professionalTools"
  | "instantMix" | "smartRandom" | "emotionMatrix" | "aiSettings" | "dnaJournal";

// Full-screen panels that should be mutually exclusive
const FULLSCREEN_PANELS: PanelName[] = [
  "emotionMatrix", "formatConverter", "dsdConverter", "trackCutter",
  "crossfadeMixer", "professionalMode", "share", "statsAchievements",
  "dnaJournal",
];

function createDefaultPanels(): Record<PanelName, boolean> {
  const panels = {} as Record<PanelName, boolean>;
  const allNames: PanelName[] = [
    "queue", "history", "settings", "sleepTimer", "search",
    "lyricSettings", "eq", "visualSettings", "keyboardShortcuts",
    "listeningHistory", "dailyRecommendation", "lyricsImport",
    "offlineCache", "share", "playerSkins", "lyricsSearch",
    "libraryManager", "lyricsCoverEditor", "smartPlaylist",
    "backupRestore", "statsAchievements", "professionalMode",
    "formatConverter", "dsdConverter", "trackCutter", "crossfadeMixer",
    "fingerprintScanner", "libraryHealth", "professionalTools",
    "instantMix", "smartRandom", "emotionMatrix", "aiSettings", "dnaJournal",
  ];
  allNames.forEach(name => { panels[name] = false; });
  return panels;
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

  // ─── Centralized Panel Management ──────────────────────────
  panels: Record<PanelName, boolean>;
  openPanel: (name: PanelName) => void;
  closePanel: (name: PanelName) => void;
  togglePanel: (name: PanelName) => void;
  closeAllPanels: () => void;
  isPanelOpen: (name: PanelName) => boolean;

  // 全屏歌词
  isFullscreenLyrics: boolean;
  setIsFullscreenLyrics: (isFullscreen: boolean) => void;
  toggleFullscreenLyrics: () => void;

  // 设置面板
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;

  // 歌词设置
  isLyricSettingsOpen: boolean;
  setIsLyricSettingsOpen: (isOpen: boolean) => void;

  // Toast 消息
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage["type"], duration?: number) => void;
  removeToast: (id: string) => void;

  // EQ 面板
  isEQOpen: boolean;
  setIsEQOpen: (isOpen: boolean) => void;

  // 全屏状态
  isFullscreen: boolean;
  setIsFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => void;

  // 快捷键帮助
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
}

export const useUIStore = create<UIState>((set, get) => ({
  currentView: "home",
  themeMode: "dark",
  themeColors: defaultColors,
  isDynamicTheme: true,
  showModal: false,
  modalContent: null,
  isTransitioning: false,

  // ─── Centralized Panel Management ──────────────────────────
  panels: createDefaultPanels(),
  openPanel: (name) => set((state) => {
    const next = { ...state.panels };
    // If opening a fullscreen panel, close other fullscreen panels
    if (FULLSCREEN_PANELS.includes(name)) {
      FULLSCREEN_PANELS.forEach(p => { next[p] = false; });
    }
    next[name] = true;
    return { panels: next };
  }),
  closePanel: (name) => set((state) => ({
    panels: { ...state.panels, [name]: false },
  })),
  togglePanel: (name) => {
    const isOpen = get().panels[name];
    if (isOpen) {
      get().closePanel(name);
    } else {
      get().openPanel(name);
    }
  },
  closeAllPanels: () => set({ panels: createDefaultPanels() }),
  isPanelOpen: (name) => get().panels[name],

  // 全屏歌词
  isFullscreenLyrics: false,
  setIsFullscreenLyrics: (isFullscreen) => set({ isFullscreenLyrics: isFullscreen }),
  toggleFullscreenLyrics: () => set((state) => ({ isFullscreenLyrics: !state.isFullscreenLyrics })),

  // 设置面板
  isSettingsOpen: false,
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

  // 歌词设置
  isLyricSettingsOpen: false,
  setIsLyricSettingsOpen: (isOpen) => set({ isLyricSettingsOpen: isOpen }),

  // Toast 消息
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

  // EQ 面板
  isEQOpen: false,
  setIsEQOpen: (isOpen) => set({ isEQOpen: isOpen }),

  // 全屏状态
  isFullscreen: false,
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  toggleFullscreen: async () => {
    // If running in Electron, use the IPC call
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      const newState = await (window as any).electronAPI.toggleFullscreen();
      set({ isFullscreen: newState });
    } else {
      // Browser Fallback with real API call
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
        set({ isFullscreen: true });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
          set({ isFullscreen: false });
        }
      }
    }
  },

  // 快捷键帮助
  isKeyboardShortcutsOpen: false,
  setIsKeyboardShortcutsOpen: (isOpen) => set({ isKeyboardShortcutsOpen: isOpen }),
  showKeyboardShortcuts: () => set({ isKeyboardShortcutsOpen: true }),

  setCurrentView: (view) => set({ currentView: view }),
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
