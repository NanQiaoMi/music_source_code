/**
 * S2-6: dev-only audio performance sampler (store writes, rAF frames, graph
 * nodes, long tasks). Browser-only outside production; safe in SSR/tests.
 */
import { getAudioGraphStats } from "../audio/audioGraphStats";

export const AUDIO_METRICS_TICK_MS = 1000;
const LONG_TASK_THRESHOLD_MS = 50;
const MAX_FRAME_SAMPLES = 3600;
const MAX_RATE_SAMPLES = 300;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface AudioMetricsSnapshot {
  running: boolean;
  durationMs: number;
  frames: { count: number; avgMs: number; p95Ms: number; maxMs: number };
  storeWrites: { total: number; perSecond: number; samples: number[] };
  longTasks: { count: number; totalMs: number; maxMs: number };
  /** Mirrors __audioGraphStats; both fields are since its last reset(). */
  audioGraph: { createdNodes: number; activeNodes: number };
}

let running = false;
let startedAt = 0;
let stoppedAt: number | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let rafId: number | null = null;
let lastFrameAt: number | null = null;
let frameDeltas: number[] = [];
let writes = 0;
let writeSamples: number[] = [];
let lastTickAt = 0,
  lastTickWrites = 0;
let longTaskCount = 0,
  longTaskTotalMs = 0,
  longTaskMaxMs = 0;
let observer: PerformanceObserver | null = null;

type SetItem = (this: Storage, key: string, value: string) => void;
type HookedSetItem = SetItem & { __audioMetricsHooked?: true };
let hookedSetItem: HookedSetItem | null = null;
let originalSetItem: SetItem | null = null;

const isBrowser = (): boolean =>
  !IS_PRODUCTION && typeof window !== "undefined" && typeof document !== "undefined";

const round2 = (value: number): number => Math.round(value * 100) / 100;
function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

const durationMs = (): number => {
  const end = running ? Date.now() : (stoppedAt ?? startedAt);
  return Math.max(0, end - startedAt);
};

function resetCounters(): void {
  writes = 0;
  writeSamples = [];
  lastTickAt = startedAt;
  lastTickWrites = 0;
  frameDeltas = [];
  lastFrameAt = null;
  longTaskCount = 0;
  longTaskTotalMs = 0;
  longTaskMaxMs = 0;
}

function tick(): void {
  if (!running) return;
  const at = Date.now();
  const elapsed = at - lastTickAt;
  if (elapsed <= 0) return;
  writeSamples.push(round2((writes - lastTickWrites) / (elapsed / 1000)));
  if (writeSamples.length > MAX_RATE_SAMPLES) writeSamples.shift();
  lastTickAt = at;
  lastTickWrites = writes;
}

function onFrame(timestamp: number): void {
  if (!running) return;
  if (lastFrameAt !== null) {
    const delta = timestamp - lastFrameAt;
    if (delta > 0) {
      frameDeltas.push(delta);
      if (frameDeltas.length > MAX_FRAME_SAMPLES) frameDeltas.shift();
    }
  }
  lastFrameAt = timestamp;
  scheduleFrame();
}

function scheduleFrame(): void {
  if (!running || typeof requestAnimationFrame !== "function") return;
  rafId = requestAnimationFrame(onFrame);
}

function installStoreWriteHook(): void {
  if (typeof Storage === "undefined" || typeof Storage.prototype.setItem !== "function") return;
  const current = Storage.prototype.setItem as HookedSetItem;
  if (current.__audioMetricsHooked) return;
  const original = current;
  const wrapped: HookedSetItem = function (this: Storage, key, value) {
    if (running) writes += 1;
    original.call(this, key, value);
  };
  wrapped.__audioMetricsHooked = true;
  try {
    Storage.prototype.setItem = wrapped;
    hookedSetItem = wrapped;
    originalSetItem = original;
  } catch {
    hookedSetItem = null;
    originalSetItem = null;
  }
}

function removeStoreWriteHook(): void {
  const wrapped = hookedSetItem;
  const original = originalSetItem;
  hookedSetItem = null;
  originalSetItem = null;
  if (!wrapped || !original) return;
  try {
    if (Storage.prototype.setItem === wrapped) Storage.prototype.setItem = original;
  } catch {
    /* 探针清理失败不影响采样结果。 */
  }
}

function startLongTaskObserver(): void {
  if (typeof PerformanceObserver !== "function") return;
  try {
    observer = new PerformanceObserver((list) => {
      if (!running) return;
      const entries = list.getEntries();
      for (let i = 0; i < entries.length; i += 1) {
        const duration = entries[i].duration;
        if (duration <= LONG_TASK_THRESHOLD_MS) continue;
        longTaskCount += 1;
        longTaskTotalMs += duration;
        if (duration > longTaskMaxMs) longTaskMaxMs = duration;
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    observer = null;
  }
}

function stopInternal(): void {
  if (running) {
    stoppedAt = Date.now();
    running = false;
  }
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  if (rafId !== null) {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
    rafId = null;
  }
  try {
    observer?.disconnect();
  } catch {
    /* ignore */
  }
  observer = null;
  removeStoreWriteHook();
  lastFrameAt = null;
}

export function start(): void {
  if (!isBrowser() || running) return;
  try {
    running = true;
    startedAt = Date.now();
    stoppedAt = null;
    resetCounters();
    installStoreWriteHook();
    startLongTaskObserver();
    scheduleFrame();
    tickTimer = setInterval(tick, AUDIO_METRICS_TICK_MS);
  } catch {
    stopInternal();
    startedAt = 0;
    stoppedAt = null;
  }
}

export function stop(): AudioMetricsSnapshot {
  stopInternal();
  return getSnapshot();
}

export function reset(): void {
  stopInternal();
  startedAt = 0;
  stoppedAt = null;
  resetCounters();
}

export function getSnapshot(): AudioMetricsSnapshot {
  const ms = durationMs();
  const seconds = ms / 1000;
  const frameCount = frameDeltas.length;
  let frameSum = 0;
  let frameMax = 0;
  for (let i = 0; i < frameCount; i += 1) {
    frameSum += frameDeltas[i];
    if (frameDeltas[i] > frameMax) frameMax = frameDeltas[i];
  }
  const perSecond = seconds > 0 ? round2(writes / seconds) : 0;
  const graph = getAudioGraphStats();

  return {
    running,
    durationMs: Math.round(ms),
    frames: {
      count: frameCount,
      avgMs: frameCount > 0 ? round2(frameSum / frameCount) : 0,
      p95Ms: round2(percentile95(frameDeltas)),
      maxMs: round2(frameMax),
    },
    storeWrites: { total: writes, perSecond, samples: [...writeSamples] },
    longTasks: {
      count: longTaskCount,
      totalMs: round2(longTaskTotalMs),
      maxMs: round2(longTaskMaxMs),
    },
    audioGraph: {
      createdNodes: graph.createdNodes,
      activeNodes: graph.activeNodes,
    },
  };
}

export const audioMetricsProbe = { start, stop, getSnapshot, reset };

type AudioMetricsWindow = Window & { __audioMetrics?: typeof audioMetricsProbe };

if (isBrowser()) {
  (window as AudioMetricsWindow).__audioMetrics = audioMetricsProbe;
}
