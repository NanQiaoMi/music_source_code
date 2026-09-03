/**
 * WorkerPoolManager
 * 管理并复用 Web Worker 实例，限制最大并发数（默认 2），
 * 并支持任务排队与 45s 空闲超时终止，防止多文件转码/波形提取时 Worker 实例暴增导致内存耗尽。
 */

export interface WorkerTask<TInput = any, TOutput = any> {
  id: string;
  data: TInput;
  transferables?: Transferable[];
  resolve: (value: TOutput) => void;
  reject: (reason: any) => void;
  timeoutMs?: number;
}

export class WorkerPoolManager {
  private static instances: Map<string, WorkerPoolManager> = new Map();
  private workerScriptUrl: URL | string;
  private maxWorkers: number;
  private idleTimeoutMs: number;

  private activeWorkers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private idleTimers: Map<Worker, ReturnType<typeof setTimeout>> = new Map();

  constructor(workerScriptUrl: URL | string, maxWorkers = 2, idleTimeoutMs = 45000) {
    this.workerScriptUrl = workerScriptUrl;
    this.maxWorkers = maxWorkers;
    this.idleTimeoutMs = idleTimeoutMs;
  }

  public static getPool(key: string, scriptUrl: URL | string, maxWorkers = 2): WorkerPoolManager {
    if (!WorkerPoolManager.instances.has(key)) {
      WorkerPoolManager.instances.set(key, new WorkerPoolManager(scriptUrl, maxWorkers));
    }
    return WorkerPoolManager.instances.get(key)!;
  }

  public getActiveCount(): number {
    return this.activeWorkers.length;
  }

  public getIdleCount(): number {
    return this.idleWorkers.length;
  }

  public getQueueLength(): number {
    return this.taskQueue.length;
  }

  protected createWorker(): Worker {
    return new Worker(this.workerScriptUrl, { type: "module" });
  }

  public execute<TInput = any, TOutput = any>(
    data: TInput,
    transferables?: Transferable[],
    timeoutMs = 60000
  ): Promise<TOutput> {
    return new Promise<TOutput>((resolve, reject) => {
      const task: WorkerTask<TInput, TOutput> = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        data,
        transferables,
        resolve,
        reject,
        timeoutMs,
      };

      this.taskQueue.push(task);
      this.dispatchNext();
    });
  }

  private dispatchNext(): void {
    if (this.taskQueue.length === 0) return;

    let worker: Worker | null = null;
    if (this.idleWorkers.length > 0) {
      worker = this.idleWorkers.pop()!;
      const timer = this.idleTimers.get(worker);
      if (timer) {
        clearTimeout(timer);
        this.idleTimers.delete(worker);
      }
    } else if (this.activeWorkers.length < this.maxWorkers) {
      worker = this.createWorker();
    }

    if (!worker) {
      // All workers busy, task waits in queue
      return;
    }

    const task = this.taskQueue.shift()!;
    this.activeWorkers.push(worker);

    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    if (task.timeoutMs && task.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        cleanup();
        worker?.terminate();
        this.removeActiveWorker(worker!);
        task.reject(new Error(`Worker task timed out after ${task.timeoutMs}ms`));
        this.dispatchNext();
      }, task.timeoutMs);
    }

    const onMessage = (e: MessageEvent) => {
      cleanup();
      this.releaseWorker(worker!);
      task.resolve(e.data);
      this.dispatchNext();
    };

    const onError = (e: ErrorEvent) => {
      cleanup();
      worker?.terminate();
      this.removeActiveWorker(worker!);
      task.reject(e.error || new Error(e.message));
      this.dispatchNext();
    };

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      worker?.removeEventListener("message", onMessage);
      worker?.removeEventListener("error", onError);
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);

    if (task.transferables && task.transferables.length > 0) {
      worker.postMessage(task.data, task.transferables);
    } else {
      worker.postMessage(task.data);
    }
  }

  private releaseWorker(worker: Worker): void {
    this.removeActiveWorker(worker);
    this.idleWorkers.push(worker);

    const idleTimer = setTimeout(() => {
      const idx = this.idleWorkers.indexOf(worker);
      if (idx !== -1) {
        this.idleWorkers.splice(idx, 1);
        worker.terminate();
      }
      this.idleTimers.delete(worker);
    }, this.idleTimeoutMs);

    this.idleTimers.set(worker, idleTimer);
  }

  private removeActiveWorker(worker: Worker): void {
    const idx = this.activeWorkers.indexOf(worker);
    if (idx !== -1) {
      this.activeWorkers.splice(idx, 1);
    }
  }

  public terminateAll(): void {
    for (const worker of this.activeWorkers) {
      worker.terminate();
    }
    this.activeWorkers = [];

    for (const worker of this.idleWorkers) {
      worker.terminate();
    }
    this.idleWorkers = [];

    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();
  }
}
