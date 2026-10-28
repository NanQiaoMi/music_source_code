import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APPEND = path.join(process.cwd(), "scripts", "perf", "append-history.mjs");
const DASH = path.join(process.cwd(), "scripts", "perf", "perf-dashboard.mjs");
const temps = [];
const write = (dir, rel, data) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2));
};
const report = (over = {}) => ({
  result: {
    generatedAt: "2026-10-29T00:00:00.000Z",
    rootMain: { files: 3, rawKB: 689.3, gzipKB: over.rootMain ?? 211 },
    firstLoad: { scripts: 8, rawKB: 1959.8, gzipKB: over.firstLoad ?? 607.2 },
    css: { files: 1, rawKB: 225.4, gzipKB: over.css ?? 29 },
    asyncChunks: { files: 30, maxFile: "chunk-three.js", maxKB: over.async ?? 683.5 },
    publicMB: over.publicMB ?? 58.4,
  },
});
const entry = (ts, over = {}) => ({
  ts,
  commit: "a7da509",
  rootMainGzipKB: 211,
  firstLoadGzipKB: 607.2,
  cssGzipKB: 29,
  asyncMaxKB: 683.5,
  publicMB: 58.4,
  ...over,
});
const fixture = ({ history } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-history-"));
  temps.push(dir);
  write(dir, "perf/bundle-report.json", report());
  if (history) write(dir, "perf/perf-history.jsonl", history.map((row) => JSON.stringify(row)).join("\n") + "\n");
  return dir;
};
const run = (script, dir, ...args) => spawnSync(process.execPath, [script, "--root", dir, ...args], { encoding: "utf8" });
const lines = (dir) =>
  fs
    .readFileSync(path.join(dir, "perf", "perf-history.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
afterEach(() => temps.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe("perf history", () => {
  it("appends one schema row with optional metrics and validates it", () => {
    const dir = fixture();
    write(dir, "perf/audio-metrics.json", { scenario: "playback-5min", metrics: { fpsP50: 58, dropped: 0 } });
    let result = run(APPEND, dir, "--ts", "2026-10-29T00:00:00.000Z", "--commit", "a7da509", "--metrics", "perf/audio-metrics.json");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const rows = lines(dir);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0])).toEqual({
      ts: "2026-10-29T00:00:00.000Z",
      commit: "a7da509",
      rootMainGzipKB: 211,
      firstLoadGzipKB: 607.2,
      cssGzipKB: 29,
      asyncMaxKB: 683.5,
      publicMB: 58.4,
      metrics: { fpsP50: 58, dropped: 0 },
    });
    result = run(APPEND, dir, "--ts", "2026-10-29T00:00:01.000Z", "--commit", "b33c8ce");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(lines(dir)).toHaveLength(2);
    expect(run(APPEND, dir, "--check").status).toBe(0);
    expect(run(APPEND, dir, "--report", "perf/missing.json", "--ts", "2026-10-29T00:00:02.000Z").status).toBe(2);
    expect(run(APPEND, dir, "--metrics", "perf/nope.json", "--ts", "2026-10-29T00:00:03.000Z").status).toBe(2);
  });

  it("rejects duplicate or backward timestamps", () => {
    const dir = fixture({ history: [entry("2026-10-29T00:00:00.000Z"), entry("2026-10-29T00:00:00.000Z", { commit: "dupe" })] });
    let result = run(APPEND, dir, "--check");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ts must be strictly increasing");

    const appendDir = fixture();
    expect(run(APPEND, appendDir, "--ts", "2026-10-29T00:00:00.000Z", "--commit", "a7da509").status).toBe(0);
    result = run(APPEND, appendDir, "--ts", "2026-10-29T00:00:00.000Z", "--commit", "b33c8ce");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("duplicate ts");
    expect(lines(appendDir)).toHaveLength(1);
    result = run(APPEND, appendDir, "--ts", "2026-10-28T23:59:59.000Z", "--commit", "1f74dd9");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("older than the last entry");
  });

  it("renders three entries with trends, regression highlights and metrics", () => {
    const dir = fixture({
      history: [
        entry("2026-10-29T00:00:00.000Z"),
        entry("2026-10-29T01:00:00.000Z", { commit: "b33c8ce", rootMainGzipKB: 212, firstLoadGzipKB: 608 }),
        entry("2026-10-29T02:00:00.000Z", { commit: "1f74dd9", rootMainGzipKB: 218.2, firstLoadGzipKB: 619.5, metrics: { fpsP50: 57.5, dropped: 0 } }),
      ],
    });
    let result = run(DASH, dir, "--out", "perf/dash.md");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("wrote perf/dash.md");
    const md = fs.readFileSync(path.join(dir, "perf", "dash.md"), "utf8");
    expect(md).toContain("| Time (UTC) | Commit | rootMain gzip | First load gzip | CSS gzip | Max async | public |");
    expect(md.split("\n").filter((line) => line.startsWith("| 2026-10-29"))).toHaveLength(3);
    expect(md).toContain("↑ +6.2");
    expect(md).toContain("↑ +11.5");
    expect(md).toContain("rootMain gzip +6.2 KB (212.0 → 218.2) over +5 KB");
    expect(md).toContain("First load gzip +11.5 KB (608.0 → 619.5) over +10 KB");
    expect(md).toContain("fpsP50: 57.5");
    result = run(DASH, dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("| 2026-10-29 00:00 |");
  });

  it("initializes and renders empty history", () => {
    const dir = fixture();
    let result = run(APPEND, dir, "--init");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(dir, "perf", "perf-history.jsonl"), "utf8")).toBe("");
    expect(run(APPEND, dir, "--check").status).toBe(0);
    result = run(DASH, dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("_No history entries yet._");
    expect(run(DASH, dir, "--out", "perf/empty.md").status).toBe(0);
    expect(fs.readFileSync(path.join(dir, "perf", "empty.md"), "utf8")).toContain("No history entries");
  });
});
