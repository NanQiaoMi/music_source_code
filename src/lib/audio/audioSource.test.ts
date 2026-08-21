import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAudioSourceBlob } from "./audioSource";

const mocks = vi.hoisted(() => ({
  getStoredMusic: vi.fn(),
  getFileFromStorage: vi.fn(),
}));

vi.mock("@/services/localMusicStorage", () => ({
  getStoredMusic: mocks.getStoredMusic,
}));

vi.mock("@/services/localMusicService", () => ({
  getFileFromStorage: mocks.getFileFromStorage,
}));

const baseSong = {
  id: "song-1",
  title: "Audio Demo",
};

describe("resolveAudioSourceBlob", () => {
  beforeEach(() => {
    mocks.getStoredMusic.mockReset();
    mocks.getFileFromStorage.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads stored:// sources and infers format from filename", async () => {
    mocks.getStoredMusic.mockResolvedValue({
      id: "stored-1",
      fileData: new Uint8Array([1, 2, 3]).buffer,
      fileType: "audio/mpeg",
      fileName: "demo.flac",
    });

    const result = await resolveAudioSourceBlob({ ...baseSong, audioUrl: "stored://stored-1" });

    expect(mocks.getStoredMusic).toHaveBeenCalledWith("stored-1");
    expect(result.sourceLabel).toBe("demo.flac");
    expect(result.inferredFormat).toBe("flac");
    expect(result.blob.size).toBe(3);
  });

  it("loads local:// sources and respects explicit song format", async () => {
    mocks.getFileFromStorage.mockResolvedValue({
      data: new Uint8Array([4, 5]).buffer,
      type: "audio/x-wav",
    });

    const result = await resolveAudioSourceBlob({
      ...baseSong,
      audioUrl: "local://legacy-1",
      format: "MP3",
    });

    expect(mocks.getFileFromStorage).toHaveBeenCalledWith("legacy-1");
    expect(result.inferredFormat).toBe("mp3");
    expect(result.sourceLabel).toBe("local://legacy-1");
  });

  it("loads remote URLs through fetch and infers format from MIME type", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([new Uint8Array([8, 9])], { type: "audio/ogg" }),
    } as Response);

    const result = await resolveAudioSourceBlob({ ...baseSong, audioUrl: "/tracks/demo" });

    expect(fetch).toHaveBeenCalledWith("/tracks/demo");
    expect(result.inferredFormat).toBe("ogg");
    expect(result.blob.size).toBe(2);
  });

  it("rejects missing or empty audio sources", async () => {
    await expect(resolveAudioSourceBlob(baseSong)).rejects.toThrow(
      "No audio source available for Audio Demo"
    );

    mocks.getStoredMusic.mockResolvedValue({
      fileData: new Uint8Array([]).buffer,
      fileType: "audio/mpeg",
      fileName: "empty.mp3",
    });

    await expect(
      resolveAudioSourceBlob({ ...baseSong, audioUrl: "stored://empty" })
    ).rejects.toThrow("Audio source file is empty for Audio Demo");
  });
});
