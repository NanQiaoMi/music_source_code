/* eslint-env node */
// S6-12b: assert the perf gates are wired into CI after the production build.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "deploy.yml"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const indexOf = (text, needle, from = 0) => {
  const i = text.indexOf(needle, from);
  expect(i, `missing: ${needle}`).toBeGreaterThanOrEqual(0);
  return i;
};

describe("CI perf gates wiring", () => {
  it("runs npm run perf:gates after the production build in the build job", () => {
    const jobStart = indexOf(workflow, "\n  build:");
    const nextJob = indexOf(workflow, "\n  quality-gate:");
    const build = indexOf(workflow, "run: npm run build", jobStart);
    const gates = indexOf(workflow, "run: npm run perf:gates", jobStart);
    expect(gates).toBeGreaterThan(build);
    expect(gates).toBeLessThan(nextJob);
  });

  it("keeps the known-stale store-stats --check disabled and documents why", () => {
    const activeChecks = workflow
      .split(/\r?\n/)
      .filter((line) => /^\s*run:/.test(line) && /report-store-stats(?:\.mjs)? --check/.test(line));
    expect(activeChecks).toEqual([]);
    expect(workflow).toContain("perf/store-stats-baseline.json is");
    expect(workflow).toContain("stale");
  });

  it("chains the four passing gates in order, skipping bundle markers without a build", () => {
    const script = pkg.scripts["perf:gates"];
    const order = [
      "scripts/check-store-budgets.mjs",
      "report-store-stats.mjs --max-whole 10",
      "check-bundle-markers.mjs",
      "npm run verify:raf",
    ];
    const positions = order.map((needle) => script.indexOf(needle));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(script).toContain("--skip-if-missing");
  });
});
