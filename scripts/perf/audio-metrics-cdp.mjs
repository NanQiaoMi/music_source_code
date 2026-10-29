#!/usr/bin/env node
/**
 * S2-6 browser audio-metrics capture (Playwright + local Chrome).
 *
 * Reuses the dev-only probe window.__audioMetrics (src/lib/perf/audioMetrics.ts) and
 * window.__audioGraphStats (src/lib/audio/audioGraphStats.ts), sampling every 5s:
 *
 *   idle          no playback (fresh profile, Home view) 60s
 *   play          silent 100s WAV playing (blob: URL, loopMode=single) 60s
 *   track-switch  playing, then 3 next-track + 2 progress seek actions, then 60s
 *
 * The Player view is opened with display-only localStorage fixtures (the S3-2
 * technique): ui-store-v2 sets currentView=player, player-store seeds currentSong
 * with an inline silent WAV (source=local, no network), queue-store-v5 seeds a
 * 5-song queue so next-track works. No application code is changed.
 *
 * Usage:
 *   node node_modules/next/dist/bin/next dev --webpack -p 3038
 *   node scripts/perf/audio-metrics-cdp.mjs                    # 3 scenarios x 60s
 *   node scripts/perf/audio-metrics-cdp.mjs --quick            # smoke: 3 x 5s, 1s interval
 *   node scripts/perf/audio-metrics-cdp.mjs --scenario play --duration 60
 *
 * Output:
 *   perf/audio-metrics/s2-6-<scenario>.json   raw samples + aggregates per scenario
 *   perf/audio-metrics/s2-6-report.md         combined report + acceptance verdict
 *
 * When the probe or the play control is unavailable nothing is fabricated: the
 * scenario is written as blocked with the exact reason and the process exits 2.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const DEFAULT_BASE_URL = process.env.S2_6_BASE_URL || "http://127.0.0.1:3038";
export const DEFAULT_OUT_DIR = "perf/audio-metrics";
export const DEFAULT_CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const DEFAULT_DURATION_SEC = 60;
export const DEFAULT_QUICK_DURATION_SEC = 5;
export const DEFAULT_INTERVAL_MS = 5000;
export const DEFAULT_QUICK_INTERVAL_MS = 1000;
export const DEFAULT_TIMEOUT_MS = 180000;
export const SETTLE_MS = 6000;
export const PROBE_TIMEOUT_MS = 90000;
export const PLAYBACK_TIMEOUT_MS = 25000;
export const VIEWPORT = { width: 1440, height: 900 };

export const PLAY_CONTROL_SELECTOR = 'button[title="播放"], button[title="暂停"]';
export const PLAYING_CONTROL_SELECTOR = 'button[title="暂停"]';
export const PROGRESS_SLIDER_SELECTOR = '[role="slider"][aria-label="音频播放进度"]';
export const QUEUE_STORAGE_KEY = "queue-store-v5";
/** S2-4 scope: the two playback persist keys (throttled to <=1 write/s combined). */
export const PLAYBACK_STORAGE_KEYS = ["player-store", "audio-store-v4"];
export const TICK = String.fromCharCode(96);

const SCENARIO_IDS = ["idle", "play", "track-switch"];

const THEME_COLORS = {
  primary: "rgb(55, 65, 81)",
  secondary: "rgb(31, 41, 55)",
  accent: "rgb(75, 85, 99)",
  complementary: "rgb(30, 41, 59)",
  background: "rgb(8, 9, 12)",
  surface: "rgb(15, 17, 23)",
  gradient: ["rgb(55, 65, 81)", "rgb(31, 41, 55)", "rgb(75, 85, 99)"],
  text: "rgb(255, 255, 255)",
  textMuted: "rgba(255, 255, 255, 0.6)",
};

const DEMO_LYRICS = [
  "[00:00.00]S2-6 silent sample",
  "[00:01.00]browser audio metrics fixture",
  "[00:02.50]no real audio content",
  "[00:04.00]loopMode=single keeps 60s playback continuous",
].join("\n");

/**
 * Silent WAV length for the fixture. Must stay above the app's 95s trial-snippet
 * threshold (useAudioPlayer auto-rescues anything <= 95s, which would add network
 * noise and a long task). 100s at 8kHz/8-bit is a ~800KB Blob built in-page once;
 * the blob URL string is short, so localStorage stays tiny.
 */
export const SILENT_WAV_SECONDS = 100;

export function createFixtures({ seconds = SILENT_WAV_SECONDS } = {}) {
  const song = (index) => ({
    id: "s2-6-fixture-" + (index + 1),
    title: "S2-6 silent sample " + (index + 1),
    artist: "MIMI perf fixture",
    album: "S2-6 audio metrics",
    cover: "",
    // Filled by the init script with a blob: URL for the in-page generated silent WAV.
    audioUrl: "",
    duration: seconds,
    source: "local",
    lyrics: DEMO_LYRICS,
  });
  const songs = [0, 1, 2, 3, 4].map(song);
  return {
    songs,
    seconds,
    uiStore: {
      state: {
        currentView: "player",
        themeMode: "dark",
        themeColors: THEME_COLORS,
        isDynamicTheme: false,
      },
      version: 2,
    },
    playerStore: {
      state: {
        currentSong: songs[0],
        volume: 0.7,
        isMuted: false,
        playbackRate: 1,
        // 100s clip > 60s window: no ended event, native loop is only a safety net.
        loopMode: "single",
      },
      version: 0,
    },
    queueStore: {
      state: { queue: songs, currentIndex: 0, history: [], playThroughMode: "normal" },
      version: 0,
    },
  };
}

