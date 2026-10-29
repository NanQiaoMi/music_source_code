/**
 * S7-9a OPFS 50MB audio benchmark (Playwright + installed Chrome, headless).
 *
 * Measures, inside the page: build a 50MB PCM16 WAV in memory (header + zeroed
 * silence), write it to OPFS (createWritable), read it back (getFile/arrayBuffer),
 * then decode it with AudioContext.decodeAudioData (proxy for "start playback").
 * PerformanceObserver('longtask') records >50ms tasks per phase and
 * performance.memory (when exposed) records heap.
 *
 * WAV is a PROXY: there is no 50MB FLAC fixture and no in-page FLAC decoder (FLAC
 * runs through ffmpeg.wasm in a worker, S7-3), so no "50MB FLAC start" number is
 * produced or claimed here.
 *
 * Without --base-url the script starts its own dev server on port 3039
 * (node node_modules/next/dist/bin/next dev --webpack -p 3039) and kills it at
 * the end. It measures on a same-origin JSON route so React/rAF noise from the
 * app shell cannot pollute the long-task samples.
 *
 * Usage: node scripts/perf/bench-opfs.mjs [--quick] [--base-url=http://host:port]
 * Output: perf/opfs-bench-<ts>.json + perf/opfs-bench-report.md
 * Exit: 0 measured, 2 OPFS/audio unsupported (reason recorded, nothing faked).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = 3039;
const PAGE = "/api/sources/builtin";
const CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FULL_BYTES = 50 * 1024 * 1024;
const QUICK_BYTES = 10 * 1024 * 1024;
const READS = 3;
const TIMEOUT_MS = 300000;
const REPORT = "opfs-bench-report.md";
const round2 = (value) => Math.round(value * 100) / 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function parseArgs(argv) {
  const options = { baseUrl: null, quick: false, help: false };
  for (const arg of argv) {
    if (arg === "--quick") options.quick = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice(11).replace(/\/$/, "");
    else throw new Error("Unknown argument: " + arg);
  }
  return options;
}

/** In-page benchmark. Playwright serializes this function: no Node closures. */
export async function runInPage({ bytes, reads, dirName }) {
  const round = (n) => Math.round(n * 100) / 100;
  const heap = () =>
    typeof performance !== "undefined" && performance.memory
      ? round(performance.memory.usedJSHeapSize / 1048576)
      : null;
  const support = {
    opfs: typeof navigator.storage?.getDirectory === "function",
    audio:
      typeof AudioContext === "function" &&
      typeof AudioContext.prototype.decodeAudioData === "function",
    longTask:
      typeof PerformanceObserver === "function" &&
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes("longtask"),
    memory: heap() !== null,
  };
  if (!support.opfs) {
    return {
      support,
      blocked: { code: "opfs-unsupported", message: "navigator.storage.getDirectory is missing" },
      phases: [],
      wav: null,
      decode: null,
      detachedOnWrite: null,
      heap: { startMB: heap(), endMB: heap(), peakMB: heap() },
    };
  }
  const durations = [];
  const observer = support.longTask
    ? new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) durations.push(entry.duration);
      })
    : null;
  if (observer) observer.observe({ entryTypes: ["longtask"] });
  const heapStartMB = heap();
  const phases = [];
  let blocked = null;
  let wav = null;
  let decode = null;
  let audioContext = null;
  let detachedOnWrite = null;
  const makeWav = () => {
    const buffer = new ArrayBuffer(bytes);
    const view = new DataView(buffer);
    const dataBytes = Math.floor((bytes - 44) / 4) * 4;
    const ascii = (offset, text) => {
      for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index));
      }
    };
    ascii(0, "RIFF");
    view.setUint32(4, 36 + dataBytes, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, 44100, true);
    view.setUint32(28, 176400, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    ascii(36, "data");
    view.setUint32(40, dataBytes, true);
    return { buffer, dataBytes, seconds: round(dataBytes / 176400) };
  };
  const phase = async (name, fn) => {
    const started = performance.now();
    let value = null;
    let error = null;
    try {
      value = await fn();
    } catch (caught) {
      error = caught && caught.message ? caught.message : String(caught);
    }
    const durationMs = performance.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 80)); // let longtask entries flush
    const batch = durations.splice(0);
    phases.push({
      name,
      durationMs: round(durationMs),
      error,
      longTaskCount: batch.length,
      longTaskMaxMs: batch.length ? round(Math.max(...batch)) : 0,
      heapMB: heap(),
    });
    if (error) throw new Error(name + ": " + error);
    return value;
  };
  let dir = null;
  try {
    wav = await phase("generate-wav", async () => makeWav());
    dir = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle(dirName, {
      create: true,
    });
    const handle = await dir.getFileHandle("bench.wav", { create: true });
    await phase("opfs-write", async () => {
      const writable = await handle.createWritable();
      await writable.write(wav.buffer);
      await writable.close();
      detachedOnWrite = wav.buffer.byteLength === 0;
    });
    let last = null;
    for (let index = 0; index < reads; index += 1) {
      last = await phase("opfs-read-" + (index + 1), async () =>
        (await handle.getFile()).arrayBuffer()
      );
    }
    if (!support.audio) {
      blocked = { code: "audio-decode-unsupported", message: "decodeAudioData is missing" };
    } else {
      // The app already owns a live AudioContext before playback, so context
      // construction is measured separately and excluded from the start cost.
      audioContext = await phase("create-audio-context", async () => new AudioContext());
      decode = await phase("decode-audio", async () => {
        const audio = await audioContext.decodeAudioData(last);
        return {
          durationSec: round(audio.duration),
          sampleRate: audio.sampleRate,
          channels: audio.numberOfChannels,
          frames: audio.length,
        };
      });
    }
  } catch (error) {
    blocked = {
      code: "phase-failed",
      message: error && error.message ? error.message : String(error),
    };
  } finally {
    if (observer) observer.disconnect();
    if (audioContext) await audioContext.close().catch(() => {});
    try {
      if (dir) await dir.removeEntry("bench.wav");
    } catch {
      // best-effort cleanup
    }
  }
  const heaps = [heapStartMB, ...phases.map((entry) => entry.heapMB), heap()].filter(
    (value) => value !== null
  );
  return {
    support,
    blocked,
    wav: wav && { bytes, dataBytes: wav.dataBytes, durationSec: wav.seconds },
    phases,
    decode,
    detachedOnWrite,
    heap: {
      startMB: heapStartMB,
      endMB: heap(),
      peakMB: heaps.length ? Math.max(...heaps) : null,
    },
  };
}

