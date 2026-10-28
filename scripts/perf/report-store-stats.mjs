#!/usr/bin/env node
// Store architecture stats: store count, persist keys, whole-store subscriptions, store graph, getState by layer.
// Usage: node scripts/perf/report-store-stats.mjs [--check] [--max-whole <n>] [--json <path>] [--store <useXStore>]
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const STORE_DIR = path.join(SRC, "store");
const BASELINE_FILE = path.join(ROOT, "perf", "store-stats-baseline.json");
const args = process.argv.slice(2);
const check = args.includes("--check");
const jsonIdx = args.indexOf("--json");
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
const storeIdx = args.indexOf("--store");
const storeFilter = storeIdx >= 0 ? args[storeIdx + 1] : null;
const maxWholeIdx = args.indexOf("--max-whole");
const maxWhole = maxWholeIdx >= 0 ? Number(args[maxWholeIdx + 1]) : null;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}
function isSource(p) {
  return (p.endsWith(".ts") || p.endsWith(".tsx")) && !p.includes(".test.") && !p.includes(".spec.");
}

const files = walk(SRC, []).filter(isSource);

const constantMap = new Map();
const constRe = /(?:export\s+)?const\s+([A-Z][A-Z0-9_]+)\s*=\s*["']([^"']+)["']/g;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let cm;
  while ((cm = constRe.exec(text))) constantMap.set(cm[1], cm[2]);
}
const storeModules = fs
  .readdirSync(STORE_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.includes(".test.") && e.name !== "index.ts")
  .map((e) => e.name.replace(/\.ts$/, ""));

function collectPersistNames(fileName, text) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const names = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "persist") {
      const options = node.arguments[1];
      const nameNode = options && ts.isObjectLiteralExpression(options)
        ? options.properties.find((property) => property.name?.getText(source) === "name")
        : undefined;
      const initializer = nameNode?.initializer;
      if (initializer && (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))) {
        names.push(initializer.text);
      } else if (initializer && ts.isIdentifier(initializer) && constantMap.has(initializer.text)) {
        names.push(constantMap.get(initializer.text));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

const storeModuleSet = new Set(storeModules);
const persistKeys = [];
const edgesAll = new Set();
const edgesRuntime = new Set();
for (const name of storeModules) {
  const p = path.join(STORE_DIR, name + ".ts");
  const text = fs.readFileSync(p, "utf8");
  persistKeys.push(...collectPersistNames(name + ".ts", text));
  const importRe = /import\s+(type\s+)?([\s\S]*?)from\s+["'](?:@\/store\/|\.\/)([A-Za-z0-9_]+)["']/g;
  let im;
  while ((im = importRe.exec(text))) {
    const target = im[3];
    if (target === name || !storeModuleSet.has(target)) continue;
    const label = name + " -> " + target;
    edgesAll.add(label);
    const isTypeOnly = Boolean(im[1]) || /^\s*\{\s*type\s/.test(im[2] || "");
    if (!isTypeOnly) edgesRuntime.add(label);
  }
}

const adjacency = new Map();
for (const node of storeModules) adjacency.set(node, []);
for (const e of edgesRuntime) {
  const parts = e.split(" -> ");
  if (adjacency.has(parts[0]) && adjacency.has(parts[1])) adjacency.get(parts[0]).push(parts[1]);
}
function countScc(adj) {
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  let scc = 0;
  function strong(v) {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) || []) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }
    if (low.get(v) === idx.get(v)) {
      let w;
      const component = [];
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) scc += 1;
    }
  }
  for (const v of adj.keys()) if (!idx.has(v)) strong(v);
  return scc;
}

