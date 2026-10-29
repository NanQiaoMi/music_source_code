import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  PERF_BASELINES,
  REQUIRED_ENV_KEYS,
  formatTable,
  parseArgs,
  runPreflight,
} from "./preflight.mjs";

const PREFLIGHT = path.join(path.dirname(fileURLToPath(import.meta.url)), "preflight.mjs");
const IDS = "version,changelog,git-clean,build-id,build-output,perf-baselines,env-files,docs-facts";
const roots = [];

function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-fixture-"));
  roots.push(root);
  const files = {
    "package.json": JSON.stringify({ name: "fixture", version: "1.2.3" }),
    "README.md": "# Fixture V1.2.3\n",
    "docs/nbl/CHANGELOG.md": "## v1.2.3 - 2026-10-01\n\n- fixture\n",
    "docs/nbl/RELEASE-CHECKLIST.md": "# Release\n",
    "docs/nbl/CI.md": "# CI\n",
    "package-lock.json": "{}\n",
    "next.config.js": "module.exports = {};\n",
    ".env.example": REQUIRED_ENV_KEYS.map((key) => key + "=\n").join(""),
    ".next/BUILD_ID": "fixture-build\n",
    "scripts/check-docs-facts.mjs": "process.exit(0);\n",
    ...Object.fromEntries(PERF_BASELINES.map((rel) => [rel, "{}\n"])),
    ...overrides,
  };
  for (const [rel, value] of Object.entries(files)) {
    const file = path.join(root, rel);
    if (value === null) fs.rmSync(file, { recursive: true, force: true });
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, value);
    }
  }
  return root;
}

const fakeSpawn =
  ({ gitStatus = 0, gitOut = "", docsStatus = 0 } = {}) =>
  (command) =>
    command === "git"
      ? { status: gitStatus, stdout: gitOut, stderr: "" }
      : {
          status: docsStatus,
          stdout: docsStatus ? "" : "ok",
          stderr: docsStatus ? "docs fail" : "",
        };

afterEach(() => {
  while (roots.length) fs.rmSync(roots.pop(), { recursive: true, force: true });
});

describe("release preflight", () => {
  it("passes a consistent fixture and reports every check", () => {
    const result = runPreflight({ root: fixture(), tag: "v1.2.3", spawn: fakeSpawn() });
    expect(result.ok).toBe(true);
    expect(result.rows.map((row) => row.id)).toEqual(IDS.split(","));
    expect(result.rows.every((row) => row.status === "PASS")).toBe(true);
    expect(formatTable(result.rows)).toContain("| version");
  });

  it("collects version, changelog, git, artifact, baseline, env and docs failures", () => {
    const root = fixture({
      "package.json": JSON.stringify({ version: "2.0.0" }),
      "README.md": "# Fixture V2.0.0\n",
      "docs/nbl/CHANGELOG.md": "## v9.9.9 - 2026-10-01\n",
      ".next/BUILD_ID": null,
      "perf/bundle-baseline.json": null,
      ".env.example": REQUIRED_ENV_KEYS.filter((key) => key !== "NEXT_PUBLIC_APP_URL")
        .map((key) => key + "=\n")
        .join(""),
    });
    const result = runPreflight({
      root,
      tag: "v1.2.3",
      spawn: fakeSpawn({ gitOut: " M src/a.ts\n?? x", docsStatus: 1 }),
    });
    expect(result.ok).toBe(false);
    const failed = result.rows.filter((row) => row.status === "FAIL").map((row) => row.id);
    expect(failed).toEqual(
      expect.arrayContaining(
        "version,changelog,git-clean,build-id,perf-baselines,env-files,docs-facts".split(",")
      )
    );
    expect(result.summary.failed).toBe(failed.length);
  });

  it("downgrades a dirty tree to WARN with --allow-dirty", () => {
    const result = runPreflight({
      root: fixture(),
      tag: "v1.2.3",
      allowDirty: true,
      spawn: fakeSpawn({ gitOut: " M src/a.ts" }),
    });
    expect(result.ok).toBe(true);
    expect(result.rows.find((row) => row.id === "git-clean")).toMatchObject({ status: "WARN" });
  });

  it("skips build artifacts with --skip-build", () => {
    const result = runPreflight({
      root: fixture({ ".next/BUILD_ID": null }),
      tag: "v1.2.3",
      skipBuild: true,
      spawn: fakeSpawn(),
    });
    expect(result.ok).toBe(true);
    expect(
      result.rows.filter((row) => row.id.startsWith("build-")).map((row) => row.status)
    ).toEqual(["SKIP", "SKIP"]);
  });

  it("prints JSON via the CLI and exits 1 on failures", () => {
    const run = (root, args) =>
      spawnSync(process.execPath, [PREFLIGHT, ...args], { cwd: root, encoding: "utf8" });
    const okRun = run(fixture(), ["--json", "--tag", "v1.2.3"]);
    expect(okRun.status, okRun.stderr).toBe(0);
    expect(JSON.parse(okRun.stdout)).toMatchObject({ ok: true, version: "1.2.3", tag: "v1.2.3" });
    const badRun = run(fixture({ "package.json": JSON.stringify({ version: "2.0.0" }) }), [
      "--tag",
      "v1.2.3",
    ]);
    expect(badRun.status).toBe(1);
    expect(badRun.stdout).toContain("RESULT: FAIL");
  });

  it("rejects unknown options and missing tag values", () => {
    expect(() => parseArgs(["--nope"])).toThrow("unknown option");
    expect(() => parseArgs(["--tag"])).toThrow("missing value");
  });
});