export function summarize(result) {
  const reads = result.phases.filter((entry) => entry.name.startsWith("opfs-read-"));
  const write = result.phases.find((entry) => entry.name === "opfs-write") ?? null;
  const decode = result.phases.find((entry) => entry.name === "decode-audio") ?? null;
  const readMs = reads.map((entry) => entry.durationMs);
  const sorted = [...readMs].sort((a, b) => a - b);
  const startupLongTaskMs = Math.max(
    decode?.longTaskMaxMs ?? 0,
    ...reads.map((entry) => entry.longTaskMaxMs)
  );
  return {
    writeMs: write ? write.durationMs : null,
    readMs,
    readMedianMs: sorted.length ? round2(sorted[Math.floor(sorted.length / 2)]) : null,
    decodeMs: decode ? decode.durationMs : null,
    decodeLongTaskMaxMs: decode ? decode.longTaskMaxMs : null,
    startupLongTaskMs,
    startupUnder100ms: result.blocked ? null : startupLongTaskMs < 100,
  };
}

export function evaluate(result) {
  const summary = summarize(result);
  const write = result.phases.find((entry) => entry.name === "opfs-write") ?? null;
  const checks = [
    {
      id: "opfs-available",
      pass: Boolean(result.support?.opfs) && !result.blocked,
      detail: result.blocked
        ? result.blocked.code + ": " + result.blocked.message
        : "OPFS write/read completed",
    },
    {
      id: "startup-long-task-under-100ms",
      pass: summary.startupUnder100ms === true,
      detail:
        "max long task across read+decode = " + summary.startupLongTaskMs + "ms (target <100ms)",
    },
    {
      id: "opfs-write-under-50ms-task",
      pass: Boolean(write) && write.longTaskMaxMs < 50,
      detail: "write max long task = " + (write ? write.longTaskMaxMs : "n/a") + "ms",
    },
  ];
  return { summary, checks, met: checks.every((check) => check.pass) };
}

