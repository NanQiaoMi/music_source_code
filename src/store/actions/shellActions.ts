/**
 * S6-9d：键盘快捷键等外壳入口的命令式 UI 动作。
 *
 * keydown 处理器无法使用 hook selector（原生事件里没有 React 上下文），
 * 读「此刻」视图/设置态与切换面板统一收口到动作层，hooks 不再直接触达 store。
 */
import { usePanelStore } from "@/store/panelStore";
import { useUIStore } from "@/store/uiStore";
import { useUiShellStore } from "@/store/uiShellStore";

export const getUiShellSnapshot = () => useUiShellStore.getState();

export const toggleShelf3DPanel = (): void => {
  usePanelStore.getState().togglePanel("shelf3D");
};

export const openAiSettingsPanel = (): void => {
  usePanelStore.getState().openPanel("aiSettings");
};

export const toggleAiSettingsPanel = (): void => {
  usePanelStore.getState().togglePanel("aiSettings");
};

/** Esc：只关闭已打开的设置类浮层（保留原快捷键的逐项判断语义）。 */
export function closeSettingsOverlays(): void {
  const ui = useUIStore.getState();
  if (ui.isSettingsOpen) ui.setIsSettingsOpen(false);
  if (ui.isLyricSettingsOpen) ui.setIsLyricSettingsOpen(false);
}
