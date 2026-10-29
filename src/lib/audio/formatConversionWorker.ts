import { AudioWorkerPool } from "./workerPool";
import { WORKER_UNAVAILABLE_MESSAGE } from "./workerCapabilities";

export interface FormatConversionWorkerPayload {
  type?: "progress" | "complete" | "error";
  data?: {
    progress?: number;
    /** Output bytes, transferred back from the worker (preferred reply). */
    outputBuffer?: ArrayBuffer;
    outputType?: string;
    /** "local" when /ffmpeg-core was used, "cdn" for the unpkg fallback. */
    coreSource?: string;
    /** Legacy reply from older worker bundles; structured-cloned, not transferred. */
    outputBlob?: Blob;
    error?: string;
  };
}

export interface FormatConversionWorkerMessage {
  type: "convert";
  data: {
    /**
     * Input audio bytes. Posted with `postMessage(message, [fileBuffer])`, which
     * detaches this buffer on the sender side (`byteLength === 0`) after posting.
     */
    fileBuffer: ArrayBuffer;
    sourceFormat: string;
    targetFormat: string;
    bitrate: number;
    sampleRate: number;
    channels: number;
    preserveMetadata: boolean;
  };
}

export interface FormatConversionWorkerLike {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<FormatConversionWorkerPayload>) => void
  ) => void;
  removeEventListener: (
    type: "message",
    listener: (event: MessageEvent<FormatConversionWorkerPayload>) => void
  ) => void;
  postMessage: {
    (message: FormatConversionWorkerMessage): void;
    (message: FormatConversionWorkerMessage, transfer: Transferable[]): void;
  };
}

export interface RunFormatConversionWorkerTaskInput {
  /** Preferred path: bounded pool (queue, timeout, restart, transferables). */
  pool?: AudioWorkerPool;
  /** Legacy direct worker; `null` when `createAudioWorker` reported unavailability. */
  worker?: FormatConversionWorkerLike | null;
  /** Raw audio bytes; ownership moves to the worker (detached after posting). */
  fileBuffer: ArrayBuffer;
  sourceFormat: string;
  targetFormat: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  preserveMetadata: boolean;
  onProgress: (progress: number) => void;
  /** Observability hook: "local" (/ffmpeg-core) or "cdn" (unpkg fallback). */
  onCoreSource?: (source: string) => void;
}

const CONVERSION_TIMEOUT_MS = 180000;

function normalizeProgress(progress: unknown): number | null {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return null;
  }

  return Math.max(0, Math.min(100, progress));
}

function toOutputBlob(data: FormatConversionWorkerPayload["data"] = {}): Blob {
  const outputBlob = data.outputBuffer
    ? new Blob([data.outputBuffer], { type: data.outputType || "" })
    : data.outputBlob;

  if (!outputBlob) {
    throw new Error("Conversion worker completed without output");
  }
  return outputBlob;
}

function buildMessage(
  fileBuffer: ArrayBuffer,
  sourceFormat: string,
  targetFormat: string,
  bitrate: number,
  sampleRate: number,
  channels: number,
  preserveMetadata: boolean
): FormatConversionWorkerMessage {
  return {
    type: "convert",
    data: {
      fileBuffer,
      sourceFormat,
      targetFormat,
      bitrate,
      sampleRate,
      channels,
      preserveMetadata,
    },
  };
}

export function runFormatConversionWorkerTask({
  pool,
  worker,
  fileBuffer,
  sourceFormat,
  targetFormat,
  bitrate,
  sampleRate,
  channels,
  preserveMetadata,
  onProgress,
  onCoreSource,
}: RunFormatConversionWorkerTaskInput): Promise<Blob> {
  const message = buildMessage(
    fileBuffer,
    sourceFormat,
    targetFormat,
    bitrate,
    sampleRate,
    channels,
    preserveMetadata
  );

  if (pool) {
    return pool
      .execute<FormatConversionWorkerPayload["data"]>(message, {
        transfer: [fileBuffer],
        timeoutMs: CONVERSION_TIMEOUT_MS,
        onProgress: (progress) => onProgress(progress),
      })
      .then((data) => {
        if (data?.coreSource) onCoreSource?.(data.coreSource);
        return toOutputBlob(data);
      });
  }

  if (!worker) {
    return Promise.reject(new Error(WORKER_UNAVAILABLE_MESSAGE));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener("message", workerHandler);
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const workerHandler = (event: MessageEvent<FormatConversionWorkerPayload>) => {
      const { type, data = {} } = event.data || {};

      if (type === "progress") {
        const progress = normalizeProgress(data.progress);
        if (progress !== null) {
          onProgress(progress);
        }
        return;
      }

      if (type === "complete") {
        settle(() => {
          if (data.coreSource) onCoreSource?.(data.coreSource);
          try {
            resolve(toOutputBlob(data));
          } catch (error) {
            reject(error instanceof Error ? error : new Error("Conversion failed"));
          }
        });
        return;
      }

      if (type === "error") {
        settle(() => reject(new Error(data.error || "Conversion failed")));
        return;
      }

      settle(() => reject(new Error("Unexpected conversion worker response")));
    };

    worker.addEventListener("message", workerHandler);

    try {
      // Transfer (not clone) the potentially large input buffer; it is detached after this call.
      worker.postMessage(message, [fileBuffer]);
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error("Conversion failed")));
    }
  });
}
