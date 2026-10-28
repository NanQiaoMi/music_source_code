import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPlan, formatTable, parseArgs, runCheck, summarize } from "./release-dry-run.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(DIR, "release-dry-run.mjs");
const ROOT = path.resolve(DIR, "..");
const buildRow = (plan) => plan.find((check) => check.id === "build");
const runCli = (...args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000 });

describe("release-dry-run plan", () => {
  it("defaults to the safe subset and reports build as skipped", () => {
    const plan = buildPlan();
    expect(plan.map((check) => check.id)).toEqual(["tsc", "docs-facts", "build", "perf-gates"]);
    expect(buildRow(plan).skip).toContain("safe subset");
  });

  it("includes build with --build but lets --skip-build win", () => {
    expect(buildRow(buildPlan({ build: true })).skip).toBeUndefined();
    expect(buildRow(buildPlan({ build: true, skipBuild: true })).skip).toContain("--skip-build");
  });

  it("turns a non-zero command into a failed row and table entry", () => {
    const spawn = () => ({ status: 1, stdout: "", stderr: "boom" });
    const row = runCheck({ id: "fixture", command: "x", args: [] }, spawn);
    expect(row).toMatchObject({ status: "FAIL", exitCode: 1 });
    expect(summarize([row]).ok).toBe(false);
    expect(formatTable([row])).toContain("| fixture | FAIL");
  });

  it("rejects unknown flags", () => {
    expect(() => parseArgs(["--nope"])).toThrow("unknown option");
  });
});

describe("release-dry-run CLI (check-only fixture)", () => {
  it("prints a JSON plan without running commands", () => {
    const result = runCli("--check-only", "--json");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({ ok: true, checkOnly: true, buildIncluded: false });
    expect(payload.summary).toMatchObject({ passed: 0, failed: 0, skipped: 1, planned: 3 });
    expect(payload.checks.map((check) => check.id).join(",")).toBe(
      "tsc,docs-facts,build,perf-gates"
    );
    expect(payload.checks.find((check) => check.id === "build").status).toBe("SKIP");
  });

  it("plans build when --build is passed", () => {
    const payload = JSON.parse(runCli("--check-only", "--json", "--build").stdout);
    expect(payload.buildIncluded).toBe(true);
    expect(payload.checks.find((check) => check.id === "build").status).toBe("PLAN");
    expect(payload.summary).toMatchObject({ skipped: 0, planned: 4 });
  });

  it("reports a forced skip for --build --skip-build", () => {
    const payload = JSON.parse(runCli("--check-only", "--json", "--build", "--skip-build").stdout);
    expect(payload.buildIncluded).toBe(false);
    expect(payload.checks.find((check) => check.id === "build").skippedReason).toContain(
      "--skip-build"
    );
  });

  it("prints a human PASS/PLAN table and exits 0", () => {
    const result = runCli("--check-only");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("== release dry run (S8-5) ==");
    expect(result.stdout).toContain("| RESULT");
    expect(result.stdout).toContain("| build      | SKIP");
    expect(result.stdout).toContain("RESULT: PASS - 0 passed, 0 failed, 1 skipped, 3 planned");
  });

  it("exits 2 on unknown options", () => {
    const result = runCli("--nope");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unknown option: --nope");
  });
});
