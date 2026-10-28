#!/usr/bin/env node
// Release dry run (S8-5): non-destructive local subset of docs/nbl/RELEASE-CHECKLIST.md.
// Default: tsc + docs facts + perf gates; --build adds build (writes .next), --skip-build forces skip.
// Exit: 0 = no FAIL, 1 = any FAIL, 2 = invalid usage; see --help for options.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const USAGE = `Release dry run (S8-5) - safe, non-destructive subset of the release checklist.

Usage:
  node scripts/release-dry-run.mjs [options]

Options:
  --build        include "npm run build" (writes .next; slower)
  --skip-build   force-skip build even with --build; reported as SKIP
  --json         machine-readable result on stdout
  --check-only   print the plan without running commands (fixture mode)
  -h, --help     show this help
Default checks: tsc, docs facts, perf:gates. Exit 1 when any executed check fails.`;

export function parseArgs(argv) {
  const options = { json: false, checkOnly: false, build: false, skipBuild: false, help: false };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--check-only") options.checkOnly = true;
    else if (arg === "--build") options.build = true;
    else if (arg === "--skip-build") options.skipBuild = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error("unknown option: " + arg);
  }
  return options;
}

const define = (id, command, args) => ({ id, command, args });

export function buildPlan({ build = false, skipBuild = false } = {}) {
  const plan = [
    define("tsc", "npx", ["tsc", "--noEmit", "--incremental", "false", "--pretty", "false"]),
    define("docs-facts", "node", ["scripts/check-docs-facts.mjs"]),
    define("build", "npm", ["run", "build"]),
    define("perf-gates", "npm", ["run", "perf:gates"]),
  ];
  const skip = skipBuild
    ? "skipped via --skip-build"
    : build
      ? null
      : "safe subset by default; pass --build to include";
  const target = plan.find((check) => check.id === "build");
  if (skip) target.skip = skip;
  return plan;
}

export function runCheck(check, spawn = spawnSync) {
  const started = Date.now();
  const result = spawn(check.command, check.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout || "", result.stderr || ""].join("\n").trim();
  const row = { ...check, status: result.status === 0 ? "PASS" : "FAIL" };
  return { ...row, exitCode: result.status, durationMs: Date.now() - started, output };
}

export function summarize(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  const failed = count("FAIL");
  return {
    passed: count("PASS"),
    failed,
    skipped: count("SKIP"),
    planned: count("PLAN"),
    ok: failed === 0,
  };
}

export function formatTable(rows) {
  const header = ["CHECK", "RESULT", "TIME", "COMMAND / NOTE"];
  const body = rows.map((row) => [
    row.id,
    row.status,
    typeof row.durationMs === "number" ? (row.durationMs / 1000).toFixed(1) + "s" : "-",
    row.skip || [row.command, ...row.args].join(" "),
  ]);
  const widths = header.map((cell, i) =>
    Math.max(cell.length, ...body.map((row) => row[i].length))
  );
  const line = (cells) => "| " + cells.map((cell, i) => cell.padEnd(widths[i])).join(" | ") + " |";
  const border = "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";
  return [border, line(header), border, ...body.map(line), border].join("\n");
}

const tail = (text, maxLines = 20) =>
  String(text || "")
    .trim()
    .split("\n")
    .slice(-maxLines)
    .join("\n");

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error("[release-dry-run] " + error.message + "\n\n" + USAGE);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const rows = buildPlan(options).map((check) => {
    if (check.skip) return { ...check, status: "SKIP", durationMs: null };
    if (options.checkOnly) return { ...check, status: "PLAN", durationMs: null };
    return runCheck(check);
  });
  const summary = summarize(rows);
  const build = rows.find((row) => row.id === "build");

  if (options.json) {
    const checks = rows.map((row) => ({
      id: row.id,
      status: row.status,
      exitCode: row.exitCode ?? null,
      durationMs: row.durationMs ?? null,
      skippedReason: row.skip ?? null,
      command: [row.command, ...row.args].join(" "),
      outputTail: row.status === "FAIL" ? tail(row.output) : null,
    }));
    const payload = {
      ok: summary.ok,
      checkOnly: options.checkOnly,
      buildIncluded: !build.skip,
      summary,
      checks,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    for (const row of rows) {
      const command = [row.command, ...row.args].join(" ");
      if (row.status === "FAIL")
        console.error(`\n[FAIL] ${row.id} (${command})\n${tail(row.output)}`);
    }
    const stats = [
      `${summary.passed} passed`,
      `${summary.failed} failed`,
      `${summary.skipped} skipped`,
    ];
    if (summary.planned) stats.push(`${summary.planned} planned`);
    console.log("== release dry run (S8-5) ==");
    console.log(formatTable(rows));
    console.log(`RESULT: ${summary.ok ? "PASS" : "FAIL"} - ${stats.join(", ")}`);
    if (summary.ok && build.skip)
      console.log(`NOTE: ${build.skip}; rerun with --build for a full local dry run.`);
  }

  process.exitCode = summary.ok ? 0 : 1;
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
