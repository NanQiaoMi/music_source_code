// S6-7：themeStore 是 themeMode/themeColors/isDynamicTheme 的唯一可写 owner；
// uiStore 的三个同名字段只是 ui-store-v2 的持久化投影（payload 形状必须不变）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultColors } from "@/utils/colorExtractor";
import { defaultThemeState, resolveThemeMode, useThemeStore } from "./themeStore";
import { useUIStore } from "./uiStore";

const UI_STORE_KEY = "ui-store-v2";
const uiStoreWrites = (spy: { mock: { calls: [string, string][] } }) =>
  spy.mock.calls.filter(([key]) => key === UI_STORE_KEY);

const customColors = {
  primary: "rgb(1, 2, 3)",
  secondary: "rgb(4, 5, 6)",
  accent: "rgb(7, 8, 9)",
  complementary: "rgb(10, 11, 12)",
  background: "rgb(13, 14, 15)",
  surface: "rgb(16, 17, 18)",
  gradient: ["rgb(1, 2, 3)", "rgb(4, 5, 6)"],
  text: "rgb(19, 20, 21)",
  textMuted: "rgba(19, 20, 21, 0.6)",
};

describe("themeStore ownership (S6-7)", () => {
  beforeEach(() => {
    useThemeStore.setState(defaultThemeState);
    useUIStore.setState({ themeMode: "dark", themeColors: defaultColors, isDynamicTheme: true });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts from the pre-split defaults (dark / dynamic / default palette)", () => {
    expect(useThemeStore.getState()).toMatchObject({
      themeMode: "dark",
      themeColors: defaultColors,
      isDynamicTheme: true,
    });
  });

  it("is the only writer of theme changes and projects them once into ui-store-v2", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useThemeStore.getState().setThemeMode("light");

    expect(useThemeStore.getState().themeMode).toBe("light");
    expect(useUIStore.getState().themeMode).toBe("light");

    const writes = uiStoreWrites(setItem);
    expect(writes).toHaveLength(1);
    const saved = JSON.parse(String(writes[0][1]));
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.state).sort()).toEqual([
      "currentView",
      "isDynamicTheme",
      "themeColors",
      "themeMode",
    ]);
    expect(saved.state.themeMode).toBe("light");
  });

  it("does not rewrite unchanged facts (no duplicate persist writes)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useThemeStore.getState().setThemeMode("light");
    useThemeStore.getState().setThemeMode("light");
    useThemeStore.getState().setThemeColors(useThemeStore.getState().themeColors);
    useThemeStore.getState().setIsDynamicTheme(true);
    useThemeStore.getState().setIsDynamicTheme(true);

    expect(uiStoreWrites(setItem)).toHaveLength(1);
  });

  it("keeps the deprecated uiStore theme actions working as forwarders", () => {
    const ui = useUIStore.getState();

    ui.setThemeMode("auto");
    expect(useThemeStore.getState().themeMode).toBe("auto");

    // 与拆前 uiStore.toggleTheme 一致：非 light 一律切到 light（auto → light）。
    ui.toggleTheme();
    expect(useThemeStore.getState().themeMode).toBe("light");

    ui.setThemeColors(customColors);
    expect(useThemeStore.getState().themeColors).toBe(customColors);
    expect(useUIStore.getState().themeColors).toBe(customColors);

    ui.setIsDynamicTheme(false);
    expect(useThemeStore.getState().isDynamicTheme).toBe(false);
  });

  it("hydrates the owner from the legacy ui-store-v2 payload", async () => {
    localStorage.setItem(
      UI_STORE_KEY,
      JSON.stringify({
        state: { themeMode: "light", themeColors: customColors, isDynamicTheme: false },
        version: 2,
      })
    );

    await useUIStore.persist.rehydrate();

    expect(useThemeStore.getState()).toMatchObject({
      themeMode: "light",
      themeColors: customColors,
      isDynamicTheme: false,
    });
    // 旧 key 原样保留，不做删除（本版本只迁移读取）。
    expect(localStorage.getItem(UI_STORE_KEY)).toContain('"themeMode":"light"');
  });

  it("resolves auto against prefers-color-scheme and falls back to dark", () => {
    expect(resolveThemeMode("light")).toBe("light");
    expect(resolveThemeMode("dark")).toBe("dark");

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    expect(resolveThemeMode("auto")).toBe("dark");

    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    expect(resolveThemeMode("auto")).toBe("light");
    vi.unstubAllGlobals();
  });
});
