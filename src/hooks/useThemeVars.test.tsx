// S6-7：useThemeVars 是 --theme-* CSS 变量与 html class 的唯一运行期写入方。
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultColors, lightModeColors } from "@/utils/colorExtractor";
import { defaultThemeState, useThemeStore } from "@/store/themeStore";
import { THEME_COLOR_VARS, applyThemeColors, useThemeVars } from "./useThemeVars";

function ThemeProbe() {
  useThemeVars();
  return createElement("span", null, "theme-probe");
}

const customColors = {
  primary: "rgb(101, 1, 1)",
  secondary: "rgb(102, 2, 2)",
  accent: "rgb(103, 3, 3)",
  complementary: "rgb(104, 4, 4)",
  background: "rgb(105, 5, 5)",
  surface: "rgb(106, 6, 6)",
  gradient: ["rgb(101, 1, 1)", "rgb(102, 2, 2)"],
  text: "rgb(107, 7, 7)",
  textMuted: "rgba(107, 7, 7, 0.6)",
};

const rootStyle = () => document.documentElement.style;
const resetThemeDom = () => {
  document.documentElement.className = "";
  for (const name of Object.keys(THEME_COLOR_VARS)) rootStyle().removeProperty(name);
  rootStyle().removeProperty("--theme-transition-duration");
};

describe("useThemeVars (S6-7)", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    useThemeStore.setState(defaultThemeState);
    resetThemeDom();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = undefined;
    container.remove();
    resetThemeDom();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function mountProbe() {
    root = createRoot(container);
    await act(async () => root?.render(createElement(ThemeProbe)));
  }

  it("applies the owner palette and dark class on first mount", async () => {
    await mountProbe();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(rootStyle().getPropertyValue("--theme-primary")).toBe(defaultColors.primary);
    expect(rootStyle().getPropertyValue("--theme-background")).toBe(defaultColors.background);
    expect(rootStyle().getPropertyValue("--theme-gradient")).toContain(defaultColors.accent);
    expect(rootStyle().getPropertyValue("--theme-transition-duration")).toBe("1000ms");
  });

  it("derives every CSS variable from a single themeColors write", async () => {
    await mountProbe();

    await act(async () => useThemeStore.getState().setThemeColors(customColors));

    expect(useThemeStore.getState().themeColors).toBe(customColors);
    expect(rootStyle().getPropertyValue("--theme-primary")).toBe(customColors.primary);
    expect(rootStyle().getPropertyValue("--theme-secondary")).toBe(customColors.secondary);
    expect(rootStyle().getPropertyValue("--theme-accent")).toBe(customColors.accent);
    expect(rootStyle().getPropertyValue("--theme-text-muted")).toBe(customColors.textMuted);
    expect(rootStyle().getPropertyValue("--theme-gradient")).toContain(customColors.accent);
  });

  it("switches class and default palette with the theme mode", async () => {
    await mountProbe();

    await act(async () => useThemeStore.getState().setThemeMode("light"));

    expect(useThemeStore.getState().themeMode).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(rootStyle().getPropertyValue("--theme-background")).toBe(lightModeColors.background);
  });

  it("follows prefers-color-scheme in auto mode", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));

    await act(async () => useThemeStore.getState().setThemeMode("auto"));
    await mountProbe();

    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("skips DOM writes when the palette has not changed", () => {
    expect(applyThemeColors(defaultColors)).toBe(Object.keys(THEME_COLOR_VARS).length);
    expect(applyThemeColors(defaultColors)).toBe(0);
  });
});
