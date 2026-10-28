/**
 * S6-10b / S6-6a：组件层无法使用 hook 的命令式 UI 入口。
 *
 * `toast` 单例在模块作用域被调用（无 React 上下文），只能由 store 动作层读取
 * 当前 toastStore（toast 事实的唯一 owner）；能拿到 hook 的组件仍直接用 selector。
 */
import { useToastStore, type ToastMessage } from "@/store/toastStore";

export function showToast(
  message: string,
  type: ToastMessage["type"] = "info",
  duration?: number
): void {
  useToastStore.getState().showToast(message, type, duration);
}

/**
 * 命令式 toast 单例（S6-12a：从 components/shared/GlassToast 下沉到动作层）。
 * store 不得 import components，因此 aiStore/emotionStore/sourceSlice 改从这里取；
 * GlassToast 仍 re-export 同一对象，组件侧旧 import 路径继续可用。
 */
export const toast = {
  success: (message: string, duration?: number) => showToast(message, "success", duration),
  error: (message: string, duration?: number) => showToast(message, "error", duration),
  info: (message: string, duration?: number) => showToast(message, "info", duration),
  warning: (message: string, duration?: number) => showToast(message, "warning", duration),
};
