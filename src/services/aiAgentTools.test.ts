import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AI_AGENT_TOOLS,
  executeTool,
  cacheSong,
  cacheSongs,
  getCachedSong,
  clearSongCache,
} from "./aiAgentTools";
import { multiSourceResolver } from "./MultiSourceResolver";
import { useAudioStore } from "@/store/audioStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { Song } from "@/types/song";

vi.mock("./MultiSourceResolver", () => ({
  multiSourceResolver: {
    searchOnlineMusic: vi.fn(),
    fetchOnlineLyrics: vi.fn(),
  },
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: {
    getState: vi.fn(() => ({
      playSong: vi.fn(),
    })),
  },
}));

vi.mock("@/store/useOfflineDownloadStore", () => ({
  useOfflineDownloadStore: {
    getState: vi.fn(() => ({
      addDownload: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe("aiAgentTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSongCache();
  });

  describe("Tool Definitions", () => {
    it("should export the 4 required tools with proper definitions", () => {
      expect(AI_AGENT_TOOLS).toHaveLength(4);
      const toolNames = AI_AGENT_TOOLS.map((t) => t.function.name);
      expect(toolNames).toContain("search_songs");
      expect(toolNames).toContain("play_song");
      expect(toolNames).toContain("download_song");
      expect(toolNames).toContain("get_lyrics");
    });
  });

  describe("Song Cache Helpers", () => {
    it("should correctly cache and retrieve songs by id", () => {
      const mockSong: Song = {
        id: "song_123",
        title: "晴天",
        artist: "周杰伦",
        duration: 269,
        source: "netease",
      };

      cacheSong(mockSong);
      expect(getCachedSong("song_123")).toEqual(mockSong);
      expect(getCachedSong("unknown_id")).toBeUndefined();

      clearSongCache();
      expect(getCachedSong("song_123")).toBeUndefined();
    });

    it("should batch cache songs with cacheSongs", () => {
      const songs: Song[] = [
        { id: "s1", title: "Song 1", artist: "Artist 1", duration: 180, source: "netease" },
        { id: "s2", title: "Song 2", artist: "Artist 2", duration: 200, source: "qq" },
      ];

      cacheSongs(songs);
      expect(getCachedSong("s1")).toEqual(songs[0]);
      expect(getCachedSong("s2")).toEqual(songs[1]);
    });
  });

  describe("executeTool - search_songs", () => {
    it("should search songs via multiSourceResolver and return results and cache them", async () => {
      const mockSongs: Song[] = [
        {
          id: "jay_qingtian",
          title: "晴天",
          artist: "周杰伦",
          album: "叶惠美",
          duration: 269,
          source: "netease",
        },
      ];

      (multiSourceResolver.searchOnlineMusic as any).mockResolvedValue(mockSongs);

      const res = await executeTool("search_songs", { query: "周杰伦 晴天", limit: 5 });

      expect(multiSourceResolver.searchOnlineMusic).toHaveBeenCalledWith("周杰伦 晴天", 5);
      expect(res.success).toBe(true);
      expect(res.songs).toEqual(mockSongs);
      expect(getCachedSong("jay_qingtian")).toEqual(mockSongs[0]);
    });

    it("should return failure when query is empty", async () => {
      const res = await executeTool("search_songs", { query: "" });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Empty search query");
    });
  });

  describe("executeTool - play_song", () => {
    it("should play a cached song when songId exists", async () => {
      const playMock = vi.fn();
      (useAudioStore.getState as any).mockReturnValue({ playSong: playMock });

      const mockSong: Song = {
        id: "song_abc",
        title: "七里香",
        artist: "周杰伦",
        duration: 300,
        source: "netease",
      };
      cacheSong(mockSong);

      const res = await executeTool("play_song", { songId: "song_abc" });

      expect(res.success).toBe(true);
      expect(playMock).toHaveBeenCalledWith(mockSong);
    });

    it("should fallback to constructing Song if not in cache", async () => {
      const playMock = vi.fn();
      (useAudioStore.getState as any).mockReturnValue({ playSong: playMock });

      const res = await executeTool("play_song", {
        songId: "new_id",
        title: "夜曲",
        artist: "周杰伦",
        source: "qq",
      });

      expect(res.success).toBe(true);
      expect(playMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new_id",
          title: "夜曲",
          artist: "周杰伦",
          source: "qq",
        })
      );
    });

    it("should return error if songId is missing", async () => {
      const res = await executeTool("play_song", {});
      expect(res.success).toBe(false);
      expect(res.error).toBe("Missing songId");
    });
  });

  describe("executeTool - download_song", () => {
    it("should add song to offline download queue", async () => {
      const addDownloadMock = vi.fn().mockResolvedValue(undefined);
      (useOfflineDownloadStore.getState as any).mockReturnValue({ addDownload: addDownloadMock });

      const res = await executeTool("download_song", {
        songId: "dl_123",
        title: "十年",
        artist: "陈奕迅",
        quality: "lossless",
      });

      expect(res.success).toBe(true);
      expect(addDownloadMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "dl_123",
          title: "十年",
          artist: "陈奕迅",
        }),
        "lossless"
      );
    });

    it("should return error if songId is missing", async () => {
      const res = await executeTool("download_song", {});
      expect(res.success).toBe(false);
      expect(res.error).toBe("Missing songId");
    });
  });

  describe("executeTool - get_lyrics", () => {
    it("should fetch lyrics successfully via multiSourceResolver", async () => {
      (multiSourceResolver.fetchOnlineLyrics as any).mockResolvedValue({
        lyrics: "[00:00.00] 晴天 - 周杰伦",
        translationLyrics: "[00:00.00] Sunny Day",
      });

      const res = await executeTool("get_lyrics", {
        songId: "lyric_song",
        title: "晴天",
        artist: "周杰伦",
      });

      expect(res.success).toBe(true);
      expect(res.data).toEqual({
        lyrics: "[00:00.00] 晴天 - 周杰伦",
        translationLyrics: "[00:00.00] Sunny Day",
      });
    });

    it("should return message when no lyrics found", async () => {
      (multiSourceResolver.fetchOnlineLyrics as any).mockResolvedValue({});

      const res = await executeTool("get_lyrics", { songId: "no_lyric" });
      expect(res.success).toBe(false);
      expect(res.message).toBe("未找到相关歌词");
    });
  });

  describe("executeTool - unknown tool", () => {
    it("should return error for unknown tool name", async () => {
      const res = await executeTool("non_existent_tool", {});
      expect(res.success).toBe(false);
      expect(res.error).toContain("Unknown tool");
    });
  });
});
