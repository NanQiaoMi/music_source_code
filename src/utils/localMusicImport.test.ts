import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveMusicFile: vi.fn(),
  associateLyricsWithAudioFiles: vi.fn(),
  readTags: vi.fn(),
}));

vi.mock("@/services/localMusicStorage", () => ({
  saveMusicFile: mocks.saveMusicFile,
}));

vi.mock("@/services/lyricsService", () => ({
  associateLyricsWithAudioFiles: mocks.associateLyricsWithAudioFiles,
}));

vi.mock("./songValidation", () => ({
  generateSongId: () => "song-fixed",
}));

vi.mock("jsmediatags", () => ({
  default: {
    read: mocks.readTags,
  },
}));

import { importLocalSongs } from "./localMusicImport";

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as unknown as FileList;

  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, {
      configurable: true,
      enumerable: true,
      value: file,
    });
  });

  return fileList;
}

describe("importLocalSongs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.saveMusicFile.mockReset();
    mocks.saveMusicFile.mockResolvedValue(undefined);
    mocks.associateLyricsWithAudioFiles.mockReset();
    mocks.associateLyricsWithAudioFiles.mockResolvedValue(
      new Map([["Artist - Track.mp3", "[00:00.00]Lyric line"]])
    );
    mocks.readTags.mockReset();
    mocks.readTags.mockImplementation((_file, handlers) => handlers.onError());

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:duration-probe");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    class FakeAudio {
      duration = 123;
      private listeners = new Map<string, () => void>();

      addEventListener(event: string, callback: () => void) {
        this.listeners.set(event, callback);
      }

      set src(_value: string) {
        queueMicrotask(() => this.listeners.get("loadedmetadata")?.());
      }
    }

    vi.stubGlobal("Audio", FakeAudio);
  });

  it("persists imported audio files and returns refresh-safe stored URLs", async () => {
    const audioFile = new File([new Uint8Array([1, 2, 3])], "Artist - Track.mp3", {
      type: "audio/mpeg",
    });

    const result = await importLocalSongs(createFileList([audioFile]));

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(result.songs[0]).toMatchObject({
      id: "song-fixed",
      title: "Track",
      artist: "Artist",
      audioUrl: "stored://song-fixed",
      lyrics: "[00:00.00]Lyric line",
      duration: 123,
      source: "local",
      format: "mp3",
      fileSize: 3,
    });
    expect(mocks.saveMusicFile).toHaveBeenCalledTimes(1);
    expect(mocks.saveMusicFile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "song-fixed",
        fileData: expect.any(ArrayBuffer),
        fileType: "audio/mpeg",
        fileName: "Artist - Track.mp3",
        title: "Track",
        artist: "Artist",
        duration: 123,
        lyrics: "[00:00.00]Lyric line",
      })
    );
  });
});
