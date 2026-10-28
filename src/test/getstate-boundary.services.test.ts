import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S6-10 服务层 getState 棘轮（E7）。
 * 口径与 scripts/report-getstate.mjs 一致，基线在 perf/getstate-baseline.json。
 * 当前已达 service=0：allowed 必须为空；若将来无法避免，登记「文件 + 数量」并同步抬 target。
 */
const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "report-getstate.mjs");
const BASELINE = path.join(ROOT, "perf", "getstate-baseline.json");

interface GetStateReport {
  totals: { getState: number; files: number };
  byLayer: Record<string, number>;
  services: { total: number; files: Record<string, number>; scanned: number };
  files: Record<string, number>;
}

let cached: GetStateReport | null = null;

function report(): GetStateReport {
  if (cached) return cached;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "getstate-"));
  const out = path.join(dir, "report.json");
  try {
    execFileSync(process.execPath, [SCRIPT, "--json", out], { cwd: ROOT, stdio: "pipe" });
    const parsed = JSON.parse(fs.readFileSync(out, "utf8")) as GetStateReport;
    cached = parsed;
    return parsed;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("S6-10 service getState boundary", () => {
  it("counts real getState calls by layer and skips test files", () => {
    const result = report();
    expect(result.totals.getState).toBeGreaterThan(0);
    expect(result.services.scanned).toBeGreaterThan(0);
    expect(result.byLayer.services).toBe(result.services.total);
    // 非空证明扫描器没有退化为 0；test 文件（大量 getState）必须被排除。
    expect(result.files["src/hooks/useAudioPlayer.ts"]).toBeGreaterThan(0);
    expect(result.files["src/store/audioStore.test.ts"]).toBeUndefined();
  });

  it("keeps services within the frozen ratchet (currently 0)", () => {
    const result = report();
    const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")) as {
      targets?: { services?: number };
      allowed?: { services?: Record<string, number> };
    };
    const target = baseline.targets?.services ?? 0;
    const allowed = baseline.allowed?.services ?? {};
    expect(result.services.total).toBeLessThanOrEqual(target);
    const offenders = Object.entries(result.services.files).filter(
      ([file, count]) => count > (allowed[file] ?? 0)
    );
    expect(offenders).toEqual([]);
    if (target === 0) expect(result.services.files).toEqual({});
  });

  it("passes report-getstate --check (same ratchet in CI form)", () => {
    expect(() =>
      execFileSync(process.execPath, [SCRIPT, "--check"], { cwd: ROOT, stdio: "pipe" })
    ).not.toThrow();
  });
});
