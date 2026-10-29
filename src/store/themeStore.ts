/**
 * S6-7：主题运行时事实（themeMode / themeColors / isDynamicTheme）的唯一 owner。
 *
 * 为什么不是 uiStore / visualSettingsStore：
 * - uiStore 的 theme* 三个字段是 ui-store-v2 的持久化投影（写入端只有本 store 的
 *   subscribe，见 uiStore.ts 末尾），hydrate 时通过 onRehydrateStorage 一次性灌入本
 *   store；payload 形状保持 {currentView,themeMode,themeColors,isDynamicTheme}/v2 不变。
 * - visualSettingsStore 只保留视觉参数与预设主题数据；它不再是运行时主题色的写入方。
 *
 * 本 store 刻意不挂 persist：持久化仍由 ui-store-v2 承担（父任务要求格式不变），
 * 避免同一事实出现两份可写副本。预设字段（currentTheme/customTheme/
 * followSystemTheme/autoDayNight）未在 S6-7 迁出，见 TRACKING 缺口。
 */
import { create } from "zustand";
import { defaultColors, type ThemeColors } from "@/utils/colorExtractor";

export type ThemeMode = "light" | "dark" | "auto";

export interface ThemeState {
  themeMode: ThemeMode;
  themeColors: ThemeColors;
  isDynamicTheme: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColors: (colors: ThemeColors) => void;
  setIsDynamicTheme: (enabled: boolean) => void;
  toggleTheme: () => void;
  /** 一次性 legacy 迁移入口：uiStore 从 ui-store-v2 hydrate 后调用。 */
  adoptLegacyTheme: (
    patch: Partial<Pick<ThemeState, "themeMode" | "themeColors" | "isDynamicTheme">>
  ) => void;
}

export const defaultThemeState = {
  themeMode: "dark" as ThemeMode,
  themeColors: defaultColors,
  isDynamicTheme: true,
};

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

export const useThemeStore = create<ThemeState>()((set, get) => ({
  ...defaultThemeState,

  setThemeMode: (mode) => {
    if (!THEME_MODES.includes(mode) || get().themeMode === mode) return;
    set({ themeMode: mode });
  },
  // 同一对象引用重复写入直接短路：切歌/面板重复 apply 不会产生第二次 ui-store-v2 写盘，
  // 也不会让 useThemeVars 重复写 CSS 变量。
  setThemeColors: (colors) => {
    if (!colors || get().themeColors === colors) return;
    set({ themeColors: colors });
  },
  setIsDynamicTheme: (enabled) => {
    if (get().isDynamicTheme === enabled) return;
    set({ isDynamicTheme: enabled });
  },
  toggleTheme: () =>
    set((state) => ({ themeMode: state.themeMode === "light" ? "dark" : "light" })),

  adoptLegacyTheme: (patch) => {
    const current = get();
    const next: Partial<ThemeState> = {};
    if (
      patch.themeMode &&
      THEME_MODES.includes(patch.themeMode) &&
      patch.themeMode !== current.themeMode
    ) {
      next.themeMode = patch.themeMode;
    }
    if (patch.themeColors && patch.themeColors !== current.themeColors) {
      next.themeColors = patch.themeColors;
    }
    if (
      typeof patch.isDynamicTheme === "boolean" &&
      patch.isDynamicTheme !== current.isDynamicTheme
    ) {
      next.isDynamicTheme = patch.isDynamicTheme;
    }
    if (Object.keys(next).length > 0) set(next);
  },
}));

/** "auto" 解析为具体明暗模式；SSR / 无 matchMedia 时按服务端默认 dark 处理。 */
export function resolveThemeMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "auto") return mode;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
