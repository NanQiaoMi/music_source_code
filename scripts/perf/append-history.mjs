#!/usr/bin/env node
// Append one schema-checked perf history row (perf/perf-history.jsonl) per run.
// Usage: node scripts/perf/append-history.mjs [--root dir] [--report perf/bundle-report.json]
//   [--metrics audio-metrics.json] [--history perf/perf-history.jsonl] [--commit sha] [--ts iso]
//   [--init] [--check]
// Exit: 0 ok, 1 invalid/non-monotonic history, 2 missing or invalid input.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FIELDS, ISO_RE, entryError, flag, option, readHistory } from "./perf-history-lib.mjs";

const argv = process.argv.slice(2);
const root = path.resolve(option(argv, "root", process.cwd()));
const resolve = (value) => path.resolve(root, value);
const historyPath = resolve(option(argv, "history", "perf/perf-history.jsonl"));
const show = (value) => path.relative(root, value).replaceAll("\\", "/");

function fail(message, code = 2) {
  console.error("[perf-history] " + message);
  process.exit(code);
}
function readJson(file, label) {
  if (!fs.existsSync(file)) fail(label + " not found: " + show(file));
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(label + " is not valid JSON: " + show(file) + " (" + error.message + ")");
  }
}
const pickers = {
  rootMainGzipKB: (result) => result?.rootMain?.gzipKB,
  firstLoadGzipKB: (result) => result?.firstLoad?.gzipKB,
  cssGzipKB: (result) => result?.css?.gzipKB,
  asyncMaxKB: (result) => result?.asyncChunks?.maxKB,
  publicMB: (result) => result?.publicMB,
};
function bundleRow(file) {
  const raw = readJson(file, "report");
  const result = raw && typeof raw === "object" ? raw.result ?? raw : null;
  const row = {};
  for (const field of FIELDS) {
    const value = pickers[field.key](result);
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail("report missing numeric " + field.key + ": " + show(file));
    row[field.key] = value;
  }
  return row;
}
function metricsObject(file) {
  const raw = readJson(file, "metrics");
  const metrics = raw?.metrics ?? raw;
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) fail("metrics must be a JSON object: " + show(file));
  return metrics;
}
function gitCommit() {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return sha || "unknown";
  } catch {
    return "unknown";
  }
}
function existing() {
  try {
    return readHistory(historyPath);
  } catch (error) {
    fail(error.message, 1);
  }
}
function init() {
  if (fs.existsSync(historyPath)) {
    console.log("[perf-history] already initialized: " + show(historyPath) + " (" + existing().length + " entries)");
    return;
  }
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, "");
  console.log("[perf-history] initialized " + show(historyPath) + " (header-less JSONL)");
}
function check() {
  const entries = existing();
  const count = entries.length + (entries.length === 1 ? " entry" : " entries");
  const range = entries.length > 1 ? " (" + entries[0].ts + " -> " + entries.at(-1).ts + ")" : "";
  console.log("[perf-history] OK: " + count + (entries.length ? ", schema valid, ts strictly increasing" + range : " (empty history)"));
}
function append() {
  const before = existing();
  const ts = option(argv, "ts", new Date().toISOString());
  if (!ISO_RE.test(ts) || Number.isNaN(Date.parse(ts))) fail("--ts must be an ISO 8601 timestamp: " + ts);
  const last = before.at(-1);
  if (last) {
    const delta = Date.parse(ts) - Date.parse(last.ts);
    if (delta === 0) fail("duplicate ts " + ts + " (history is append-only)", 1);
    if (delta < 0) fail("ts " + ts + " is older than the last entry " + last.ts + " (history is append-only)", 1);
  }
  const reportPath = resolve(option(argv, "report", "perf/bundle-report.json"));
  const metricsPath = option(argv, "metrics", null);
  const commit = option(argv, "commit", null) || (process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 12) : gitCommit());
  if (!commit) fail("cannot resolve commit; pass --commit");
  const row = { ts, commit, ...bundleRow(reportPath) };
  if (metricsPath) row.metrics = metricsObject(resolve(metricsPath));
  const error = entryError(row);
  if (error) fail("internal schema error: " + error);
  const text = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, "utf8") : "";
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, (text && !text.endsWith("\n") ? "\n" : "") + JSON.stringify(row) + "\n");
  console.log("[perf-history] appended " + show(historyPath) + " #" + (before.length + 1) + " (" + row.commit + ", rootMain " + row.rootMainGzipKB + " KB, first load " + row.firstLoadGzipKB + " KB)");
}

if (flag(argv, "init") && flag(argv, "check")) fail("--init and --check are mutually exclusive");
if (flag(argv, "init")) init();
else if (flag(argv, "check")) check();
else append();
