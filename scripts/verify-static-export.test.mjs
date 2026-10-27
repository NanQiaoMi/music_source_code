import { describe, expect, it } from "vitest";
import { evaluateOutFreshness } from "./verify-static-export.mjs";

describe("evaluateOutFreshness", () => {
  it("reports missing out/index.html with exit code 2", () => {
    const result = evaluateOutFreshness({ outIndexMtimeMs: null, dataManagerExists: false });
    expect(result).toMatchObject({ ok: false, code: 2 });
    expect(result.reason).toContain("out/index.html not found");
  });

  it("reports an incomplete export when data-manager.html is missing", () => {
    const result = evaluateOutFreshness({ outIndexMtimeMs: 1, dataManagerExists: false });
    expect(result).toMatchObject({ ok: false, code: 2 });
    expect(result.reason).toContain("data-manager.html");
  });

  it("reports stale output with exit code 3 when out is older than source/config", () => {
    const result = evaluateOutFreshness({
      outIndexMtimeMs: 100,
      dataManagerExists: true,
      sourceNewestMs: 200,
      configNewestMs: 150,
    });
    expect(result).toMatchObject({ ok: false, code: 3 });
    expect(result.reason).toContain("older than source/config");
  });

  it("accepts fresh output", () => {
    const result = evaluateOutFreshness({
      outIndexMtimeMs: 300,
      dataManagerExists: true,
      sourceNewestMs: 200,
      configNewestMs: 250,
    });
    expect(result).toMatchObject({ ok: true, code: 0, reason: "fresh" });
    expect(result.inputNewestMs).toBe(250);
  });

  it("enforces the optional max-age window", () => {
    const result = evaluateOutFreshness({
      outIndexMtimeMs: 1000,
      dataManagerExists: true,
      sourceNewestMs: 0,
      configNewestMs: 0,
      nowMs: 1000 + 10 * 60000,
      maxAgeMin: 5,
    });
    expect(result).toMatchObject({ ok: false, code: 3 });
    expect(result.reason).toContain("min old");
  });
});
