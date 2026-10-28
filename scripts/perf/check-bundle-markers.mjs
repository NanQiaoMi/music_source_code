#!/usr/bin/env node
// S4-3b initial-bundle marker guard: E4-1 (jsmediatags) + E4-6 (@mediapipe/tasks-vision).
// Scans build-manifest.rootMainFiles plus every <script src> of the pre-rendered /
// and /data-manager HTML. Markers are structural identifiers so console.warn copy
// ("jsmediatags") and CDN/wasm URLs ("@mediapipe/tasks-vision") cannot false-positive:
// jsmediatags -> "ID3v2"; mediapipe -> "mediapipe.NormalizedRect".
// Usage: node scripts/perf/check-bundle-markers.mjs [--next .next] [--forbid <name>] [--json out.json]
//        [--skip-if-missing]  (perf:gates: pass without a build instead of exiting 2)
/* eslint-env node */
import fs from "node:fs";
import path from "node:path";

const PAGES = [
  { source: "/", rel: path.join("server", "app", "index.html") },
  { source: "/data-manager", rel: path.join("server", "app", "data-manager.html") },
];
export const MARKERS = [
  { name: "jsmediatags", gate: "E4-1", pattern: "ID3v2" },
  { name: "mediapipe", gate: "E4-6", pattern: "mediapipe.NormalizedRect" },
];

export function toNextRel(url) {
  const clean = url.split(/[?#]/)[0];
  if (/^(?:[a-z]+:)?\/\//i.test(clean) || clean.startsWith("data:")) return null;
  const stripped = clean.startsWith("/_next/") ? clean.slice(7) : clean.replace(/^\.?\//, "");
  return stripped.split("/").join(path.sep);
}

export function parseScriptSrcs(html) {
  const srcs = [];
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const rel = toNextRel(match[1]);
    if (rel && !srcs.includes(rel)) srcs.push(rel);
  }
  return srcs;
}

export function collectInitialFiles(dir) {
  const manifestFile = path.join(dir, "build-manifest.json");
  if (!fs.existsSync(manifestFile)) throw new Error(`no build-manifest.json under ${dir}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const files = new Map();
  const add = (rel, source) => {
    const normalized = rel.split("/").join(path.sep);
    if (!files.has(normalized)) files.set(normalized, []);
    const sources = files.get(normalized);
    if (!sources.includes(source)) sources.push(source);
  };
  for (const rel of manifest.rootMainFiles || []) add(rel, "rootMain");
  for (const page of PAGES) {
    const pageFile = path.join(dir, page.rel);
    if (!fs.existsSync(pageFile)) throw new Error(`${page.rel} not found under ${dir}`);
    for (const rel of parseScriptSrcs(fs.readFileSync(pageFile, "utf8"))) add(rel, page.source);
  }
  const initial = [...files].map(([rel, sources]) => ({ rel, sources }));
  const missing = initial.filter((f) => !fs.existsSync(path.join(dir, f.rel))).map((f) => f.rel);
  return { initial, missing };
}

export function scanInitialFiles(dir, initial, markers = MARKERS) {
  const violations = [];
  for (const file of initial) {
    const abs = path.join(dir, file.rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    for (const marker of markers) {
      const count = text.split(marker.pattern).length - 1;
      if (count > 0) violations.push({ ...marker, file: file.rel, count, sources: file.sources });
    }
  }
  return violations;
}

const args = process.argv.slice(2);
const readArg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const nextDir = readArg("--next") || ".next";
const jsonOut = readArg("--json");
const forbid = readArg("--forbid");
const markers = forbid ? MARKERS.filter((m) => m.name === forbid) : MARKERS;
const skipIfMissing = args.includes("--skip-if-missing");
if (skipIfMissing && !fs.existsSync(path.join(nextDir, "build-manifest.json"))) {
  console.log(`[bundle-markers] skip: no build output under ${nextDir} (run npm run build to enable)`);
  process.exit(0);
}
if (!markers.length) {
  const names = MARKERS.map((m) => m.name).join(", ");
  console.error(`[bundle-markers] unknown --forbid "${forbid}" (expected: ${names})`);
  process.exit(2);
}

let collected;
try {
  collected = collectInitialFiles(nextDir);
} catch (error) {
  console.error(`[bundle-markers] ${error.message}; run npm run build first`);
  process.exit(2);
}
const { initial, missing } = collected;
const violations = scanInitialFiles(nextDir, initial, markers);
const pages = PAGES.map((p) => p.source).join(" + ");
console.log(`[bundle-markers] ${nextDir}: ${initial.length} files from rootMainFiles + ${pages}`);
for (const marker of markers) {
  const hits = violations.filter((v) => v.name === marker.name);
  const total = hits.reduce((sum, v) => sum + v.count, 0);
  const status = hits.length ? "FAIL" : "ok  ";
  console.log(`  ${status} ${marker.gate} ${marker.name} [${marker.pattern}] hits=${total}`);
  for (const hit of hits) {
    console.log(`       ${hit.file} hits=${hit.count} sources=${hit.sources.join(",")}`);
  }
}
for (const rel of missing) console.log(`  missing ${rel} (listed but absent under ${nextDir})`);
const ok = !violations.length && !missing.length;
if (jsonOut) {
  const report = { ok, nextDir, initialFiles: initial, violations, missing };
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n");
  console.log(`[bundle-markers] wrote ${jsonOut}`);
}
console.log(ok ? "[bundle-markers] PASS - no initial-bundle markers" : "[bundle-markers] FAIL");
process.exit(violations.length ? 1 : missing.length ? 2 : 0);
