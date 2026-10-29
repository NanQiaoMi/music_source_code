// S6-7 静态守卫：主题事实只能有一个 owner / 一个 CSS 变量写入方 / 一个首帧引导。
// 这里不做运行时行为断言（见 themeStore.test.ts 与 useThemeVars.test.tsx），只防回归：
// 谁再在别处定义 themeMode/themeColors/isDynamicTheme、写 --theme-* 变量或切换
// html class，测试直接失败。
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir.split(path.sep).join("/"), entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) out.push(rel);
  }
  return out;
}

const storeFiles = fs
  .readdirSync(path.join(ROOT, "src/store"))
  .filter((file) => file.endsWith(".ts") && !file.includes(".test.") && file !== "index.ts");

const RUNTIME_THEME_FIELDS = /\b(themeMode|themeColors|isDynamicTheme)\s*[:,]/;

describe("theme source of truth (static guard)", () => {
  it("defines runtime theme state only in themeStore (uiStore keeps the persist projection)", () => {
    const offenders = storeFiles
      .filter((file) => file !== "themeStore.ts")
      .filter((file) => RUNTIME_THEME_FIELDS.test(read("src/store/" + file)))
      .filter((file) => file !== "uiStore.ts");

    expect(offenders).toEqual([]);
  });

  it("keeps uiStore's theme fields read-only projections of themeStore", () => {
    const uiStore = read("src/store/uiStore.ts");

    expect(uiStore).toContain("useThemeStore.subscribe(");
    expect(uiStore).toContain("useThemeStore.getState().setThemeMode(mode)");
    expect(uiStore).toContain("useThemeStore.getState().setThemeColors(colors)");
    expect(uiStore).toContain("useThemeStore.getState().toggleTheme()");
    expect(uiStore).toContain("adoptLegacyTheme(");
  });

  it("declares --theme-* variable names only in useThemeVars", () => {
    const allowed = new Set(["src/hooks/useThemeVars.ts"]);
    const varLiteral =
      /["'`]--theme-(primary|secondary|accent|complementary|background|surface|text|text-muted|gradient|transition-duration)["'`]/;
    const offenders = walk("src").filter((rel) => !allowed.has(rel) && varLiteral.test(read(rel)));

    expect(offenders).toEqual([]);
  });

  it("toggles the html theme class only in useThemeVars and the pre-hydration boot script", () => {
    const allowed = new Set([
      "src/hooks/useThemeVars.ts",
      "src/components/layout/ThemeBootScript.tsx",
    ]);
    const classToggle = /classList\.(?:toggle|add|remove)\(\s*["'](?:dark|light)["']/;
    const offenders = walk("src").filter((rel) => !allowed.has(rel) && classToggle.test(read(rel)));

    expect(offenders).toEqual([]);
  });

  it("boots the theme class before hydration from the unchanged ui-store-v2 key", () => {
    const layout = read("src/app/layout.tsx");
    const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
    const boot = read("src/components/layout/ThemeBootScript.tsx");

    expect(layout).toContain("import { ThemeBootScript }");
    expect(head).toContain("<ThemeBootScript />");
    expect(boot).toContain('THEME_BOOT_STORAGE_KEY = "ui-store-v2"');
    expect(boot).toContain("dangerouslySetInnerHTML");
    expect(read("src/store/uiStore.ts")).toContain('name: "ui-store-v2"');
    // 首帧调色板由 globals.css 提供，boot 脚本不再写 --theme-* 变量。
    expect(boot).not.toMatch(/--theme-(primary|background|surface)/);
  });

  it("keeps the dynamic-theme hook free of DOM writes and uiStore coupling", () => {
    const hook = read("src/hooks/useDynamicTheme.ts");

    expect(hook).toContain("useThemeVars()");
    expect(hook).toContain("useThemeStore");
    expect(hook).not.toContain("useUIStore");
    expect(hook).not.toMatch(/documentElement\.style\.setProperty/);
  });

  it("leaves no inline theme palette in the page shell", () => {
    expect(read("src/app/page.tsx")).not.toContain("--theme-primary");
    expect(read("src/app/globals.css")).toContain("--theme-primary");
  });
});