export function renderReport({ result, verdict, meta, jsonFile }) {
  const code = String.fromCharCode(96);
  const fence = code + code + code;
  const table = (head, rows) =>
    [head, head.map(() => "---"), ...rows].map((row) => "| " + row.join(" | ") + " |").join("\n");
  const s = verdict.summary;
  const lines = [
    "# S7-9a OPFS 50MB audio benchmark",
    "",
    "> Generated by " + code + "npm run perf:opfs-bench" + code + " (" + meta.command + ").",
    "> Fixture is **WAV PCM16 44.1kHz stereo**, not FLAC - see Gaps.",
    "",
    "## Environment",
    "",
    table(
      ["item", "value"],
      [
        ["capturedAt", meta.startedAt],
        ["branch / commit", meta.git.branch + " / " + meta.git.commit],
        ["baseUrl", meta.baseUrl],
        ["page", meta.page],
        ["Chrome", meta.browser + " (headless)"],
        ["Node / Playwright", meta.runtime.node + " / " + meta.runtime.playwright],
        ["platform", meta.runtime.platform],
        [
          "fixture",
          result.wav ? result.wav.bytes + " bytes / " + result.wav.durationSec + "s audio" : "n/a",
        ],
        ["support", JSON.stringify(result.support)],
      ]
    ),
    "",
    "## Phases (in-browser)",
    "",
    table(
      ["phase", "duration (ms)", "long tasks", "max long task (ms)", "heap after (MB)"],
      result.phases.map((entry) => [
        entry.name,
        entry.durationMs,
        entry.longTaskCount,
        entry.longTaskMaxMs,
        entry.heapMB ?? "-",
      ])
    ),
    "",
    "## Verdict",
    "",
    table(
      ["check", "result", "detail"],
      verdict.checks.map((check) => [check.id, check.pass ? "PASS" : "FAIL", check.detail])
    ),
    "",
    "- OPFS write: **" +
      (s.writeMs ?? "n/a") +
      " ms** (single sample; buffer detached by write: " +
      String(result.detachedOnWrite) +
      ")",
    "- OPFS read: **" +
      (s.readMs.length ? s.readMs.join(" / ") + " ms" : "n/a") +
      "** (median " +
      (s.readMedianMs ?? "n/a") +
      " ms, " +
      s.readMs.length +
      " samples)",
    "- decodeAudioData (start proxy): **" +
      (s.decodeMs ?? "n/a") +
      " ms**, decode long task max **" +
      (s.decodeLongTaskMaxMs ?? "n/a") +
      " ms**",
    "- Startup long task (max of read+decode): **" +
      s.startupLongTaskMs +
      " ms** -> " +
      (s.startupUnder100ms === true
        ? "<100ms PASS"
        : s.startupUnder100ms === false
          ? ">=100ms FAIL"
          : "not measured"),
    "- Heap: start " +
      (result.heap.startMB ?? "n/a") +
      " MB / peak " +
      (result.heap.peakMB ?? "n/a") +
      " MB / end " +
      (result.heap.endMB ?? "n/a") +
      " MB" +
      (result.support.memory ? "" : " (performance.memory unavailable)"),
    result.blocked
      ? "- **Blocked**: " + result.blocked.code + " - " + result.blocked.message
      : "- No blockers: OPFS and audio decode both ran.",
    "",
    "## Gaps (recorded, not claimed)",
    "",
    "- **No 50MB FLAC measurement**: no 50MB FLAC fixture and no in-page FLAC decoder exist; production FLAC decoding is ffmpeg.wasm inside a worker (S7-3), which this page cannot invoke. WAV PCM16 is the proxy.",
    "- OPFS numbers are raw OPFS API calls mirroring " +
      code +
      "src/lib/storage/opfsAudioStore.ts" +
      code +
      " (feature-flagged, not bundled into any route): this measures the storage primitive, not a wired playback path.",
    "- Headless Chrome: no audio device, single machine, warm page; absolute numbers are indicative, the long-task verdict is the portable result.",
    "- " +
      code +
      "performance.memory" +
      code +
      " is Chrome-only and bucketized; heap columns are coarse.",
    "",
    "## Reproduce",
    "",
    fence + "bash",
    "node scripts/perf/bench-opfs.mjs            # starts its own dev server on 3039",
    "node scripts/perf/bench-opfs.mjs --quick    # 10MB smoke",
    fence,
    "",
    "Raw JSON: " + code + jsonFile + code + ".",
  ];
  return lines.join("\n") + "\n";
}

function packageVersion(name) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve("node_modules", name, "package.json"), "utf8"))
      .version;
  } catch {
    return null;
  }
}

function gitValue(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

async function portAnswers(url, timeoutMs = 2000) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })).status < 500;
  } catch {
    return false;
  }
}

