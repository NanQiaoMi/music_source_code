/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（FakeWorker 事件对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioWorkerPool, getDefaultMaxWorkers, type WorkerPoolOptions } from "./workerPool";
import { WORKER_UNAVAILABLE_MESSAGE } from "./workerCapabilities";

type Listener = (event: any) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly listeners = new Map<string, Set<Listener>>();
  readonly posted: Array<{ message: unknown; transfer?: Transferable[] }> = [];
  terminated = false;
  throwOnPost: string | null = null;

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: unknown, transfer?: Transferable[]) {
    if (this.throwOnPost) throw new Error(this.throwOnPost);
    this.posted.push({ message, transfer });
  }

  terminate() {
    this.terminated = true;
  }

  emitMessage(data: unknown) {
    for (const listener of Array.from(this.listeners.get("message") || [])) {
      listener({ data });
    }
  }

  emitError(message = "boom") {
    for (const listener of Array.from(this.listeners.get("error") || [])) {
      listener({ message });
    }
  }

  get lastPosted() {
    return this.posted[this.posted.length - 1];
  }
}

function createPool(options: Partial<WorkerPoolOptions> = {}) {
  return new AudioWorkerPool({
    createWorker: () => new FakeWorker() as unknown as Worker,
    idleTimeoutMs: 60000,
    ...options,
  });
}

