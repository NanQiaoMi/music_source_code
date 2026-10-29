#!/usr/bin/env node
// S8-2 per-domain coverage gate (burn-in). Reads vitest's json-summary report and
// enforces the floors in perf/coverage-domains.json. Floors are "measured - margin"
// and are ratchet-only up: --update never lowers an existing floor.
// Usage: node scripts/check-coverage-domains.mjs [--report-only] [--update]
//        [--root <dir>] [--config <path>] [--summary <path>]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const METRICS = ["statements", "branches", "functions", "lines"];
const argv = process.argv.slice(2);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const root = path.resolve(value("--root", process.cwd()));
const configPath = path.resolve(root, value("--config", "perf/coverage-domains.json"));
const summaryPath = path.resolve(root, value("--summary", "coverage/coverage-summary.json"));
const reportOnly = argv.includes("--report-only");
const update = argv.includes("--update");

const rel = (file) => path.relative(root, file).split(path.sep).join("/");
const round = (n) => Math.round(n * 100) / 100;
const die = (message) => {
  console.error("[coverage-domains] " + message);
  process.exit(2);
};
const readJson = (file, label, hint = "") => {
  if (!fs.existsSync(file)) die("missing " + label + " " + rel(file) + hint);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    die("invalid " + label + " " + rel(file) + ": " + error.message);
  }
};

const config = readJson(configPath, "config");
const domains = Array.isArray(config.domains) ? config.domains : [];
if (domains.length === 0) die("config has no domains");
const margin = Number(config.burnInMarginPp ?? 5);
if (!Number.isFinite(margin) || margin < 0) die("config burnInMarginPp must be a number >= 0");
for (const domain of domains) {
  if (!domain.name) die("config domain without name");
  if (update) continue;
  for (const metric of METRICS) {
    const floor = domain.thresholds?.[metric];
    if (typeof floor !== "number" || floor < 0 || floor > 100) {
      die("config " + domain.name + ": threshold " + metric + " must be a number 0-100");
    }
  }
}

const summary = readJson(summaryPath, "coverage summary", " (run: npm run test:coverage:domains)");
const files = Object.keys(summary)
  .filter((key) => key !== "total")
  .map((key) => ({ key, path: key.replace(/\\/g, "/") }));
const inDomain = (file, domain) => file.startsWith(domain + "/") || file.includes("/" + domain + "/");

function measure(domain) {
  const totals = Object.fromEntries(METRICS.map((metric) => [metric, { total: 0, covered: 0 }]));
  let count = 0;
  for (const file of files) {
    if (!inDomain(file.path, domain)) continue;
    count += 1;
    for (const metric of METRICS) {
      totals[metric].total += summary[file.key][metric]?.total ?? 0;
      totals[metric].covered += summary[file.key][metric]?.covered ?? 0;
    }
  }
  const pct = {};
  for (const metric of METRICS) {
    pct[metric] = totals[metric].total === 0 ? 100 : round((totals[metric].covered / totals[metric].total) * 100);
  }
  return { files: count, pct };
}

if (update) {
  const next = domains.map((domain) => {
    const actual = measure(domain.name);
    if (actual.files === 0) die("cannot --update: domain " + domain.name + " has no files in " + rel(summaryPath));
    const thresholds = {};
    for (const metric of METRICS) {
      const proposed = round(actual.pct[metric] - margin);
      const current = domain.thresholds?.[metric];
      thresholds[metric] = typeof current === "number" ? Math.max(current, proposed) : proposed;
    }
    return { name: domain.name, files: actual.files, measured: actual.pct, thresholds };
  });
  let commit = null;
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    commit = null;
  }
  const note =
    "S8-2 per-domain burn-in floors: threshold = round(measured - burnInMarginPp, 2), ratchet-only up " +
    "(--update raises floors when coverage improves and never lowers them). Source: npm run test:coverage:domains.";
  const output = { version: 1, note, burnInMarginPp: margin, measuredAt: new Date().toISOString(), commit, domains: next };
  fs.writeFileSync(configPath, JSON.stringify(output, null, 2) + "\n");
  console.log("[coverage-domains] wrote " + rel(configPath) + " (" + next.length + " domains, floors = measured - " + margin + "pp, ratchet-only up)");
  process.exit(0);
}

const rows = [];
const offenders = [];
for (const domain of domains) {
  const actual = measure(domain.name);
  if (actual.files === 0) {
    offenders.push(domain.name + ": no files in coverage summary (domain missing)");
  } else {
    for (const metric of METRICS) {
      const floor = domain.thresholds[metric];
      if (actual.pct[metric] < floor) {
        offenders.push(domain.name + ": " + metric + " " + actual.pct[metric].toFixed(2) + " < floor " + floor.toFixed(2));
      }
    }
  }
  rows.push([domain.name, actual.files, actual.pct, domain.thresholds]);
}

console.log("== S8-2 coverage domains (burn-in floors = measured - " + margin + "pp, ratchet-only up) ==");
console.log("domain".padEnd(22) + "files".padStart(6) + "stmts".padStart(9) + "branch".padStart(9) + "funcs".padStart(9) + "lines".padStart(9) + "  floors (s/b/f/l)");
for (const [name, count, pct, floor] of rows) {
  const cells = METRICS.map((metric) => pct[metric].toFixed(2).padStart(9)).join("");
  const floors = METRICS.map((metric) => floor[metric].toFixed(2)).join("/");
  console.log(name.padEnd(22) + String(count).padStart(6) + cells + "  " + floors);
}

if (offenders.length > 0) {
  for (const offender of offenders) console.log("::error title=coverage-domains::" + offender);
  console.error("[coverage-domains] FAIL: " + offenders.length + " offender(s) below burn-in floor");
  for (const offender of offenders) console.error(" - " + offender);
  if (!reportOnly) process.exit(1);
  console.log("[coverage-domains] report-only: " + offenders.length + " offender(s) not enforced");
} else {
  console.log("[coverage-domains] PASS: " + rows.length + " domains at or above burn-in floors");
}
