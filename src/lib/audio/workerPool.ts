/**
 * Bounded Web Worker pool (S7-3b).
 *
 * One task per worker; overflow waits in a priority queue. Audio workers speak
 * `{ type: "progress" | "complete" | "error" }`: progress is forwarded while
 * completion resolves the task. Buffers travel through `transfer` (moved, not
 * cloned). A crashed/timed-out worker is replaced up to `maxRestarts` times;
 * after that the pool reports itself unavailable so callers degrade explicitly.
 */
import { canUseWorker, WORKER_UNAVAILABLE_MESSAGE } from "./workerCapabilities";

export interface WorkerPoolStats {
  created: number;
  active: number;
  queued: number;
  completed: number;
  failed: number;
  restarts: number;
}

export interface WorkerPoolOptions {
  scriptUrl?: URL | string;
  /** Test seam; defaults to `new Worker(scriptUrl, { type: "module" })`. */
  createWorker?: () => Worker | null;
  /** Defaults to `min(2, hardwareConcurrency - 1)`, clamped to >= 1. */
  maxWorkers?: number;
  idleTimeoutMs?: number;
  taskTimeoutMs?: number;
  maxRestarts?: number;
  /** Called once when the pool can no longer create workers. */
  onWorkerUnavailable?: (reason: string) => void;
}

export interface WorkerTaskOptions {
  /** Higher runs first; FIFO within the same priority. */
  priority?: number;
  transfer?: Transferable[];
  timeoutMs?: number;
  onProgress?: (progress: number, data: Record<string, unknown>) => void;
}

interface WorkerEnvelope {
  type?: unknown;
  data?: ({ progress?: unknown; error?: unknown } & Record<string, unknown>) | undefined;
}

interface QueuedTask {
  message: unknown;
  options: WorkerTaskOptions;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export function getDefaultMaxWorkers(concurrency?: number): number {
  const cpus = typeof concurrency === "number" && concurrency > 0 ? concurrency : 2;
  return Math.max(1, Math.min(2, cpus - 1));
}

export class AudioWorkerPool {
  private readonly createWorker: () => Worker | null;
  private readonly maxWorkers: number;
  private readonly idleTimeoutMs: number;
  private readonly taskTimeoutMs: number;
  private readonly maxRestarts: number;
  private readonly onWorkerUnavailable?: (reason: string) => void;
  private readonly activeWorkers = new Set<Worker>();
  private readonly activeRejectors = new Map<Worker, (error: Error) => void>();
  private readonly idleTimers = new Map<Worker, ReturnType<typeof setTimeout>>();
  private idleWorkers: Worker[] = [];
  private queue: QueuedTask[] = [];
  private readonly stats = { created: 0, completed: 0, failed: 0, restarts: 0 };
  private consecutiveFailures = 0;
  private unavailableReason: string | null = null;

  constructor(options: WorkerPoolOptions = {}) {
    this.createWorker =
      options.createWorker ??
      (() => {
        if (!options.scriptUrl || !canUseWorker()) return null;
        try {
          return new Worker(options.scriptUrl, { type: "module" });
        } catch {
          return null;
        }
      });
    this.maxWorkers =
      options.maxWorkers ?? getDefaultMaxWorkers(globalThis.navigator?.hardwareConcurrency);
    this.idleTimeoutMs = options.idleTimeoutMs ?? 45000;
    this.taskTimeoutMs = options.taskTimeoutMs ?? 60000;
    this.maxRestarts = options.maxRestarts ?? 2;
    this.onWorkerUnavailable = options.onWorkerUnavailable;
  }

  public execute<T = unknown>(message: unknown, options: WorkerTaskOptions = {}): Promise<T> {
    if (this.unavailableReason) return Promise.reject(new Error(this.unavailableReason));
    return new Promise<T>((resolve, reject) => {
      this.enqueue({ message, options, resolve: resolve as (value: unknown) => void, reject });
      this.dispatch();
    });
  }

  public getStats(): WorkerPoolStats {
    return {
      created: this.stats.created,
      active: this.activeWorkers.size,
      queued: this.queue.length,
      completed: this.stats.completed,
      failed: this.stats.failed,
      restarts: this.stats.restarts,
    };
  }

  public getIdleCount(): number {
    return this.idleWorkers.length;
  }

  public terminateAll(): void {
    for (const task of this.queue.splice(0)) task.reject(new Error("Worker pool terminated"));
    for (const worker of this.activeWorkers) {
      this.activeRejectors.get(worker)?.(new Error("Worker pool terminated"));
      worker.terminate();
    }
    this.activeWorkers.clear();
    this.activeRejectors.clear();
    for (const worker of this.idleWorkers) worker.terminate();
    this.idleWorkers = [];
    for (const timer of this.idleTimers.values()) clearTimeout(timer);
    this.idleTimers.clear();
  }

