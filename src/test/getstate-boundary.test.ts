import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S6-10 getState 分层棘轮（E7）。
 * 口径与 scripts/report-getstate.mjs 一致，基线在 perf/getstate-baseline.json。
 * S6-10a 已收敛 service=0，S6-10b 收敛 component=0：allowed 必须为空；
 * S6-9c 收敛 lib=5（bootstrap / gesture 白名单，理由见 baseline.allowedRationale）；
 * S6-9d 收敛 hooks=0：渲染期读状态用 selector，事件回调的「此刻」快照走 store/actions。
 * 若将来无法避免，登记「文件 + 数量」并同步抬 target。
 */
const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "report-getstate.mjs");
const BASELINE = path.join(ROOT, "perf", "getstate-baseline.json");
const RATCHET_LAYERS = ["services", "components", "lib", "hooks"] as const;

type RatchetLayer = (typeof RATCHET_LAYERS)[number];

interface LayerReport {
  total: number;
  files: Record<string, number>;
  scanned: number;
}

interface GetStateReport extends Record<RatchetLayer, LayerReport> {
  totals: { getState: number; files: number };
  byLayer: Record<string, number>;
  files: Record<string, number>;
}

interface Baseline {
  targets?: Partial<Record<RatchetLayer, number>>;
  allowed?: Partial<Record<RatchetLayer, Record<string, number>>>;
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

function baseline(): Baseline {
  return JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Baseline;
}

describe("S6-10 getState boundary", () => {
  it("counts real getState calls by layer and skips test files", () => {
    const result = report();
    expect(result.totals.getState).toBeGreaterThan(0);
    for (const layer of RATCHET_LAYERS) {
      expect(result[layer].scanned).toBeGreaterThan(0);
      expect(result.byLayer[layer]).toBe(result[layer].total);
    }
    // 非空证明扫描器没有退化为 0；test 文件（大量 getState）必须被排除。
    // S6-9d 后 hooks 层已归零，用 store 层（仓库内最大调用面）作扫描器哨兵。
    expect(result.files["src/store/audioStore.ts"]).toBeGreaterThan(0);
    expect(result.files["src/store/audioStore.test.ts"]).toBeUndefined();
  });

  for (const layer of RATCHET_LAYERS) {
    it(`keeps ${layer} within the frozen ratchet`, () => {
      const result = report();
      const frozen = baseline();
      const target = frozen.targets?.[layer] ?? 0;
      const allowed = frozen.allowed?.[layer] ?? {};
      expect(result[layer].total).toBeLessThanOrEqual(target);
      const offenders = Object.entries(result[layer].files).filter(
        ([file, count]) => count > (allowed[file] ?? 0)
      );
      expect(offenders).toEqual([]);
      if (target === 0) expect(result[layer].files).toEqual({});
    });
  }

  it("passes report-getstate --check (same ratchet in CI form)", () => {
    expect(() =>
      execFileSync(process.execPath, [SCRIPT, "--check"], { cwd: ROOT, stdio: "pipe" })
    ).not.toThrow();
  });
});
