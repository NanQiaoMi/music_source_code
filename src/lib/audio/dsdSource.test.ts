import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDSDSourceBlob } from "./dsdSource";

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
  title: "DSD Demo",
};

describe("resolveDSDSourceBlob", () => {
  beforeEach(() => {
    mocks.getStoredMusic.mockReset();
    mocks.getFileFromStorage.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads stored:// sources from localMusicStorage", async () => {
    mocks.getStoredMusic.mockResolvedValue({
      id: "stored-1",
      fileData: new Uint8Array([1, 2, 3]).buffer,
      fileType: "audio/dsd",
      fileName: "demo.dsf",
    });

    const result = await resolveDSDSourceBlob({ ...baseSong, audioUrl: "stored://stored-1" });

    expect(mocks.getStoredMusic).toHaveBeenCalledWith("stored-1");
    expect(result.sourceLabel).toBe("demo.dsf");
    expect(result.blob.size).toBe(3);
    expect(result.blob.type).toBe("audio/dsd");
  });

  it("loads local:// sources from legacy local music storage", async () => {
    mocks.getFileFromStorage.mockResolvedValue({
      data: new Uint8Array([4, 5]).buffer,
      type: "audio/x-dsf",
    });

    const result = await resolveDSDSourceBlob({ ...baseSong, audioUrl: "local://legacy-1" });

    expect(mocks.getFileFromStorage).toHaveBeenCalledWith("legacy-1");
    expect(result.sourceLabel).toBe("local://legacy-1");
    expect(result.blob.size).toBe(2);
  });

  it("loads remote or blob URLs through fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([new Uint8Array([8, 9])], { type: "audio/dsd" }),
    } as Response);

    const result = await resolveDSDSourceBlob({ ...baseSong, audioUrl: "/tracks/demo.dsf" });

    expect(fetch).toHaveBeenCalledWith("/tracks/demo.dsf");
    expect(result.sourceLabel).toBe("/tracks/demo.dsf");
    expect(result.blob.size).toBe(2);
  });

  it("rejects songs without a readable source", async () => {
    await expect(resolveDSDSourceBlob(baseSong)).rejects.toThrow(
      "No audio source available for DSD Demo"
    );
  });

  it("rejects missing stored files", async () => {
    mocks.getStoredMusic.mockResolvedValue(null);

    await expect(
      resolveDSDSourceBlob({ ...baseSong, audioUrl: "stored://missing" })
    ).rejects.toThrow("Stored DSD file not found for DSD Demo");
  });
});
