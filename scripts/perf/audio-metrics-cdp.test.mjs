import { describe, expect, it } from "vitest";
import {
  PLAYBACK_STORAGE_KEYS,
  SILENT_WAV_SECONDS,
  createFixtures,
  evaluateAcceptance,
  parseArgs,
  summarizeSamples,
} from "./audio-metrics-cdp.mjs";

function finalSnapshot(overrides = {}) {
  return {
    running: false,
    durationMs: 60000,
    frames: { count: 3600, avgMs: 6.06, p95Ms: 6.2, maxMs: 8.8 },
    storeWrites: { total: 60, perSecond: 1, samples: [1, 1, 0.5, 1.5] },
    longTasks: { count: 0, totalMs: 0, maxMs: 0 },
    audioGraph: { createdNodes: 85, activeNodes: 85 },
    ...overrides,
  };
}

function scenarioResult(id, aggregateOverrides = {}, resultOverrides = {}) {
  return {
    scenario: id,
    blocked: false,
    pageErrors: [],
    samples: new Array(12).fill(finalSnapshot()),
    aggregates: {
      storeWritesPerSec: 1.6,
      playbackStoreWrites: 60,
      playbackStoreWritesPerSec: 1,
      storeWritesByKey: {
        "player-store": 30,
        "audio-store-v4": 30,
        "stats-achievements-store-v4": 34,
      },
      rafAvgMs: 6.06,
      rafP95Ms: 6.2,
      rafMaxMs: 8.8,
      rafFrames: 3600,
      rafFps: 165,
      nodesCreated: 85,
      nodesActive: 85,
      longTasks50ms: 0,
      sampleCount: 12,
      ...aggregateOverrides,
    },
    ...resultOverrides,
  };
}

const captured = () => [
  scenarioResult("idle", {
    storeWritesPerSec: 0,
    playbackStoreWrites: 0,
    playbackStoreWritesPerSec: 0,
    storeWritesByKey: {},
    nodesCreated: 0,
    nodesActive: 0,
  }),
  scenarioResult("play"),
  scenarioResult("track-switch", { storeWritesPerSec: 1.67 }),
];

describe("audio-metrics-cdp argument parsing", () => {
  it("defaults to the three 60s scenarios with a 5s sample interval", () => {
    expect(parseArgs([])).toMatchObject({
      durationSec: 60,
      intervalMs: 5000,
      scenarios: ["idle", "play", "track-switch"],
      reportOnly: false,
    });
  });

  it("supports --quick, explicit duration and a single scenario", () => {
    expect(parseArgs(["--quick"])).toMatchObject({ durationSec: 5, intervalMs: 1000 });
    expect(parseArgs(["--quick", "7"])).toMatchObject({ durationSec: 7, intervalMs: 1000 });
    expect(parseArgs(["--quick", "--duration", "30"])).toMatchObject({ durationSec: 30 });
    expect(parseArgs(["--scenario", "play", "--duration=10"])).toMatchObject({
      scenarios: ["play"],
      durationSec: 10,
    });
    expect(parseArgs(["--report-only"]).reportOnly).toBe(true);
  });

  it("rejects unknown scenarios and non-positive numbers", () => {
    expect(() => parseArgs(["--scenario", "nope"])).toThrow(/Unknown scenario/);
    expect(() => parseArgs(["--nope"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["--duration", "0"])).toThrow(/positive number/);
  });
});

describe("audio-metrics-cdp aggregation", () => {
  it("separates the two playback keys from one-time all-key writes", () => {
    const final = finalSnapshot({
      storeWrites: { total: 98, perSecond: 1.63, samples: [1, 35.96, 2] },
    });
    const log = {
      total: 98,
      byKey: { "player-store": 30, "audio-store-v4": 30, "stats-achievements-store-v4": 34 },
    };
    const aggregate = summarizeSamples(new Array(12).fill(final), final, log, 60);
    expect(PLAYBACK_STORAGE_KEYS).toEqual(["player-store", "audio-store-v4"]);
    expect(aggregate).toMatchObject({
      storeWritesPerSec: 1.63,
      playbackStoreWrites: 60,
      playbackStoreWritesPerSec: 1,
      storeWritesMax1s: 35.96,
      rafFps: 165.02,
      nodesCreated: 85,
      sampleCount: 12,
    });
    expect(aggregate.storeWritesByKey["stats-achievements-store-v4"]).toBe(34);
  });

  it("falls back to the probe duration when no window length is passed", () => {
    const final = finalSnapshot({ storeWrites: { total: 30, perSecond: 0.5, samples: [] } });
    const aggregate = summarizeSamples([], final, { byKey: { "player-store": 30 } });
    expect(aggregate.playbackStoreWritesPerSec).toBe(0.5);
  });
});

describe("audio-metrics-cdp acceptance", () => {
  it("passes when playback writes, node delta and long tasks are within target", () => {
    const verdict = evaluateAcceptance(captured());
    expect(verdict.met).toBe(true);
    expect(verdict.checks.map((check) => check.id)).toEqual([
      "E4-write-rate",
      "E7-node-leak",
      "E6-long-tasks",
      "no-page-errors",
    ]);
  });

  it("fails E4 on playback writes above 1/s even when all-key writes are similar", () => {
    const results = captured();
    results[1].aggregates.playbackStoreWritesPerSec = 1.2;
    const verdict = evaluateAcceptance(results);
    expect(verdict.met).toBe(false);
    expect(verdict.checks.find((check) => check.id === "E4-write-rate").pass).toBe(false);
  });

  it("fails E7 when a switch creates extra audio graph nodes", () => {
    const results = captured();
    results[2].aggregates.nodesCreated = 87;
    results[2].aggregates.nodesActive = 87;
    const verdict = evaluateAcceptance(results);
    expect(verdict.checks.find((check) => check.id === "E7-node-leak").pass).toBe(false);
  });

  it("fails E6 on a >50ms long task and marks node leaks N/A without both play scenarios", () => {
    const results = captured();
    results[0].aggregates.longTasks50ms = 2;
    const verdict = evaluateAcceptance(results);
    expect(verdict.checks.find((check) => check.id === "E6-long-tasks").pass).toBe(false);

    const partial = evaluateAcceptance([scenarioResult("idle")]);
    expect(partial.checks.find((check) => check.id === "E7-node-leak").pass).toBeNull();
    expect(partial.met).toBe(false);
  });
});

describe("audio-metrics-cdp fixture", () => {
  it("stays above the 95s trial-snippet rescue threshold", () => {
    const fixtures = createFixtures();
    expect(SILENT_WAV_SECONDS).toBeGreaterThan(95);
    expect(fixtures.songs).toHaveLength(5);
    expect(fixtures.songs.every((song) => song.duration === SILENT_WAV_SECONDS)).toBe(true);
    expect(fixtures.songs.every((song) => song.audioUrl === "")).toBe(true);
    expect(fixtures.songs.every((song) => song.source === "local")).toBe(true);
    expect(fixtures.uiStore.state.currentView).toBe("player");
    expect(fixtures.playerStore.state.loopMode).toBe("single");
    expect(fixtures.queueStore.state.queue).toHaveLength(5);
    expect(fixtures.queueStore.state.currentIndex).toBe(0);
  });
});
