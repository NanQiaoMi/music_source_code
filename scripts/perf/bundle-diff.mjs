#!/usr/bin/env node
// Bundle regression diff: committed baseline vs a fresh bundle-budget report.
// Usage: node scripts/perf/bundle-diff.mjs [--root dir] [--baseline perf/bundle-baseline.json]
//   [--report perf/bundle-report.json] [--max-root-gzip 5] [--max-first-load-gzip 10]
//   [--json out.json] [--md out.md] [--update]
// Exit: 0 pass, 1 regression, 2 missing/invalid input. --update is explicit and never implicit.
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes("--" + name);
function option(name, fallback) {
  const index = argv.indexOf("--" + name);
  if (index < 0) return fallback;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}
function die(message) {
  console.error("[bundle-diff] " + message);
  process.exit(2);
}
const root = path.resolve(option("root", process.cwd()));
const resolve = (p) => path.resolve(root, p);
const baselinePath = resolve(option("baseline", "perf/bundle-baseline.json"));
const reportPath = resolve(option("report", "perf/bundle-report.json"));
const show = (p) => path.relative(root, p).replaceAll("\\", "/");
const number = (name, fallback) => {
  const value = Number(option(name, fallback));
  if (!Number.isFinite(value) || value < 0) die(`--${name} must be a non-negative number`);
  return value;
};
const maxRootGzip = number("max-root-gzip", 5);
const maxFirstLoadGzip = number("max-first-load-gzip", 10);

function read(file, label) {
  if (!fs.existsSync(file)) die(`${label} not found: ${show(file)} (run the build/bundle report first, or pass --update)`);
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    return json.result ?? json;
  } catch (error) {
    die(`${label} is not valid JSON: ${show(file)} (${error.message})`);
  }
}

const report = read(reportPath, "report");
if (flag("update")) {
  const payload = { version: 1, updatedAt: new Date().toISOString(), source: show(reportPath), result: report };
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[bundle-diff] baseline updated: ${show(baselinePath)}`);
}
const baseline = read(baselinePath, "baseline");

const definitions = [
  { metric: "rootMain gzip", unit: "KB", pick: (r) => r.rootMain?.gzipKB, limit: maxRootGzip },
  { metric: "rootMain raw", unit: "KB", pick: (r) => r.rootMain?.rawKB, limit: null },
  { metric: "first-load gzip", unit: "KB", pick: (r) => r.firstLoad?.gzipKB, limit: maxFirstLoadGzip },
  { metric: "first-load raw", unit: "KB", pick: (r) => r.firstLoad?.rawKB, limit: null },
  { metric: "css gzip", unit: "KB", pick: (r) => r.css?.gzipKB, limit: null },
  { metric: "rootMain files", unit: "", pick: (r) => r.rootMain?.files, limit: null },
];
const rows = definitions.map(({ metric, unit, pick, limit }) => {
  const base = pick(baseline);
  const current = pick(report);
  const delta = typeof base === "number" && typeof current === "number" ? Math.round((current - base) * 10) / 10 : null;
  const failed = limit !== null && delta !== null && delta > limit;
  const status = limit === null ? "info" : delta === null ? "n/a" : failed ? "FAIL" : "PASS";
  return { metric, unit, limit, base, current, delta, status };
});
const failures = rows.filter((row) => row.status === "FAIL");
const fmt = (value, unit) => (typeof value === "number" ? `${value}${unit ? " " + unit : ""}` : "n/a");
const fmtDelta = (value, unit) => (value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value}${unit ? " " + unit : ""}`);
const fmtLimit = (limit, unit) => (limit === null ? "\u2014" : `+${limit}${unit ? " " + unit : ""}`);
const table = [
  "| Metric | Baseline | Current | Delta | Threshold | Result |",
  "|---|---:|---:|---:|---:|---|",
  ...rows.map((row) => `| ${row.metric} | ${fmt(row.base, row.unit)} | ${fmt(row.current, row.unit)} | ${fmtDelta(row.delta, row.unit)} | ${fmtLimit(row.limit, row.unit)} | ${row.status} |`),
].join("\n");

console.log("== Bundle diff ==");
console.log(`baseline  ${show(baselinePath)}`);
console.log(`report    ${show(reportPath)}`);
console.log(table);
if (failures.length > 0) {
  for (const row of failures) console.error(`[bundle-diff] FAIL ${row.metric}: ${fmtDelta(row.delta, row.unit)} > ${fmtLimit(row.limit, row.unit)}`);
  console.error(`[bundle-diff] ${failures.length} regression(s); --update only after review`);
  process.exitCode = 1;
} else {
  console.log(`[bundle-diff] PASS (rootMain gzip <= +${maxRootGzip} KB, first-load gzip <= +${maxFirstLoadGzip} KB)`);
}

const markdownOut = option("md", null);
if (markdownOut) {
  fs.mkdirSync(path.dirname(resolve(markdownOut)), { recursive: true });
  fs.writeFileSync(resolve(markdownOut), "## Bundle diff\n\n" + table + "\n");
}
const jsonOut = option("json", null);
if (jsonOut) {
  fs.mkdirSync(path.dirname(resolve(jsonOut)), { recursive: true });
  fs.writeFileSync(
    resolve(jsonOut),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseline: show(baselinePath),
        report: show(reportPath),
        thresholds: { rootMainGzipKB: maxRootGzip, firstLoadGzipKB: maxFirstLoadGzip },
        rows,
        failures: failures.map((row) => row.metric),
      },
      null,
      2
    ) + "\n"
  );
}
