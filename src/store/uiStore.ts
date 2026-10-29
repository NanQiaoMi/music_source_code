/**
 * S6-6a/S6-6b/S6-6c/S6-7：uiStore 只保留弹窗字段与 deprecated 兼容转发器。
 * 各域唯一 owner：
 * - toast → ./toastStore（S6-6a）
 * - panel → ./panelStore（S6-6b）
 * - 壳（view/nav/transition/fullscreen）→ ./uiShellStore（S6-6c）
 * - 主题（themeMode/themeColors/isDynamicTheme）→ ./themeStore（S6-7）
 * 既有的 showToast/removeToast / openPanel/closePanel/... / setCurrentView/... / setThemeMode
 * 调用点不需要改 import，但状态读取必须走对应 owner store。唯二的例外是 currentView 与三个
 * theme 字段：ui-store-v2 的 key/version/partialize 必须与拆前逐字节一致，因此这里保留它们
 * 作为持久化投影（真正 owner 仍是 uiShellStore / themeStore），由文件末尾的 subscribe 单向
 * 同步；hydrate 时再把持久化值一次性灌回 owner（legacy 迁移，不新增 key）。
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/lib/storage/safeStorage";
import { ThemeColors, defaultColors } from "@/utils/colorExtractor";
import { useToastStore, type ToastMessage } from "@/store/toastStore";
import { FULLSCREEN_PANELS, usePanelStore, type PanelName } from "@/store/panelStore";
import { useUiShellStore, type ViewType } from "@/store/uiShellStore";
import { useThemeStore, type ThemeMode } from "@/store/themeStore";

export type { ToastMessage };
export type { PanelName };
export type { ViewType };
export type { ThemeMode };
/** @deprecated since S6-6b. 用 @/store/panelStore 的 PANEL_NAMES。 */
export { PANEL_NAMES } from "@/store/panelStore";

interface UIState {
  /**
   * @deprecated since S6-6c. 壳域唯一 owner 是 @/store/uiShellStore（useUiShellStore）。
   * uiStore 只保留 ui-store-v2 的持久化投影；读取当前视图请用 useUiShellStore。
   */
  currentView: ViewType;
  /**
   * @deprecated since S6-7. 主题唯一 owner 是 @/store/themeStore（useThemeStore）。
   * 以下三个字段只作为 ui-store-v2 的持久化投影存在（文件末尾 subscribe 单向同步）。
   */
  themeMode: ThemeMode;
  themeColors: ThemeColors;
  isDynamicTheme: boolean;
  showModal: boolean;
  modalContent: React.ReactNode | null;

  /** @deprecated since S6-6c. 用 useUiShellStore.getState().setIsNavMenuOpen(open)。 */
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

  isKeyboardShortcutsOpen: boolean;
  setIsKeyboardShortcutsOpen: (isOpen: boolean) => void;
  showKeyboardShortcuts: () => void;

