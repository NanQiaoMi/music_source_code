/* eslint-env node */
// S8-1a: full CI gate wiring — coverage domains step after unit tests, plus the
// required-check list that PR authors are held to (docs/nbl/CI.md).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const workflow = read(".github/workflows/deploy.yml");
const doc = read("docs/nbl/CI.md");

const verifyJob = () => {
  const start = workflow.indexOf("\n  verify:");
  const end = workflow.indexOf("\n  desktop-windows:");
  expect(start, "missing verify job").toBeGreaterThanOrEqual(0);
  expect(end, "missing desktop-windows job").toBeGreaterThan(start);
  return { start, text: workflow.slice(start, end) };
};

describe("CI required checks", () => {
  it("runs the coverage domain gate after the unit tests, before the build", () => {
    const { start } = verifyJob();
    const unit = workflow.indexOf("run: npm run test -- --run", start);
    const coverage = workflow.indexOf("run: npm run test:coverage:domains", start);
    const build = workflow.indexOf("run: npm run build", start);
    expect(unit, "missing unit-test step").toBeGreaterThanOrEqual(0);
    expect(coverage, "missing coverage step").toBeGreaterThanOrEqual(0);
    expect(coverage).toBeGreaterThan(unit);
    expect(build).toBeGreaterThan(coverage);
  });

  it("keeps both runs: coverage does not replace the plain unit-test step", () => {
    const { text } = verifyJob();
    expect(text).toContain("name: Unit tests");
    expect(text).toContain("name: Coverage domains");
  });

  it("bounds the verify job with timeout-minutes and emits a job summary", () => {
    const { text } = verifyJob();
    expect(text).toMatch(/timeout-minutes:\s*\d+/);
    expect(text).toContain("GITHUB_STEP_SUMMARY");
  });

  it("documents every required check in docs/nbl/CI.md", () => {
    const tokens = [
      "tsc --noEmit",
      "eslint src",
      "npm run test",
      "test:coverage:domains",
      "npm run build",
      "perf:gates",
      "check-docs-facts",
      "timeout-minutes",
    ];
    for (const token of tokens) {
      expect(doc, "CI.md must mention " + token).toContain(token);
    }
    expect(doc).toContain("coverage domains");
  });

  it("records the blocked store-stats --check", () => {
    expect(doc).toContain("store-stats");
    expect(doc).toContain("--check");
    expect(doc).toContain("禁用");
  });

  it("links the gate doc from the PR process", () => {
    expect(read("docs/nbl/PROCESS.md")).toContain("CI.md");
  });
});
