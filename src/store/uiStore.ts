/**
 * S6-6a/S6-6b：uiStore 只保留壳域 + 主题字段，其余事实按域迁到唯一 owner：
 * - toast → ./toastStore（S6-6a）
 * - panel → ./panelStore（S6-6b）
 * 旧的 showToast/removeToast / openPanel/closePanel/... 保留为 deprecated 转发器，
 * 既有调用点不需要改 import；但状态读取必须走 useToastStore / usePanelStore，
 * 否则每次 UI 交互仍会经由 persist 写一次 localStorage。
 * ui-store-v2 的 key/version/partialize 全部未变（toast/panel 从未持久化）。
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/lib/storage/safeStorage";
import { ThemeColors, defaultColors } from "@/utils/colorExtractor";
import { useToastStore, type ToastMessage } from "@/store/toastStore";
import { FULLSCREEN_PANELS, usePanelStore, type PanelName } from "@/store/panelStore";

export type { ToastMessage };
export type { PanelName };
/** @deprecated since S6-6b. 用 @/store/panelStore 的 PANEL_NAMES。 */
export { PANEL_NAMES } from "@/store/panelStore";

type ViewType = "home" | "player" | "visualization" | "emotion";
type ThemeMode = "light" | "dark" | "auto";

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

  // S6-6b：panel 域已迁出（./panelStore），以下是 @deprecated 转发器。
  /** @deprecated since S6-6b. panels.shelf3D 的兼容镜像，读取请用 usePanelStore。 */
  isShelf3DOpen: boolean;
  /** @deprecated since S6-6b. 用 usePanelStore.getState().openPanel(name)。 */
  openPanel: (name: PanelName) => void;
  /** @deprecated since S6-6b. 用 usePanelStore.getState().closePanel(name)。 */
  closePanel: (name: PanelName) => void;
  /** @deprecated since S6-6b. 用 usePanelStore.getState().togglePanel(name)。 */
  togglePanel: (name: PanelName) => void;
  /** @deprecated since S6-6b. 用 usePanelStore.getState().closeAllPanels()。 */
  closeAllPanels: () => void;
  /** @deprecated since S6-6b. 用 usePanelStore.getState().isPanelOpen(name)。 */
  isPanelOpen: (name: PanelName) => boolean;
  /** @deprecated since S6-6b. 用 usePanelStore.getState().openShelf3D() 等别名。 */
  openShelf3D: () => void;
  closeShelf3D: () => void;
  toggleShelf3D: () => void;
  setIsShelf3DOpen: (isOpen: boolean) => void;

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
    (set) => ({
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

      // S6-6b：panel 动作只做转发（唯一实现与状态在 ./panelStore）；isShelf3DOpen 是
      // panels.shelf3D 的兼容镜像，由文件末尾的 subscribe 同步。
      isShelf3DOpen: false,
      openPanel: (name) => usePanelStore.getState().openPanel(name),
      closePanel: (name) => usePanelStore.getState().closePanel(name),
      togglePanel: (name) => usePanelStore.getState().togglePanel(name),
      closeAllPanels: () => usePanelStore.getState().closeAllPanels(),
      isPanelOpen: (name) => usePanelStore.getState().isPanelOpen(name),
      openShelf3D: () => usePanelStore.getState().openShelf3D(),
      closeShelf3D: () => usePanelStore.getState().closeShelf3D(),
      toggleShelf3D: () => usePanelStore.getState().toggleShelf3D(),
      setIsShelf3DOpen: (isOpen) => usePanelStore.getState().setIsShelf3DOpen(isOpen),

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

// 兼容镜像 + 壳域副作用：旧 openPanel 打开全屏面板时会同时关闭全屏歌词。panels 已不在
// uiStore，用 subscribe 保持"打开全屏面板 ⇒ isFullscreenLyrics=false"与 isShelf3DOpen
// 镜像（只有真正变化时才 setState，避免面板点击白写 ui-store-v2）。方向固定为
// uiStore → panelStore，反向 import 会让 store 图出现环（S6-11c SCC=0）。
usePanelStore.subscribe((state, prev) => {
  if (state.panels === prev.panels) return;
  const ui = useUIStore.getState();
  const isShelf3DOpen = state.panels.shelf3D;
  const fullscreenOpened = FULLSCREEN_PANELS.some(
    (name) => state.panels[name] && !prev.panels[name]
  );
  if (!fullscreenOpened && ui.isShelf3DOpen === isShelf3DOpen) return;
  useUIStore.setState({
    isShelf3DOpen,
    ...(fullscreenOpened ? { isFullscreenLyrics: false } : {}),
  });
});
