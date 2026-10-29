import { describe, expect, it } from "vitest";
import { parseArgs, renderMarkdown, runSoak } from "./soak.mjs";

const stub = { tick() {}, stats: () => ({ cache: {}, operations: {} }) };
const run = (samples, options = {}) => {
  let i = 0;
  return runSoak({
    durationMs: 2000,
    intervalMs: 1000,
    workload: stub,
    sleep: async () => {},
    sampler: () => samples[Math.min(i++, samples.length - 1)],
    ...options,
  });
};

describe("soak harness", () => {
  it("reports start/peak/end/delta over two ticks", async () => {
    const report = await run([20, 22, 23.456]);
    expect(report).toMatchObject({ ticks: 2, thresholdMb: 30, passed: true });
    expect(report.memory).toMatchObject({ startMB: 20, peakMB: 23.46, endMB: 23.46 });
    expect(report.memory.deltaMB).toBe(3.46);
  });

  it("fails when the heap delta exceeds --threshold-mb", async () => {
    const report = await run([10, 20, 45.5], { thresholdMb: 30 });
    expect(report.memory).toMatchObject({ deltaMB: 35.5, peakDeltaMB: 35.5 });
    expect(report.passed).toBe(false);
    expect(renderMarkdown(report, "perf/reports/soak-x.json")).toContain("- result: FAIL");
  });

  it("parses options and rejects bad values", () => {
    expect(parseArgs(["--quick"]).duration).toBe(1);
    expect(parseArgs(["--quick", "2"]).duration).toBe(2);
    expect(parseArgs(["--interval", "30", "--threshold-mb", "0"]).interval).toBe(30);
    expect(() => parseArgs(["--duration", "0"])).toThrow(/>= 0.01/);
    expect(() => parseArgs(["--nope"])).toThrow(/unknown option/);
  });

  it("drives the real TtlLruCache and hydrationStatus modules", async () => {
    const report = await run([10, 11, 12], { workload: undefined });
    expect(report.workload.operations.sets).toBe(500);
    expect(report.workload.cache.size).toBeLessThanOrEqual(400);
    expect(report.workload.hydration.final).toBe("ready");
  });
});