const round2 = (value) => Math.round(value * 100) / 100;
const mean = (values) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class BlockerError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "BlockerError";
    this.code = code;
    this.detail = detail;
  }
}

export function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    outDir: DEFAULT_OUT_DIR,
    chromePath: DEFAULT_CHROME_PATH,
    durationSec: DEFAULT_DURATION_SEC,
    intervalMs: DEFAULT_INTERVAL_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    scenarios: [...SCENARIO_IDS],
    quick: false,
    reportOnly: false,
    help: false,
  };
  let durationExplicit = false;
  let intervalExplicit = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;
    const takeValue = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (i >= argv.length) throw new Error("Missing value for " + key);
      return argv[i];
    };
    if (key === "--base-url") options.baseUrl = takeValue();
    else if (key === "--out") options.outDir = takeValue();
    else if (key === "--chrome-path") options.chromePath = takeValue();
    else if (key === "--duration") {
      options.durationSec = Number(takeValue());
      durationExplicit = true;
    } else if (key === "--interval") {
      options.intervalMs = Number(takeValue());
      intervalExplicit = true;
    } else if (key === "--timeout") options.timeoutMs = Number(takeValue());
    else if (key === "--scenario") {
      const value = takeValue();
      if (!SCENARIO_IDS.includes(value)) {
        throw new Error(
          "Unknown scenario: " + value + " (expected " + SCENARIO_IDS.join("|") + ")"
        );
      }
      options.scenarios = [value];
    } else if (key === "--quick") {
      options.quick = true;
      const value = inline !== undefined ? inline : argv[i + 1];
      const quickSeconds = value ? Number(String(value).replace(/s$/, "")) : NaN;
      if (Number.isFinite(quickSeconds) && quickSeconds > 0) {
        i += 1;
        options.durationSec = quickSeconds;
        durationExplicit = true;
      }
    } else if (key === "--report-only") options.reportOnly = true;
    else if (key === "--help" || key === "-h") options.help = true;
    else throw new Error("Unknown argument: " + arg);
  }
  if (!options.help) {
    const positive = [
      ["--duration", options.durationSec],
      ["--interval", options.intervalMs],
      ["--timeout", options.timeoutMs],
    ];
    for (const [flag, value] of positive) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(flag + " must be a positive number");
      }
    }
    if (options.quick) {
      if (!durationExplicit) options.durationSec = DEFAULT_QUICK_DURATION_SEC;
      if (!intervalExplicit) options.intervalMs = DEFAULT_QUICK_INTERVAL_MS;
    }
  }
  return options;
}

export function summarizeSamples(samples, final, writeLog = null, durationSec = 0) {
  const rates = Array.isArray(final.storeWrites.samples) ? final.storeWrites.samples : [];
  const byKey = writeLog?.byKey ?? {};
  const playbackWrites = PLAYBACK_STORAGE_KEYS.reduce((sum, key) => sum + (byKey[key] ?? 0), 0);
  const seconds = durationSec > 0 ? durationSec : final.durationMs / 1000;
  return {
    storeWritesPerSec: final.storeWrites.perSecond,
    storeWritesTotal: final.storeWrites.total,
    storeWritesMax1s: round2(rates.length ? Math.max(...rates) : 0),
    storeWritesMean1s: round2(mean(rates)),
    playbackStoreWrites: playbackWrites,
    playbackStoreWritesPerSec: seconds > 0 ? round2(playbackWrites / seconds) : 0,
    storeWritesByKey: byKey,
    rafAvgMs: final.frames.avgMs,
    rafP95Ms: final.frames.p95Ms,
    rafMaxMs: final.frames.maxMs,
    rafFrames: final.frames.count,
    rafFps: final.frames.avgMs > 0 ? round2(1000 / final.frames.avgMs) : 0,
    nodesCreated: final.audioGraph.createdNodes,
    nodesActive: final.audioGraph.activeNodes,
    longTasks50ms: final.longTasks.count,
    longTaskTotalMs: final.longTasks.totalMs,
    longTaskMaxMs: final.longTasks.maxMs,
    durationMs: final.durationMs,
    sampleCount: samples.length,
  };
}

