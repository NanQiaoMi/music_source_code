/**
 * S6-6c: UI 壳域（视图/导航/全屏/转场）唯一 owner（transient）。
 *
 * S6-8a：全屏事实收敛为一个枚举 `fullscreenSurface`。
 * - "none"   ：没有全屏 surface
 * - "lyrics" ：全屏歌词（旧 isFullscreenLyrics=true）
 * - "panel"  ：整窗全屏 surface（旧 isFullscreen=true；Electron 窗口全屏或
 *              document.fullscreenElement，由 toggleFullscreen / 原生事件驱动）
 * 两个旧布尔值不再存在，surface 互斥：进入任一 surface 会替换另一个。
 *
 * 原生全屏状态只有本 store 一个写入口：toggleFullscreen 与全屏事件监听都走
 * syncNativeFullscreen；组件里的 fullscreenchange 监听已删除，避免三处各写一份。
 *
 * 不直接接 persist：ui-store-v2 的 key/version/partialize 必须与拆前逐字节一致，
 * 因此 uiStore 仍持有 currentView 的持久化投影（见 uiStore.ts 文件末尾 subscribe）。
 * fullscreenSurface 不在 partialize 中，任何全屏切换都不写 localStorage（测试守卫）。
 * uiShellStore 不进 storageRegistry，store 图方向固定为 uiStore -> uiShellStore（S6-11c SCC=0）。
 */
import { create } from "zustand";

export type ViewType = "home" | "player" | "visualization" | "emotion";
export type FullscreenSurface = "none" | "lyrics" | "panel";
export type OpenFullscreenSurface = Exclude<FullscreenSurface, "none">;

interface UIShellState {
  currentView: ViewType;
  isTransitioning: boolean;
  isNavMenuOpen: boolean;
  fullscreenSurface: FullscreenSurface;
  setCurrentView: (view: ViewType) => void;
  setIsTransitioning: (transitioning: boolean) => void;
  setIsNavMenuOpen: (open: boolean) => void;
  setFullscreenSurface: (surface: FullscreenSurface) => void;
  /** 进入/切换全屏 surface；再次对同一 surface 调用则回到 none。 */
  toggleFullscreenSurface: (surface: OpenFullscreenSurface) => void;
  /** 兼容旧语义：setIsFullscreenLyrics(value)。 */
  setFullscreenLyrics: (open: boolean) => void;
  toggleFullscreenLyrics: () => void;
  /** 原生全屏状态同步（document fullscreenchange / 旧 setIsFullscreen 语义）。 */
  syncNativeFullscreen: (native: boolean) => void;
  toggleFullscreen: () => Promise<void>;
}

function canUseDocument(): boolean {
  return typeof document !== "undefined";
}

export const useUiShellStore = create<UIShellState>()((set, get) => ({
  currentView: "home",
  isTransitioning: false,
  isNavMenuOpen: false,
  fullscreenSurface: "none",

  setCurrentView: (view) => set({ currentView: view, isNavMenuOpen: false }),
  setIsTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
  setIsNavMenuOpen: (open) => set({ isNavMenuOpen: open }),

  setFullscreenSurface: (surface) => {
    if (get().fullscreenSurface === surface) return;
    set({ fullscreenSurface: surface });
  },
  toggleFullscreenSurface: (surface) => {
    get().setFullscreenSurface(get().fullscreenSurface === surface ? "none" : surface);
  },
  setFullscreenLyrics: (open) => {
    const current = get().fullscreenSurface;
    if (open) {
      if (current !== "lyrics") set({ fullscreenSurface: "lyrics" });
      return;
    }
    // 关闭歌词只清歌词，不误伤整窗全屏（旧实现只把 isFullscreenLyrics 置 false）。
    if (current === "lyrics") set({ fullscreenSurface: "none" });
  },
  toggleFullscreenLyrics: () => get().toggleFullscreenSurface("lyrics"),

  syncNativeFullscreen: (native) => {
    const current = get().fullscreenSurface;
    if (native) {
      if (current !== "panel") set({ fullscreenSurface: "panel" });
    } else if (current === "panel") {
      set({ fullscreenSurface: "none" });
    }
  },

  toggleFullscreen: async () => {
    const electronAPI = typeof window !== "undefined" ? window.electronAPI : null;
    if (electronAPI?.toggleFullscreen) {
      const newState = await electronAPI.toggleFullscreen();
      set({ fullscreenSurface: newState ? "panel" : "none" });
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
        set({ fullscreenSurface: "panel" });
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
        set({ fullscreenSurface: "none" });
      }
    }
  },
}));

/**
 * 全屏事件的唯一监听点：把浏览器原生全屏状态同步进 owner。
 * 旧实现散落在 VisualizationView 与 useKeyboardShortcuts 两处（同一事实三份写入）。
 */
const FULLSCREEN_EVENTS = [
  "fullscreenchange",
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "MSFullscreenChange",
];

function readNativeFullscreen(): boolean {
  if (!canUseDocument()) return false;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

if (canUseDocument()) {
  const sync = () => useUiShellStore.getState().syncNativeFullscreen(readNativeFullscreen());
  FULLSCREEN_EVENTS.forEach((event) => document.addEventListener(event, sync));
  // 首帧对齐：Electron 窗口/浏览器可能已在全屏状态挂载。
  if (readNativeFullscreen()) useUiShellStore.setState({ fullscreenSurface: "panel" });
}
