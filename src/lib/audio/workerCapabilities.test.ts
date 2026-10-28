import { afterEach, describe, expect, it, vi } from "vitest";
import { canUseWorker, createAudioWorker, WORKER_UNAVAILABLE_MESSAGE } from "./workerCapabilities";

class FakeWorker {
  constructor(
    public url: URL | string,
    public options?: WorkerOptions
  ) {}
}

describe("workerCapabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports worker availability from the global scope", () => {
    vi.stubGlobal("Worker", FakeWorker);
    expect(canUseWorker()).toBe(true);

    vi.stubGlobal("Worker", undefined);
    expect(canUseWorker()).toBe(false);
  });

  it("creates module workers when supported", () => {
    const instances: FakeWorker[] = [];
    class RecordingWorker extends FakeWorker {
      constructor(url: URL | string, options?: WorkerOptions) {
        super(url, options);
        instances.push(this);
      }
    }
    vi.stubGlobal("Worker", RecordingWorker);

    const worker = createAudioWorker(new URL("https://example.test/worker.js"));

    expect(worker).toBeInstanceOf(RecordingWorker);
    expect(instances).toHaveLength(1);
    expect(instances[0].options).toEqual({ type: "module" });
  });

  it("returns null instead of throwing when Worker is undefined", () => {
    vi.stubGlobal("Worker", undefined);
    expect(createAudioWorker("worker.js")).toBeNull();
  });

  it("returns null instead of throwing when worker construction fails", () => {
    class ThrowingWorker {
      constructor() {
        throw new Error("Worker blocked by policy");
      }
    }
    vi.stubGlobal("Worker", ThrowingWorker);

    expect(createAudioWorker("worker.js")).toBeNull();
  });

  it("exposes an explicit unavailable message for the fallback path", () => {
    expect(WORKER_UNAVAILABLE_MESSAGE).toMatch(/unavailable/i);
  });
});
