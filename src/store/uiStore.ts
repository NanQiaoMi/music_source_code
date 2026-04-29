import { create } from "zustand";
import { ThemeColors, defaultColors } from "@/utils/colorExtractor";

type ViewType = "home" | "player" | "visualization";
type ThemeMode = "light" | "dark" | "auto";

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