/** Acceptance: E4 writes <= 1/s, E7 no node growth across track switches, E6 zero >50ms long tasks. */
export function evaluateAcceptance(results) {
  const captured = results.filter((result) => !result.blocked && result.aggregates);
  const byId = Object.fromEntries(captured.map((result) => [result.scenario, result]));
  const checks = [];

  const writeDetail = captured
    .map(
      (result) =>
        result.scenario +
        "=" +
        result.aggregates.playbackStoreWritesPerSec +
        "/s (all keys " +
        result.aggregates.storeWritesPerSec +
        "/s)"
    )
    .join(", ");
  checks.push({
    id: "E4-write-rate",
    label: "playback persist writes <= 1/s",
    target: "player-store + audio-store-v4 <= 1/s (S2-4 target 0.4/s)",
    pass: captured.length > 0 && captured.every((r) => r.aggregates.playbackStoreWritesPerSec <= 1),
    detail: captured.length ? writeDetail : "no samples",
  });

  const play = byId.play;
  const switching = byId["track-switch"];
  const idle = byId.idle;
  const nodeDetail = captured
    .map(
      (r) =>
        r.scenario +
        ": created=" +
        r.aggregates.nodesCreated +
        " active=" +
        r.aggregates.nodesActive
    )
    .join(", ");
  let nodePass = null;
  let nodeNote = "play / track-switch both required to compare";
  if (play && switching) {
    const createdDelta = switching.aggregates.nodesCreated - play.aggregates.nodesCreated;
    const activeDelta = switching.aggregates.nodesActive - play.aggregates.nodesActive;
    const idleClean = idle ? idle.aggregates.nodesCreated === 0 : true;
    nodePass = createdDelta === 0 && activeDelta === 0 && idleClean;
    nodeNote =
      "track-switch minus play: createdDelta=" +
      createdDelta +
      " activeDelta=" +
      activeDelta +
      (idle ? " idleCreated=" + idle.aggregates.nodesCreated : "");
  }
  checks.push({
    id: "E7-node-leak",
    label: "audio graph nodes do not leak",
    target: "zero node delta across switches",
    pass: nodePass,
    detail: captured.length ? nodeDetail + "; " + nodeNote : "no samples",
  });

  const longTaskDetail = captured
    .map((r) => r.scenario + "=" + r.aggregates.longTasks50ms)
    .join(", ");
  checks.push({
    id: "E6-long-tasks",
    label: "zero >50ms long tasks",
    target: "0",
    pass: captured.length > 0 && captured.every((r) => r.aggregates.longTasks50ms === 0),
    detail: captured.length ? longTaskDetail : "no samples",
  });

  const pageErrorCount = results.reduce((sum, r) => sum + (r.pageErrors?.length ?? 0), 0);
  checks.push({
    id: "no-page-errors",
    label: "no uncaught page errors",
    target: "0",
    pass: pageErrorCount === 0,
    detail: "pageErrors total=" + pageErrorCount,
  });

  const met = checks.every((check) => check.pass === true);
  return { checks, met, capturedScenarios: captured.map((r) => r.scenario) };
}

function formatTimestamp(iso) {
  return iso.replace("T", " ").replace(/\.\d+Z$/, "Z");
}

