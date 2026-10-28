#!/usr/bin/env node
// Markdown perf dashboard from perf/perf-history.jsonl (last N runs, trends, regressions).
// Usage: node scripts/perf/perf-dashboard.mjs [--root dir] [--history perf/perf-history.jsonl]
//   [--limit 14] [--out perf/perf-dashboard.md]
// Exit: 0 ok (empty history included), 1 malformed history, 2 bad arguments.
import fs from "node:fs";
import path from "node:path";
import { FIELDS, option, readHistory } from "./perf-history-lib.mjs";

const argv = process.argv.slice(2);
const root = path.resolve(option(argv, "root", process.cwd()));
const historyPath = path.resolve(root, option(argv, "history", "perf/perf-history.jsonl"));
const out = option(argv, "out", null);
const limit = Number(option(argv, "limit", "14"));
if (!Number.isInteger(limit) || limit < 1) {
  console.error("[perf-dashboard] --limit must be a positive integer");
  process.exit(2);
}
let entries;
try {
  entries = readHistory(historyPath);
} catch (error) {
  console.error("[perf-dashboard] " + error.message);
  process.exit(1);
}

const round = (value) => Math.round(value * 10) / 10;
const fixed = (value) => round(value).toFixed(1);
const stamp = (ts) => new Date(ts).toISOString().slice(0, 16).replace("T", " ");
const preview = (value) => {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
  return text.length > 80 ? text.slice(0, 77) + "..." : text;
};
function trend(value, previous) {
  if (previous === undefined || previous === null) return fixed(value);
  const delta = round(value - previous);
  const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2192";
  return fixed(value) + " " + arrow + (delta === 0 ? "" : " " + (delta > 0 ? "+" : "") + fixed(delta));
}
function dashboard() {
  const lines = ["## Perf dashboard", ""];
  if (entries.length === 0) {
    lines.push("_No history entries yet._", "", "Run `npm run perf:history:append` after `node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json`, then `npm run perf:dashboard`.");
    return lines.join("\n") + "\n";
  }
  const visible = entries.slice(-limit);
  const offset = entries.length - visible.length;
  lines.push("_" + entries.length + " run(s) recorded; showing last " + visible.length + ". Trends vs the previous run: \u2191 growth, \u2193 reduction, \u2192 flat._", "", "| Time (UTC) | Commit | " + FIELDS.map((field) => field.label).join(" | ") + " |", "|---|---|" + FIELDS.map(() => "---:").join("|") + "|");
  for (let index = offset; index < entries.length; index += 1) {
    const entry = entries[index];
    const previous = entries[index - 1];
    lines.push("| " + stamp(entry.ts) + " | `" + entry.commit + "` | " + FIELDS.map((field) => trend(entry[field.key], previous?.[field.key])).join(" | ") + " |");
  }
  lines.push("", "### Regression highlights", "");
  const highlights = [];
  for (let index = Math.max(1, offset); index < entries.length; index += 1) {
    for (const field of FIELDS) {
      const delta = round(entries[index][field.key] - entries[index - 1][field.key]);
      if (delta > field.maxDelta) {
        const previous = fixed(entries[index - 1][field.key]);
        const current = fixed(entries[index][field.key]);
        highlights.push("- " + stamp(entries[index].ts) + " `" + entries[index].commit + "`: " + field.label + " +" + fixed(delta) + field.unit + " (" + previous + " \u2192 " + current + ") over +" + field.maxDelta + field.unit);
      }
    }
  }
  if (entries.length < 2) lines.push("- Not enough history to compare (need at least 2 runs).");
  else if (highlights.length === 0) lines.push("- None over thresholds (" + FIELDS.map((field) => field.label + " +" + field.maxDelta + field.unit).join(", ") + ").");
  else lines.push(...highlights);
  const latest = entries.at(-1);
  const metricKeys = latest.metrics && typeof latest.metrics === "object" ? Object.keys(latest.metrics).slice(0, 8) : [];
  if (metricKeys.length > 0) {
    lines.push("", "### Latest runtime metrics (" + stamp(latest.ts) + ")", "");
    for (const key of metricKeys) lines.push("- " + key + ": " + preview(latest.metrics[key]));
  }
  return lines.join("\n") + "\n";
}

const markdown = dashboard();
if (out) {
  const file = path.resolve(root, out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, markdown);
  console.log("[perf-dashboard] wrote " + path.relative(root, file).replaceAll("\\", "/") + " (" + entries.length + " runs)");
} else {
  process.stdout.write(markdown);
}
