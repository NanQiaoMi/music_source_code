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
import { useFavoritesStore } from "@/store/favoritesStore";
import { useQueueStore } from "@/store/queueStore";
import { useVisualizationV8Store } from "@/store/visualizationV8Store";
import { useSleepTimerStore } from "@/store/sleepTimerStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { Song } from "@/types/song";

vi.mock("./MultiSourceResolver", () => ({
  multiSourceResolver: {
    searchOnlineMusic: vi.fn(),
    searchBestMatchingSongResults: vi.fn(),
    fetchOnlineLyrics: vi.fn(),
  },
}));

vi.mock("@/store/audioStore", () => {
  const state = {
    playSong: vi.fn(),
    setIsPlaying: vi.fn(),
    nextSong: vi.fn(),
    prevSong: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setLoopMode: vi.fn(),
    currentSong: null as Song | null,
    isPlaying: false,
    volume: 0.8,
    isMuted: false,
    loopMode: "none",
    currentTime: 45,
    duration: 240,
  };
  return {
    useAudioStore: {
      getState: vi.fn(() => state),
    },
  };
});

vi.mock("@/store/favoritesStore", () => {
  const state = {
    addToFavorites: vi.fn(),
    removeFromFavorites: vi.fn(),
    toggleFavorite: vi.fn(),
    isFavorite: vi.fn().mockReturnValue(false),
  };
  return {
    useFavoritesStore: {
      getState: vi.fn(() => state),
    },
  };
});

vi.mock("@/store/queueStore", () => {
  const state = {
    clearQueue: vi.fn(),
    addToQueue: vi.fn(),
    addToNext: vi.fn(),
  };
  return {
    useQueueStore: {
      getState: vi.fn(() => state),
    },
  };
});

vi.mock("@/store/visualizationV8Store", () => {
  const state = {
    setCurrentEffect: vi.fn(),
  };
  return {
    useVisualizationV8Store: {
      getState: vi.fn(() => state),
    },
  };
});

vi.mock("@/store/sleepTimerStore", () => {
  const state = {
    setTimer: vi.fn(),
    startTimer: vi.fn(),
    cancelTimer: vi.fn(),
  };
  return {
    useSleepTimerStore: {
      getState: vi.fn(() => state),
    },
  };
});

vi.mock("@/store/useOfflineDownloadStore", () => {
  const state = {
    addDownload: vi.fn().mockResolvedValue(undefined),
  };
  return {
    useOfflineDownloadStore: {
      getState: vi.fn(() => state),
    },
  };
});