async function startDevServer(timeoutMs) {
  const log = [];
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    }
  );
  const collect = (chunk) => {
    log.push(String(chunk));
    if (log.length > 200) log.shift();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  const stop = () =>
    new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      if (process.platform === "win32") {
        try {
          execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } catch {
          child.kill();
        }
      } else {
        child.kill("SIGTERM");
      }
      setTimeout(resolve, 8000).unref();
    });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("next dev exited with " + child.exitCode + ": " + log.slice(-6).join(""));
    }
    if (await portAnswers("http://127.0.0.1:" + PORT + PAGE, 15000)) return { stop };
    await sleep(1000);
  }
  await stop();
  throw new Error(
    "next dev did not answer on port " +
      PORT +
      " within " +
      timeoutMs +
      "ms: " +
      log.slice(-6).join("")
  );
}

function usage() {
  console.log(
    [
      "Usage: node scripts/perf/bench-opfs.mjs [options]",
      "",
      "  --base-url=<url>  reuse an existing dev server (default: start one on " + PORT + ")",
      "  --quick           10MB smoke instead of 50MB",
      "  --help            show this help",
    ].join("\n")
  );
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    usage();
    return 0;
  }
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error("Chrome not found at " + CHROME_PATH + " (set CHROME_PATH)");
  }
  const bytes = options.quick ? QUICK_BYTES : FULL_BYTES;
  const startedAt = new Date().toISOString();
  const outDir = path.resolve("perf");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonFile = path.join(
    outDir,
    "opfs-bench-" + startedAt.replace(/\.\d+Z$/, "").replace(/:/g, "-") + ".json"
  );
  let server = null;
  let baseUrl = options.baseUrl;
  if (!baseUrl) {
    if (await portAnswers("http://127.0.0.1:" + PORT + PAGE)) {
      throw new Error("port " + PORT + " is already serving; pass --base-url=<url>");
    }
    console.log("[opfs] starting dev server on " + PORT + " ...");
    server = await startDevServer(TIMEOUT_MS);
    baseUrl = "http://127.0.0.1:" + PORT;
  }

  const { chromium } = await import(/* @vite-ignore */ "playwright");
  const browser = await chromium.launch({
    channel: "chrome",
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  });
  const browserVersion = browser.version();
  let result;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(baseUrl + PAGE, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForTimeout(1000);
    result = await page.evaluate(runInPage, { bytes, reads: READS, dirName: "mimi-audio-bench" });
    result.pageErrors = pageErrors;
    await context.close();
  } finally {
    await browser.close().catch(() => {});
    if (server) {
      await server.stop();
      console.log("[opfs] dev server stopped");
    }
  }

  const meta = {
    startedAt,
    command: "node scripts/perf/bench-opfs.mjs" + (options.quick ? " --quick" : ""),
    baseUrl,
    page: PAGE,
    bytes,
    reads: READS,
    git: {
      branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
      commit: gitValue(["rev-parse", "HEAD"]),
    },
    browser: "Chrome " + browserVersion,
    runtime: {
      node: process.version,
      playwright: packageVersion("playwright"),
      platform:
        os.platform() +
        " " +
        os.release() +
        " / " +
        (os.cpus()[0]?.model ?? "unknown CPU") +
        " / " +
        Math.round(os.totalmem() / 1024 / 1024 / 1024) +
        "GB",
    },
  };
  const verdict = evaluate(result);
  fs.writeFileSync(jsonFile, JSON.stringify({ meta, result, verdict }, null, 2) + "\n");
  fs.writeFileSync(
    path.join(outDir, REPORT),
    renderReport({
      result,
      verdict,
      meta,
      jsonFile: path.relative(process.cwd(), jsonFile).replace(/\\/g, "/"),
    })
  );
  console.log(
    "[opfs] write=" +
      verdict.summary.writeMs +
      "ms read=" +
      JSON.stringify(verdict.summary.readMs) +
      " decode=" +
      verdict.summary.decodeMs +
      "ms startupLongTask=" +
      verdict.summary.startupLongTaskMs +
      "ms"
  );
  console.log("[opfs] report: " + path.join("perf", REPORT));
  if (result.blocked) {
    console.error("[opfs] BLOCKED " + result.blocked.code + ": " + result.blocked.message);
    return 2;
  }
  console.log(
    "[opfs] checks: " +
      verdict.checks.map((check) => check.id + "=" + (check.pass ? "PASS" : "FAIL")).join(", ")
  );
  return 0;
}

let isMain = false;
try {
  isMain =
    Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
} catch {
  isMain = false;
}
if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error("[opfs] " + (error && error.stack ? error.stack : String(error)));
      process.exitCode = 1;
    });
}