export function renderReport({ results, meta, acceptance, outDir }) {
  const code = (value) => TICK + value + TICK;
  const lines = [];
  lines.push("# S2-6 browser audio-metrics evidence (CDP/Playwright)");
  lines.push("");
  lines.push(
    "> Generated by " +
      code("npm run perf:audio-metrics:s2-6") +
      ". Probe: " +
      code("src/lib/perf/audioMetrics.ts") +
      " (" +
      code("window.__audioMetrics") +
      "), sampled every " +
      meta.intervalMs / 1000 +
      "s."
  );
  lines.push("");
  lines.push("## Environment");
  lines.push("");
  lines.push("| item | value |");
  lines.push("| --- | --- |");
  lines.push("| capturedAt | " + formatTimestamp(meta.startedAt) + " |");
  lines.push(
    "| branch @ commit | " + meta.git.branch + " @ " + (meta.git.commit ?? "unknown") + " |"
  );
  lines.push("| dev server | " + meta.baseUrl + " |");
  lines.push("| Chrome | " + meta.browser.version + " (headless, channel=chrome) |");
  lines.push("| Playwright | " + (meta.runtime.playwright ?? "unknown") + " |");
  lines.push("| Node / OS | " + meta.runtime.node + " / " + meta.runtime.platform + " |");
  lines.push(
    "| viewport | " +
      VIEWPORT.width +
      "x" +
      VIEWPORT.height +
      " @1x (headless, no GPU assumption) |"
  );
  lines.push(
    "| per-scenario duration / interval | " + meta.durationSec + "s / " + meta.intervalMs + "ms |"
  );
  lines.push("");
  lines.push("## Scenarios and fixtures");
  lines.push("");
  lines.push("| scenario | description | data |");
  lines.push("| --- | --- | --- |");
  for (const result of results) {
    lines.push(
      "| " + code(result.scenario) + " | " + result.label + " | " + result.dataSummary + " |"
    );
  }
  lines.push("");
  lines.push(
    "Display-only fixtures: ui-store-v2 " +
      code("currentView=player") +
      "; player-store " +
      code("currentSong") +
      " points at an inline silent WAV (source=local, no network); queue-store-v5 seeds 5 samples. " +
      code("loopMode=single") +
      " sets native " +
      code("audio.loop") +
      " as a safety net; the " +
      meta.fixtureSeconds +
      "s clip is longer than the sampling window, so no ended event occurs."
  );
  const playable = results.filter((result) => !result.blocked && result.playbackEvidence);
  if (playable.length > 0) {
    lines.push("");
    lines.push("## Playback evidence (media clock really advances)");
    lines.push("");
    lines.push("| scenario | currentTime before | currentTime after 1.5s | advanced |");
    lines.push("| --- | ---: | ---: | --- |");
    for (const result of playable) {
      lines.push(
        "| " +
          code(result.scenario) +
          " | " +
          result.playbackEvidence.currentTimeBefore +
          " | " +
          result.playbackEvidence.currentTimeAfter +
          " | " +
          (result.playbackEvidence.advanced ? "yes" : "no") +
          " |"
      );
    }
  }
  lines.push("");
  lines.push("## Aggregates");
  lines.push("");
  lines.push(
    "| scenario | duration | samples | playback writes/s | all writes/s | max 1s | rAF fps | rAF avg | rAF p95 | rAF max | frames | nodes created | nodes active | >50ms long tasks | console errors | page errors |"
  );
  lines.push(
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  for (const result of results) {
    if (result.blocked) {
      lines.push(
        "| " +
          code(result.scenario) +
          " | " +
          result.durationSec +
          "s | 0 | - | BLOCKED | - | - | - | - | - | - | - | - | - | " +
          (result.consoleErrors?.length ?? 0) +
          " | " +
          (result.pageErrors?.length ?? 0) +
          " |"
      );
      continue;
    }
    const a = result.aggregates;
    lines.push(
      "| " +
        code(result.scenario) +
        " | " +
        result.durationSec +
        "s | " +
        a.sampleCount +
        " | " +
        a.playbackStoreWritesPerSec +
        " | " +
        a.storeWritesPerSec +
        " | " +
        a.storeWritesMax1s +
        " | " +
        a.rafFps +
        " | " +
        a.rafAvgMs +
        " | " +
        a.rafP95Ms +
        " | " +
        a.rafMaxMs +
        " | " +
        a.rafFrames +
        " | " +
        a.nodesCreated +
        " | " +
        a.nodesActive +
        " | " +
        a.longTasks50ms +
        " | " +
        (result.consoleErrors?.length ?? 0) +
        " | " +
        (result.pageErrors?.length ?? 0) +
        " |"
    );
  }
  lines.push("");
  lines.push(
    "Writes by localStorage key during the probe window (S2-4 scope is the two playback keys):"
  );
  lines.push("");
  lines.push("| scenario | key | writes |");
  lines.push("| --- | --- | ---: |");
  for (const result of results) {
    if (result.blocked) continue;
    const entries = Object.entries(result.aggregates.storeWritesByKey ?? {}).sort(
      (left, right) => right[1] - left[1]
    );
    if (entries.length === 0) {
      lines.push("| " + code(result.scenario) + " | (none) | 0 |");
      continue;
    }
    for (const [key, count] of entries) {
      lines.push("| " + code(result.scenario) + " | " + code(key) + " | " + count + " |");
    }
  }
  lines.push("");
  const firstPlay = results.find((result) => !result.blocked && result.scenario === "play");
  const anyResult = results.find((result) => !result.blocked);
  lines.push(
    "Headless Chrome has no vsync here: rAF runs at ~" +
      (anyResult?.aggregates.rafFps ?? 0) +
      " fps, so frame deltas are a relative local baseline rather than a 60fps target. " +
      code("frames") +
      " is capped by the probe at MAX_FRAME_SAMPLES=3600 deltas, i.e. the most recent ~" +
      Math.round(3600 / ((anyResult?.aggregates.rafFps ?? 1) || 1)) +
      "s at that rate."
  );
  lines.push("");
  if (firstPlay) {
    lines.push(
      "Node baseline: the first play creates the whole audio graph once (created=" +
        firstPlay.aggregates.nodesCreated +
        " on this run: 30 EQ biquads + masterGain + analyser + the effects-chain block from AudioEffectsManager.init + 1 MediaElementSource). " +
        "The switch/seek burst created " +
        Math.max(
          0,
          (results.find((result) => result.scenario === "track-switch")?.aggregates.nodesCreated ??
            0) - firstPlay.aggregates.nodesCreated
        ) +
        " additional nodes."
    );
    lines.push("");
    lines.push(
      "Write-rate context: the two playback keys are throttled per key (2s), so the combined rate sits exactly at the <=1/s boundary (0.5/s per key); S2-4's 0.4/s target is not met by the current throttle configuration. " +
        "The all-key rate is higher because the first play also unlocks achievements (" +
        code("stats-achievements-store-v4") +
        " burst) and writes journal/liner-notes/performance entries once."
    );
    lines.push("");
  }
  lines.push("## Acceptance verdict (based on these real samples)");
  lines.push("");
  lines.push("| check | target | verdict | measured |");
  lines.push("| --- | --- | --- | --- |");
  for (const check of acceptance.checks) {
    const verdict = check.pass === true ? "PASS" : check.pass === false ? "FAIL" : "N/A";
    lines.push(
      "| " + check.label + " | " + check.target + " | **" + verdict + "** | " + check.detail + " |"
    );
  }
  lines.push("");
  lines.push(
    "**Overall: " +
      (acceptance.met
        ? "every check passed on these samples"
        : "at least one check FAILED (see table)") +
      ".**"
  );
  lines.push("");
  lines.push("## Sample timeline");
  lines.push("");
  for (const result of results) {
    if (result.blocked) continue;
    lines.push("### " + code(result.scenario));
    lines.push("");
    lines.push(
      "| t(s) | writes/s | writes total | rAF avg | rAF p95 | rAF max | frames | nodes active | long tasks |"
    );
    lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const sample of result.samples) {
      lines.push(
        "| " +
          sample.atSec +
          " | " +
          sample.storeWrites.perSecond +
          " | " +
          sample.storeWrites.total +
          " | " +
          sample.frames.avgMs +
          " | " +
          sample.frames.p95Ms +
          " | " +
          sample.frames.maxMs +
          " | " +
          sample.frames.count +
          " | " +
          sample.audioGraph.activeNodes +
          " | " +
          sample.longTasks.count +
          " |"
      );
    }
    if (result.burst && result.burst.length > 0) {
      lines.push("");
      lines.push(
        "Burst actions: " +
          result.burst
            .map((item) => {
              if (item.action === "next-track") {
                return (
                  "next " +
                  item.indexFrom +
                  "->" +
                  item.indexTo +
                  (item.ok ? " (ok)" : " (not observed)")
                );
              }
              return (
                "seek " +
                Math.round(item.percent * 100) +
                "% -> " +
                (item.after ?? "?") +
                "s" +
                (item.ok ? " (ok)" : " (not confirmed)")
              );
            })
            .join(", ")
      );
    }
    lines.push("");
  }
  lines.push("## Blockers and gaps (recorded as-is)");
  lines.push("");
  const blocked = results.filter((result) => result.blocked);
  if (blocked.length > 0) {
    for (const result of blocked) {
      lines.push(
        "- **" +
          code(result.scenario) +
          " not captured**: " +
          result.blocker.code +
          " - " +
          result.blocker.message
      );
    }
  } else {
    lines.push("- All scenarios were captured on this machine; no blockers.");
  }
  lines.push(
    "- Plan-level scenarios " +
      code("effects-drag") +
      " (100 intensity drags) and " +
      code("soak-100-skip") +
      " (100 switches) plus the 2h soak (S7-9) are not covered here; this run covers idle / play / 5 switch+seek actions at 60s."
  );
  lines.push(
    "- The silent clip is " +
      meta.fixtureSeconds +
      "s (just above the app's 95s trial-snippet threshold), so seek targets are 60%/25% of that clip; a real 3-minute track is not covered."
  );
  lines.push(
    "- Headless Chrome has no real sound card or GPU; rAF is compositor-driven, so writes/long-tasks/node counts are the primary signals and rAF numbers are a local baseline."
  );
  lines.push(
    "- Console errors are recorded, not fatal. In this dev environment they are 401 responses from " +
      code("/api/ai/chat") +
      " (AI backend not running/authorized here), listed under " +
      code("badResponses") +
      " in each JSON; they are not audio-path failures."
  );
  lines.push("");
  lines.push("## Reproduce");
  lines.push("");
  lines.push("~~~bash");
  lines.push("# 1) dev server on a free port");
  lines.push("node node_modules/next/dist/bin/next dev --webpack -p 3038");
  lines.push("# 2) full evidence: 3 scenarios x 60s");
  lines.push("npm run perf:audio-metrics:s2-6");
  lines.push("# smoke: 3 scenarios x 5s, 1s interval");
  lines.push("node scripts/perf/audio-metrics-cdp.mjs --quick");
  lines.push("~~~");
  lines.push("");
  const rel = (file) => path.relative(process.cwd(), file).split(path.sep).join("/");
  lines.push("Artifacts:");
  for (const result of results) {
    lines.push("- " + code(rel(path.join(outDir, "s2-6-" + result.scenario + ".json"))));
  }
  lines.push("- " + code(rel(path.join(outDir, "s2-6-report.md"))));
  lines.push("");
  return lines.join("\n");
}

