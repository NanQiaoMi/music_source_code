export interface FormatConversionWorkerPayload {
  type?: "progress" | "complete" | "error";
  data?: {
    progress?: number;
    outputBlob?: Blob;
    error?: string;
  };
}

export interface FormatConversionWorkerMessage {
  type: "convert";
  data: {
    fileBlob: Blob;
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
  postMessage: (message: FormatConversionWorkerMessage) => void;
}

export interface RunFormatConversionWorkerTaskInput {
  worker: FormatConversionWorkerLike;
  fileBlob: Blob;
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
  fileBlob,
  sourceFormat,
  targetFormat,
  bitrate,
  sampleRate,
  channels,
  preserveMetadata,
  onProgress,
}: RunFormatConversionWorkerTaskInput): Promise<Blob> {
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
          if (data.outputBlob) {
            resolve(data.outputBlob);
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

    try {
      worker.postMessage({
        type: "convert",
        data: {
          fileBlob,
          sourceFormat,
          targetFormat,
          bitrate,
          sampleRate,
          channels,
          preserveMetadata,
        },
      });
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error("Conversion failed")));
    }
  });
}
