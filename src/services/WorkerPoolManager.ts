/**
 * WorkerPoolManager (S7-3 legacy facade).
 *
 * Kept for callers/tests written before S7-3b; all scheduling, transferables,
 * timeouts and crash-restarts now live in `@/lib/audio/workerPool`. New code
 * should use `AudioWorkerPool` directly.
 */
import { AudioWorkerPool, type WorkerPoolStats } from "@/lib/audio/workerPool";

export interface WorkerTask<TInput = unknown, TOutput = unknown> {
  id: string;
  data: TInput;
  transferables?: Transferable[];
  // 用方法签名而非属性签名：方法保留双向变型，泛型任务才能入队到 WorkerTask[] 统一队列
  resolve(value: TOutput): void;
  reject(reason: unknown): void;
  timeoutMs?: number;
}

export class WorkerPoolManager {
  private static instances: Map<string, WorkerPoolManager> = new Map();
  private workerScriptUrl: URL | string;
  private pool: AudioWorkerPool;

  constructor(workerScriptUrl: URL | string, maxWorkers = 2, idleTimeoutMs = 45000) {
    this.workerScriptUrl = workerScriptUrl;
    this.pool = new AudioWorkerPool({
      maxWorkers,
      idleTimeoutMs,
      createWorker: () => this.createWorker(),
    });
  }

  public static getPool(key: string, scriptUrl: URL | string, maxWorkers = 2): WorkerPoolManager {
    if (!WorkerPoolManager.instances.has(key)) {
      WorkerPoolManager.instances.set(key, new WorkerPoolManager(scriptUrl, maxWorkers));
    }
    return WorkerPoolManager.instances.get(key)!;
  }

  public getActiveCount(): number {
    return this.pool.getStats().active;
  }

  public getIdleCount(): number {
    return this.pool.getIdleCount();
  }

  public getQueueLength(): number {
    return this.pool.getStats().queued;
  }

  public getStats(): WorkerPoolStats {
    return this.pool.getStats();
  }

  protected createWorker(): Worker {
    return new Worker(this.workerScriptUrl, { type: "module" });
  }

  public execute<TInput = unknown, TOutput = unknown>(
    data: TInput,
    transferables?: Transferable[],
    timeoutMs = 60000
  ): Promise<TOutput> {
    return this.pool.execute<TOutput>(data, { transfer: transferables, timeoutMs });
  }

  public terminateAll(): void {
    this.pool.terminateAll();
  }
}