function readPackageVersion(relativePath) {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
    return JSON.parse(raw).version ?? null;
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

function ensureChrome(chromePath) {
  if (!fs.existsSync(chromePath)) {
    throw new Error(
      "Chrome executable not found at " + chromePath + ". Pass --chrome-path or set CHROME_PATH."
    );
  }
}

async function preflight(baseUrl, timeoutMs) {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error("HTTP " + response.status);
  } catch (error) {
    throw new Error(
      "Dev server is not reachable at " +
        baseUrl +
        " (" +
        (error && error.message ? error.message : String(error)) +
        "). Start it first: node node_modules/next/dist/bin/next dev --webpack -p 3038"
    );
  }
}

async function pageDiagnostics(page) {
  const detail = { url: null, title: null, bodyText: null, probe: null };
  try {
    detail.url = page.url();
    detail.title = await page.title();
    detail.bodyText = (await page.evaluate(() => document.body.innerText || "")).slice(0, 400);
    detail.probe = await page.evaluate(() => {
      const probe = window.__audioMetrics;
      if (!probe) return null;
      const snapshot = probe.getSnapshot();
      return {
        running: snapshot.running,
        frames: snapshot.frames.count,
        storeWrites: snapshot.storeWrites.total,
        graph: snapshot.audioGraph,
      };
    });
  } catch (error) {
    detail.diagnosticError = error && error.message ? error.message : String(error);
  }
  return detail;
}

async function waitForProbe(page) {
  try {
    await page.waitForFunction(() => Boolean(window.__audioMetrics), undefined, {
      timeout: PROBE_TIMEOUT_MS,
    });
  } catch {
    throw new BlockerError(
      "probe-missing",
      "window.__audioMetrics was not installed within " +
        PROBE_TIMEOUT_MS / 1000 +
        "s: the dev probe did not load (bootstrap skipped, or NODE_ENV is not development)",
      await pageDiagnostics(page)
    );
  }
}

async function waitForPlayControl(page) {
  const deadline = Date.now() + PLAYBACK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const controls = page.locator(PLAY_CONTROL_SELECTOR);
    const count = await controls.count();
    for (let i = 0; i < count; i += 1) {
      const control = controls.nth(i);
      if (await control.isVisible()) return control;
    }
    await sleep(500);
  }
  throw new BlockerError(
    "play-control-missing",
    "no visible play control (" +
      PLAY_CONTROL_SELECTOR +
      ") on the Player view: currentView may not be player, or Player3D is not mounted",
    await pageDiagnostics(page)
  );
}

