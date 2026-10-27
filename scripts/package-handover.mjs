#!/usr/bin/env node
/**
 * Package a clean handover snapshot of the project (S0 deliverable + handover).
 *
 * - Copies the working tree (including uncommitted WIP) into dist/handover/<name>/
 * - Excludes build artifacts, caches, secrets, AI tooling dirs and generated assets
 * - Writes SNAPSHOT.txt / PACKAGE-MANIFEST.md / HANDOVER-README.md into the package
 * - Zips the package and writes <zip>.sha256
 *
 * Usage: node scripts/package-handover.mjs [--no-zip] [--out <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const noZip = args.includes("--no-zip");
const outIdx = args.indexOf("--out");
const outRoot = outIdx >= 0 ? path.resolve(ROOT, args[outIdx + 1]) : path.join(ROOT, "dist", "handover");
const buildRoot = path.resolve(ROOT, "..", "handover-build");
const name = "MIMI-Music-Player-" + pkg.version + "-handover-" + today;
const stage = path.join(buildRoot, name);
const zipPath = path.join(outRoot, name + ".zip");

const EXCLUDE_TOP_DIRS = new Set([
  "node_modules", ".next", "out", "dist-electron", "MIMI-Music-Player-Portable",
  ".git", ".worktrees", ".venv", "coverage", "test-results", ".cache", "scratch",
  "mimimusic-promo", "NVIDIA Corporation", "skills", "musicapi", "dist",
]);
const EXCLUDE_DIR_PATHS = new Set(["backend/build", "backend/dist", "backend/__pycache__", "public/mediapipe"]);
const EXCLUDE_FILE_EXACT = new Set([".env.local", ".env", ".env.production.local", "tsconfig.tsbuildinfo", "skills-lock.json"]);
const EXCLUDE_FILE_RE = [/\.log$/, /\.pem$/, /^\.DS_Store$/, /^daily_video_editing_.*\.png$/, /^gemini-svg.*\.svg$/];
const ALLOWED_DOT_DIRS = new Set([".github", ".husky"]);

function isExcludedDir(rel) {
  const parts = rel.split("/");
  const top = parts[0];
  if (EXCLUDE_TOP_DIRS.has(top)) return true;
  if (!ALLOWED_DOT_DIRS.has(top) && top.startsWith(".")) return true;
  for (const p of EXCLUDE_DIR_PATHS) {
    if (rel === p || rel.startsWith(p + "/")) return true;
  }
  return false;
}
function isExcludedFile(rel) {
  const base = path.basename(rel);
  if (EXCLUDE_FILE_EXACT.has(base)) return true;
  if (rel === ".env.local" || rel.startsWith(".env.") && !rel.endsWith(".example")) return true;
  return EXCLUDE_FILE_RE.some((re) => re.test(base));
}

const included = [];
let includedBytes = 0;
function walk(dir, base) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + entry.name : entry.name;
    if (entry.isSymbolicLink()) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isExcludedDir(rel)) continue;
      walk(abs, rel);
    } else {
      if (isExcludedFile(rel)) continue;
      included.push(rel);
      includedBytes += fs.statSync(abs).size;
    }
  }
}
walk(ROOT, "");
included.sort();

if (included.some((rel) => rel === ".env.local" || rel.startsWith("node_modules/"))) {
  console.error("[package-handover] FATAL: excluded secrets/dependencies were included");
  process.exit(1);
}
if (!included.includes("docs/nbl/HANDOVER.md")) {
  console.error("[package-handover] FATAL: docs/nbl/HANDOVER.md missing");
  process.exit(1);
}

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const rel of included) {
  const dest = path.join(stage, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dest);
}

function git(gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: ROOT, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "(git unavailable)";
}
const branch = git(["branch", "--show-current"]);
const head = git(["rev-parse", "HEAD"]);
const status = git(["status", "--porcelain"]);
const statusCount = status ? status.split("\n").filter(Boolean).length : 0;

const snapshot = [
  "MIMI Music Player - handover source snapshot",
  "Generated: " + new Date().toISOString(),
  "Package: " + name,
  "Version: " + pkg.version,
  "Branch: " + branch,
  "HEAD: " + head,
  "Uncommitted entries: " + statusCount,
  "",
  "git status --porcelain:",
  status || "(clean)",
  "",
  "Note: this is a working-tree snapshot (no .git directory); uncommitted WIP is already applied.",
].join("\n") + "\n";
fs.writeFileSync(path.join(stage, "SNAPSHOT.txt"), snapshot);

function dirSize(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return 0;
  let total = 0;
  const stack = [abs];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.isFile()) total += fs.statSync(p).size;
    }
  }
  return total;
}
const excludedDirs = [
  ["node_modules", "npm dependencies (reinstall with npm ci --legacy-peer-deps)"],
  [".next", "Next build cache (regenerated by npm run dev/build)"],
  ["out", "stale static export (2026-07-30; desktop export currently blocked)"],
  ["dist-electron", "historical Electron packages (regenerate when release path is fixed)"],
  ["MIMI-Music-Player-Portable", "old portable build output"],
  [".git", "git history (this package is a source snapshot; base commit recorded in SNAPSHOT.txt)"],
  [".worktrees", "local worktrees (5.19GB; not needed for handover)"],
  [".venv", "local Python venv (recreate per STARTUP_GUIDE)"],
  ["coverage", "test coverage output"],
  ["test-results", "local test artifacts"],
  [".cache", "tool caches"],
  ["scratch", "local working notes/audits (gitignored; ask original owner if needed)"],
  ["mimimusic-promo", "promo assets, not part of the app"],
  ["NVIDIA Corporation", "GPU shader cache"],
  ["skills", "AI assistant skill library (not used by the app; 319 files)"],
  ["musicapi", "legacy third-party music-source JS scripts (not referenced by src)"],
  ["public/mediapipe", "generated MediaPipe assets; run npm run sync:mediapipe after npm install"],
  ["backend/build", "PyInstaller intermediates"],
  ["backend/dist", "PyInstaller output"],
  ["backend/__pycache__", "Python bytecode cache"],
];
const excludedRows = excludedDirs.map(([rel, reason]) => {
  const size = dirSize(rel);
  return "| " + rel + " | " + (size / 1024 / 1024).toFixed(1) + " MB | " + reason + " |";
});
const excludedFiles = [
  [".env.local", ".required secrets; use .env.example and fill locally"],
  ["*.log / .codex-dev-server*.log", "local logs"],
  ["tsconfig.tsbuildinfo", "incremental build cache"],
  ["skills-lock.json", "belongs to the excluded skills toolchain"],
  ["daily_video_editing_*.png, gemini-svg*.svg", "non-runtime design/source artifacts at repo root"],
  [".env / .env.production.local / *.pem / .DS_Store", "secrets or OS metadata"],
];

const topDirs = {};
for (const rel of included) {
  const top = rel.split("/")[0];
  topDirs[top] = (topDirs[top] || 0) + 1;
}
const topRows = Object.entries(topDirs).sort((a, b) => b[1] - a[1])
  .map(([top, count]) => "| " + top + " | " + count + " |");

const manifest = [
  "# PACKAGE-MANIFEST",
  "",
  "Generated: " + new Date().toISOString(),
  "Package: " + name,
  "Project: " + pkg.name + " " + pkg.version,
  "Source branch: " + branch,
  "Source HEAD: " + head,
  "Uncommitted entries at packaging: " + statusCount + " (see SNAPSHOT.txt)",
  "",
  "## Included",
  "",
  "- Files: " + included.length,
  "- Bytes: " + includedBytes + " (" + (includedBytes / 1024 / 1024).toFixed(1) + " MB)",
  "- Preserved uncommitted WIP: yes (working-tree snapshot)",
  "- Includes: src, docs (including HANDOVER.md), electron, backend sources, scripts, perf, public (without mediapipe), configs, .env.example",
  "",
  "### Top-level file counts",
  "",
  "| Path | Files |",
  "|---|---:|",
  topRows.join("\n"),
  "",
  "## Excluded",
  "",
  "| Path | Approx size | Reason |",
  "|---|---:|---|",
  excludedRows.join("\n"),
  "",
  "### Excluded files/patterns",
  "",
  "| Pattern | Reason |",
  "|---|---|",
  excludedFiles.map(([p, r]) => "| " + p + " | " + r + " |").join("\n"),
  "",
  "## Verify",
  "",
  "- Ensure no .env.local / node_modules / .next in the extracted tree.",
  "- Run: npm ci --legacy-peer-deps && npm run sync:mediapipe && npx tsc --noEmit && npm run test -- --run && npm run build",
  "- See docs/nbl/HANDOVER.md for full setup, known issues and handover checklist.",
  "",
  "## Regenerate",
  "",
  "Run: node scripts/package-handover.mjs",
].join("\n") + "\n";
fs.writeFileSync(path.join(stage, "PACKAGE-MANIFEST.md"), manifest);

const handoverReadme = [
  "# HANDOVER-README",
  "",
  "This is a clean source snapshot of MIMI Music Player " + pkg.version + ".",
  "",
  "1. Read docs/nbl/HANDOVER.md (full handover guide, known issues, checklist).",
  "2. npm ci --legacy-peer-deps",
  "3. copy .env.example to .env.local (optional for local playback; required for AI features)",
  "4. npm run sync:mediapipe (gesture assets; optional for playback)",
  "5. npm run dev -> http://localhost:3025",
  "",
  "Important:",
  "- Uncommitted WIP is already applied in this snapshot (see SNAPSHOT.txt).",
  "- Desktop packaging is intentionally frozen until S7-4 (see HANDOVER.md 8.2).",
  "- Do not commit real API keys; .env.local is excluded from this package.",
].join("\n") + "\n";
fs.writeFileSync(path.join(stage, "HANDOVER-README.md"), handoverReadme);

let zipSize = null;
let zipHash = null;
if (!noZip) {
  fs.mkdirSync(outRoot, { recursive: true });
  fs.rmSync(zipPath, { force: true });
  const pyCode = [
    "import os, sys, zipfile",
    "stage, root_name, out = sys.argv[1], sys.argv[2], sys.argv[3]",
    "with zipfile.ZipFile(out, \"w\", zipfile.ZIP_DEFLATED, compresslevel=9) as z:",
    "    for root, dirs, files in os.walk(stage):",
    "        for f in files:",
    "            p = os.path.join(root, f)",
    "            rel = os.path.relpath(p, stage).replace(os.sep, \"/\")",
    "            z.write(p, root_name + \"/\" + rel)",
  ].join("\n");
  const py = spawnSync("python", ["-c", pyCode, stage, name, zipPath], { stdio: "inherit" });
  if (py.status !== 0 || !fs.existsSync(zipPath)) {
    console.error("[package-handover] zip failed (python status " + py.status + ")");
    process.exit(1);
  }
  zipSize = fs.statSync(zipPath).size;
  zipHash = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
  fs.writeFileSync(zipPath + ".sha256", zipHash + "  " + path.basename(zipPath) + "\n");
}

if (!args.includes("--keep-stage")) {
  fs.rmSync(stage, { recursive: true, force: true });
}

console.log("");
console.log("[package-handover] package: " + name);
console.log("  stage: " + stage);
console.log("  files: " + included.length + " (" + (includedBytes / 1024 / 1024).toFixed(1) + " MB source)");
if (!noZip) {
  console.log("  zip:   " + zipPath + " (" + (zipSize / 1024 / 1024).toFixed(1) + " MB)");
  console.log("  sha256: " + zipHash);
}