let whole = 0;
let selector = 0;
let wholeOnlyFiles = 0;
const wholeByFile = {};
const wholeByStore = {};
for (const p of files) {
  const text = fs.readFileSync(p, "utf8");
  const wholeRe = /use([A-Z][A-Za-z0-9_]*)Store\(\s*\)/g;
  const anyRe = /use([A-Z][A-Za-z0-9_]*)Store\(/g;
  let wholeCount = 0;
  let anyCount = 0;
  let m;
  while ((m = wholeRe.exec(text))) {
    wholeCount += 1;
    const storeName = `use${m[1]}Store`;
    wholeByStore[storeName] = (wholeByStore[storeName] || 0) + 1;
  }
  while ((m = anyRe.exec(text))) anyCount += 1;
  if (wholeCount > 0) {
    whole += wholeCount;
    wholeByFile[rel(p)] = wholeCount;
  }
  selector += Math.max(0, anyCount - wholeCount);
  if (wholeCount > 0 && anyCount === wholeCount) wholeOnlyFiles += 1;
}

const getStateByLayer = {};
for (const p of files) {
  const text = fs.readFileSync(p, "utf8");
  const count = (text.match(/use[A-Z][A-Za-z0-9_]*Store\.getState\(/g) || []).length;
  if (count === 0) continue;
  const r = rel(p);
  const layer = r.split("/")[1] || "src";
  getStateByLayer[layer] = (getStateByLayer[layer] || 0) + count;
}

const registryKeys = [...fs.readFileSync(path.join(SRC, "lib", "storage", "storageRegistry.ts"), "utf8").matchAll(/^\s*key:\s*"([^"]+)"/gm)].map((m) => m[1]);
const uniquePersistKeys = [...new Set(persistKeys)];
const missingFromRegistry = uniquePersistKeys.filter((key) => !registryKeys.includes(key));
const unregisteredKeys = registryKeys.filter((key) => !uniquePersistKeys.includes(key));

const result = {
  generatedAt: new Date().toISOString(),
  storageRegistry: {
    keys: registryKeys.length,
    persisted: uniquePersistKeys.length,
    registered: uniquePersistKeys.length - missingFromRegistry.length,
    coverage: uniquePersistKeys.length - missingFromRegistry.length + "/" + uniquePersistKeys.length,
    missing: missingFromRegistry.sort(),
    unregistered: unregisteredKeys.sort(),
  },
  stores: {
    count: storeModules.length,
    names: storeModules.slice().sort(),
    persistCount: persistKeys.length,
    persistKeys: persistKeys.slice().sort(),
  },
  subscriptions: {
    totalCalls: whole + selector,
    wholeCalls: whole,
    selectorCalls: selector,
    wholeOnlyFiles,
    wholeRatioPct: Math.round((whole / Math.max(1, whole + selector)) * 1000) / 10,
    wholeByStore: Object.fromEntries(Object.entries(wholeByStore).sort((a, b) => b[1] - a[1])),
    topWholeFiles: Object.entries(wholeByFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15),
  },
  storeGraph: {
    edges: edgesRuntime.size,
    edgesAllStatic: edgesAll.size,
    edgeList: [...edgesRuntime].sort(),
    sccCount: countScc(adjacency),
  },
  getStateByLayer,
};

console.log("== Store architecture stats ==");
console.log("stores        " + result.stores.count + "  persist keys " + result.stores.persistCount);
console.log("registry      " + result.storageRegistry.coverage + " persisted keys registered");
console.log("subscriptions " + result.subscriptions.totalCalls + " calls: whole " + whole + " (" + result.subscriptions.wholeRatioPct + "%), selector " + selector + ", whole-only files " + wholeOnlyFiles);
console.log("store graph   " + result.storeGraph.edges + " edges, SCC " + result.storeGraph.sccCount);
console.log("getState      " + JSON.stringify(getStateByLayer));
console.log("top whole     " + result.subscriptions.topWholeFiles.slice(0, 5).map((x) => x[0] + ":" + x[1]).join(", "));
if (storeFilter) {
  console.log("store whole   " + storeFilter + ": " + (wholeByStore[storeFilter] || 0));
}

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2) + "\n");
  console.log("[store-stats] wrote " + jsonOut);
}

if (maxWhole !== null) {
  if (!Number.isFinite(maxWhole) || maxWhole < 0) {
    console.error("[store-stats] --max-whole needs a non-negative number");
    process.exit(2);
  }
  if (whole > maxWhole) {
    console.error("[store-stats] FAIL: wholeCalls " + whole + " > budget " + maxWhole);
    process.exit(1);
  }
  console.log("[store-stats] OK: wholeCalls " + whole + " <= " + maxWhole);
}

if (check) {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error("[store-stats] missing " + rel(BASELINE_FILE) + "; run with --json " + rel(BASELINE_FILE) + " first.");
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
  const fails = [];
  if (result.stores.count !== base.stores.count) fails.push("stores " + result.stores.count + " != baseline " + base.stores.count);
  if (result.subscriptions.wholeCalls > base.subscriptions.wholeCalls) fails.push("wholeCalls " + result.subscriptions.wholeCalls + " > baseline " + base.subscriptions.wholeCalls);
  if (result.storeGraph.edges > base.storeGraph.edges) fails.push("storeEdges " + result.storeGraph.edges + " > baseline " + base.storeGraph.edges);
  if (result.stores.persistCount < base.stores.persistCount) fails.push("persistCount " + result.stores.persistCount + " < baseline " + base.stores.persistCount);
  if (missingFromRegistry.length > 0) fails.push("persist keys missing from registry: " + missingFromRegistry.join(","));
  if (unregisteredKeys.length > 0) fails.push("registry keys without persist config: " + unregisteredKeys.join(","));
  if (fails.length > 0) {
    console.error("[store-stats] FAIL: " + fails.join("; "));
    process.exit(1);
  }
  console.log("[store-stats] OK (not worse than baseline)");
}