async function startPlayback(page) {
  const control = await waitForPlayControl(page);
  await control.click({ timeout: 15000 });
  try {
    await page.waitForFunction(
      (selector) => Boolean(document.querySelector(selector)),
      PLAYING_CONTROL_SELECTOR,
      { timeout: PLAYBACK_TIMEOUT_MS }
    );
  } catch {
    throw new BlockerError(
      "playback-not-started",
      "playback was not confirmed within " +
        PLAYBACK_TIMEOUT_MS / 1000 +
        "s (no " +
        PLAYING_CONTROL_SELECTOR +
        " control): the media event pipeline never reported playing (autoplay or decode failure)",
      await pageDiagnostics(page)
    );
  }

  // Real playback evidence: the media clock must advance, not just the play intent.
  const durationDeadline = Date.now() + 5000;
  while (Date.now() < durationDeadline) {
    const slider = await readSlider(page);
    if (slider && slider.max > 0) break;
    await sleep(200);
  }
  const before = await readSlider(page);
  await page.waitForTimeout(1500);
  const after = await readSlider(page);
  const advanced =
    Boolean(before && after) && Number.isFinite(after.now) && after.now - before.now >= 0.3;
  if (!advanced) {
    throw new BlockerError(
      "playback-not-progressing",
      "the play control switched to pause but the media currentTime did not advance in 1.5s " +
        "(before=" +
        (before ? before.now : "null") +
        ", after=" +
        (after ? after.now : "null") +
        "): playback is not actually progressing",
      { before, after, diagnostics: await pageDiagnostics(page) }
    );
  }
  return {
    currentTimeBefore: round2(before.now),
    currentTimeAfter: round2(after.now),
    advanced: true,
  };
}

async function readQueueIndex(page) {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed?.state?.currentIndex === "number" ? parsed.state.currentIndex : null;
    } catch {
      return null;
    }
  }, QUEUE_STORAGE_KEY);
}

async function readSlider(page) {
  return page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    return {
      now: Number(element.getAttribute("aria-valuenow")),
      max: Number(element.getAttribute("aria-valuemax")),
      text: element.getAttribute("aria-valuetext"),
    };
  }, PROGRESS_SLIDER_SELECTOR);
}

async function clickNextControl(page) {
  const playControl = page.locator(PLAYING_CONTROL_SELECTOR).first();
  const container = playControl.locator("xpath=..");
  const buttons = container.locator("button");
  const total = await buttons.count();
  if (total < 3) return false;
  await buttons.nth(total - 1).click({ timeout: 10000 });
  return true;
}

async function switchTrackAndSeek(page) {
  const burst = [];
  const initialIndex = await readQueueIndex(page);
  for (let i = 0; i < 3; i += 1) {
    const from = await readQueueIndex(page);
    await page.keyboard.press("Control+N");
    await page.waitForTimeout(900);
    const to = await readQueueIndex(page);
    burst.push({
      action: "next-track",
      via: "keyboard",
      indexFrom: from,
      indexTo: to,
      ok: from !== to && to !== null,
    });
  }
  if (burst.every((item) => !item.ok)) {
    const clicked = await clickNextControl(page).catch(() => false);
    await page.waitForTimeout(1200);
    const to = clicked ? await readQueueIndex(page) : null;
    burst.push({
      action: "next-track",
      via: "control-click",
      indexFrom: initialIndex,
      indexTo: to,
      ok: initialIndex !== to && to !== null,
    });
  }

  const slider = page.locator(PROGRESS_SLIDER_SELECTOR).first();
  for (const percent of [0.6, 0.25]) {
    let box = null;
    try {
      box = await slider.boundingBox();
    } catch {
      box = null;
    }
    if (!box) {
      burst.push({ action: "seek", percent, ok: false, reason: "progress slider not visible" });
      continue;
    }
    const beforeSlider = await readSlider(page);
    const target = (beforeSlider?.max ?? 0) * percent;
    await page.mouse.move(box.x + box.width * percent, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.waitForTimeout(150);
    const afterSlider = await readSlider(page);
    const after = afterSlider ? round2(afterSlider.now) : null;
    burst.push({
      action: "seek",
      percent,
      targetTime: round2(target),
      before: beforeSlider ? round2(beforeSlider.now) : null,
      after,
      ok: after !== null && Math.abs(after - target) <= 0.75,
    });
  }

  const seeks = burst.filter((item) => item.action === "seek");
  if (seeks.length > 0 && seeks.every((item) => !item.ok)) {
    throw new BlockerError(
      "seek-not-confirmed",
      "progress-bar seek did not take effect (aria-valuenow never approached the target time)",
      { burst, diagnostics: await pageDiagnostics(page) }
    );
  }
  return burst;
}

function buildScenarioPlan(scenarioId) {
  if (scenarioId === "idle") {
    return {
      id: "idle",
      label: "idle (no playback, Home view)",
      dataSummary: "fresh profile, no seed, no play click",
      seed: null,
      prepare: null,
    };
  }
  if (scenarioId === "play") {
    return {
      id: "play",
      label: "playback (100s silent WAV, blob URL)",
      dataSummary: "player view + display-only currentSong, play control clicked",
      seed: "player",
      prepare: async (page) => ({ burst: [], evidence: await startPlayback(page) }),
    };
  }
  return {
    id: "track-switch",
    label: "track switch + seek burst, then continuous playback",
    dataSummary: "player view + 5-song queue, then 3 next + 2 progress seeks",
    seed: "player",
    prepare: async (page) => {
      const evidence = await startPlayback(page);
      return { burst: await switchTrackAndSeek(page), evidence };
    },
  };
}

/** Counts localStorage.setItem per key (S2-4 scope is the two playback keys). */
async function installWriteLog(context) {
  await context.addInitScript(() => {
    if (window.__s2_6WriteLog) return;
    const log = { total: 0, byKey: {} };
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      log.total += 1;
      log.byKey[key] = (log.byKey[key] || 0) + 1;
      return original.call(this, key, value);
    };
    window.__s2_6WriteLog = log;
    window.__s2_6WriteLogReset = () => {
      log.total = 0;
      log.byKey = {};
    };
  });
}

