/**
 * S6-6a: toast 域唯一 owner（transient，不持久化，因此不进 storageRegistry）。
 *
 * 事实从 uiStore 原样迁出：`toasts` 队列 + showToast/dismissToast，默认 type=info、
 * duration=3000、id 形态、duration>0 才挂自动消失定时器都与拆前逐字一致。
 * 唯一新增约束是有界队列 MAX_TOASTS（超出丢最旧），避免长会话/批量导入时无限增长；
 * 低于上限时行为与旧实现完全相同。
 *
 * 兼容：uiStore 仍保留 showToast/removeToast 的 deprecated 转发器，78 处调用点不用改；
 * 但状态读取必须走 useToastStore（uiStore 不再持有 toasts，否则 persist 会在每次
 * toast 变更时写一次 localStorage）。
 */
import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

/** S6-8 会把成就 toast 并入本 store，用 variant 区分来源（当前默认按 "toast" 处理）。 */
export type ToastVariant = "toast" | "achievement";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  variant?: ToastVariant;
}

interface ToastState {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
  /** 兼容旧名（uiStore.removeToast / GlassToast 旧 import），与 dismissToast 等价。 */
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const DEFAULT_TOAST_DURATION = 3000;
/** 同时驻留的 toast 上限；超出时移除最旧的一条。 */
export const MAX_TOASTS = 5;

function createToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  showToast: (message, type = "info", duration = DEFAULT_TOAST_DURATION) => {
    const id = createToastId();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }].slice(-MAX_TOASTS),
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  removeToast: (id) => {
    get().dismissToast(id);
  },
  clearToasts: () => set({ toasts: [] }),
}));
