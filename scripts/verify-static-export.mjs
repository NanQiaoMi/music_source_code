#!/usr/bin/env node
// Verify that out/ is a fresh Next static export (S0-3).
// Usage: node scripts/verify-static-export.mjs [--max-age-minutes N]
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const args = process.argv.slice(2);
const idx = args.indexOf("--max-age-minutes");
const maxAgeMin = idx >= 0 ? Number(args[idx + 1]) : null;

function fail(message) {
  console.error("[verify-static-export] FAIL: " + message);
  process.exit(1);
}

const indexHtml = path.join(OUT, "index.html");
const dataManager = path.join(OUT, "data-manager.html");
if (!fs.existsSync(indexHtml)) fail("out/index.html not found; run node scripts/build-static.mjs first");
if (!fs.existsSync(dataManager)) fail("out/data-manager.html not found; static export is incomplete");

const indexTime = fs.statSync(indexHtml).mtimeMs;
if (maxAgeMin !== null) {
  const ageMin = (Date.now() - indexTime) / 60000;
  if (ageMin > maxAgeMin) fail("out/index.html is " + Math.round(ageMin) + "min old (> " + maxAgeMin + ")");
}

function newestMtime(dir) {
  let newest = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  }
  return newest;
}

const srcNewest = newestMtime(path.join(ROOT, "src"));
const configNewest = Math.max(
  fs.statSync(path.join(ROOT, "next.config.js")).mtimeMs,
  fs.statSync(path.join(ROOT, "package.json")).mtimeMs
);
const inputNewest = Math.max(srcNewest, configNewest);
if (indexTime < inputNewest) {
  const outAge = ((Date.now() - indexTime) / 60000).toFixed(1);
  fail(
    "out/ is older than source/config (out built " + outAge + "min ago). " +
    "Desktop packaging would ship stale frontend; rebuild with node scripts/build-static.mjs"
  );
}

console.log("[verify-static-export] OK");
console.log("  out/index.html: " + new Date(indexTime).toISOString());
console.log("  newest input:   " + new Date(inputNewest).toISOString());
