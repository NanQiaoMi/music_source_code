import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "perf", "bundle-diff.mjs");
const temps = [];
const write = (dir, rel, data) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2));
};
const report = (rootMainGzip, firstLoadGzip) => ({
  result: {
    generatedAt: "2026-10-29T00:00:00.000Z",
    rootMain: { files: 3, rawKB: 689.3, gzipKB: rootMainGzip, missing: [] },
    firstLoad: { scripts: 8, rawKB: 1959.8, gzipKB: firstLoadGzip, missing: 0 },
    css: { files: 1, rawKB: 225.4, gzipKB: 29 },
  },
});
const fixture = ({ baseline = report(211, 607.2), current = report(211, 607.2) } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-diff-"));
  temps.push(dir);
  if (baseline) write(dir, "perf/bundle-baseline.json", { version: 1, result: baseline.result });
  if (current) write(dir, "perf/bundle-report.json", current);
  return dir;
};
const run = (dir, ...args) => spawnSync(process.execPath, [SCRIPT, "--root", dir, ...args], { encoding: "utf8" });
afterEach(() => temps.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe("bundle-diff", () => {
  it("passes within thresholds and writes markdown/json artifacts", () => {
    const dir = fixture();
    const result = run(dir, "--json", "out/diff.json", "--md", "out/diff.md");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("| rootMain gzip | 211 KB | 211 KB | +0 KB | +5 KB | PASS |");
    expect(result.stdout).toContain("[bundle-diff] PASS");
    const json = JSON.parse(fs.readFileSync(path.join(dir, "out", "diff.json"), "utf8"));
    expect(json.failures).toEqual([]);
    expect(json.rows.find((row) => row.metric === "first-load gzip").limit).toBe(10);
    expect(fs.readFileSync(path.join(dir, "out", "diff.md"), "utf8")).toContain("| Metric | Baseline |");
  });

  it("fails when rootMain gzip grows past +5KB and first-load past +10KB", () => {
    let result = run(fixture({ current: report(216.5, 607.2) }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FAIL rootMain gzip: +5.5 KB > +5 KB");
    result = run(fixture({ current: report(211, 618) }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FAIL first-load gzip: +10.8 KB > +10 KB");
    expect(run(fixture({ current: report(216.5, 617.2) }), "--max-root-gzip", "10", "--max-first-load-gzip", "10").status).toBe(0);
  });

  it("exits 2 when the baseline or current report is missing", () => {
    const noBaseline = fixture({ baseline: null });
    let result = run(noBaseline);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("baseline not found");
    expect(fs.existsSync(path.join(noBaseline, "perf", "bundle-baseline.json"))).toBe(false);
    result = run(fixture({ current: null }));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("report not found");
  });

  it("rebaselines only on explicit --update and ratchets the new baseline", () => {
    const dir = fixture();
    expect(run(dir, "--update").status).toBe(0);
    let baseline = JSON.parse(fs.readFileSync(path.join(dir, "perf", "bundle-baseline.json"), "utf8"));
    expect(baseline.result.rootMain.gzipKB).toBe(211);
    expect(baseline.updatedAt).toBeTruthy();
    write(dir, "perf/bundle-report.json", report(220, 607.2));
    expect(run(dir).status).toBe(1);
    expect(run(dir, "--update").status).toBe(0);
    baseline = JSON.parse(fs.readFileSync(path.join(dir, "perf", "bundle-baseline.json"), "utf8"));
    expect(baseline.result.rootMain.gzipKB).toBe(220);
    expect(run(dir).status).toBe(0);
  });
});
