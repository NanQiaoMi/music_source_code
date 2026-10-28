/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// Worker 事件桩只需"能被调用"，用具体函数签名会与调用方的 (e: MessageEvent) 产生逆变冲突
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkerPoolManager } from "./WorkerPoolManager";

class MockWorker {
  public onmessage: ((e: MessageEvent) => void) | null = null;
  public onerror: ((e: ErrorEvent) => void) | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  public terminated = false;
  public lastTransfer?: Transferable[];

  constructor(
    public scriptUrl: string | URL,
    public options?: any
  ) {}

  addEventListener(type: string, listener: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Function) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(data: any, transfer?: Transferable[]) {
    this.lastTransfer = transfer;
    const payload = data;
    setTimeout(() => {
      if (this.terminated) return;
      const listeners = Array.from(this.listeners.get("message") || []);
      listeners.forEach((fn) => fn({ data: { result: payload, processed: true } }));
    }, 10);
  }

  terminate() {
    this.terminated = true;
  }
}

class TestableWorkerPool extends WorkerPoolManager {
  public mockWorkers: MockWorker[] = [];

  protected override createWorker(): Worker {
    const worker = new MockWorker(this["workerScriptUrl"]);
    this.mockWorkers.push(worker);
    return worker as unknown as Worker;
  }
}

describe("WorkerPoolManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("limits maximum worker instances to maxWorkers and queues overflow tasks", async () => {
    const pool = new TestableWorkerPool("test-worker.js", 2, 5000);

    const task1Promise = pool.execute({ id: 1 });
    const task2Promise = pool.execute({ id: 2 });
    const task3Promise = pool.execute({ id: 3 });

    expect(pool.getActiveCount()).toBe(2);
    expect(pool.getQueueLength()).toBe(1);
    expect(pool.mockWorkers.length).toBe(2);

    // Fast-forward so task 1 & 2 complete
    await vi.advanceTimersByTimeAsync(15);

    const res1 = await task1Promise;
    const res2 = await task2Promise;
    expect(res1).toEqual({ result: { id: 1 }, processed: true });
    expect(res2).toEqual({ result: { id: 2 }, processed: true });

    // Task 3 should now have been dequeued and executed
    expect(pool.getQueueLength()).toBe(0);
    await vi.advanceTimersByTimeAsync(15);
    const res3 = await task3Promise;
    expect(res3).toEqual({ result: { id: 3 }, processed: true });

    pool.terminateAll();
  });

  it("forwards transferable buffers to worker.postMessage", async () => {
    const pool = new TestableWorkerPool("test-worker.js", 1, 5000);
    const fileBuffer = new ArrayBuffer(8);

    const taskPromise = pool.execute({ fileBuffer }, [fileBuffer]);
    await vi.advanceTimersByTimeAsync(15);
    await taskPromise;

    expect(pool.mockWorkers[0].lastTransfer).toEqual([fileBuffer]);
    pool.terminateAll();
  });

  it("terminates idle workers after idleTimeoutMs", async () => {
    const pool = new TestableWorkerPool("test-worker.js", 2, 3000);

    const taskPromise = pool.execute({ id: "fast" });
    await vi.advanceTimersByTimeAsync(15);
    await taskPromise;

    expect(pool.getActiveCount()).toBe(0);
    expect(pool.getIdleCount()).toBe(1);

    // Fast forward idle timeout
    await vi.advanceTimersByTimeAsync(3100);

    expect(pool.getIdleCount()).toBe(0);
    expect(pool.mockWorkers[0].terminated).toBe(true);

    pool.terminateAll();
  });
});
