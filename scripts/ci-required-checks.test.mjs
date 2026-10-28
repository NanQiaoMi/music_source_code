/* eslint-env node */
// S8-1b: the serial CI verify job is split into parallel quality / coverage / build jobs
// plus a single `quality-gate` aggregate. This asserts the split, that every required gate
// step runs in exactly one job, and that docs/nbl/CI.md records the 12min budget and checks.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const workflow = read(".github/workflows/deploy.yml");
const doc = read("docs/nbl/CI.md");

const GATE_JOBS = ["quality", "coverage", "build"];
const REQUIRED_RUNS = [
  "npx tsc --noEmit --incremental false --pretty false",
  "npx eslint src --ext ts,tsx --rulesdir eslint-rules --max-warnings=0 --report-unused-disable-directives",
  "npm run verify:layers",
  "npm run test -- --run",
  "npm run test:coverage:domains",
  "npm run build",
  "npm run perf:gates",
  "node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json",
  "node scripts/check-docs-facts.mjs",
];

// Zero-dependency job splitter: jobs are the two-space keys directly under `jobs:`.
const jobs = (() => {
  const lines = workflow.split(/\r?\n/);
  const start = lines.indexOf("jobs:");
  if (start < 0) throw new Error("deploy.yml has no jobs: section");
  const blocks = new Map();
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (line !== "" && !/^[\s#]/.test(line)) break; // next top-level key
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) {
      current = header[1];
      blocks.set(current, []);
    } else if (current !== null) {
      blocks.get(current).push(line);
    }
  }
  return blocks;
})();

const jobText = (name) => {
  const lines = jobs.get(name);
  expect(lines, "missing job " + name).toBeDefined();
  return lines.join("\n");
};

const runsIn = (name) =>
  jobText(name)
    .split(/\r?\n/)
    .map((line) => /^\s*run: (.*)$/.exec(line))
    .filter(Boolean)
    .map((match) => match[1].trim());

const jobOfRun = (command) => [...jobs.keys()].filter((name) => runsIn(name).includes(command));

describe("CI required checks (parallel verify)", () => {
  it("splits the verify chain into at least three independent gate jobs", () => {
    expect(jobs.size).toBeGreaterThanOrEqual(3);
    for (const name of GATE_JOBS) {
      expect(jobs.has(name), "missing gate job " + name).toBe(true);
      expect(jobText(name), name + " must run in parallel (no needs:)").not.toMatch(/^\s*needs:/m);
    }
  });

  it("runs every required gate step in exactly one job", () => {
    for (const command of REQUIRED_RUNS) {
      expect(jobOfRun(command), command).toHaveLength(1);
    }
  });

  it("keeps coverage in its own job, separate from quality", () => {
    expect(runsIn("coverage")).toContain("npm run test:coverage:domains");
    expect(runsIn("coverage")).not.toContain("npm run test -- --run");
    expect(runsIn("quality")).toContain("npm run test -- --run");
    expect(runsIn("quality")).not.toContain("npm run test:coverage:domains");
    expect(jobOfRun("npm run test:coverage:domains")).toEqual(["coverage"]);
  });

  it("gives the build gate job the production build and the gates that need .next", () => {
    const build = jobText("build");
    for (const command of [
      "npm run build",
      "npm run perf:gates",
      "node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json",
      "node scripts/check-docs-facts.mjs",
    ]) {
      expect(runsIn("build"), "build job must run " + command).toContain(command);
    }
    expect(build.indexOf("run: npm run build")).toBeLessThan(
      build.indexOf("run: npm run perf:gates")
    );
    expect(build).toContain("Cache Next build cache");
    expect(jobOfRun("npm run perf:gates")).toEqual(["build"]);
  });

  it("bounds every gate job with timeout-minutes: 15", () => {
    for (const name of GATE_JOBS) {
      expect(jobText(name), name + " timeout").toMatch(/timeout-minutes:\s*15\b/);
    }
    for (const [name, lines] of jobs) {
      expect(lines.join("\n"), name + " needs timeout-minutes").toMatch(/timeout-minutes:\s*\d+/);
    }
  });

  it("aggregates the three jobs into one required check and gates release jobs on it", () => {
    const gate = jobText("quality-gate");
    expect(gate).toContain("if: always()");
    expect(gate).toMatch(/needs:\s*\[quality, coverage, build\]/);
    for (const name of GATE_JOBS) {
      expect(gate, "quality-gate must assert " + name).toContain("needs." + name + ".result");
    }
    expect(gate).toContain("GITHUB_STEP_SUMMARY");
    expect(jobText("desktop-windows")).toMatch(/needs: quality-gate/);
    expect(jobText("deploy-to-vercel")).toMatch(/needs: quality-gate/);
  });

  it("documents the job layout, durations, budget and required checks in docs/nbl/CI.md", () => {
    const docLines = doc.split(/\r?\n/);
    for (const name of [...GATE_JOBS, "quality-gate"]) {
      expect(
        docLines.some((line) => line.startsWith("| `" + name + "`")),
        "CI.md must table job " + name
      ).toBe(true);
    }
    for (const token of [
      "tsc --noEmit",
      "eslint src",
      "verify:layers",
      "npm run test",
      "test:coverage:domains",
      "npm run build",
      "perf:gates",
      "check-docs-facts",
      "timeout-minutes",
      "coverage domains",
      "required",
    ]) {
      expect(doc, "CI.md must mention " + token).toContain(token);
    }
    expect(doc).toMatch(/12\s*min/i);
    expect(doc).toContain("wall");
  });

  it("keeps the known-stale store-stats --check disabled and documents why", () => {
    const activeChecks = workflow
      .split(/\r?\n/)
      .filter((line) => /^\s*run:/.test(line) && /report-store-stats(?:\.mjs)? --check/.test(line));
    expect(activeChecks).toEqual([]);
    expect(workflow).toContain("perf/store-stats-baseline.json is");
    expect(workflow).toContain("stale");
    expect(doc).toContain("store-stats");
    expect(doc).toContain("--check");
    expect(doc).toContain("禁用");
  });

  it("links the gate doc from the PR process", () => {
    expect(read("docs/nbl/PROCESS.md")).toContain("CI.md");
  });
});
