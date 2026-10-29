/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
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
import type { PlaybackPorts, PlaybackSnapshot } from "@/domain/playback/ports";
import { usePlayerStore } from "@/store/playerStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useQueueStore } from "@/store/queueStore";
import { useVisualizationStore } from "@/store/visualizationStore";
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

// S6-9b：播放传输不再 mock 整棵 audioStore，改为注入 fake PlaybackPorts。
function createFakePorts(initial: Partial<PlaybackSnapshot> = {}) {
  let snapshot: PlaybackSnapshot = {
    currentSong: null,
    isPlaying: false,
    shouldPlay: false,
    volume: 0.8,
    isMuted: false,
    currentTime: 0,
    duration: 240,
    ...initial,
  };
  const ports = {
    playSong: vi.fn(),
    toggleIntent: vi.fn(() => {
      snapshot = {
        ...snapshot,
        shouldPlay: !snapshot.shouldPlay,
        isPlaying: !snapshot.shouldPlay,
      };
    }),
    seek: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    setVolume: vi.fn((volume: number) => {
      snapshot = { ...snapshot, volume };
    }),
    toggleMute: vi.fn(() => {
      snapshot = { ...snapshot, isMuted: !snapshot.isMuted };
    }),
    clearCurrentSong: vi.fn(),
    getSnapshot: vi.fn(() => snapshot),
  } satisfies PlaybackPorts;
  return ports;
}

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
    queue: [],
    currentIndex: 0,
    clearQueue: vi.fn(),
    addToQueue: vi.fn(),
    addToNext: vi.fn(),
    setQueue: vi.fn(),
    setCurrentIndex: vi.fn(),
  };
  return {
    useQueueStore: {
      getState: vi.fn(() => state),
      // S6-5: audioStore no longer subscribes to queueStore; keep subscribe for module-shape parity.
      subscribe: vi.fn(() => () => {}),
    },
  };
});

