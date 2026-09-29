import { useCallback, useRef, useState } from "react";

export type TaskStatus = "idle" | "running" | "done" | "cancelled" | "error";

export interface TaskResult {
  status: TaskStatus;
  error?: string;
}

export interface CancellableTask {
  run: () => Promise<TaskResult>;
  cancel: () => void;
  readonly status: TaskStatus;
}

export interface CancellableTaskOptions {
  onProgress?: (done: number, total: number) => void;
}

/**
 * 逐单元执行、可上报进度、可中途取消的批量任务。
 * 用于测速、离线缓存清理、脚本批量拉取这类会卡住 UI 的长循环。
 */
export function createCancellableTask(
  total: number,
  unit: (index: number, report: (done: number) => void) => Promise<void> | void,
  options: CancellableTaskOptions = {}
): CancellableTask {
  let cancelled = false;
  let status: TaskStatus = "idle";
  let lastReported: number | null = null;

  // 单元内 report() 与整单元完成后的自动上报可能指向同一个进度值，只发一次。
  const emit = (done: number) => {
    if (done === lastReported) return;
    lastReported = done;
    options.onProgress?.(done, total);
  };

  const cancel = () => {
    if (status === "running") {
      cancelled = true;
      status = "cancelled";
    }
  };

  const run = async (): Promise<TaskResult> => {
    status = "running";
    cancelled = false;
    lastReported = null;
    try {
      for (let i = 0; i < total; i++) {
        if (cancelled) return { status: "cancelled" };
        await unit(i, emit);
        if (cancelled) return { status: "cancelled" };
        emit(i + 1);
      }
      status = "done";
      return { status: "done" };
    } catch (e) {
      status = "error";
      return { status: "error", error: e instanceof Error ? e.message : String(e) };
    }
  };

  return {
    run,
    cancel,
    get status() {
      return status;
    },
  };
}

export interface CancellableTaskHook {
  start: () => Promise<TaskResult>;
  cancel: () => void;
  progress: number;
  status: TaskStatus;
}

export function useCancellableTask(
  total: number,
  unit: (index: number, report: (done: number) => void) => Promise<void> | void
): CancellableTaskHook {
  const taskRef = useRef<ReturnType<typeof createCancellableTask> | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<TaskStatus>("idle");

  const start = useCallback(async () => {
    const task = createCancellableTask(total, unit, {
      onProgress: (done, all) => setProgress(all === 0 ? 0 : done / all),
    });
    taskRef.current = task;
    setProgress(0);
    setStatus("running");
    const res = await task.run();
    setStatus(res.status);
    return res;
  }, [total, unit]);

  const cancel = useCallback(() => taskRef.current?.cancel(), []);

  return { start, cancel, progress, status };
}
