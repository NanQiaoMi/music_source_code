import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRehydrateHandles,
  registerRehydrateHandle,
  rehydrateRegisteredStores,
} from "./rehydrateRegisteredStores";

describe("rehydrateRegisteredStores", () => {
  beforeEach(() => {
    clearRehydrateHandles();
  });

  it("runs explicitly registered handles in order", async () => {
    const calls: string[] = [];
    registerRehydrateHandle("custom-a", () => {
      calls.push("a");
    });
    registerRehydrateHandle("custom-b", async () => {
      calls.push("b");
    });

    const result = await rehydrateRegisteredStores(["custom-a", "custom-b"]);

    expect(calls).toEqual(["a", "b"]);
    expect(result).toEqual({ ok: ["custom-a", "custom-b"], failed: [] });
  });

  it("collects failed handles instead of throwing", async () => {
    registerRehydrateHandle("broken", () => {
      throw new Error("boom");
    });
    registerRehydrateHandle("healthy", () => undefined);

    const result = await rehydrateRegisteredStores(["broken", "healthy"]);

    expect(result.failed).toEqual(["broken"]);
    expect(result.ok).toEqual(["healthy"]);
  });

  it("treats unknown keys without a loader/handle as no-op ok", async () => {
    const result = await rehydrateRegisteredStores(["unknown-key"]);
    expect(result).toEqual({ ok: ["unknown-key"], failed: [] });
  });

  it("deduplicates requested keys", async () => {
    const handle = vi.fn();
    registerRehydrateHandle("dedupe", handle);
    const result = await rehydrateRegisteredStores(["dedupe", "dedupe"]);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(result.ok).toEqual(["dedupe"]);
  });
});
