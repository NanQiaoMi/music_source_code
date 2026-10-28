/**
 * S6-10b：组件层无法使用 hook 的命令式 UI 入口。
 *
 * `toast` 单例在模块作用域被调用（无 React 上下文），只能由 store 动作层读取
 * 当前 uiStore；能拿到 hook 的组件仍直接用 selector，不经过本文件。
 */
import { useUIStore, type ToastMessage } from "@/store/uiStore";

export function showToast(
  message: string,
  type: ToastMessage["type"] = "info",
  duration?: number
): void {
  useUIStore.getState().showToast(message, type, duration);
}
