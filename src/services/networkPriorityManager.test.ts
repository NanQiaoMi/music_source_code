import { describe, it, expect, beforeEach } from "vitest";
import { networkPriorityManager, NetworkPriority } from "./networkPriorityManager";

describe("networkPriorityManager", () => {
  beforeEach(() => {
    networkPriorityManager.setAudioBuffering(false);
    networkPriorityManager.clearQueue();
  });

  it("should execute P0 tasks immediately even if audio is buffering", async () => {
    networkPriorityManager.setAudioBuffering(true);
    let executed = false;

    const result = await networkPriorityManager.schedule(
      NetworkPriority.P0_AUDIO_STREAM,
      async () => {
        executed = true;
        return "p0_done";
      }
    );

    expect(executed).toBe(true);
    expect(result).toBe("p0_done");
  });

  it("should suspend P2 tasks when audio is buffering and drain when buffering ends", async () => {
    networkPriorityManager.setAudioBuffering(true);
    let p2Executed = false;

    const p2Promise = networkPriorityManager.schedule(
      NetworkPriority.P2_BACKGROUND,
      async () => {
        p2Executed = true;
        return "p2_done";
      }
    );

    // Give microtasks a tick
    await new Promise((r) => setTimeout(r, 20));
    expect(p2Executed).toBe(false); // Should be suspended

    // Audio finishes buffering
    networkPriorityManager.setAudioBuffering(false);

    const result = await p2Promise;
    expect(p2Executed).toBe(true);
    expect(result).toBe("p2_done");
  });

  it("should abort P2 tasks if signal aborts while waiting in queue", async () => {
    networkPriorityManager.setAudioBuffering(true);
    const controller = new AbortController();

    const p2Promise = networkPriorityManager.schedule(
      NetworkPriority.P2_BACKGROUND,
      async () => "never_runs",
      { signal: controller.signal }
    );

    controller.abort();

    await expect(p2Promise).rejects.toThrow("Aborted");
  });
});
