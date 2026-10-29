// S6-8 静态守卫：全屏 / toast / 性能档三类事实各自只能有一个 owner。
// 这里不做运行时行为断言（见 uiShellStore / toastStore / performanceV8Store 用例），
// 只防回归：谁再在别处声明状态字段、另起队列或开第二条档位写路径，测试直接失败。
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** 去注释，避免文档性提及（"旧 isFullscreenLyrics"）被当成代码命中。 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir.split(path.sep).join("/"), entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) out.push(rel);
  }
  return out;
}

const SRC_FILES = walk("src");
const STORE_FILES = fs
  .readdirSync(path.join(ROOT, "src/store"))
  .filter((file) => file.endsWith(".ts") && !file.includes(".test.") && file !== "index.ts")
  .map((file) => "src/store/" + file);

describe("fullscreen single owner (S6-8a)", () => {
  it("keeps the fullscreen surface enum only in uiShellStore", () => {
    const offenders = STORE_FILES.filter(
      (rel) =>
        rel !== "src/store/uiShellStore.ts" && /fullscreenSurface/.test(stripComments(read(rel)))
    );
    expect(offenders).toEqual([]);
  });

  it("removes the legacy boolean fullscreen facts from every store", () => {
    const offenders = STORE_FILES.filter((rel) =>
      /\bisFullscreen(Lyrics)?\s*[,:]|\bsetIsFullscreen/.test(stripComments(read(rel)))
    );
    expect(offenders).toEqual([]);
  });

  it("writes the surface only from the shell owner", () => {
    const allowed = new Set(["src/store/uiShellStore.ts"]);
    const offenders = SRC_FILES.filter(
      (rel) =>
        !allowed.has(rel) && /setState\(\s*\{[^}]*fullscreenSurface/.test(stripComments(read(rel)))
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the ui-store-v2 payload free of fullscreen fields", () => {
    const uiStore = stripComments(read("src/store/uiStore.ts"));
    expect(uiStore).toContain('name: "ui-store-v2"');
    const partialize = uiStore.slice(
      uiStore.indexOf("partialize:"),
      uiStore.indexOf("onRehydrateStorage")
    );
    expect(partialize).toContain("currentView");
    expect(partialize).not.toMatch(/fullscreen/i);
  });

  it("listens to native fullscreen events once, in the shell owner", () => {
    const shell = stripComments(read("src/store/uiShellStore.ts"));
    expect(shell).toContain('"fullscreenchange"');
    expect(shell).toContain("syncNativeFullscreen");
    // 其他文件不得再注册 fullscreen 事件监听（旧实现散落在两个组件里）。
    const offenders = SRC_FILES.filter(
      (rel) =>
        rel !== "src/store/uiShellStore.ts" &&
        /addEventListener\(\s*"[a-z]*fullscreen/i.test(stripComments(read(rel)))
    );
    expect(offenders).toEqual([]);
  });
});

describe("toast single owner (S6-8b)", () => {
  it("declares the toast queue only in toastStore", () => {
    const offenders = STORE_FILES.filter(
      (rel) => rel !== "src/store/toastStore.ts" && /^\s*toasts\s*:/m.test(stripComments(read(rel)))
    );
    expect(offenders).toEqual([]);
  });

  it("removes the duplicate achievement queue, timer and toast action", () => {
    const stats = stripComments(read("src/store/statsAchievementsStore.ts"));
    expect(stats).not.toContain("activeToasts");
    expect(stats).not.toMatch(/removeToast\s*:/);
    expect(stats).toContain("useToastStore.getState().showToast(");

    const component = stripComments(read("src/components/shared/AchievementToast.tsx"));
    expect(component).toContain("useToastStore");
    expect(component).not.toContain("useStatsAchievementsStore");
    expect(component).not.toContain("setTimeout");

    // 自动消失只由 toastStore 的 duration 定时器负责。
    const otherTimers = SRC_FILES.filter(
      (rel) =>
        rel !== "src/store/toastStore.ts" &&
        /setTimeout\([\s\S]{0,80}dismissToast/.test(stripComments(read(rel)))
    );
    expect(otherTimers).toEqual([]);
  });

  it("renders the achievement variant from the shared queue", () => {
    const toast = stripComments(read("src/store/toastStore.ts"));
    expect(toast).toContain("variant?: ToastVariant");
    expect(toast).toContain("achievement?: AchievementToastPayload");
    expect(read("src/components/shared/AchievementToast.tsx")).toContain(
      'toast.variant === "achievement"'
    );
    expect(read("src/components/shared/GlassToast.tsx")).toContain(
      'toast.variant !== "achievement"'
    );
  });
});

describe("quality tier single source (S6-8c)", () => {
  it("keeps performanceV8Store a read-only projection without tier write paths", () => {
    const perf = stripComments(read("src/store/performanceV8Store.ts"));
    expect(perf).not.toMatch(/setPerformance(Preset|Level)/);
    expect(perf).not.toMatch(/\bactivePreset\s*:/);
    expect(perf).toContain("visualRuntime.onQualityChange(");
    expect(perf).toContain("projectQuality:");
    expect(perf).toContain("partialize: (state) => ({ config: state.config })");
  });

  it("routes every explicit tier write through visualRuntime.setQuality", () => {
    const allowed = new Set([
      "src/runtime/visualRuntime.ts",
      "src/lib/visualization/quality.ts",
      "src/store/performanceV8Store.ts",
    ]);
    const offenders = SRC_FILES.filter(
      (rel) => !allowed.has(rel) && /\.setQuality\(/.test(stripComments(read(rel)))
    );
    expect(offenders).toEqual([]);
    expect(read("src/runtime/visualRuntime.ts")).toContain("setQuality(tier: VisualQuality)");
  });

  it("defines the tier vocabulary only in the runtime owner", () => {
    const offenders = SRC_FILES.filter(
      (rel) =>
        rel !== "src/runtime/visualRuntime.ts" &&
        /type VisualQuality\s*=/.test(stripComments(read(rel)))
    );
    expect(offenders).toEqual([]);
  });
});
