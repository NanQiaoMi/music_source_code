import { describe, expect, it, vi } from "vitest";
import {
  FormatConversionWorkerLike,
  FormatConversionWorkerMessage,
  FormatConversionWorkerPayload,
  runFormatConversionWorkerTask,
} from "./formatConversionWorker";

type WorkerListener = (event: MessageEvent<FormatConversionWorkerPayload>) => void;

class FakeConversionWorker implements FormatConversionWorkerLike {
  lastMessage: FormatConversionWorkerMessage | null = null;
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

  postMessage(message: FormatConversionWorkerMessage) {
    this.lastMessage = message;
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

function runTask(worker: FakeConversionWorker, onProgress = vi.fn()) {
  const fileBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" });
  const promise = runFormatConversionWorkerTask({
    worker,
    fileBlob,
    sourceFormat: "mp3",
    targetFormat: "flac",
    bitrate: 320,
    sampleRate: 44100,
    channels: 2,
    preserveMetadata: true,
    onProgress,
  });

  return { fileBlob, onProgress, promise };
}

describe("runFormatConversionWorkerTask", () => {
  it("posts conversion settings and resolves with the output blob", async () => {
    const worker = new FakeConversionWorker();
    const { fileBlob, onProgress, promise } = runTask(worker);
    const outputBlob = new Blob([new Uint8Array([9, 8])], { type: "audio/flac" });

    expect(worker.lastMessage).toEqual({
      type: "convert",
      data: {
        fileBlob,
        sourceFormat: "mp3",
        targetFormat: "flac",
        bitrate: 320,
        sampleRate: 44100,
        channels: 2,
        preserveMetadata: true,
      },
    });

    worker.emit({ type: "progress", data: { progress: 42 } });
    expect(onProgress).toHaveBeenCalledWith(42);

    worker.emit({ type: "complete", data: { outputBlob } });

    await expect(promise).resolves.toBe(outputBlob);
    expect(worker.listenerCount).toBe(0);
  });

  it("clamps progress updates before forwarding them", async () => {
    const worker = new FakeConversionWorker();
    const { onProgress, promise } = runTask(worker);
    const outputBlob = new Blob([new Uint8Array([1])], { type: "audio/wav" });

    worker.emit({ type: "progress", data: { progress: -25 } });
    worker.emit({ type: "progress", data: { progress: 125 } });
    worker.emit({ type: "complete", data: { outputBlob } });

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
