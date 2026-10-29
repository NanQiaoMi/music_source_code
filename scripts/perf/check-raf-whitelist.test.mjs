/* eslint-env node */
// S5-2d / E5-1: valid/invalid fixtures plus the live repository for the rAF whitelist audit.
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "check-raf-whitelist.mjs");
const temps = [];

afterEach(() => temps.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "raf-whitelist-"));
  temps.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

const source = (...lines) => lines.join("\n") + "\n";
const whitelist = (entries) => JSON.stringify({ version: 1, entries }, null, 2);
const entry = (overrides = {}) => ({ file: "src/a.ts", line: 1, category: "other", reason: "test reason", ...overrides });

function run(args, options = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", ...options });
}

describe("check-raf-whitelist", () => {
  it("passes the live repository with every call site whitelisted", () => {
    const result = run([]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS");
    expect(result.stdout).toContain("usages=14");
    expect(result.stdout).toContain("player3d-pending=4");
  });

  it("accepts a whitelisted call and ignores test files", () => {
    const dir = fixture({
      "src/a.ts": source("export const go = (fn: FrameRequestCallback) => {", "  requestAnimationFrame(fn);", "};"),
      "src/a.test.ts": source("requestAnimationFrame(() => undefined);"),
      "perf/rAF-whitelist.json": whitelist([entry({ line: 2 })]),
    });
    const result = run(["--root", dir]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("usages=1");
    expect(result.stdout).toContain("PASS");
  });

  it("fails on an unlisted call site and names the line", () => {
    const dir = fixture({
      "src/a.ts": source("const tick = () => requestAnimationFrame(tick);"),
      "perf/rAF-whitelist.json": whitelist([]),
    });
    const result = run(["--root", dir]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("unlisted src/a.ts:1");
    expect(result.stdout).toContain("FAIL");
  });

  it("fails when a whitelisted line moved or was deleted", () => {
    const dir = fixture({
      "src/a.ts": source("// header", "const tick = () => requestAnimationFrame(tick);"),
      "perf/rAF-whitelist.json": whitelist([entry({ line: 1 })]),
    });
    const result = run(["--root", dir]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no longer matches");
  });

  it("fails on unknown categories, missing reasons and duplicates", () => {
    const bad = fixture({
      "src/a.ts": source("const tick = () => requestAnimationFrame(tick);"),
      "perf/rAF-whitelist.json": whitelist([
        entry({ category: "made-up" }),
        entry({ file: "src/a.test.ts" }),
        entry({ reason: "" }),
        entry(),
        entry(),
      ]),
    });
    const result = run(["--root", bad]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('unknown category "made-up"');
    expect(result.stdout).toContain("needs a reason");
    expect(result.stdout).toContain("out of scope");
    expect(result.stdout).toContain("duplicate entry");
  });

  it("supports ownership entries validated by an explicit match string", () => {
    const dir = fixture({
      "src/runtime/runtime.ts": source("export const pick = (env: Env) => env.scheduler ?? rafScheduler;"),
      "perf/rAF-whitelist.json": whitelist([
        entry({ file: "src/runtime/runtime.ts", line: 1, category: "visualRuntime", match: "rafScheduler" }),
      ]),
    });
    const result = run(["--root", dir]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("visualRuntime=1");
  });

  it("exits 2 for a missing whitelist or unknown option", () => {
    const noWhitelist = fixture({ "src/a.ts": source("const tick = () => requestAnimationFrame(tick);") });
    expect(run(["--root", noWhitelist]).status).toBe(2);
    expect(run(["--nope"]).status).toBe(2);
    expect(run(["--root"]).status).toBe(2);
  });
});
