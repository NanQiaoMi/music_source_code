// S7-9a soak harness (node only, no jsdom): bounded synthetic workload per tick over
// real modules (TtlLruCache + hydrationStatus) while sampling heapUsed.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ts = createRequire(import.meta.url)("typescript");
const TS_OPTIONS = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const round2 = (v) => Math.round(v * 100) / 100;
const mb = (v, sign) => (sign && v >= 0 ? "+" : "") + v.toFixed(2) + " MB";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = () => new Date().toISOString();

// Node 20 (CI) cannot strip TS types: transpile the real modules with the existing
// typescript devDependency instead of adding a loader dependency.
async function loadTs(relative) {
  const file = path.join(ROOT, ".cache/soak", path.basename(relative).replace(".ts", ".mjs"));
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(ROOT, relative), "utf8"), {
    compilerOptions: TS_OPTIONS,
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, outputText);
  return import(pathToFileURL(file).href);
}

export const sampleHeapMb = () => process.memoryUsage().heapUsed / 1048576;

const MAX = 400;
const TTL = 15_000;
const STEP = 10_000; // virtual ms per tick, so TTL entries expire during a run
const SETS = 250;
const GETS = 400;
const LISTENERS = 16;
const STATUSES = ["hydrating", "ready", "idle", "ready"];

/** Real-module workload: bounded per tick, no retained growth outside the cache. */
export async function createWorkload() {
  const { TtlLruCache } = await loadTs("src/lib/cache/TtlLruCache.ts");
  const hydration = await loadTs("src/lib/hydrationStatus.ts");
  const initial = hydration.getHydrationStatus();
  const counters = { sets: 0, gets: 0, pruned: 0, transitions: 0 };
  let clock = 0;
  const cache = new TtlLruCache({ maxEntries: MAX, maxAgeMs: TTL, now: () => clock });
  const key = (n) => "song-" + (n % (MAX * 3));
  return {
    tick(index) {
      clock += STEP;
      counters.pruned += cache.prune();
      for (let i = 0; i < SETS; i += 1) {
        const id = key(index * MAX + i);
        cache.set(id, { url: "local://" + id, at: clock });
        counters.sets += 1;
      }
      for (let i = 0; i < GETS; i += 1) {
        cache.get(key(index * 97 + i * 13));
        counters.gets += 1;
      }
      const offs = [];
      for (let i = 0; i < LISTENERS; i += 1)
        offs.push(hydration.subscribeHydrationStatus(() => {}));
      for (const status of STATUSES) {
        hydration.setHydrationStatus(status);
        counters.transitions += 1;
      }
      for (const off of offs) off();
    },
    stats() {
      const size = cache.size();
      return {
        cache: { maxEntries: MAX, ttlMs: TTL, size, ...cache.stats() },
        hydration: {
          listeners: LISTENERS,
          transitions: counters.transitions,
          final: hydration.getHydrationStatus(),
        },
        operations: { ...counters },
      };
    },
    dispose() {
      hydration.setHydrationStatus(initial);
    },
  };
}

export function renderMarkdown(report, reportPath) {
  const m = report.memory;
  const c = report.workload?.cache ?? {};
  const o = report.workload?.operations ?? {};
  return [
    "## Soak (node synthetic harness)",
    `- ticks: ${report.ticks} (${report.durationMinutes} min @ ${report.intervalSeconds}s)`,
    `- heap start/peak/end: ${mb(m.startMB)} / ${mb(m.peakMB)} / ${mb(m.endMB)}`,
    `- heap delta: ${mb(m.deltaMB, true)} (peak ${mb(m.peakDeltaMB, true)}, threshold ${report.thresholdMb} MB)`,
    `- result: ${report.passed ? "PASS" : "FAIL"}`,
    `- operations: ${o.sets ?? 0} sets / ${o.gets ?? 0} gets / ${o.pruned ?? 0} prunes / ${o.transitions ?? 0} transitions`,
    `- cache: ${c.size ?? 0}/${c.maxEntries ?? 0}, hitRate ${((c.hitRate ?? 0) * 100).toFixed(1)}%`,
    reportPath ? `- report: ${reportPath}` : "",
  ].join("\n");
}

export function parseArgs(argv) {
  const options = { duration: 60, interval: null, threshold: 30, json: false };
  const number = (raw, name, min) => {
    if (!(Number(raw) >= min)) throw new Error("--" + name + " >= " + min + " required");
    return Number(raw);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error(arg + " requires a value");
      return value;
    };
    if (arg === "--duration") options.duration = number(next(), "duration", 0.01);
    else if (arg === "--quick") {
      const value = argv[i + 1];
      options.duration = value && !value.startsWith("--") ? number(argv[++i], "quick", 0.01) : 1;
    } else if (arg === "--interval") options.interval = number(next(), "interval", 0.1);
    else if (arg === "--threshold-mb") options.threshold = number(next(), "threshold-mb", 0);
    else if (arg === "--json") options.json = true;
    else throw new Error("unknown option: " + arg);
  }
  return options;
}

export async function runSoak({
  durationMs,
  intervalMs = 60_000,
  thresholdMb = 30,
  sampler = sampleHeapMb,
  workload,
  sleep: wait = sleep,
  now = Date.now,
  clock = iso,
} = {}) {
  if (!(durationMs > 0) || !(intervalMs > 0)) throw new Error("invalid duration/interval");
  const ticks = Math.max(1, Math.round(durationMs / intervalMs));
  const active = workload ?? (await createWorkload());
  const startedAt = now();
  const startMB = round2(sampler());
  const samples = [];
  let stats = {};
  try {
    for (let i = 0; i < ticks; i += 1) {
      await wait(intervalMs);
      active.tick(i);
      const heapMB = round2(sampler());
      samples.push({ tick: i + 1, at: clock(), elapsedMs: now() - startedAt, heapMB });
    }
    stats = active.stats?.() ?? {};
  } finally {
    active.dispose?.();
  }
  const peakMB = round2(Math.max(startMB, ...samples.map((s) => s.heapMB)));
  const endMB = samples.at(-1)?.heapMB ?? startMB;
  const memory = {
    startMB,
    peakMB,
    endMB,
    deltaMB: round2(endMB - startMB),
    peakDeltaMB: round2(peakMB - startMB),
  };
  return {
    generatedAt: clock(),
    durationMinutes: round2(durationMs / 60_000),
    intervalSeconds: round2(intervalMs / 1000),
    ticks: samples.length,
    memory,
    thresholdMb,
    passed: memory.deltaMB <= thresholdMb,
    workload: stats,
    samples,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const interval = options.interval ?? Math.min(60, Math.max(1, Math.round(options.duration)));
  const report = await runSoak({
    durationMs: options.duration * 60_000,
    intervalMs: interval * 1000,
    thresholdMb: options.threshold,
  });
  const out = path.resolve("perf", "reports", "soak-" + iso().replace(/[:.]/g, "-") + ".json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  const shown = path.relative(ROOT, out).replaceAll("\\", "/");
  console.log(options.json ? JSON.stringify(report, null, 2) : renderMarkdown(report, shown));
  if (!report.passed) {
    console.error(`[soak] FAIL heap delta ${report.memory.deltaMB} MB > ${report.thresholdMb} MB`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[soak] " + error.message);
    process.exitCode = 2;
  });
}