  /** @deprecated since S6-6c. 用 useUiShellStore.getState().setCurrentView(view)。 */
  setCurrentView: (view: ViewType) => void;
  /** @deprecated since S6-7. 用 useThemeStore.getState().setThemeMode(mode)。 */
  setThemeMode: (mode: ThemeMode) => void;
  /** @deprecated since S6-7. 用 useThemeStore.getState().setThemeColors(colors)。 */
  setThemeColors: (colors: ThemeColors) => void;
  /** @deprecated since S6-7. 用 useThemeStore.getState().setIsDynamicTheme(enabled)。 */
  setIsDynamicTheme: (enabled: boolean) => void;
  /** @deprecated since S6-7. 用 useThemeStore.getState().toggleTheme()。 */
  toggleTheme: () => void;
  showModalComponent: (content: React.ReactNode) => void;
  hideModal: () => void;
  /** @deprecated since S6-6c. 用 useUiShellStore.getState().setIsTransitioning(value)。 */
  setIsTransitioning: (transitioning: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // S6-6c：currentView 是 ui-store-v2 的持久化投影（见文件末尾 subscribe），不是 owner。
      currentView: "home",
      themeMode: "dark",
      themeColors: defaultColors,
      isDynamicTheme: true,
      showModal: false,
      modalContent: null,

      // S6-6c：壳域动作只做转发（唯一实现与状态在 ./uiShellStore）。
      setIsNavMenuOpen: (open) => useUiShellStore.getState().setIsNavMenuOpen(open),

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

      isKeyboardShortcutsOpen: false,
      setIsKeyboardShortcutsOpen: (isOpen) => set({ isKeyboardShortcutsOpen: isOpen }),
      showKeyboardShortcuts: () => set({ isKeyboardShortcutsOpen: true }),
      setCurrentView: (view) => useUiShellStore.getState().setCurrentView(view),
      // S6-7：主题动作只做转发（唯一实现与状态在 ./themeStore）。
      setThemeMode: (mode) => useThemeStore.getState().setThemeMode(mode),
      setThemeColors: (colors) => useThemeStore.getState().setThemeColors(colors),
      setIsDynamicTheme: (enabled) => useThemeStore.getState().setIsDynamicTheme(enabled),
      toggleTheme: () => useThemeStore.getState().toggleTheme(),
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
      setIsTransitioning: (transitioning) =>
        useUiShellStore.getState().setIsTransitioning(transitioning),
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
      // S6-6c：持久化的 currentView 由 persist hydrate 提供，hydrate 后同步给壳域 owner；
      // 不再读写 mimimusic_active_view 双通道（ui-store-v2 是唯一持久化来源）。
      onRehydrateStorage: () => (state) => {
        if (state?.currentView) useUiShellStore.setState({ currentView: state.currentView });
        // S6-7：主题持久化仍留在 ui-store-v2（payload 不变），hydrate 后一次性灌入唯一 owner。
        if (state) {
          useThemeStore.getState().adoptLegacyTheme({
            themeMode: state.themeMode,
            themeColors: state.themeColors,
            isDynamicTheme: state.isDynamicTheme,
          });
        }
      },
    }
  )
);

// S6-6c：壳域唯一 owner = uiShellStore。uiStore 侧只在 currentView 真正变化时更新持久化投影，
// 保证 ui-store-v2 的 {currentView, themeMode, themeColors, isDynamicTheme}/version 2 与拆前
// 逐字节一致；全屏/导航/转场等非持久壳字段不再产生任何 ui-store-v2 写盘。
useUiShellStore.subscribe((state, prev) => {
  if (state.currentView === prev.currentView) return;
  if (useUIStore.getState().currentView !== state.currentView) {
    useUIStore.setState({ currentView: state.currentView });
  }
});

// S6-7：主题唯一 owner = themeStore。uiStore 侧只在主题真正变化时更新持久化投影，保证
// ui-store-v2 的 {currentView, themeMode, themeColors, isDynamicTheme}/version 2 与拆前
// 逐字节一致，同时一次主题切换只产生一次投影 setState（一次写盘）。
useThemeStore.subscribe((state, prev) => {
  if (
    state.themeMode === prev.themeMode &&
    state.themeColors === prev.themeColors &&
    state.isDynamicTheme === prev.isDynamicTheme
  ) {
    return;
  }
  useUIStore.setState({
    themeMode: state.themeMode,
    themeColors: state.themeColors,
    isDynamicTheme: state.isDynamicTheme,
  });
});

// 兼容：旧代码（含测试）直接 useUIStore.setState({ currentView }) 时仍驱动壳域，避免
// deprecated 投影与 owner 分叉。uiShellStore 不反向 import uiStore，store 图保持无环。
useUIStore.subscribe((state, prev) => {
  if (state.currentView === prev.currentView) return;
  if (useUiShellStore.getState().currentView !== state.currentView) {
    useUiShellStore.setState({ currentView: state.currentView });
  }
});

// 兼容镜像 + 壳域副作用：旧 openPanel 打开全屏面板时会同时关闭全屏歌词。panels 已不在
// uiStore，用 subscribe 保持"打开全屏面板 ⇒ fullscreenSurface 离开 lyrics"（写 uiShellStore）与
// isShelf3DOpen 镜像（只有真正变化时才 setState，避免面板点击白写 ui-store-v2）。方向固定为
// uiStore → panelStore / uiShellStore，反向 import 会让 store 图出现环（S6-11c SCC=0）。
usePanelStore.subscribe((state, prev) => {
  if (state.panels === prev.panels) return;
  const fullscreenOpened = FULLSCREEN_PANELS.some(
    (name) => state.panels[name] && !prev.panels[name]
  );
  if (fullscreenOpened) useUiShellStore.getState().setFullscreenLyrics(false);
  const isShelf3DOpen = state.panels.shelf3D;
  if (useUIStore.getState().isShelf3DOpen !== isShelf3DOpen) {
    useUIStore.setState({ isShelf3DOpen });
  }
});
