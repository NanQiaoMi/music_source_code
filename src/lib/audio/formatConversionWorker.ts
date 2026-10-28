import { WORKER_UNAVAILABLE_MESSAGE } from "./workerCapabilities";

export interface FormatConversionWorkerPayload {
  type?: "progress" | "complete" | "error";
  data?: {
    progress?: number;
    /** Output bytes, transferred back from the worker (preferred reply). */
    outputBuffer?: ArrayBuffer;
    outputType?: string;
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
  /** `null` when `createAudioWorker` reported that workers are unavailable. */
  worker: FormatConversionWorkerLike | null;
  /** Raw audio bytes; ownership moves to the worker (detached after posting). */
  fileBuffer: ArrayBuffer;
  sourceFormat: string;
  targetFormat: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  preserveMetadata: boolean;
  onProgress: (progress: number) => void;
}

function normalizeProgress(progress: unknown): number | null {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return null;
  }

  return Math.max(0, Math.min(100, progress));
}

export function runFormatConversionWorkerTask({
  worker,
  fileBuffer,
  sourceFormat,
  targetFormat,
  bitrate,
  sampleRate,
  channels,
  preserveMetadata,
  onProgress,
}: RunFormatConversionWorkerTaskInput): Promise<Blob> {
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
          const outputBlob = data.outputBuffer
            ? new Blob([data.outputBuffer], { type: data.outputType || "" })
            : data.outputBlob;

          if (outputBlob) {
            resolve(outputBlob);
          } else {
            reject(new Error("Conversion worker completed without output"));
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

    const message: FormatConversionWorkerMessage = {
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

    try {
      // Transfer (not clone) the potentially large input buffer; it is detached after this call.
      worker.postMessage(message, [fileBuffer]);
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error("Conversion failed")));
    }
  });
}