/**
 * Builds the silent WAV once in the page, exposes it as a blob: URL and seeds the
 * persist envelopes with that URL (so localStorage only stores a short string).
 */
async function seedPlayerFixture(context, fixtures) {
  await context.addInitScript(
    (payload) => {
      const createSilentWavBlob = (seconds, sampleRate) => {
        const samples = Math.max(1, Math.round(seconds * sampleRate));
        const buffer = new ArrayBuffer(44 + samples);
        const view = new DataView(buffer);
        const writeText = (offset, text) => {
          for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
        };
        writeText(0, "RIFF");
        view.setUint32(4, 36 + samples, true);
        writeText(8, "WAVE");
        writeText(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate, true);
        view.setUint16(32, 1, true);
        view.setUint16(34, 8, true);
        writeText(36, "data");
        view.setUint32(40, samples, true);
        new Uint8Array(buffer, 44).fill(0x80);
        return new Blob([buffer], { type: "audio/wav" });
      };

      try {
        // One blob URL per song: useAudioPlayer revokes the previous URL on every
        // track change, so a shared URL breaks playback after the first switch.
        for (const song of payload.queueStore.state.queue) {
          song.audioUrl = URL.createObjectURL(createSilentWavBlob(payload.seconds, 8000));
        }
        payload.playerStore.state.currentSong.audioUrl = payload.queueStore.state.queue[0].audioUrl;
        localStorage.clear();
        localStorage.setItem("ui-store-v2", JSON.stringify(payload.uiStore));
        localStorage.setItem("player-store", JSON.stringify(payload.playerStore));
        localStorage.setItem("queue-store-v5", JSON.stringify(payload.queueStore));
      } catch (error) {
        // Seed failures surface later as a missing play control / unconfirmed playback.
        console.error("[s2-6] fixture seed failed", error);
      }
    },
    {
      seconds: fixtures.seconds,
      uiStore: fixtures.uiStore,
      playerStore: fixtures.playerStore,
      queueStore: fixtures.queueStore,
    }
  );
}

