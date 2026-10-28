import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  GESTURE_SETTINGS_STORAGE_KEY,
  createDefaultGestureBindings,
  createDefaultGestureSettings,
  type GestureActionId,
  type GestureBindings,
  type GestureCommandId,
  type GestureSettings,
} from "@/lib/gesture/types";

type PersistedGestureSettings = Partial<Omit<GestureSettings, "bindings">> & {
  bindings?: Partial<GestureBindings>;
};

interface GestureSettingsState extends GestureSettings {
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  update: (patch: Partial<Omit<GestureSettings, "bindings">>) => void;
  setBinding: (command: GestureCommandId, action: GestureActionId) => void;
  setBindings: (bindings: Partial<GestureBindings>) => void;
  resetBindings: () => void;
  resetSettings: () => void;
}

function sanitizeSettings(persisted: PersistedGestureSettings | undefined): GestureSettings {
  const defaults = createDefaultGestureSettings();
  if (!persisted) return defaults;

  const bindings = {
    ...createDefaultGestureBindings(),
    ...(persisted.bindings ?? {}),
  };

  return {
    ...defaults,
    ...persisted,
    enabled: typeof persisted.enabled === "boolean" ? persisted.enabled : defaults.enabled,
    showHud: typeof persisted.showHud === "boolean" ? persisted.showHud : defaults.showHud,
    showPreview:
      typeof persisted.showPreview === "boolean" ? persisted.showPreview : defaults.showPreview,
    showSkeleton:
      typeof persisted.showSkeleton === "boolean" ? persisted.showSkeleton : defaults.showSkeleton,
    showCursor:
      typeof persisted.showCursor === "boolean" ? persisted.showCursor : defaults.showCursor,
    showDebugStats:
      typeof persisted.showDebugStats === "boolean"
        ? persisted.showDebugStats
        : defaults.showDebugStats,
    hudCollapsed:
      typeof persisted.hudCollapsed === "boolean" ? persisted.hudCollapsed : defaults.hudCollapsed,
    mirror: typeof persisted.mirror === "boolean" ? persisted.mirror : defaults.mirror,
    sensitivity: clampNumber(persisted.sensitivity, 0.5, 2, defaults.sensitivity),
    pointerSmoothing: clampNumber(persisted.pointerSmoothing, 0, 1, defaults.pointerSmoothing),
    volumeStep: clampNumber(persisted.volumeStep, 0.01, 0.2, defaults.volumeStep),
    cameraDeviceId: typeof persisted.cameraDeviceId === "string" ? persisted.cameraDeviceId : null,
    bindings,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * 手势偏好设置（持久化）。
 *
 * 与运行时状态分离的原因：
 * - 高频 cursor / fps 更新不应触发 persist 序列化；
 * - 关闭页面后需要保留用户的开关、灵敏度、摄像头与绑定。
 *
 * 存储键保持不变（mimi-gesture-settings-v1），后续新增字段通过 sanitizeSettings 兜底，
 * 不破坏已有 localStorage。
 */
export const useGestureSettingsStore = create<GestureSettingsState>()(
  persist(
    (set, get) => ({
      ...createDefaultGestureSettings(),

      setEnabled: (enabled) => set({ enabled }),
      toggleEnabled: () => set({ enabled: !get().enabled }),
      update: (patch) => set(patch),
      setBinding: (command, action) =>
        set((state) => ({ bindings: { ...state.bindings, [command]: action } })),
      setBindings: (bindings) => set((state) => ({ bindings: { ...state.bindings, ...bindings } })),
      resetBindings: () => set({ bindings: createDefaultGestureBindings() }),
      resetSettings: () => set(createDefaultGestureSettings()),
    }),
    {
      skipHydration: true,
      name: GESTURE_SETTINGS_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        enabled: state.enabled,
        showHud: state.showHud,
        showPreview: state.showPreview,
        showSkeleton: state.showSkeleton,
        showCursor: state.showCursor,
        showDebugStats: state.showDebugStats,
        hudCollapsed: state.hudCollapsed,
        mirror: state.mirror,
        sensitivity: state.sensitivity,
        pointerSmoothing: state.pointerSmoothing,
        volumeStep: state.volumeStep,
        cameraDeviceId: state.cameraDeviceId,
        bindings: state.bindings,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSettings(persisted as PersistedGestureSettings | undefined),
      }),
    }
  )
);
