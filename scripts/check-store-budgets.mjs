#!/usr/bin/env node
// Store line-budget ratchet + cycle gate (S6-12).
// Rules: every src/store file must stay <= its baseline; files not in the
// baseline must be <= --max-lines. Runtime store-to-store imports must be acyclic.
// Usage: node scripts/check-store-budgets.mjs [--check] [--update]
//        [--root <dir>] [--baseline <path>] [--max-lines <n>]
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const root = path.resolve(value("--root", process.cwd()));
const baselinePath = path.resolve(root, value("--baseline", "perf/store-line-baseline.json"));
const maxLines = Number(value("--max-lines", "400"));
const update = argv.includes("--update");
if (!Number.isInteger(maxLines) || maxLines <= 0) {
  console.error("[store-budgets] --max-lines needs a positive integer");
  process.exit(2);
}

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const IGNORED_DIRS = new Set(["__tests__", "__contract__", "fixtures", "__fixtures__", "node_modules"]);
const isSource = (name) => /\.tsx?$/.test(name) && !/\.(test|spec)\./.test(name);
const countLines = (text) => {
  if (!text) return 0;
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.length;
};
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(p, out);
    } else if (isSource(entry.name)) out.push(p);
  }
  return out;
}

const storeDir = path.join(root, "src", "store");
const files = walk(storeDir).sort();
if (files.length === 0) {
  console.error("[store-budgets] no store files under " + rel(storeDir));
  process.exit(2);
}
const counts = Object.fromEntries(files.map((p) => [rel(p), countLines(fs.readFileSync(p, "utf8"))]));
const totalLines = Object.values(counts).reduce((a, b) => a + b, 0);

let baseline = null;
if (fs.existsSync(baselinePath)) {
  try { baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")); }
  catch (error) {
    console.error("[store-budgets] invalid baseline " + rel(baselinePath) + ": " + error.message);
    process.exit(2);
  }
}
let baseFiles = baseline?.files && typeof baseline.files === "object" ? baseline.files : {};

// Cycle gate: same runtime-edge scope as scripts/perf/report-store-stats.mjs
// (top-level store modules; type-only imports do not create runtime edges).
const topStores = fs
  .readdirSync(storeDir, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.includes(".test.") && e.name !== "index.ts")
  .map((e) => e.name.replace(/\.ts$/, ""));
const storeSet = new Set(topStores);
const graph = new Map(topStores.map((name) => [name, []]));
const importRe = /import\s+(type\s+)?([\s\S]*?)from\s+["'](?:@\/store\/|\.\/)([A-Za-z0-9_]+)["']/g;
for (const name of topStores) {
  const text = fs.readFileSync(path.join(storeDir, name + ".ts"), "utf8");
  for (const match of text.matchAll(importRe)) {
    const target = match[3];
    if (target === name || !storeSet.has(target)) continue;
    const typeOnly = Boolean(match[1]) || /^\s*\{\s*type\s/.test(match[2] || "");
    if (!typeOnly) graph.get(name).push(target);
  }
}
let index = 0;
const indices = new Map();
const low = new Map();
const stack = [];
const onStack = new Set();
const cycles = [];
function connect(node) {
  indices.set(node, index);
  low.set(node, index);
  index += 1;
  stack.push(node);
  onStack.add(node);
  for (const next of graph.get(node)) {
    if (!indices.has(next)) {
      connect(next);
      low.set(node, Math.min(low.get(node), low.get(next)));
    } else if (onStack.has(next)) {
      low.set(node, Math.min(low.get(node), indices.get(next)));
    }
  }
  if (low.get(node) !== indices.get(node)) return;
  const component = [];
  let member;
  do {
    member = stack.pop();
    onStack.delete(member);
    component.push(member);
  } while (member !== node);
  if (component.length > 1) cycles.push(component.sort().join(" <-> "));
}
for (const name of topStores) if (!indices.has(name)) connect(name);

const checkViolations = [];
for (const [file, lines] of Object.entries(counts)) {
  const base = baseFiles[file];
  if (base === undefined) {
    if (lines > maxLines) checkViolations.push(file + ": " + lines + " lines > hard cap " + maxLines + " (new file)");
  } else if (lines > base) {
    checkViolations.push(file + ": " + lines + " lines > baseline " + base + " (ratchet; shrink-only)");
  }
}
let stale = Object.keys(baseFiles).filter((file) => counts[file] === undefined);
const cycleViolations = cycles.map((cycle) => "runtime store cycle: " + cycle);
if (update) {
  const updateViolations = [];
  if (baseline) {
    for (const [file, lines] of Object.entries(counts)) {
      const base = baseFiles[file];
      if (base !== undefined && lines > base) {
        updateViolations.push(file + ": " + lines + " > baseline " + base + " (--update is shrink-only)");
      } else if (base === undefined && lines > maxLines) {
        updateViolations.push(file + ": " + lines + " > hard cap " + maxLines + " (new file cannot be grandfathered)");
      }
    }
  }
  if (updateViolations.length + cycleViolations.length > 0) {
    fail(updateViolations.concat(cycleViolations));
  }
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(
    baselinePath,
    JSON.stringify({ maxLines, generatedAt: new Date().toISOString(), files: counts }, null, 2) + "\n",
  );
  console.log("[store-budgets] wrote " + rel(baselinePath) + " (" + files.length + " files)");
  baseFiles = counts;
  stale = [];
} else if (!baseline) {
  console.error("[store-budgets] missing " + rel(baselinePath) + "; run with --update first (explicit).");
  process.exit(2);
}

function fail(items) {
  console.error("[store-budgets] FAIL: " + items.length + " offender(s)");
  for (const item of items) console.error(" - " + item);
  process.exit(1);
}
if (!update && checkViolations.length + cycleViolations.length > 0) fail(checkViolations.concat(cycleViolations));

const grandfathered = Object.entries(counts).filter(([, lines]) => lines > maxLines).length;
console.log("== Store line budgets + cycles ==");
console.log("files         " + files.length + "  total lines " + totalLines + "  max " + maxLines);
console.log("baseline      " + Object.keys(baseFiles).length + " files  grandfathered " + grandfathered + "  stale " + stale.length);
console.log("cycles        SCC " + cycles.length + " (runtime store-to-store imports)");
if (stale.length > 0) console.log("stale         " + stale.join(", "));
if (grandfathered > 0) console.log("over cap      " + grandfathered + " baselined file(s) frozen above " + maxLines + " lines");
console.log("[store-budgets] PASS: " + files.length + " files within budget; SCC " + cycles.length);
