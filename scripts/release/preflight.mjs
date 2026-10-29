#!/usr/bin/env node
// S8-5 release preflight: version/README, CHANGELOG, git, build artifacts, perf baselines,
// required files/env keys, docs facts. Exit 0 = no FAIL, 1 = any FAIL, 2 = bad usage.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const USAGE = `Release preflight (S8-5)
Usage: node scripts/release/preflight.mjs [--tag vX.Y.Z] [--allow-dirty] [--skip-build] [--json]
Checks: version/README, CHANGELOG head, git cleanliness, build artifacts, perf baselines,
required files and .env.example keys, and check-docs-facts. Exit 1 on FAIL.`;

export const REQUIRED_ENV_KEYS =
  "SENSENOVA_BASE_URL SENSENOVA_DEFAULT_MODEL SENSENOVA_API_KEY_1 NEXT_PUBLIC_APP_URL NEXT_PUBLIC_BACKEND_URL".split(
    " "
  );
export const REQUIRED_FILES =
  ".env.example package-lock.json next.config.js README.md docs/nbl/CHANGELOG.md docs/nbl/RELEASE-CHECKLIST.md docs/nbl/CI.md".split(
    " "
  );
export const PERF_BASELINES =
  "perf/budget.json perf/bundle-baseline.json perf/coverage-domains.json perf/store-line-baseline.json perf/rAF-whitelist.json".split(
    " "
  );

const row = (id, status, detail) => ({ id, status, detail });
const pass = (id, detail) => row(id, "PASS", detail);
const fail = (id, detail) => row(id, "FAIL", detail);
const skip = (id, detail) => row(id, "SKIP", detail);
const warn = (id, detail) => row(id, "WARN", detail);
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const head = (root, rel, n = 20) => read(root, rel).split(/\r?\n/).slice(0, n).join("\n");
const tail = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-200);

export function parseArgs(argv) {
  const options = { tag: null, allowDirty: false, skipBuild: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--allow-dirty") options.allowDirty = true;
    else if (arg === "--skip-build") options.skipBuild = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--tag") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error("missing value for --tag");
      options.tag = value;
    } else if (arg.startsWith("--tag=")) options.tag = arg.slice(6);
    else throw new Error("unknown option: " + arg);
  }
  return options;
}

function checkVersion(root, tag) {
  let version;
  try {
    version = JSON.parse(read(root, "package.json")).version;
  } catch (error) {
    return { version, row: fail("version", "package.json missing or invalid: " + error.message) };
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version || ""))
    return { version, row: fail("version", "not SemVer: " + version) };
  if (tag && tag !== "v" + version)
    return { version, row: fail("version", `tag ${tag} != v${version}`) };
  try {
    if (!new RegExp("V?" + escapeRe(version), "i").test(head(root, "README.md")))
      return { version, row: fail("version", "README does not mention v" + version) };
  } catch {
    return { version, row: fail("version", "README.md missing") };
  }
  return {
    version,
    row: pass("version", `package.json ${version}; tag ${tag || "v" + version}; README matches`),
  };
}

function checkChangelog(root, version) {
  if (!version) return fail("changelog", "package.json version unavailable");
  let text;
  try {
    text = read(root, "docs/nbl/CHANGELOG.md");
  } catch {
    return fail("changelog", "docs/nbl/CHANGELOG.md missing");
  }
  const heading = text.split(/\r?\n/).find((line) => /^##\s+/.test(line));
  if (!heading) return fail("changelog", "no '## ' heading in CHANGELOG");
  if (!new RegExp("^##\\s+v?" + escapeRe(version) + "\\b").test(heading.trim()))
    return fail("changelog", `head is "${heading.trim()}", expected a v${version} section`);
  const date = heading.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const today = new Date().toLocaleDateString("sv-SE");
  if (date && date > today) return fail("changelog", `date ${date} is in the future`);
  return pass("changelog", heading.trim().replace(/^##\s+/, "") + " (head entry)");
}

function outputMode(root) {
  const file = ["next.config.js", "next.config.mjs"]
    .map((name) => path.join(root, name))
    .find((p) => fs.existsSync(p));
  if (!file) return "server";
  const text = fs.readFileSync(file, "utf8");
  if (/output\s*:\s*["']standalone["']/.test(text)) return "standalone";
  if (/output\s*:\s*["']export["']/.test(text))
    return /output\s*:\s*process\.env\./.test(text) ? "export-optional" : "export";
  return "server";
}

function checkBuild(root, skipBuild) {
  if (skipBuild)
    return ["build-id", "build-output"].map((id) => skip(id, "skipped via --skip-build"));
  let buildId = "";
  try {
    buildId = fs.readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim();
  } catch {
    // Reported below.
  }
  const rows = [
    buildId
      ? pass("build-id", ".next/BUILD_ID present")
      : fail("build-id", ".next/BUILD_ID missing; run npm run build"),
  ];
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const output = (rel, ok, bad) =>
    exists(rel) ? pass("build-output", ok) : fail("build-output", bad);
  const mode = outputMode(root);
  if (mode === "standalone")
    rows.push(
      output(".next/standalone/server.js", "standalone server present", "standalone server missing")
    );
  else if (mode === "export")
    rows.push(
      output("out/index.html", "static export out/index.html present", "out/index.html missing")
    );
  else if (mode === "export-optional")
    rows.push(
      exists("out/index.html")
        ? pass("build-output", "static export out/index.html present")
        : pass("build-output", "standard server build; out/ optional (STATIC_EXPORT unset)")
    );
  else
    rows.push(
      buildId
        ? pass("build-output", "standard server build (.next)")
        : fail("build-output", "no .next build output")
    );
  return rows;
}

function checkGit(root, allowDirty, spawn) {
  const result = spawn("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
  if (result.error || result.status !== 0) return skip("git-clean", "not a git worktree");
  const dirty = String(result.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (dirty.length === 0) return pass("git-clean", "working tree clean");
  const detail = `${dirty.length} uncommitted path(s): ${dirty.slice(0, 3).join(", ")}`;
  return allowDirty
    ? warn("git-clean", "allowed by --allow-dirty; " + detail)
    : fail("git-clean", detail);
}

function checkPerf(root) {
  const missing = [];
  const invalid = [];
  for (const rel of PERF_BASELINES) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) missing.push(rel);
    else {
      try {
        JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        invalid.push(rel);
      }
    }
  }
  if (missing.length || invalid.length)
    return fail(
      "perf-baselines",
      `missing=${JSON.stringify(missing)} invalid=${JSON.stringify(invalid)}`
    );
  return pass("perf-baselines", `${PERF_BASELINES.length} baseline files present and valid JSON`);
}

function checkEnvFiles(root) {
  const missingFiles = REQUIRED_FILES.filter((rel) => !fs.existsSync(path.join(root, rel)));
  let missingKeys = [];
  try {
    const keys = new Set(
      [...read(root, ".env.example").matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1])
    );
    missingKeys = REQUIRED_ENV_KEYS.filter((key) => !keys.has(key));
  } catch {
    missingKeys = [...REQUIRED_ENV_KEYS];
  }
  if (missingFiles.length || missingKeys.length)
    return fail(
      "env-files",
      `missing files=${JSON.stringify(missingFiles)} keys=${JSON.stringify(missingKeys)}`
    );
  return pass(
    "env-files",
    `${REQUIRED_FILES.length} files; ${REQUIRED_ENV_KEYS.length} .env.example keys`
  );
}

function checkDocsFacts(root, spawn) {
  if (!fs.existsSync(path.join(root, "scripts/check-docs-facts.mjs")))
    return fail("docs-facts", "scripts/check-docs-facts.mjs missing");
  const result = spawn(process.execPath, ["scripts/check-docs-facts.mjs"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120000,
  });
  if (result.error) return fail("docs-facts", "failed to start: " + result.error.message);
  if (result.status !== 0)
    return fail("docs-facts", `exit ${result.status}: ${tail(result.stderr || result.stdout)}`);
  return pass("docs-facts", "check-docs-facts exit 0");
}

export function runPreflight({
  root = process.cwd(),
  tag = null,
  allowDirty = false,
  skipBuild = false,
  spawn = spawnSync,
} = {}) {
  const checked = checkVersion(root, tag);
  const rows = [
    checked.row,
    checkChangelog(root, checked.version),
    checkGit(root, allowDirty, spawn),
    ...checkBuild(root, skipBuild),
    checkPerf(root),
    checkEnvFiles(root),
    checkDocsFacts(root, spawn),
  ];
  const count = (status) => rows.filter((item) => item.status === status).length;
  const summary = {
    passed: count("PASS"),
    failed: count("FAIL"),
    skipped: count("SKIP"),
    warned: count("WARN"),
  };
  return {
    ok: summary.failed === 0,
    version: checked.version,
    tag: tag || (checked.version ? "v" + checked.version : null),
    rows,
    summary,
  };
}

export function formatTable(rows) {
  const body = rows.map((r) => [
    r.id,
    r.status,
    String(r.detail || "")
      .replace(/\|/g, "/")
      .slice(0, 110),
  ]);
  const widths = ["CHECK", "RESULT", "DETAIL"].map((cell, i) =>
    Math.max(cell.length, ...body.map((r) => r[i].length))
  );
  const line = (cells) => "| " + cells.map((cell, i) => cell.padEnd(widths[i])).join(" | ") + " |";
  const border = "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";
  return [border, line(["CHECK", "RESULT", "DETAIL"]), border, ...body.map(line), border].join(
    "\n"
  );
}

export function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error("[release-preflight] " + error.message + "\n\n" + USAGE);
    process.exitCode = 2;
    return;
  }
  if (options.help) return console.log(USAGE);
  const result = runPreflight(options);
  const payload = {
    ok: result.ok,
    version: result.version,
    tag: result.tag,
    summary: result.summary,
    checks: result.rows,
  };
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log("== release preflight (S8-5) ==");
    console.log(formatTable(result.rows));
    console.log(
      `RESULT: ${result.ok ? "PASS" : "FAIL"} - ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped, ${result.summary.warned} warned`
    );
  }
  process.exitCode = result.ok ? 0 : 1;
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
