#!/usr/bin/env node
// Verify that out/ is a fresh Next static export (S0-3).
// Usage: node scripts/verify-static-export.mjs [--max-age-minutes N]
// Exit codes: 0 = fresh; 2 = missing/incomplete out; 3 = stale out; 1 = unexpected error.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Pure freshness evaluation so it can be unit-tested without the filesystem.
 * @param {{
 *   outIndexMtimeMs?: number|null,
 *   dataManagerExists?: boolean,
 *   sourceNewestMs?: number,
 *   configNewestMs?: number,
 *   nowMs?: number,
 *   maxAgeMin?: number|null,
 * }} input
 * @returns {{ ok: boolean, code: number, reason: string, inputNewestMs?: number }}
 */
export function evaluateOutFreshness({
  outIndexMtimeMs = null,
  dataManagerExists = false,
  sourceNewestMs = 0,
  configNewestMs = 0,
  nowMs = Date.now(),
  maxAgeMin = null,
} = {}) {
  if (outIndexMtimeMs === null || outIndexMtimeMs === undefined) {
    return {
      ok: false,
      code: 2,
      reason: "out/index.html not found; run node scripts/build-static.mjs first",
    };
  }
  if (!dataManagerExists) {
    return {
      ok: false,
      code: 2,
      reason: "out/data-manager.html not found; static export is incomplete",
    };
  }
  if (maxAgeMin !== null && Number.isFinite(maxAgeMin)) {
    const ageMin = (nowMs - outIndexMtimeMs) / 60000;
    if (ageMin > maxAgeMin) {
      return {
        ok: false,
        code: 3,
        reason: "out/index.html is " + Math.round(ageMin) + "min old (> " + maxAgeMin + ")",
      };
    }
  }
  const inputNewestMs = Math.max(Number(sourceNewestMs) || 0, Number(configNewestMs) || 0);
  if (outIndexMtimeMs < inputNewestMs) {
    const outAgeMin = ((nowMs - outIndexMtimeMs) / 60000).toFixed(1);
    return {
      ok: false,
      code: 3,
      reason:
        "out/ is older than source/config (out built " + outAgeMin + "min ago). " +
        "Desktop packaging would ship stale frontend; rebuild with node scripts/build-static.mjs",
      inputNewestMs,
    };
  }
  return { ok: true, code: 0, reason: "fresh", inputNewestMs };
}

function newestMtime(dir) {
  let newest = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(candidate);
      else newest = Math.max(newest, fs.statSync(candidate).mtimeMs);
    }
  }
  return newest;
}

function safeMtime(filePath) {
  return fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
}

function main() {
  const root = process.cwd();
  const out = path.join(root, "out");
  const args = process.argv.slice(2);
  const idx = args.indexOf("--max-age-minutes");
  const maxAgeMin = idx >= 0 ? Number(args[idx + 1]) : null;

  const indexHtml = path.join(out, "index.html");
  const dataManager = path.join(out, "data-manager.html");
  const srcDir = path.join(root, "src");
  const configNewestMs = Math.max(
    safeMtime(path.join(root, "next.config.js")),
    safeMtime(path.join(root, "package.json"))
  );

  const result = evaluateOutFreshness({
    outIndexMtimeMs: fs.existsSync(indexHtml) ? fs.statSync(indexHtml).mtimeMs : null,
    dataManagerExists: fs.existsSync(dataManager),
    sourceNewestMs: fs.existsSync(srcDir) ? newestMtime(srcDir) : 0,
    configNewestMs,
    nowMs: Date.now(),
    maxAgeMin,
  });

  if (!result.ok) {
    console.error("[verify-static-export] FAIL: " + result.reason);
    process.exit(result.code || 1);
  }

  const indexTime = fs.statSync(indexHtml).mtimeMs;
  console.log("[verify-static-export] OK");
  console.log("  out/index.html: " + new Date(indexTime).toISOString());
  console.log("  newest input:   " + new Date(result.inputNewestMs || 0).toISOString());
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main();
}