describe("aiAgentTools - Complete Player Tools Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSongCache();
  });

  describe("Tool Definitions", () => {
    it("should export all 12 tools with proper OpenAI function definitions", () => {
      expect(AI_AGENT_TOOLS).toHaveLength(12);
      const toolNames = AI_AGENT_TOOLS.map((t) => t.function.name);
      expect(toolNames).toContain("search_songs");
      expect(toolNames).toContain("play_song");
      expect(toolNames).toContain("control_playback");
      expect(toolNames).toContain("set_volume");
      expect(toolNames).toContain("set_play_mode");
      expect(toolNames).toContain("get_current_playing");
      expect(toolNames).toContain("like_current_song");
      expect(toolNames).toContain("add_to_queue");
      expect(toolNames).toContain("switch_visualizer");
      expect(toolNames).toContain("set_sleep_timer");
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

      const mockSongResults = mockSongs.map((s, idx) => ({
        song: s,
        source: s.source,
        canPlay: true,
        canDownload: true,
        isBestMatch: idx === 0,
        matchScore: 98,
        qualityLabel: "无损 FLAC",
      }));

      (multiSourceResolver.searchBestMatchingSongResults as any).mockResolvedValue(mockSongResults);

      const res = await executeTool("search_songs", { query: "周杰伦 晴天", limit: 5 });

      expect(multiSourceResolver.searchBestMatchingSongResults).toHaveBeenCalledWith(
        "周杰伦 晴天",
        5
      );
      expect(res.success).toBe(true);
      expect(res.songs).toEqual(mockSongs);
      expect(res.songResults).toEqual(mockSongResults);
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
      const audioState = useAudioStore.getState();

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
      expect(audioState.playSong).toHaveBeenCalledWith(mockSong);
    });

    it("should fallback to constructing Song if not in cache", async () => {
      const audioState = useAudioStore.getState();

      const res = await executeTool("play_song", {
        songId: "new_id",
        title: "夜曲",
        artist: "周杰伦",
        source: "qq",
      });

      expect(res.success).toBe(true);
      expect(audioState.playSong).toHaveBeenCalledWith(
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

  describe("executeTool - control_playback", () => {
    it("should handle play, pause, toggle, next, prev, stop actions", async () => {
      const audioState = useAudioStore.getState();

      // play
      const resPlay = await executeTool("control_playback", { action: "play" });
      expect(resPlay.success).toBe(true);
      expect(audioState.setIsPlaying).toHaveBeenCalledWith(true);

      // pause
      const resPause = await executeTool("control_playback", { action: "pause" });
      expect(resPause.success).toBe(true);
      expect(audioState.setIsPlaying).toHaveBeenCalledWith(false);

      // next
      const resNext = await executeTool("control_playback", { action: "next" });
      expect(resNext.success).toBe(true);
      expect(audioState.nextSong).toHaveBeenCalled();

      // prev
      const resPrev = await executeTool("control_playback", { action: "prev" });
      expect(resPrev.success).toBe(true);
      expect(audioState.prevSong).toHaveBeenCalled();

      // toggle
      const resToggle = await executeTool("control_playback", { action: "toggle" });
      expect(resToggle.success).toBe(true);
    });

    it("should return error for invalid action", async () => {
      const res = await executeTool("control_playback", { action: "invalid_action" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid action");
    });
  });

  describe("executeTool - set_volume", () => {
    it("should clamp and set volume correctly", async () => {
      const audioState = useAudioStore.getState();

      const res = await executeTool("set_volume", { volume: 65 });
      expect(res.success).toBe(true);
      expect(audioState.setVolume).toHaveBeenCalledWith(0.65);
      expect(res.message).toContain("65%");
    });

    it("should toggle mute when isMuted differs", async () => {
      const audioState = useAudioStore.getState();
      audioState.isMuted = false;

      const res = await executeTool("set_volume", { isMuted: true });
      expect(res.success).toBe(true);
      expect(audioState.toggleMute).toHaveBeenCalled();
      expect(res.message).toContain("静音");
    });

    it("should return error if no params provided", async () => {
      const res = await executeTool("set_volume", {});
      expect(res.success).toBe(false);
      expect(res.error).toBe("No volume or isMuted parameter provided");
    });
  });

  describe("executeTool - set_play_mode", () => {
    it("should set loop, single, shuffle, sequence modes", async () => {
      const audioState = useAudioStore.getState();

      await executeTool("set_play_mode", { mode: "single" });
      expect(audioState.setLoopMode).toHaveBeenCalledWith("single");

      await executeTool("set_play_mode", { mode: "loop" });
      expect(audioState.setLoopMode).toHaveBeenCalledWith("all");

      await executeTool("set_play_mode", { mode: "shuffle" });
      expect(audioState.setLoopMode).toHaveBeenCalledWith("shuffle");

      await executeTool("set_play_mode", { mode: "sequence" });
      expect(audioState.setLoopMode).toHaveBeenCalledWith("none");
    });

    it("should return error for unsupported mode", async () => {
      const res = await executeTool("set_play_mode", { mode: "unknown_mode" });
      expect(res.success).toBe(false);
    });
  });

  describe("executeTool - get_current_playing", () => {
    it("should return current song info and status", async () => {
      const audioState = useAudioStore.getState();
      audioState.currentSong = {
        id: "song_current",
        title: "晴天",
        artist: "周杰伦",
        album: "叶惠美",
        duration: 269,
        source: "netease",
      };
      audioState.isPlaying = true;

      const res = await executeTool("get_current_playing", {});
      expect(res.success).toBe(true);
      expect(res.message).toContain("晴天");
      expect((res.data as any).isPlaying).toBe(true);
      expect((res.data as any).song.title).toBe("晴天");
    });

    it("should return message if nothing is playing", async () => {
      const audioState = useAudioStore.getState();
      audioState.currentSong = null;

      const res = await executeTool("get_current_playing", {});
      expect(res.success).toBe(true);
      expect(res.message).toContain("暂无正在播放");
    });
  });

  describe("executeTool - like_current_song", () => {
    it("should toggle favorite on current song if no songId provided", async () => {
      const audioState = useAudioStore.getState();
      audioState.currentSong = {
        id: "song_fav",
        title: "晴天",
        artist: "周杰伦",
        duration: 269,
        source: "netease",
      };

      const favState = useFavoritesStore.getState();

      const res = await executeTool("like_current_song", { action: "like" });
      expect(res.success).toBe(true);
      expect(favState.addToFavorites).toHaveBeenCalledWith(audioState.currentSong);
    });

    it("should remove from favorites with unlike action", async () => {
      const audioState = useAudioStore.getState();
      audioState.currentSong = {
        id: "song_fav",
        title: "晴天",
        artist: "周杰伦",
        duration: 269,
        source: "netease",
      };

      const favState = useFavoritesStore.getState();

      const res = await executeTool("like_current_song", { action: "unlike" });
      expect(res.success).toBe(true);
      expect(favState.removeFromFavorites).toHaveBeenCalledWith("song_fav");
    });
  });

  describe("executeTool - add_to_queue", () => {
    it("should add resolved cached songs to queue", async () => {
      const mockSong1: Song = {
        id: "q1",
        title: "Song 1",
        artist: "A1",
        duration: 180,
        source: "netease",
      };
      const mockSong2: Song = {
        id: "q2",
        title: "Song 2",
        artist: "A2",
        duration: 200,
        source: "netease",
      };
      cacheSongs([mockSong1, mockSong2]);

      const queueState = useQueueStore.getState();

      const resAppend = await executeTool("add_to_queue", {
        action: "append",
        songIds: ["q1", "q2"],
      });
      expect(resAppend.success).toBe(true);
      expect(queueState.addToQueue).toHaveBeenCalledTimes(2);

      const resInsert = await executeTool("add_to_queue", {
        action: "insert_next",
        songIds: ["q1", "q2"],
      });
      expect(resInsert.success).toBe(true);
      expect(queueState.addToNext).toHaveBeenCalledTimes(2);
    });

    it("should clear queue on clear action", async () => {
      const queueState = useQueueStore.getState();
      const res = await executeTool("add_to_queue", { action: "clear" });
      expect(res.success).toBe(true);
      expect(queueState.clearQueue).toHaveBeenCalled();
    });
  });

  describe("executeTool - switch_visualizer", () => {
    it("should map Chinese names to correct effect ID and call store", async () => {
      const visualState = useVisualizationV8Store.getState();

      const res1 = await executeTool("switch_visualizer", { effect: "水墨特效" });
      expect(res1.success).toBe(true);
      expect(visualState.setCurrentEffect).toHaveBeenCalledWith("cinematicOrientalInk");

      const res2 = await executeTool("switch_visualizer", { effect: "弧光伴字" });
      expect(res2.success).toBe(true);
      expect(visualState.setCurrentEffect).toHaveBeenCalledWith("cinematicLyricDrift");
    });
  });

  describe("executeTool - set_sleep_timer", () => {
    it("should set and start timer with valid minutes", async () => {
      const sleepState = useSleepTimerStore.getState();

      const res = await executeTool("set_sleep_timer", { minutes: 30 });
      expect(res.success).toBe(true);
      expect(sleepState.setTimer).toHaveBeenCalledWith(30);
      expect(sleepState.startTimer).toHaveBeenCalled();
      expect(res.message).toContain("30 分钟");
    });

    it("should cancel timer when cancel is true", async () => {
      const sleepState = useSleepTimerStore.getState();

      const res = await executeTool("set_sleep_timer", { cancel: true });
      expect(res.success).toBe(true);
      expect(sleepState.cancelTimer).toHaveBeenCalled();
      expect(res.message).toContain("已取消");
    });
  });

  describe("executeTool - download_song", () => {
    it("should add song to offline download queue", async () => {
      const dlState = useOfflineDownloadStore.getState();

      const res = await executeTool("download_song", {
        songId: "dl_123",
        title: "十年",
        artist: "陈奕迅",
        quality: "lossless",
      });

      expect(res.success).toBe(true);
      expect(dlState.addDownload).toHaveBeenCalledWith(
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