describe("AudioWorkerPool", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps concurrency at maxWorkers and queues overflow until a worker frees up", async () => {
    const pool = createPool({ maxWorkers: 2 });

    const first = pool.execute({ id: 1 });
    const second = pool.execute({ id: 2 });
    const third = pool.execute({ id: 3 });

    expect(pool.getStats()).toMatchObject({ created: 2, active: 2, queued: 1 });
    expect(FakeWorker.instances[0].lastPosted?.message).toEqual({ id: 1 });

    FakeWorker.instances[0].emitMessage({ type: "complete", data: { done: 1 } });
    await expect(first).resolves.toEqual({ done: 1 });
    expect(pool.getStats()).toMatchObject({ created: 2, completed: 1, queued: 0 });
    expect(FakeWorker.instances[0].lastPosted?.message).toEqual({ id: 3 });

    FakeWorker.instances[1].emitMessage({ type: "complete", data: { done: 2 } });
    FakeWorker.instances[0].emitMessage({ type: "complete", data: { done: 3 } });
    await expect(second).resolves.toEqual({ done: 2 });
    await expect(third).resolves.toEqual({ done: 3 });
    expect(pool.getStats()).toMatchObject({ completed: 3, failed: 0, active: 0, queued: 0 });
    pool.terminateAll();
  });

  it("runs higher-priority queued tasks first while keeping FIFO for equal priority", async () => {
    const pool = createPool({ maxWorkers: 1 });

    const first = pool.execute({ id: "first" });
    const worker = FakeWorker.instances[0];
    const low = pool.execute({ id: "low" });
    const high = pool.execute({ id: "high" }, { priority: 5 });
    expect(pool.getStats().queued).toBe(2);
    expect(worker.lastPosted?.message).toEqual({ id: "first" });

    worker.emitMessage({ type: "complete", data: {} });
    await first;
    expect(worker.lastPosted?.message).toEqual({ id: "high" });

    worker.emitMessage({ type: "complete", data: {} });
    await high;
    expect(worker.lastPosted?.message).toEqual({ id: "low" });

    worker.emitMessage({ type: "complete", data: {} });
    await low;
    expect(FakeWorker.instances).toHaveLength(1);
    pool.terminateAll();
  });

  it("forwards the transfer list, clamps progress and returns the transferred output", async () => {
    const pool = createPool({ maxWorkers: 1 });
    const onProgress = vi.fn();
    const fileBuffer = new ArrayBuffer(8);
    const promise = pool.execute({ fileBuffer }, { transfer: [fileBuffer], onProgress });
    const outputBuffer = new ArrayBuffer(4);

    expect(FakeWorker.instances[0].lastPosted?.transfer).toEqual([fileBuffer]);

    FakeWorker.instances[0].emitMessage({ type: "progress", data: { progress: 125 } });
    expect(onProgress).toHaveBeenCalledWith(100, { progress: 125 });

    FakeWorker.instances[0].emitMessage({
      type: "complete",
      data: { outputBuffer, outputType: "audio/flac" },
    });
    await expect(promise).resolves.toEqual({ outputBuffer, outputType: "audio/flac" });
    pool.terminateAll();
  });

  it("rejects timed-out tasks, terminates the worker and counts a restart", async () => {
    const pool = createPool({ maxWorkers: 1, maxRestarts: 2 });
    const promise = pool.execute({ id: 1 }, { timeoutMs: 100 });
    const assertion = expect(promise).rejects.toThrow("Worker task timed out after 100ms");

    await vi.advanceTimersByTimeAsync(101);
    await assertion;

    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(pool.getStats()).toMatchObject({ failed: 1, restarts: 1, created: 1 });

    // The next task spins up a replacement worker.
    const next = pool.execute({ id: 2 });
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].emitMessage({ type: "complete", data: { ok: true } });
    await expect(next).resolves.toEqual({ ok: true });
    pool.terminateAll();
  });

  it("restarts crashed workers up to maxRestarts, then reports the pool unavailable", async () => {
    const onWorkerUnavailable = vi.fn();
    const pool = createPool({ maxWorkers: 1, maxRestarts: 1, onWorkerUnavailable });

    const first = pool.execute({ id: 1 });
    const firstAssertion = expect(first).rejects.toThrow("boom");
    FakeWorker.instances[0].emitError("boom");
    await firstAssertion;
    expect(pool.getStats()).toMatchObject({ failed: 1, restarts: 1, created: 1 });

    const second = pool.execute({ id: 2 });
    expect(FakeWorker.instances).toHaveLength(2);
    const secondAssertion = expect(second).rejects.toThrow("boom again");
    FakeWorker.instances[1].emitError("boom again");
    await secondAssertion;

    expect(onWorkerUnavailable).toHaveBeenCalledWith(
      expect.stringContaining("Worker crashed 2 times")
    );
    expect(pool.getStats()).toMatchObject({ failed: 2, restarts: 2, created: 2 });

    await expect(pool.execute({ id: 3 })).rejects.toThrow("Worker crashed 2 times");
  });

  it("rejects explicitly and calls back when workers cannot be created", async () => {
    const onWorkerUnavailable = vi.fn();
    const pool = new AudioWorkerPool({ createWorker: () => null, onWorkerUnavailable });

    await expect(pool.execute({ id: 1 })).rejects.toThrow(WORKER_UNAVAILABLE_MESSAGE);
    expect(onWorkerUnavailable).toHaveBeenCalledWith(WORKER_UNAVAILABLE_MESSAGE);
    expect(pool.getStats()).toMatchObject({ created: 0, queued: 0, failed: 0 });
  });

  it("rejects on worker-reported errors without restarting", async () => {
    const pool = createPool({ maxWorkers: 1 });
    const promise = pool.execute({ id: 1 });
    const assertion = expect(promise).rejects.toThrow("FFmpeg failed");

    FakeWorker.instances[0].emitMessage({ type: "error", data: { error: "FFmpeg failed" } });
    await assertion;

    expect(FakeWorker.instances[0].terminated).toBe(false);
    expect(pool.getStats()).toMatchObject({ failed: 1, restarts: 0, completed: 0 });
    pool.terminateAll();
  });

  it("rejects and releases the worker when postMessage throws", async () => {
    const worker = new FakeWorker();
    worker.throwOnPost = "clone failed";
    const pool = new AudioWorkerPool({
      createWorker: () => worker as unknown as Worker,
      maxWorkers: 1,
    });

    await expect(pool.execute({ id: 1 })).rejects.toThrow("clone failed");
    expect(pool.getStats()).toMatchObject({ failed: 1, active: 0, created: 1 });

    worker.throwOnPost = null;
    const retry = pool.execute({ id: 2 });
    expect(worker.lastPosted?.message).toEqual({ id: 2 });
    worker.emitMessage({ type: "complete", data: { ok: true } });
    await expect(retry).resolves.toEqual({ ok: true });
    pool.terminateAll();
  });

  it("derives the default worker count from hardwareConcurrency", () => {
    expect(getDefaultMaxWorkers(8)).toBe(2);
    expect(getDefaultMaxWorkers(2)).toBe(1);
    expect(getDefaultMaxWorkers(1)).toBe(1);
    expect(getDefaultMaxWorkers(undefined)).toBe(1);
  });
});
