import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDomainEvents, emit, on } from "./events";

describe("domain events 总线", () => {
  afterEach(() => {
    clearDomainEvents();
    vi.restoreAllMocks();
  });

  it("on 收到载荷，退订后不再触发", () => {
    const handler = vi.fn();
    const off = on("playback:seeked", handler);

    emit("playback:seeked", { seconds: 12, duration: 100 });
    expect(handler).toHaveBeenCalledWith({ seconds: 12, duration: 100 });

    off();
    emit("playback:seeked", { seconds: 30, duration: 100 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("单个订阅方抛错不影响其他订阅方", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const healthy = vi.fn();
    on("playback:paused", () => {
      throw new Error("boom");
    });
    on("playback:paused", healthy);

    expect(() => emit("playback:paused", { songId: "song-1" })).not.toThrow();
    expect(healthy).toHaveBeenCalledWith({ songId: "song-1" });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("clearDomainEvents 可按事件名或整体清理", () => {
    const seeked = vi.fn();
    const paused = vi.fn();
    on("playback:seeked", seeked);
    on("playback:paused", paused);

    clearDomainEvents("playback:seeked");
    emit("playback:seeked", { seconds: 1, duration: 2 });
    emit("playback:paused", { songId: null });
    expect(seeked).not.toHaveBeenCalled();
    expect(paused).toHaveBeenCalledTimes(1);

    clearDomainEvents();
    emit("playback:paused", { songId: null });
    expect(paused).toHaveBeenCalledTimes(1);
  });
});
