#!/usr/bin/env node
// S5-2d / E5-1: audit direct requestAnimationFrame call sites in src against perf/rAF-whitelist.json.
// Fails when a call site is not whitelisted, or a whitelisted line no longer matches the source.
// Usage: node scripts/check-raf-whitelist.mjs [--root <dir>]
/* eslint-env node */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CATEGORIES = ["visualRuntime", "scheduler-owner", "player3d-pending", "audio-panel-pending", "other"];
const CALL_RE = /\brequestAnimationFrame\s*\(/;
const TEST_RE = /\.(test|spec)\.[cm]?[jt]sx?$/;

const toPosix = (rel) => rel.split(path.sep).join("/");
const isTestPath = (rel) => TEST_RE.test(rel) || /(^|[\\/])(__tests__|fixtures)([\\/]|$)/.test(rel);
const readLines = (abs) => fs.readFileSync(abs, "utf8").split(/\r?\n/);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

/** Every text-level native rAF invocation (not cancelAnimationFrame / typeof guards) in non-test src files. */
export function scanUsages(root) {
  const usages = [];
  for (const abs of walk(path.join(root, "src"))) {
    const rel = toPosix(path.relative(root, abs));
    if (!/\.(ts|tsx)$/.test(rel) || isTestPath(rel)) continue;
    readLines(abs).forEach((text, index) => {
      if (CALL_RE.test(text)) usages.push({ file: rel, line: index + 1, text: text.trim() });
    });
  }
  return usages.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export function loadWhitelist(root) {
  const rel = "perf/rAF-whitelist.json";
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { rel, entries: [], error: "missing " + rel };
  try {
    const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
    const entries = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(entries)) return { rel, entries: [], error: rel + " has no entries[]" };
    return { rel, entries, error: null };
  } catch (error) {
    return { rel, entries: [], error: rel + " is not valid JSON: " + error.message };
  }
}

export function check(root) {
  const usages = scanUsages(root);
  const { entries, error } = loadWhitelist(root);
  const problems = [];
  if (error) return { ok: false, usages, entries: [], problems: [{ type: "config", entry: "-", detail: error }], counts: {} };

  const listed = new Set();
  for (const entry of entries) {
    const label = String(entry.file) + ":" + String(entry.line);
    const fail = (detail) => problems.push({ type: "entry", entry: label, detail });
    if (!entry.file || !Number.isInteger(entry.line) || entry.line < 1) { fail("needs file and positive integer line"); continue; }
    if (!CATEGORIES.includes(entry.category)) { fail('unknown category "' + entry.category + '"'); continue; }
    if (!entry.reason || !String(entry.reason).trim()) { fail("needs a reason"); continue; }
    if (!entry.file.startsWith("src/") || !/\.(ts|tsx)$/.test(entry.file)) { fail("must point at src/**/*.{ts,tsx}"); continue; }
    if (isTestPath(entry.file)) { fail("test files are out of scope"); continue; }
    if (listed.has(label)) { fail("duplicate entry"); continue; }
    listed.add(label);
    const abs = path.join(root, entry.file);
    if (!fs.existsSync(abs)) { fail("file not found"); continue; }
    const needle = entry.match || "requestAnimationFrame";
    const text = readLines(abs)[entry.line - 1];
    if (text === undefined || !text.includes(needle)) fail('line no longer matches "' + needle + '"');
  }

  for (const usage of usages) {
    const label = usage.file + ":" + usage.line;
    if (!listed.has(label)) problems.push({ type: "unlisted", entry: label, detail: usage.text });
  }

  const counts = {};
  for (const entry of entries) counts[entry.category] = (counts[entry.category] || 0) + 1;
  return { ok: problems.length === 0, usages, entries, problems, counts };
}

function main(argv) {
  const args = argv.slice(2);
  const known = new Set(["--root"]);
  for (let i = 0; i < args.length; i += 1) {
    if (!known.has(args[i])) {
      console.error('[raf-whitelist] unknown option "' + args[i] + '" (expected: --root <dir>)');
      return 2;
    }
    i += 1;
  }
  const rootIndex = args.indexOf("--root");
  if (rootIndex >= 0 && !args[rootIndex + 1]) {
    console.error("[raf-whitelist] --root needs a directory");
    return 2;
  }
  const root = rootIndex >= 0 ? path.resolve(args[rootIndex + 1]) : process.cwd();
  if (!fs.existsSync(path.join(root, "src"))) {
    console.error("[raf-whitelist] no src/ under " + root);
    return 2;
  }

  const result = check(root);
  console.log(
    "[raf-whitelist] " + root + ": usages=" + result.usages.length + " entries=" + result.entries.length
  );
  for (const problem of result.problems) {
    console.log("  FAIL " + problem.type + " " + problem.entry + " :: " + problem.detail);
  }
  if (!result.ok) {
    console.log("[raf-whitelist] FAIL problems=" + result.problems.length);
    return result.problems.some((problem) => problem.type === "config") ? 2 : 1;
  }
  const summary = Object.entries(result.counts).map(([category, count]) => category + "=" + count).join(" ");
  console.log("[raf-whitelist] PASS " + (summary || "0 entries"));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv));
}
