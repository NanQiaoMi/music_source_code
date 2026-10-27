#!/usr/bin/env node
// Bundle budget gate: rootMainFiles / first-load scripts / CSS / async chunks / public size.
// Usage: node scripts/perf/bundle-budget.mjs [--check] [--json <path>]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = process.cwd();
const NEXT = path.join(ROOT, ".next");
const BUDGET_FILE = path.join(ROOT, "perf", "budget.json");
const args = process.argv.slice(2);
const check = args.includes("--check");
const jsonIdx = args.indexOf("--json");
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}
function gzipSize(buf) {
  return zlib.gzipSync(buf, { level: 9 }).length;
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function dirSizeMB(dir) {
  return walk(dir, []).reduce((acc, p) => acc + fs.statSync(p).size, 0) / (1024 * 1024);
}
function relFromUrl(url) {
  let p = url.split("?")[0];
  if (p.startsWith("/_next/")) p = p.slice("/_next/".length);
  else if (p.startsWith("./")) p = p.slice(2);
  else if (p.startsWith("/")) p = p.slice(1);
  return p;
}
function parseHtml(rel) {
  const p = path.join(NEXT, rel);
  if (!fs.existsSync(p)) return null;
  const html = fs.readFileSync(p, "utf8");
  const js = [];
  const css = [];
  const scriptRe = /<script[^>]+src="([^"]+)"/g;
  const linkRe = /<link[^>]+href="([^"]+\.css)"/g;
  let m;
  while ((m = scriptRe.exec(html))) js.push(m[1]);
  while ((m = linkRe.exec(html))) css.push(m[1]);
  return { js: [...new Set(js)], css: [...new Set(css)] };
}
function sumUrlSizes(urls) {
  let raw = 0;
  let gzip = 0;
  let missing = 0;
  for (const url of urls) {
    const rel = relFromUrl(url);
    const p = path.join(NEXT, rel);
    if (!fs.existsSync(p)) {
      missing += 1;
      continue;
    }
    const buf = fs.readFileSync(p);
    raw += buf.length;
    gzip += gzipSize(buf);
  }
  return { raw, gzip, missing };
}

if (!fs.existsSync(path.join(NEXT, "build-manifest.json"))) {
  console.error("[bundle-budget] .next/build-manifest.json not found. Run npm run build first.");
  process.exit(2);
}
if (!fs.existsSync(BUDGET_FILE)) {
  console.error("[bundle-budget] perf/budget.json not found.");
  process.exit(2);
}

const manifest = readJson(path.join(NEXT, "build-manifest.json"));
const budget = readJson(BUDGET_FILE);
const rootFiles = manifest.rootMainFiles || [];

let rootRaw = 0;
let rootGzip = 0;
const missingRoot = [];
for (const rel of rootFiles) {
  const p = path.join(NEXT, rel);
  if (!fs.existsSync(p)) {
    missingRoot.push(rel);
    continue;
  }
  const buf = fs.readFileSync(p);
  rootRaw += buf.length;
  rootGzip += gzipSize(buf);
}

const indexHtml = parseHtml(path.join("server", "app", "index.html"));
const dataManagerHtml = parseHtml(path.join("server", "app", "data-manager.html"));
const first = indexHtml ? sumUrlSizes(indexHtml.js) : null;
const firstCss = indexHtml ? sumUrlSizes(indexHtml.css) : null;

const chunkFiles = walk(path.join(NEXT, "static", "chunks"), []).filter((p) => p.endsWith(".js"));
let maxChunk = { rel: "", raw: 0 };
for (const p of chunkFiles) {
  const size = fs.statSync(p).size;
  if (size > maxChunk.raw) maxChunk = { rel: path.relative(NEXT, p), raw: size };
}

const publicMB = dirSizeMB(path.join(ROOT, "public"));
const result = {
  generatedAt: new Date().toISOString(),
  rootMain: {
    files: rootFiles.length,
    rawKB: kb(rootRaw),
    gzipKB: kb(rootGzip),
    missing: missingRoot,
  },
  firstLoad: first
    ? { scripts: indexHtml.js.length, rawKB: kb(first.raw), gzipKB: kb(first.gzip), missing: first.missing }
    : null,
  css: firstCss ? { files: indexHtml.css.length, rawKB: kb(firstCss.raw), gzipKB: kb(firstCss.gzip) } : null,
  dataManagerFirstLoad: dataManagerHtml
    ? { scripts: dataManagerHtml.js.length, rawKB: kb(sumUrlSizes(dataManagerHtml.js).raw) }
    : null,
  asyncChunks: { files: chunkFiles.length, maxFile: maxChunk.rel, maxKB: kb(maxChunk.raw) },
  publicMB: Math.round(publicMB * 10) / 10,
};

const map = {
  rootMainRawKB: result.rootMain.rawKB,
  rootMainGzipKB: result.rootMain.gzipKB,
  scriptCount: result.rootMain.files,
  firstLoadRawKB: result.firstLoad ? result.firstLoad.rawKB : null,
  firstLoadGzipKB: result.firstLoad ? result.firstLoad.gzipKB : null,
  cssRawKB: result.css ? result.css.rawKB : null,
  maxAsyncChunkKB: result.asyncChunks.maxKB,
  publicMB: result.publicMB,
};

const violations = [];
for (const key of Object.keys(map)) {
  const limits = budget.thresholds[key];
  if (!limits || map[key] === null) continue;
  if (map[key] > limits.hardMax) {
    violations.push({ metric: key, value: map[key], hardMax: limits.hardMax, target: limits.target, baseline: limits.baseline });
  }
}

console.log("== Bundle budget ==");
console.log("rootMain      " + result.rootMain.files + " files  " + result.rootMain.rawKB + " KB raw / " + result.rootMain.gzipKB + " KB gzip  (hard " + budget.thresholds.rootMainRawKB.hardMax + "/" + budget.thresholds.rootMainGzipKB.hardMax + ")");
console.log("first load /  " + (result.firstLoad ? result.firstLoad.scripts + " scripts  " + result.firstLoad.rawKB + " KB raw / " + result.firstLoad.gzipKB + " KB gzip" : "index.html missing"));
console.log("css           " + (result.css ? result.css.rawKB + " KB raw / " + result.css.gzipKB + " KB gzip" : "n/a"));
console.log("async max     " + result.asyncChunks.maxFile + "  " + result.asyncChunks.maxKB + " KB  (" + result.asyncChunks.files + " chunks)");
console.log("public        " + result.publicMB + " MB");
console.log("violations    " + violations.length);
for (const v of violations) {
  console.log("  FAIL " + v.metric + "=" + v.value + " > hardMax " + v.hardMax + " (target " + v.target + ")");
}

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ result, violations }, null, 2) + "\n");
  console.log("[bundle-budget] wrote " + jsonOut);
}
if (check && violations.length > 0) process.exit(1);
