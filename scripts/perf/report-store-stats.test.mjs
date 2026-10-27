import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "perf", "report-store-stats.mjs");

function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
}

describe("report-store-stats whole-store budget", () => {
  it("keeps no-selector whole-store subscriptions within the S3-10 budget", () => {
    const result = run("--max-whole", "10");

    expect(result.status, result.stderr).toBe(0);
    const match = result.stdout.match(/wholeCalls (\d+) <= 10/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBeLessThanOrEqual(10);
  });

  it("rejects an invalid budget instead of silently passing", () => {
    const result = run("--max-whole", "-1");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("non-negative number");
  });
});
