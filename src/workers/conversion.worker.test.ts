import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ffmpegMock = vi.hoisted(() => ({
  on: vi.fn(),
  load: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  exec: vi.fn(async () => 0),
  readFile: vi.fn(async () => new Uint8Array([7, 8])),
  deleteFile: vi.fn(async () => undefined),
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    on = ffmpegMock.on;
    load = ffmpegMock.load;
    writeFile = ffmpegMock.writeFile;
    exec = ffmpegMock.exec;
    readFile = ffmpegMock.readFile;
    deleteFile = ffmpegMock.deleteFile;
  },
}));

type FetchReply = { ok: boolean; status?: number };
type FetchHandler = (url: string, method: string) => FetchReply | Promise<FetchReply>;

function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const reply = await handler(String(input), init?.method ?? "GET");
    return reply.ok
      ? new Response(new Uint8Array([1, 2]), { status: 200 })
      : new Response(null, { status: reply.status ?? 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loadWorker() {
  return import("./conversion.worker");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  if (typeof URL.createObjectURL !== "function") {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock"),
    });
  }
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("conversion worker FFmpeg core selection", () => {
  it("prefers the same-origin /ffmpeg-core assets", async () => {
    const fetchMock = stubFetch(() => ({ ok: true }));
    const worker = await loadWorker();

    await expect(worker.resolveFFmpegCoreSource()).resolves.toEqual({
      baseURL: "/ffmpeg-core",
      source: "local",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/ffmpeg-core/ffmpeg-core.js", {
      method: "HEAD",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/ffmpeg-core/ffmpeg-core.wasm", {
      method: "HEAD",
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("falls back to the pinned unpkg core when a local asset is missing", async () => {
    stubFetch((url) => ({ ok: !url.endsWith(".wasm") }));
    const worker = await loadWorker();

    await expect(worker.resolveFFmpegCoreSource()).resolves.toEqual({
      baseURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd",
      source: "cdn",
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("self-hosted FFmpeg core missing")
    );
  });

  it("falls back when the presence check cannot reach the origin (offline)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const worker = await loadWorker();

    await expect(worker.resolveFFmpegCoreSource()).resolves.toMatchObject({ source: "cdn" });
  });

  it("reports the core source in progress and complete messages", async () => {
    stubFetch(() => ({ ok: true }));
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);
    const worker = await loadWorker();
    const onmessage = (
      self as unknown as { onmessage: ((event: MessageEvent) => Promise<void>) | null }
    ).onmessage;

    await onmessage?.({
      data: {
        type: "convert",
        data: {
          fileBuffer: new Uint8Array([1, 2]).buffer,
          sourceFormat: "mp3",
          targetFormat: "flac",
          bitrate: 320,
          sampleRate: 44100,
          channels: 2,
          preserveMetadata: true,
        },
      },
    } as MessageEvent);

    const complete = postMessage.mock.calls.find(([message]) => message.type === "complete");
    expect(complete).toBeDefined();
    expect(complete?.[0].data.coreSource).toBe("local");
    expect(complete?.[0].data.outputType).toBe("audio/flac");
    expect(complete?.[1]).toEqual([complete?.[0].data.outputBuffer]);
    expect(ffmpegMock.load).toHaveBeenCalledTimes(1);

    const progress = postMessage.mock.calls.filter(([message]) => message.type === "progress");
    expect(progress.at(-1)?.[0].data).toMatchObject({ progress: 100, coreSource: "local" });
    expect(worker.LOCAL_FFMPEG_CORE_BASE_URL).toBe("/ffmpeg-core");
  });
});
