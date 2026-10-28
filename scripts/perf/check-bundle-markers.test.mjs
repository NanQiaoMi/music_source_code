/* eslint-env node */
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "perf", "check-bundle-markers.mjs");
const REAL_NEXT = path.join(process.cwd(), ".next");
const HAS_BUILD = fs.existsSync(path.join(REAL_NEXT, "build-manifest.json"));
const temps = [];
const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });

afterEach(() => temps.splice(0).forEach(cleanup));

const js = (name) => `/_next/static/chunks/${name}.js`;
const html = (...srcs) => srcs.map((src) => `<script src="${src}"></script>`).join("");
const EXTERNAL_CDN = "https://cdn.example.com/mediapipe.NormalizedRect.js";

function fixture({ root = "", page = "", dataManager = "" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-markers-"));
  temps.push(dir);
  const write = (rel, text) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  write("build-manifest.json", JSON.stringify({ rootMainFiles: ["static/chunks/root.js"] }));
  write("server/app/index.html", html(js("root"), js("page"), EXTERNAL_CDN, js("root")));
  write("server/app/data-manager.html", html(js("data-manager"), js("page")));
  write("static/chunks/root.js", root);
  write("static/chunks/page.js", page);
  write("static/chunks/data-manager.js", dataManager);
  return dir;
}

function run(dir, ...extra) {
  return spawnSync(process.execPath, [SCRIPT, "--next", dir, ...extra], { encoding: "utf8" });
}

describe("check-bundle-markers guard", () => {
  it("passes warn copy / CDN URLs, dedupes and ignores external scripts", () => {
    const dir = fixture({
      root: 'console.warn("[audioMetadata] jsmediatags 加载失败")',
      page: 'load("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/x.wasm")',
    });
    const json = path.join(dir, "report.json");
    const result = run(dir, "--json", json);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(fs.readFileSync(json, "utf8"));
    expect(report.violations).toEqual([]);
    expect(report.initialFiles).toHaveLength(3);
    expect(report.initialFiles[0].sources).toEqual(["rootMain", "/"]);
  });

  it("fails and pinpoints the offending initial file", () => {
    const dir = fixture({ dataManager: 'addProtoToStream(x, "mediapipe.NormalizedRect", y)' });
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(path.join("static", "chunks", "data-manager.js"));
  });

  it("--forbid restricts the gate to one library", () => {
    const dir = fixture({ root: 'new Error("Could not read ID3v2 major version.")' });
    expect(run(dir).status).toBe(1);
    expect(run(dir, "--forbid", "jsmediatags").status).toBe(1);
    const mediapipeOnly = run(dir, "--forbid", "mediapipe");
    expect(mediapipeOnly.status, mediapipeOnly.stdout).toBe(0);
  });

  it("--skip-if-missing skips a missing build instead of failing", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-markers-"));
    temps.push(empty);
    const result = run(empty, "--skip-if-missing");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("skip");
  });

  it("rejects unknown --forbid and missing build output", () => {
    expect(run(fixture(), "--forbid", "three").status).toBe(2);
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-markers-"));
    temps.push(empty);
    const result = run(empty);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("build-manifest.json");
  });

  it.skipIf(!HAS_BUILD)("passes against the current .next build", () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
