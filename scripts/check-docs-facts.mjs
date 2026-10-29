#!/usr/bin/env node
// Docs fact checks: store counts, stale claims, CI branches, ports, index links, execution pack presence.
// Usage: node scripts/check-docs-facts.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const results = [];
function add(id, level, ok, detail) {
  results.push({ id, level, ok, detail });
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const storeFiles = fs
  .readdirSync(path.join(ROOT, "src", "store"), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.includes(".test.") && e.name !== "index.ts");
const storeCount = storeFiles.length;

const agents = read("AGENTS.md");
const arch = read("docs/nbl/ARCHITECTURE.md");

const mentioned = [];
for (const text of [agents, arch]) {
  const res = [
    /(\d+)\s*个\s*Zustand\s*Store/gi,
    /实际\s*\*\*(\d+)\s*个 store/gi,
    /Zustand\s+(\d+)\s+stores/gi,
  ];
  for (const re of res) {
    let m;
    while ((m = re.exec(text))) mentioned.push(Number(m[1]));
  }
}
const wrongCounts = [...new Set(mentioned.filter((n) => n !== storeCount))];
add("store-count", "FAIL", wrongCounts.length === 0, "actual=" + storeCount + " documented=" + JSON.stringify([...new Set(mentioned)]) + " wrong=" + JSON.stringify(wrongCounts));

const forbidden = [
  { token: "19,790", why: "旧 ESLint 问题数已清零" },
  { token: "测试步骤被注释", why: "CI 已复活并包含测试步骤" },
  { token: "44 个 Zustand Store", why: "实际 60 个 store" },
];
for (const f of forbidden) {
  const hits = [];
  if (agents.includes(f.token)) hits.push("AGENTS.md");
  if (arch.includes(f.token)) hits.push("ARCHITECTURE.md");
  add("stale:" + f.token, "FAIL", hits.length === 0, f.why + " hits=" + JSON.stringify(hits));
}

const workflowDir = path.join(ROOT, ".github", "workflows");
const workflowFiles = fs.existsSync(workflowDir) ? fs.readdirSync(workflowDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")) : [];
let hasMaster = false;
let hasMainOnly = false;
for (const f of workflowFiles) {
  const text = read(path.join(".github", "workflows", f));
  if (/branches:\s*\[[^\]]*master/.test(text) || /-\s*master\b/.test(text)) hasMaster = true;
  if (/-\s*main\b/.test(text) && !/-\s*master\b/.test(text)) hasMainOnly = true;
}
add("ci-branch", "FAIL", hasMaster && !hasMainOnly, "workflows=" + JSON.stringify(workflowFiles) + " master=" + hasMaster + " mainOnly=" + hasMainOnly);

let ports = [];
try {
  const pkg = JSON.parse(read("package.json"));
  const dev = (pkg.scripts.dev || "").match(/(?:-p|--port)[= ](\d{4})/);
  const start = (pkg.scripts.start || "").match(/(?:-p|--port)[= ](\d{4})/);
  ports.push({ file: "package.json dev", port: dev ? Number(dev[1]) : null });
  ports.push({ file: "package.json start", port: start ? Number(start[1]) : null });
} catch (e) {
  ports.push({ file: "package.json", port: null });
}
// S0-5：部署描述符已迁到 deploy/，根目录与 deploy/ 两处都认（兼容旧检出）
const dockerfilePath = ["Dockerfile", "deploy/Dockerfile"].find((p) => exists(p));
if (dockerfilePath) {
  const docker = read(dockerfilePath);
  const expose = docker.match(/EXPOSE\s+(\d+)/);
  const env = docker.match(/ENV\s+PORT\s*=\s*(\d+)/);
  ports.push({ file: dockerfilePath + " EXPOSE", port: expose ? Number(expose[1]) : null });
  ports.push({ file: dockerfilePath + " ENV PORT", port: env ? Number(env[1]) : null });
}
const composePath = ["docker-compose.yml", "deploy/docker-compose.yml"].find((p) => exists(p));
if (composePath) {
  const compose = read(composePath);
  const pm = compose.match(/["']?(\d{4}):(\d{4})["']?/);
  ports.push({ file: composePath + " mapping", port: pm ? Number(pm[1]) : null });
}
const portValues = ports.map((p) => p.port).filter((p) => p !== null);
const portConsistent = portValues.length > 0 && portValues.every((p) => p === portValues[0]);
add("ports", "WARN", portConsistent, JSON.stringify(ports));

const index = read("docs/nbl/plans/INDEX.md");
const linkRe = /\]\((\.{0,2}\/[^)\s]+\.md)\)/g;
const broken = [];
let lm;
while ((lm = linkRe.exec(index))) {
  const target = path.resolve(path.join(ROOT, "docs", "nbl", "plans"), lm[1]);
  if (!fs.existsSync(target)) broken.push(lm[1]);
}
add("index-links", "FAIL", broken.length === 0, "broken=" + JSON.stringify(broken));

const packFiles = [
  "docs/nbl/plans/2026-10-21-arch-perf-execution/README.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/TRACKING.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/00-decisions.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S0-baseline.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S1-data-playback.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S2-audio-persistence.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S3-shell-subscriptions.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S4-bundle-loading.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S5-render-runtime.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S6-state-architecture.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S7-platform-runtime.md",
  "docs/nbl/plans/2026-10-21-arch-perf-execution/S8-quality-governance.md",
];
const missingPack = packFiles.filter((p) => !exists(p));
add("execution-pack", "FAIL", missingPack.length === 0, "missing=" + JSON.stringify(missingPack));

const fails = results.filter((r) => r.level === "FAIL" && !r.ok);
const warns = results.filter((r) => r.level === "WARN" && !r.ok);
for (const r of results) {
  const status = r.ok ? "PASS" : r.level;
  console.log("[" + status + "] " + r.id + " :: " + r.detail);
}
console.log("== docs-facts: fail=" + fails.length + " warn=" + warns.length + " ==");
if (fails.length > 0) process.exit(1);
