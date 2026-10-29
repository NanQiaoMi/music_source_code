/**
 * S6-6b: panel 域唯一 owner（transient）。
 *
 * 事实从 uiStore 原样迁出：panels 映射 + openPanel/closePanel/togglePanel/closeAllPanels/
 * isPanelOpen、PANEL_NAMES/FULLSCREEN_PANELS（含全屏面板互斥）以及 shelf3D 别名动作。
 * 动作语义与拆前逐字一致：全屏面板互斥只清其它全屏项、不清非全屏项；toggle 走 open/close。
 *
 * 不持久化：拆前 uiStore 的 partialize 只有 currentView/themeMode/themeColors/isDynamicTheme，
 * 面板开合从不落盘（刷新即关闭）。本 store 因此不接 persist、不进 storageRegistry，
 * ui-store-v2 的 key/version/partialize 全部保持不变。
 *
 * 跨域副作用：旧 openPanel 打开全屏面板时会顺手退出全屏歌词。本文件不 import uiStore
 * （否则 store 图出现 uiStore <-> panelStore 运行时环，S6-11c SCC=0 会红），改由 uiStore
 * 在模块初始化时用 usePanelStore.subscribe 观察 panels 变化并落壳域状态；S6-6c 起壳域
 * owner 是 uiShellStore（fullscreenSurface，S6-8a 收敛为枚举），副作用写那里。
 */
import { create } from "zustand";

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

/** 全屏面板：互斥打开，且打开时会关闭全屏歌词（壳域，见文件头）。 */
export const FULLSCREEN_PANELS: readonly PanelName[] = [
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

export function isFullscreenPanel(name: PanelName): boolean {
  return FULLSCREEN_PANELS.includes(name);
}

export function createDefaultPanels(): Record<PanelName, boolean> {
  return Object.fromEntries(PANEL_NAMES.map((name) => [name, false])) as Record<PanelName, boolean>;
}

interface PanelState {
  panels: Record<PanelName, boolean>;
  openPanel: (name: PanelName) => void;
  closePanel: (name: PanelName) => void;
  togglePanel: (name: PanelName) => void;
  closeAllPanels: () => void;
  isPanelOpen: (name: PanelName) => boolean;
  /** shelf3D 兼容别名：与 openPanel("shelf3D") 等价（旧 uiStore API）。 */
  openShelf3D: () => void;
  closeShelf3D: () => void;
  toggleShelf3D: () => void;
  setIsShelf3DOpen: (isOpen: boolean) => void;
}

export const usePanelStore = create<PanelState>()((set, get) => ({
  panels: createDefaultPanels(),
  openPanel: (name) =>
    set((state) => {
      const next = { ...state.panels };
      if (isFullscreenPanel(name)) {
        FULLSCREEN_PANELS.forEach((panelName) => {
          next[panelName] = false;
        });
      }
      next[name] = true;
      return { panels: next };
    }),
  closePanel: (name) => set((state) => ({ panels: { ...state.panels, [name]: false } })),
  togglePanel: (name) => {
    if (get().panels[name]) {
      get().closePanel(name);
    } else {
      get().openPanel(name);
    }
  },
  closeAllPanels: () => set({ panels: createDefaultPanels() }),
  isPanelOpen: (name) => get().panels[name],
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
}));
