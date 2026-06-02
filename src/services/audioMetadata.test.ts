import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readTags: vi.fn(),
}));

vi.mock("jsmediatags", () => ({
  default: {
    read: mocks.readTags,
  },
}));

import { batchExtractMetadata, extractAudioMetadata } from "./audioMetadata";

class FakeAudio {
  duration = 88;
  private listeners = new Map<string, () => void>();

  addEventListener(event: string, callback: () => void) {
    this.listeners.set(event, callback);
  }

  set src(_value: string) {
    queueMicrotask(() => this.listeners.get("loadedmetadata")?.());
  }
}

describe("audioMetadata", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.readTags.mockReset();
    mocks.readTags.mockImplementation((_file, handlers) => handlers.onError(new Error("no tags")));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:metadata-probe");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(Date, "now").mockReturnValue(1234);
  });

  it("returns a readable error for unsupported audio formats", async () => {
    const result = await extractAudioMetadata(
      new File(["notes"], "notes.txt", { type: "text/plain" })
    );

    expect(result).toEqual({
      success: false,
      error: "不支持的音频格式: text/plain",
    });
  });

  it("falls back to readable filename metadata when tag extraction fails", async () => {
    const result = await extractAudioMetadata(
      new File([new Uint8Array([1, 2, 3])], "Artist – Track.mp3", { type: "audio/mpeg" }),
      "song-1"
    );

    expect(result.success).toBe(true);
    expect(result.metadata).toMatchObject({
      id: "song-1",
      title: "Track",
      artist: "Artist",
      album: "未知专辑",
      duration: 88,
      fileType: "audio/mpeg",
      fileSize: 3,
    });
  });

  it("returns a readable batch error for unsupported files", async () => {
    const [result] = await batchExtractMetadata([
      new File(["cover"], "cover.png", { type: "image/png" }),
    ]);

    expect(result).toEqual({
      success: false,
      error: "文件不受支持: cover.png",
    });
  });
});