  private enqueue(task: QueuedTask): void {
    const priority = task.options.priority ?? 0;
    let index = this.queue.length;
    while (index > 0 && (this.queue[index - 1].options.priority ?? 0) < priority) index -= 1;
    this.queue.splice(index, 0, task);
  }

  private dispatch(): void {
    while (this.queue.length > 0) {
      const worker = this.acquireWorker();
      if (!worker) return;
      this.run(worker, this.queue.shift()!);
    }
  }

  private acquireWorker(): Worker | null {
    const idle = this.idleWorkers.pop();
    if (idle) {
      const timer = this.idleTimers.get(idle);
      if (timer) clearTimeout(timer);
      this.idleTimers.delete(idle);
      this.activeWorkers.add(idle);
      return idle;
    }
    if (this.activeWorkers.size >= this.maxWorkers) return null;

    let worker: Worker | null = null;
    try {
      worker = this.createWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      this.markUnavailable(WORKER_UNAVAILABLE_MESSAGE);
      return null;
    }
    this.stats.created += 1;
    this.activeWorkers.add(worker);
    return worker;
  }

  private run(worker: Worker, task: QueuedTask): void {
    let settled = false;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      this.activeRejectors.delete(worker);
    };
    const succeed = (value: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      this.stats.completed += 1;
      this.consecutiveFailures = 0;
      this.releaseWorker(worker);
      task.resolve(value);
      this.dispatch();
    };
    const failTask = (error: Error, crashed: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      this.stats.failed += 1;
      if (crashed) {
        worker.terminate();
        this.activeWorkers.delete(worker);
        this.consecutiveFailures += 1;
        this.stats.restarts += 1;
        if (this.consecutiveFailures > this.maxRestarts) {
          this.markUnavailable(
            `Worker crashed ${this.consecutiveFailures} times: ${error.message}`
          );
        }
      } else {
        this.releaseWorker(worker);
      }
      task.reject(error);
      this.dispatch();
    };
    const onMessage = (event: MessageEvent) => {
      const envelope = event.data as WorkerEnvelope | null | undefined;
      const type = envelope?.type;
      if (type === "progress") {
        const raw = Number(envelope?.data?.progress);
        const progress = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
        task.options.onProgress?.(progress, envelope?.data ?? {});
        return;
      }
      if (type === "error") {
        failTask(new Error(String(envelope?.data?.error || "Worker task failed")), false);
        return;
      }
      if (type === "complete") {
        succeed(envelope?.data ?? envelope);
        return;
      }
      // Bare payload replies (legacy WorkerPoolManager contract) resolve as-is.
      succeed(envelope);
    };
    const onError = (event: ErrorEvent) => {
      const reason =
        event?.error instanceof Error ? event.error : new Error(event?.message || "Worker crashed");
      failTask(reason, true);
    };

    this.activeRejectors.set(worker, (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      this.stats.failed += 1;
      task.reject(error);
    });

    const timeoutMs = task.options.timeoutMs ?? this.taskTimeoutMs;
    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(
        () => failTask(new Error(`Worker task timed out after ${timeoutMs}ms`), true),
        timeoutMs
      );
    }

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    try {
      if (task.options.transfer && task.options.transfer.length > 0) {
        worker.postMessage(task.message, task.options.transfer);
      } else {
        worker.postMessage(task.message);
      }
    } catch (error) {
      // e.g. DataCloneError / already-detached transfer buffer: release the worker.
      failTask(error instanceof Error ? error : new Error("Failed to post task to worker"), false);
    }
  }

  private releaseWorker(worker: Worker): void {
    this.activeWorkers.delete(worker);
    this.idleWorkers.push(worker);
    const timer = setTimeout(() => {
      const index = this.idleWorkers.indexOf(worker);
      if (index !== -1) this.idleWorkers.splice(index, 1);
      this.idleTimers.delete(worker);
      worker.terminate();
    }, this.idleTimeoutMs);
    this.idleTimers.set(worker, timer);
  }

  private markUnavailable(reason: string): void {
    if (this.unavailableReason) return;
    this.unavailableReason = reason;
    this.onWorkerUnavailable?.(reason);
    for (const task of this.queue.splice(0)) task.reject(new Error(reason));
  }
}

/** Convenience factory for call sites that only know the worker URL. */
export function createAudioWorkerPool(
  scriptUrl: URL | string,
  options: Omit<WorkerPoolOptions, "scriptUrl" | "createWorker"> = {}
): AudioWorkerPool {
  return new AudioWorkerPool({ ...options, scriptUrl });
}
