// S6-7：首帧主题引导。SSR 固定输出 dark（globals.css 深色默认），内联脚本在 hydration
// 之前按 ui-store-v2 的 themeMode 切 class，避免刷新时先深后浅。
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_BOOT_SCRIPT, THEME_BOOT_STORAGE_KEY, ThemeBootScript } from "./ThemeBootScript";

/** 模拟浏览器在解析 <head> 时同步执行内联脚本（jsdom 不会执行 SSR 字符串）。 */
function runBootScript() {
  new Function(THEME_BOOT_SCRIPT)();
}

describe("ThemeBootScript (S6-7)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "dark"; // 服务端默认
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    vi.unstubAllGlobals();
  });

  it("renders a synchronous inline script for the <head>", () => {
    const html = renderToStaticMarkup(<ThemeBootScript />);

    expect(html).toContain('id="theme-boot"');
    expect(html).toContain("localStorage");
    expect(html).not.toContain("--theme-primary");
  });

  it("keeps the server default dark when nothing is persisted", () => {
    runBootScript();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("switches to light before hydration from the unchanged ui-store-v2 payload", () => {
    localStorage.setItem(
      THEME_BOOT_STORAGE_KEY,
      JSON.stringify({ state: { themeMode: "light" }, version: 2 })
    );

    runBootScript();

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("resolves auto with prefers-color-scheme", () => {
    localStorage.setItem(
      THEME_BOOT_STORAGE_KEY,
      JSON.stringify({ state: { themeMode: "auto" }, version: 2 })
    );

    runBootScript();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to dark on a corrupt payload instead of throwing", () => {
    localStorage.setItem(THEME_BOOT_STORAGE_KEY, "{not-json");

    expect(() => runBootScript()).not.toThrow();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
