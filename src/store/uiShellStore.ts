/**
 * S6-6c: UI 壳域（视图/导航/全屏/转场）唯一 owner（transient）。
 *
 * 事实从 uiStore 原样迁出：currentView（含 `setCurrentView` 关闭导航菜单的语义）、
 * isTransitioning、isNavMenuOpen、isFullscreenLyrics、isFullscreen 及动作。
 * 动作实现与拆前逐字一致（Electron toggleFullscreen 优先，否则走 document 全屏 API）。
 *
 * 不直接接 persist：ui-store-v2 的 key/version/partialize 必须与拆前逐字节一致，
 * 因此 uiStore 仍持有 currentView 的持久化投影（见 uiStore.ts 文件末尾 subscribe）。
 * 非持久壳字段（全屏/导航/转场）不再触发 ui-store-v2 写盘；uiShellStore 不进
 * storageRegistry，store 图方向固定为 uiStore -> uiShellStore（S6-11c SCC=0）。
 */
import { create } from "zustand";

export type ViewType = "home" | "player" | "visualization" | "emotion";

interface UIShellState {
  currentView: ViewType;
  isTransitioning: boolean;
  isNavMenuOpen: boolean;
  isFullscreenLyrics: boolean;
  isFullscreen: boolean;
  setCurrentView: (view: ViewType) => void;
  setIsTransitioning: (transitioning: boolean) => void;
  setIsNavMenuOpen: (open: boolean) => void;
  setIsFullscreenLyrics: (isFullscreen: boolean) => void;
  toggleFullscreenLyrics: () => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => Promise<void>;
}

export const useUiShellStore = create<UIShellState>()((set) => ({
  currentView: "home",
  isTransitioning: false,
  isNavMenuOpen: false,
  isFullscreenLyrics: false,
  isFullscreen: false,

  setCurrentView: (view) => set({ currentView: view, isNavMenuOpen: false }),
  setIsTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
  setIsNavMenuOpen: (open) => set({ isNavMenuOpen: open }),

  setIsFullscreenLyrics: (isFullscreen) => set({ isFullscreenLyrics: isFullscreen }),
  toggleFullscreenLyrics: () => set((state) => ({ isFullscreenLyrics: !state.isFullscreenLyrics })),

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
}));
