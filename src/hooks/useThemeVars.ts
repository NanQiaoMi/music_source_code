import { useEffect, useRef } from "react";
import { defaultColors, lightModeColors, type ThemeColors } from "@/utils/colorExtractor";
import { resolveThemeMode, useThemeStore } from "@/store/themeStore";

export const THEME_TRANSITION_DURATION_MS = 1000;

/**
 * 主题色 → CSS 变量映射。全仓库唯一的变量名清单：useThemeVars 是唯一的运行时写入方，
 * ThemeBootScript 只切 html class（首帧调色板由 globals.css 的 :root/:root.light 提供）。
 */
export const THEME_COLOR_VARS = {
  "--theme-primary": "primary",
  "--theme-secondary": "secondary",
  "--theme-accent": "accent",
  "--theme-complementary": "complementary",
  "--theme-background": "background",
  "--theme-surface": "surface",
  "--theme-text": "text",
  "--theme-text-muted": "textMuted",
  "--theme-gradient": "gradient",
} as const satisfies Record<string, keyof ThemeColors>;

export type ThemeColorVar = keyof typeof THEME_COLOR_VARS;

function gradientOf(colors: ThemeColors): string {
  return `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`;
}

export function paletteVars(colors: ThemeColors): Record<ThemeColorVar, string> {
  const vars = {} as Record<ThemeColorVar, string>;
  for (const [name, key] of Object.entries(THEME_COLOR_VARS) as [
    ThemeColorVar,
    keyof ThemeColors,
  ][]) {
    vars[name] = key === "gradient" ? gradientOf(colors) : colors[key];
  }
  return vars;
}

/** 同值写入跳过：切换到同一主题/重复 apply 不会产生第二次 DOM 写。返回实际写入数。 */
export function applyThemeColors(colors: ThemeColors): number {
  if (typeof document === "undefined") return 0;
  const style = document.documentElement.style;
  let writes = 0;
  for (const [name, value] of Object.entries(paletteVars(colors))) {
    if (style.getPropertyValue(name) === value) continue;
    style.setProperty(name, value);
    writes += 1;
  }
  return writes;
}

export function applyThemeClass(resolved: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
}

function applyModeDefaults(mode: "light" | "dark"): void {
  applyThemeColors(mode === "light" ? lightModeColors : defaultColors);
  const style = document.documentElement.style;
  const duration = `${THEME_TRANSITION_DURATION_MS}ms`;
  if (style.getPropertyValue("--theme-transition-duration") !== duration) {
    style.setProperty("--theme-transition-duration", duration);
  }
}

/**
 * 主题 → DOM 的唯一写入点（S6-7）。职责只有两件：
 * 1. html class（dark/light）与模式默认调色板，随 themeMode 变化；
 * 2. 调色板变量，随 themeColors 变化（挂载首帧交给模式 effect，避免默认深色调色板
 *    覆盖浅色模式）。
 * 不再写入 --theme-bg-* / --theme-glass-* 等静态变量：它们在 globals.css 的
 * :root / :root.light 中已有同值定义（原先 JS 双写是纯重复）。
 */
export function useThemeVars(): void {
  const themeMode = useThemeStore((state) => state.themeMode);
  const themeColors = useThemeStore((state) => state.themeColors);

  useEffect(() => {
    const resolved = resolveThemeMode(themeMode);
    applyThemeClass(resolved);
    applyModeDefaults(resolved);

    // auto 模式只在系统偏好变化时跟随明暗；不重置已提取的动态调色板（与拆前一致）。
    if (themeMode !== "auto" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeClass(resolveThemeMode("auto"));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [themeMode]);

  const skipFirstColorsRun = useRef(true);
  // 首帧已由上面的模式 effect 写入；这里只响应之后的 themeColors 变化。
  useEffect(() => {
    if (skipFirstColorsRun.current) {
      skipFirstColorsRun.current = false;
      return;
    }
    applyThemeColors(themeColors);
  }, [themeColors]);
}
