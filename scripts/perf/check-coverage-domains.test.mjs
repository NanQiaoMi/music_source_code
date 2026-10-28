import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "check-coverage-domains.mjs");
const DOMAINS = ["src/lib/audio", "src/utils", "src/store", "src/services", "src/hooks"];
const METRICS = ["statements", "branches", "functions", "lines"];
const temps = [];

afterEach(() => temps.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const block = (pct) => Object.fromEntries(METRICS.map((m) => [m, { total: 100, covered: pct, skipped: 0, pct }]));
const summaryOf = (coverage) => {
  const summary = { total: block(0) };
  for (const [file, pct] of Object.entries(coverage)) summary[file] = block(pct);
  return summary;
};
const write = (dir, rel, data) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2));
};
const fixture = ({ coverage = {}, thresholds = {}, domains = DOMAINS, margin = 5 } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coverage-domains-"));
  temps.push(dir);
  write(dir, "coverage/coverage-summary.json", summaryOf(coverage));
  write(dir, "perf/coverage-domains.json", {
    version: 1,
    burnInMarginPp: margin,
    domains: domains.map((name) => ({
      name,
      thresholds: Object.fromEntries(METRICS.map((m) => [m, thresholds[name] ?? 70])),
    })),
  });
  return dir;
};
const run = (dir, ...args) => spawnSync(process.execPath, [SCRIPT, "--root", dir, ...args], { encoding: "utf8" });
const coverageAt = (pctByDomain, skipped = []) =>
  Object.fromEntries(DOMAINS.filter((name) => !skipped.includes(name)).map((name) => [name + "/a.ts", pctByDomain[name] ?? 80]));

describe("check-coverage-domains gate", () => {
  it("passes when every domain is at or above its floor", () => {
    const result = run(fixture({ coverage: coverageAt({}) }));
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS: 5 domains");
    expect(result.stdout).toContain("src/hooks");
  });

  it("fails with the offending domain and metric", () => {
    const result = run(fixture({ coverage: coverageAt({ "src/hooks": 50 }) }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FAIL: 4 offender(s)");
    expect(result.stderr).toContain("src/hooks: statements 50.00 < floor 70.00");
  });

  it("reports a domain that is missing from the summary", () => {
    const result = run(fixture({ coverage: coverageAt({}, ["src/store"]) }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/store: no files in coverage summary (domain missing)");
  });

  it("exits 2 when the coverage summary has not been generated", () => {
    const dir = fixture({ coverage: coverageAt({}) });
    fs.rmSync(path.join(dir, "coverage"), { recursive: true });
    const result = run(dir);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("npm run test:coverage:domains");
  });

  it("does not fail in --report-only burn-in mode", () => {
    const result = run(fixture({ coverage: coverageAt({ "src/services": 40 }) }), "--report-only");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("report-only");
  });

  it("ratchets floors up and never down on --update", () => {
    const dir = fixture({ coverage: coverageAt({ "src/lib/audio": 72 }), thresholds: { "src/lib/audio": 70 } });
    expect(run(dir, "--update").status).toBe(0);
    const config = JSON.parse(fs.readFileSync(path.join(dir, "perf", "coverage-domains.json"), "utf8"));
    const audio = config.domains.find((domain) => domain.name === "src/lib/audio");
    expect(audio.measured.statements).toBe(72);
    expect(audio.thresholds.statements).toBe(70); // 72 - 5 = 67 would lower the floor
    write(dir, "coverage/coverage-summary.json", summaryOf(coverageAt({ "src/lib/audio": 90 })));
    expect(run(dir, "--update").status).toBe(0);
    const raised = JSON.parse(fs.readFileSync(path.join(dir, "perf", "coverage-domains.json"), "utf8"));
    expect(raised.domains.find((domain) => domain.name === "src/lib/audio").thresholds.statements).toBe(85);
  });
});
