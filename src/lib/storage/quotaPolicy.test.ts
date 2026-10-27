import { describe, expect, it, vi } from "vitest";
import { isQuotaExceededError, writeWithPolicy } from "./quotaPolicy";

function quotaError() {
  return new DOMException("Storage quota exceeded", "QuotaExceededError");
}

describe("quotaPolicy", () => {
  it("writes the first candidate when it succeeds", () => {
    const write = vi.fn();
    const outcome = writeWithPolicy([{ value: "a" }, { value: "b" }], write);
    expect(outcome).toEqual({ ok: true, bytes: 1, degradedTo: undefined });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("a");
  });

  it("falls back to smaller candidates on quota errors", () => {
    const write = vi
      .fn()
      .mockImplementationOnce(() => {
        throw quotaError();
      })
      .mockImplementationOnce(() => undefined);
    const outcome = writeWithPolicy(
      [{ value: "full" }, { value: "small", degradedTo: "pruned" }],
      write
    );
    expect(outcome).toEqual({ ok: true, bytes: 5, degradedTo: "pruned" });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("does not keep trying after a non-quota error", () => {
    const write = vi.fn().mockImplementation(() => {
      throw new Error("serialize failed");
    });
    const outcome = writeWithPolicy([{ value: "a" }, { value: "b" }], write);
    expect(write).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ ok: false, reason: "unknown", keptPrevious: true });
  });

  it("keeps the previous value when every candidate hits quota", () => {
    const write = vi.fn().mockImplementation(() => {
      throw quotaError();
    });
    const outcome = writeWithPolicy([{ value: "a" }, { value: "b" }], write);
    expect(write).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ ok: false, reason: "quota", keptPrevious: true });
  });

  it("recognises QuotaExceededError variants", () => {
    expect(isQuotaExceededError(quotaError())).toBe(true);
    expect(isQuotaExceededError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError(new Error("nope"))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });
});
