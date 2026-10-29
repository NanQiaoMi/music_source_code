import { describe, expect, it, vi } from "vitest";
import {
  FormatConversionWorkerLike,
  FormatConversionWorkerMessage,
  FormatConversionWorkerPayload,
  runFormatConversionWorkerTask,
} from "./formatConversionWorker";
import { WORKER_UNAVAILABLE_MESSAGE } from "./workerCapabilities";
import type { AudioWorkerPool } from "./workerPool";

type WorkerListener = (event: MessageEvent<FormatConversionWorkerPayload>) => void;

class FakeConversionWorker implements FormatConversionWorkerLike {
  lastMessage: FormatConversionWorkerMessage | null = null;
  lastTransfer: Transferable[] | undefined;
  private listeners = new Set<WorkerListener>();

  addEventListener(type: "message", listener: WorkerListener) {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: "message", listener: WorkerListener) {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  postMessage(message: FormatConversionWorkerMessage, transfer?: Transferable[]) {
    this.lastMessage = message;
    this.lastTransfer = transfer;
  }

  emit(payload: FormatConversionWorkerPayload) {
    for (const listener of this.listeners) {
      listener(new MessageEvent("message", { data: payload }));
    }
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

function runTask(worker: FakeConversionWorker | null, onProgress = vi.fn()) {
  const fileBuffer = new Uint8Array([1, 2, 3]).buffer;
  const promise = runFormatConversionWorkerTask({
    worker,
    fileBuffer,
    sourceFormat: "mp3",
    targetFormat: "flac",
    bitrate: 320,
    sampleRate: 44100,
    channels: 2,
    preserveMetadata: true,
    onProgress,
  });

  return { fileBuffer, onProgress, promise };
}

describe("runFormatConversionWorkerTask", () => {
  it("transfers the input buffer and resolves with the transferred output blob", async () => {
    const worker = new FakeConversionWorker();
    const { fileBuffer, onProgress, promise } = runTask(worker);
    const outputBuffer = new Uint8Array([9, 8]).buffer;

    expect(worker.lastMessage).toEqual({
      type: "convert",
      data: {
        fileBuffer,
        sourceFormat: "mp3",
        targetFormat: "flac",
        bitrate: 320,
        sampleRate: 44100,
        channels: 2,
        preserveMetadata: true,
      },
    });
    expect(worker.lastTransfer).toEqual([fileBuffer]);

    worker.emit({ type: "progress", data: { progress: 42 } });
    expect(onProgress).toHaveBeenCalledWith(42);

    worker.emit({ type: "complete", data: { outputBuffer, outputType: "audio/flac" } });

    const outputBlob = await promise;
    expect(outputBlob).toBeInstanceOf(Blob);
    expect(outputBlob.type).toBe("audio/flac");
    expect(new Uint8Array(await outputBlob.arrayBuffer())).toEqual(new Uint8Array([9, 8]));
    expect(worker.listenerCount).toBe(0);
  });

  it("rejects explicitly when workers are unavailable", async () => {
    const { promise } = runTask(null);
    await expect(promise).rejects.toThrow(WORKER_UNAVAILABLE_MESSAGE);
  });

  it("routes conversions through the pooled worker and reports the ffmpeg core source", async () => {
    const execute = vi.fn().mockResolvedValue({
      outputBuffer: new Uint8Array([5, 6]).buffer,
      outputType: "audio/flac",
      coreSource: "local",
    });
    const pool = { execute } as unknown as AudioWorkerPool;
    const onProgress = vi.fn();
    const onCoreSource = vi.fn();
    const fileBuffer = new Uint8Array([1, 2, 3]).buffer;

    const outputBlob = await runFormatConversionWorkerTask({
      pool,
      fileBuffer,
      sourceFormat: "mp3",
      targetFormat: "flac",
      bitrate: 320,
      sampleRate: 44100,
      channels: 2,
      preserveMetadata: true,
      onProgress,
      onCoreSource,
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: "convert", data: expect.objectContaining({ fileBuffer }) }),
      expect.objectContaining({ transfer: [fileBuffer] })
    );
    const poolOptions = execute.mock.calls[0][1] as { onProgress: (progress: number) => void };
    poolOptions.onProgress(37);
    expect(onProgress).toHaveBeenCalledWith(37);
    expect(onCoreSource).toHaveBeenCalledWith("local");
    expect(outputBlob.type).toBe("audio/flac");
    expect(new Uint8Array(await outputBlob.arrayBuffer())).toEqual(new Uint8Array([5, 6]));
  });

  it("surfaces pooled worker unavailability to the caller", async () => {
    const pool = {
      execute: vi.fn().mockRejectedValue(new Error(WORKER_UNAVAILABLE_MESSAGE)),
    } as unknown as AudioWorkerPool;

    await expect(
      runFormatConversionWorkerTask({
        pool,
        fileBuffer: new ArrayBuffer(2),
        sourceFormat: "mp3",
        targetFormat: "flac",
        bitrate: 320,
        sampleRate: 44100,
        channels: 2,
        preserveMetadata: false,
        onProgress: vi.fn(),
      })
    ).rejects.toThrow(WORKER_UNAVAILABLE_MESSAGE);
  });

  it("documents transfer semantics: a transferred buffer is detached in the sender", () => {
    const message = { data: { fileBuffer: new ArrayBuffer(8) } };
    const received = structuredClone(message, { transfer: [message.data.fileBuffer] });

    expect(message.data.fileBuffer.byteLength).toBe(0);
    expect(received.data.fileBuffer.byteLength).toBe(8);
  });

  it("clamps progress updates before forwarding them", async () => {
    const worker = new FakeConversionWorker();
    const { onProgress, promise } = runTask(worker);
    const outputBuffer = new ArrayBuffer(1);

    worker.emit({ type: "progress", data: { progress: -25 } });
    worker.emit({ type: "progress", data: { progress: 125 } });
    worker.emit({ type: "complete", data: { outputBuffer } });

    await promise;
    expect(onProgress).toHaveBeenNthCalledWith(1, 0);
    expect(onProgress).toHaveBeenNthCalledWith(2, 100);
  });

  it("rejects when the worker completes without output", async () => {
    const worker = new FakeConversionWorker();
    const { promise } = runTask(worker);
    const assertion = expect(promise).rejects.toThrow("Conversion worker completed without output");

    worker.emit({ type: "complete", data: {} });

    await assertion;
    expect(worker.listenerCount).toBe(0);
  });

  it("rejects when the worker reports an error", async () => {
    const worker = new FakeConversionWorker();
    const { promise } = runTask(worker);
    const assertion = expect(promise).rejects.toThrow("FFmpeg failed");

    worker.emit({ type: "error", data: { error: "FFmpeg failed" } });

    await assertion;
    expect(worker.listenerCount).toBe(0);
  });
});