vi.mock("@/store/visualizationStore", () => {
  const state = {
    setCurrentEffect: vi.fn(),
  };
  return {
    useVisualizationStore: {
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
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      volume: 0.8,
      isMuted: false,
      loopMode: "none",
    });
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
      const ports = createFakePorts();

      const mockSong: Song = {
        id: "song_abc",
        title: "七里香",
        artist: "周杰伦",
        duration: 300,
        audioUrl: "file:///song_abc.mp3",
        source: "netease",
      };
      cacheSong(mockSong);

      const res = await executeTool("play_song", { songId: "song_abc" }, { playback: ports });

      expect(res.success).toBe(true);
      expect(ports.playSong).toHaveBeenCalledWith(mockSong, {});
    });

    it("should fallback to constructing Song if not in cache", async () => {
      const ports = createFakePorts();

      const res = await executeTool(
        "play_song",
        {
          songId: "new_id",
          title: "夜曲",
          artist: "周杰伦",
          source: "qq",
        },
        { playback: ports }
      );

      expect(res.success).toBe(true);
      // 在线平台音源可在播放时动态解析，命令层直接交给 ports.playSong。
      expect(ports.playSong).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new_id",
          title: "夜曲",
          artist: "周杰伦",
          source: "qq",
        }),
        {}
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
      const ports = createFakePorts();

      // play（暂停态 -> 恢复）
      const resPlay = await executeTool(
        "control_playback",
        { action: "play" },
        { playback: ports }
      );
      expect(resPlay.success).toBe(true);
      expect(ports.toggleIntent).toHaveBeenCalledTimes(1);
      expect(ports.getSnapshot().shouldPlay).toBe(true);

      // pause（播放态 -> 暂停）
      const resPause = await executeTool(
        "control_playback",
        { action: "pause" },
        { playback: ports }
      );
      expect(resPause.success).toBe(true);
      expect(ports.toggleIntent).toHaveBeenCalledTimes(2);
      expect(ports.getSnapshot().shouldPlay).toBe(false);

      // next
      const resNext = await executeTool(
        "control_playback",
        { action: "next" },
        { playback: ports }
      );
      expect(resNext.success).toBe(true);
      expect(ports.next).toHaveBeenCalledTimes(1);

      // prev
      const resPrev = await executeTool(
        "control_playback",
        { action: "prev" },
        { playback: ports }
      );
      expect(resPrev.success).toBe(true);
      expect(ports.prev).toHaveBeenCalledTimes(1);

      // toggle（暂停态 -> 播放）
      const resToggle = await executeTool(
        "control_playback",
        { action: "toggle" },
        { playback: ports }
      );
      expect(resToggle.success).toBe(true);
      expect(ports.toggleIntent).toHaveBeenCalledTimes(3);
      expect(resToggle.message).toBe("已开始播放");

      // stop
      const resStop = await executeTool(
        "control_playback",
        { action: "stop" },
        { playback: ports }
      );
      expect(resStop.success).toBe(true);
      expect(ports.toggleIntent).toHaveBeenCalledTimes(4);
      expect(ports.getSnapshot().shouldPlay).toBe(false);
    });

    it("should return error for invalid action", async () => {
      const res = await executeTool("control_playback", { action: "invalid_action" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid action");
    });
  });

  describe("executeTool - set_volume", () => {
    it("should clamp and set volume correctly", async () => {
      const ports = createFakePorts();

      const res = await executeTool("set_volume", { volume: 65 }, { playback: ports });
      expect(res.success).toBe(true);
      expect(ports.setVolume).toHaveBeenCalledWith(0.65);
      expect(res.message).toContain("65%");
      expect((res.data as any).volume).toBe(65);
    });

    it("should toggle mute when isMuted differs", async () => {
      const ports = createFakePorts();
      expect(ports.getSnapshot().isMuted).toBe(false);

      const res = await executeTool("set_volume", { isMuted: true }, { playback: ports });
      expect(res.success).toBe(true);
      expect(ports.toggleMute).toHaveBeenCalledTimes(1);
      expect(res.message).toContain("静音");
      expect((res.data as any).isMuted).toBe(true);
    });

    it("should return error if no params provided", async () => {
      const res = await executeTool("set_volume", {});
      expect(res.success).toBe(false);
      expect(res.error).toBe("No volume or isMuted parameter provided");
    });
  });

  describe("executeTool - set_play_mode", () => {
    it("should set loop, single, shuffle, sequence modes", async () => {
      await executeTool("set_play_mode", { mode: "single" });
      expect(usePlayerStore.getState().loopMode).toBe("single");

      await executeTool("set_play_mode", { mode: "loop" });
      expect(usePlayerStore.getState().loopMode).toBe("all");

      await executeTool("set_play_mode", { mode: "shuffle" });
      expect(usePlayerStore.getState().loopMode).toBe("shuffle");

      await executeTool("set_play_mode", { mode: "sequence" });
      expect(usePlayerStore.getState().loopMode).toBe("none");
    });

    it("should return error for unsupported mode", async () => {
      const res = await executeTool("set_play_mode", { mode: "unknown_mode" });
      expect(res.success).toBe(false);
    });
  });

  describe("executeTool - get_current_playing", () => {
    it("should return current song info and status", async () => {
      const currentSong: Song = {
        id: "song_current",
        title: "晴天",
        artist: "周杰伦",
        album: "叶惠美",
        duration: 269,
        source: "netease",
      };
      const ports = createFakePorts({
        currentSong,
        isPlaying: true,
        shouldPlay: true,
        volume: 0.55,
        isMuted: true,
        currentTime: 45,
      });
      usePlayerStore.setState({ loopMode: "single" });

      const res = await executeTool("get_current_playing", {}, { playback: ports });
      expect(res.success).toBe(true);
      expect(res.message).toContain("晴天");
      expect((res.data as any).isPlaying).toBe(true);
      expect((res.data as any).song.title).toBe("晴天");
      // 传输状态全部来自 snapshot（进度 45s、音量 55%），播放模式仍读 playerStore。
      expect((res.data as any).progressSeconds).toBe(45);
      expect((res.data as any).volume).toBe(55);
      expect((res.data as any).isMuted).toBe(true);
      expect((res.data as any).playMode).toBe("单曲循环");
    });

    it("should return message if nothing is playing", async () => {
      const ports = createFakePorts();

      const res = await executeTool("get_current_playing", {}, { playback: ports });
      expect(res.success).toBe(true);
      expect(res.message).toContain("暂无正在播放");
    });
  });

  describe("executeTool - like_current_song", () => {
    it("should toggle favorite on current song if no songId provided", async () => {
      usePlayerStore.setState({
        currentSong: {
          id: "song_fav",
          title: "晴天",
          artist: "周杰伦",
          duration: 269,
          source: "netease",
        },
      });

      const favState = useFavoritesStore.getState();

      const res = await executeTool("like_current_song", { action: "like" });
      expect(res.success).toBe(true);
      expect(favState.addToFavorites).toHaveBeenCalledWith(usePlayerStore.getState().currentSong);
    });

    it("should remove from favorites with unlike action", async () => {
      usePlayerStore.setState({
        currentSong: {
          id: "song_fav",
          title: "晴天",
          artist: "周杰伦",
          duration: 269,
          source: "netease",
        },
      });

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
      const visualState = useVisualizationStore.getState();

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
