import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlaybackRequestCoordinator,
  combineSignals,
  playbackRequestCoordinator,
  throwIfAborted,
} from "./requestCoordinator";

describe("PlaybackRequestCoordinator (S1-8a)", () => {
  afterEach(() => {
    playbackRequestCoordinator.abortAll();
    vi.useRealTimers();
  });

  it("begin aborts the previous token and keeps only one in flight", () => {
    const coordinator = new PlaybackRequestCoordinator();
    const first = coordinator.begin({ songId: "a", source: "netease" });
    const second = coordinator.begin({ songId: "b", source: "qq" });

    expect(first.controller.signal.aborted).toBe(true);
    expect(second.controller.signal.aborted).toBe(false);
    expect(coordinator.inFlight()).toBe(1);
    expect(coordinator.isCurrent(second)).toBe(true);
  });

  it("isCurrent is false for a stale token", () => {
    const coordinator = new PlaybackRequestCoordinator();
    const first = coordinator.begin({ songId: "a", source: "netease" });
    const second = coordinator.begin({ songId: "b", source: "qq" });

    expect(coordinator.isCurrent(first)).toBe(false);
    expect(coordinator.isCurrent(second)).toBe(true);
  });

  it("complete only clears the current token", () => {
    const coordinator = new PlaybackRequestCoordinator();
    const first = coordinator.begin({ songId: "a", source: "netease" });
    const second = coordinator.begin({ songId: "b", source: "qq" });

    coordinator.complete(first);
    expect(coordinator.inFlight()).toBe(1);

    coordinator.complete(second);
    expect(coordinator.inFlight()).toBe(0);
    expect(coordinator.isCurrent(second)).toBe(false);
  });

  it("abortAll aborts the current request", () => {
    const coordinator = new PlaybackRequestCoordinator();
    const token = coordinator.begin({ songId: "a", source: "netease" });

    coordinator.abortAll("test");

    expect(token.controller.signal.aborted).toBe(true);
    expect(coordinator.inFlight()).toBe(0);
  });

  it("throwIfAborted throws an AbortError for aborted signals", () => {
    const controller = new AbortController();
    expect(() => throwIfAborted(controller.signal)).not.toThrow();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrowError(
      expect.objectContaining({ name: "AbortError" })
    );
  });

  it("combineSignals follows parent aborts and pre-aborted parents", () => {
    const controller = new AbortController();
    const combined = combineSignals(controller.signal, 5000);
    expect(combined.aborted).toBe(false);

    controller.abort("manual");
    expect(combined.aborted).toBe(true);

    const already = new AbortController();
    already.abort("pre");
    expect(combineSignals(already.signal, 5000).aborted).toBe(true);
  });

  it("combineSignals aborts on timeout", async () => {
    const combined = combineSignals(undefined, 10);
    expect(combined.aborted).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(combined.aborted).toBe(true);
  });
});
