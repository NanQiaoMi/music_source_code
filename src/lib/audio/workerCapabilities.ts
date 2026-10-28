/**
 * Web Worker capability detection and defensive worker creation.
 *
 * Transfer semantics (S7-3): audio payloads must travel as transferables, i.e.
 * `worker.postMessage(message, [buffer])`. The sender's `ArrayBuffer` is then
 * *detached* (`buffer.byteLength === 0`) and must never be read again; the
 * worker owns the memory. When workers are unavailable we fail explicitly
 * instead of silently falling back to a blocking main-thread conversion.
 */
export const WORKER_UNAVAILABLE_MESSAGE =
  "Web Worker is unavailable in this environment; conversion was skipped";

export function canUseWorker(scope: typeof globalThis = globalThis): boolean {
  try {
    return typeof (scope as { Worker?: unknown }).Worker === "function";
  } catch {
    return false;
  }
}

export function createAudioWorker(
  scriptUrl: URL | string,
  scope: typeof globalThis = globalThis
): Worker | null {
  if (!canUseWorker(scope)) {
    return null;
  }

  try {
    const WorkerConstructor = (scope as unknown as { Worker: typeof Worker }).Worker;
    return new WorkerConstructor(scriptUrl, { type: "module" });
  } catch {
    return null;
  }
}