async function runScenario(browser, options, scenarioId, fixtures, env) {
  const plan = buildScenarioPlan(scenarioId);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: "zh-CN",
  });
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const badResponses = [];
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 2000));
    else if (message.type() === "warning" && consoleWarnings.length < 50) {
      consoleWarnings.push(message.text().slice(0, 2000));
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 2000)));
  page.on("response", (response) => {
    if (response.status() >= 400 && badResponses.length < 20) {
      badResponses.push({ status: response.status(), url: response.url().slice(0, 300) });
    }
  });

  try {
    await installWriteLog(context);
    if (plan.seed) await seedPlayerFixture(context, fixtures);
    await page.goto(options.baseUrl, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    await page.waitForSelector("main", { timeout: options.timeoutMs });
    await waitForProbe(page);
    await page
      .addStyleTag({ content: "nextjs-portal { display: none !important; }" })
      .catch(() => {});
    await page.waitForTimeout(SETTLE_MS);

    // Reset before the burst so nodes created while playing/switching are counted
    // since the reset (E7 semantics); store writes start counting with probe.start().
    await page.evaluate(() => {
      if (window.__audioGraphStats?.reset) window.__audioGraphStats.reset();
      window.__audioMetrics.reset();
    });

    let burst = [];
    let playbackEvidence = null;
    if (plan.prepare) {
      const prepared = await plan.prepare(page);
      burst = prepared?.burst ?? [];
      playbackEvidence = prepared?.evidence ?? null;
      await page.waitForTimeout(1000);
    }

    const startedAt = Date.now();
    await page.evaluate(() => {
      window.__s2_6WriteLogReset?.();
      window.__audioMetrics.start();
    });

    const samples = [];
    const deadline = startedAt + options.durationSec * 1000;
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(options.intervalMs, remaining));
      const snapshot = await page.evaluate(() => window.__audioMetrics.getSnapshot());
      samples.push({ atSec: round2((Date.now() - startedAt) / 1000), ...snapshot });
    }

    const final = await page.evaluate(() => window.__audioMetrics.stop());
    const graphStats = await page.evaluate(() => window.__audioGraphStats?.getSnapshot?.() ?? null);
    const writeLog = await page.evaluate(() => window.__s2_6WriteLog ?? null);
    const durationSec = round2((Date.now() - startedAt) / 1000);
    const aggregates = summarizeSamples(samples, final, writeLog, durationSec);

    return {
      result: {
        scenario: plan.id,
        label: plan.label,
        dataSummary: plan.dataSummary,
        durationSec,
        blocked: false,
        samples,
        aggregates,
        burst,
        pageErrors,
        consoleErrors,
        consoleWarnings,
        badResponses,
        playbackEvidence,
        graphStats,
        meta: {
          startedAt: new Date(startedAt).toISOString(),
          url: page.url(),
          fixtureSeconds: fixtures.songs[0].duration,
          intervalMs: options.intervalMs,
          ...env,
        },
      },
    };
  } catch (error) {
    const blocked = error instanceof BlockerError;
    return {
      result: {
        scenario: plan.id,
        label: plan.label,
        dataSummary: plan.dataSummary,
        durationSec: options.durationSec,
        blocked: true,
        blocker: {
          code: blocked ? error.code : "unexpected-error",
          message: blocked ? error.message : error && error.stack ? error.stack : String(error),
          detail: blocked ? error.detail : {},
        },
        samples: [],
        aggregates: null,
        burst: [],
        pageErrors,
        consoleErrors,
        consoleWarnings,
        badResponses,
        meta: { ...env },
      },
      fatal: blocked && error.code === "probe-missing",
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function usage() {
  console.log(
    [
      "Usage: node scripts/perf/audio-metrics-cdp.mjs [options]",
      "",
      "Options:",
      "  --base-url <url>      dev server URL (default " + DEFAULT_BASE_URL + ")",
      "  --out <dir>           output directory (default " + DEFAULT_OUT_DIR + ")",
      "  --chrome-path <p>     Chrome executable (default " + DEFAULT_CHROME_PATH + ")",
      "  --duration <sec>      sampling duration per scenario (default 60)",
      "  --interval <ms>       sampling interval (default 5000)",
      "  --scenario <id>       run one scenario: idle | play | track-switch",
      "  --quick [sec]         smoke mode (default 5s duration, 1s interval)",
      "  --report-only         rebuild s2-6-report.md from existing scenario JSONs",
      "  --timeout <ms>        navigation / probe timeout (default 180000)",
      "  --help                show this help",
      "",
      "Output: perf/audio-metrics/s2-6-<scenario>.json + s2-6-report.md",
    ].join("\n")
  );
}

function buildMeta(results, options, startedAt) {
  return {
    startedAt,
    baseUrl: options.baseUrl,
    durationSec: options.durationSec,
    intervalMs: options.intervalMs,
    fixtureSeconds:
      results.find((result) => result.meta?.fixtureSeconds)?.meta.fixtureSeconds ??
      SILENT_WAV_SECONDS,
    git: {
      branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
      commit: gitValue(["rev-parse", "HEAD"]),
    },
    browser: { version: results.find((r) => !r.blocked)?.meta?.chromeVersion ?? "unknown" },
    runtime: {
      node: process.version,
      playwright: readPackageVersion("node_modules/playwright/package.json"),
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
}

function loadExistingResults(outDir, scenarios) {
  return scenarios.map((scenarioId) => {
    const file = path.join(outDir, "s2-6-" + scenarioId + ".json");
    if (!fs.existsSync(file)) throw new Error("Missing scenario JSON: " + file);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    usage();
    return 0;
  }
  if (options.reportOnly) {
    const outDir = path.resolve(options.outDir);
    const results = loadExistingResults(outDir, options.scenarios);
    const captured = results.find((result) => !result.blocked);
    const effectiveOptions = {
      ...options,
      durationSec: captured?.durationSec ?? options.durationSec,
      intervalMs: captured?.meta?.intervalMs ?? options.intervalMs,
      baseUrl: captured?.meta?.baseUrl ?? options.baseUrl,
    };
    const meta = buildMeta(
      results,
      effectiveOptions,
      results.find((result) => result.meta?.startedAt)?.meta.startedAt ?? new Date().toISOString()
    );
    const acceptance = evaluateAcceptance(results);
    const report = renderReport({ results, meta, acceptance, outDir });
    fs.writeFileSync(path.join(outDir, "s2-6-report.md"), report + "\n");
    console.log("[s2-6] report rebuilt: " + path.join(outDir, "s2-6-report.md"));
    console.log("[s2-6] acceptance: " + (acceptance.met ? "all checks PASS" : "FAIL (see report)"));
    return results.some((result) => result.blocked) ? 2 : 0;
  }
  ensureChrome(options.chromePath);
  await preflight(options.baseUrl, Math.min(options.timeoutMs, 30000));

  const { chromium } = await import("playwright");
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const fixtures = createFixtures();
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({
    channel: "chrome",
    executablePath: options.chromePath,
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      "--window-size=1440,900",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });

  const results = [];
  try {
    for (const scenarioId of options.scenarios) {
      process.stdout.write(
        "[s2-6] scenario " + scenarioId + " (" + options.durationSec + "s) ... "
      );
      const { result, fatal } = await runScenario(browser, options, scenarioId, fixtures, {
        baseUrl: options.baseUrl,
        chromeVersion: browser.version(),
      });
      results.push(result);
      fs.writeFileSync(
        path.join(outDir, "s2-6-" + result.scenario + ".json"),
        JSON.stringify(result, null, 2) + "\n"
      );
      if (result.blocked) {
        console.log("BLOCKED (" + result.blocker.code + ")");
        if (fatal) break;
      } else {
        const a = result.aggregates;
        console.log(
          "ok samples=" +
            a.sampleCount +
            " writes=" +
            a.storeWritesPerSec +
            "/s rAF p95=" +
            a.rafP95Ms +
            "ms nodes=" +
            a.nodesCreated +
            "/" +
            a.nodesActive +
            " longTasks=" +
            a.longTasks50ms
        );
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const meta = buildMeta(results, { ...options, fixtureSeconds: fixtures.seconds }, startedAt);
  const acceptance = evaluateAcceptance(results);
  const report = renderReport({ results, meta, acceptance, outDir });
  fs.writeFileSync(path.join(outDir, "s2-6-report.md"), report + "\n");

  const blocked = results.filter((result) => result.blocked);
  console.log("[s2-6] report: " + path.join(outDir, "s2-6-report.md"));
  if (blocked.length > 0) {
    for (const result of blocked) {
      console.error(
        "[s2-6] BLOCKED " +
          result.scenario +
          ": " +
          result.blocker.code +
          " - " +
          result.blocker.message
      );
    }
    console.error("[s2-6] not all scenarios were captured; do not treat S2-6 as verified.");
    return 2;
  }
  console.log("[s2-6] acceptance: " + (acceptance.met ? "all checks PASS" : "FAIL (see report)"));
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error("[s2-6] " + (error && error.stack ? error.stack : String(error)));
      process.exitCode = 1;
    });
}
