import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateSongIntegrity, scanInvalidSongs, purgeInvalidSongs } from "./songPurgeService";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { useLibraryHealthStore } from "@/store/libraryHealthStore";
import type { Song } from "@/types/song";

vi.mock("./localMusicStorage", () => ({
  deleteStoredMusic: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./coverCache", () => ({
  deleteCoverFromCache: vi.fn().mockResolvedValue(undefined),
}));

const validSong: Song = {
  id: "valid-1",
  title: "Valid Song",
  artist: "Valid Artist",
  duration: 210,
  audioUrl: "https://example.com/audio.mp3",
  source: "local",
};

const brokenSong: Song = {
  id: "broken-1",
  title: "Broken Track",
  artist: "Unknown",
  duration: 0,
  audioUrl: "",
  source: "local",
};

const ghostSong: Song = {
  id: "ghost-1",
  title: "Untitled",
  artist: "Unknown Artist",
  duration: 0,
  audioUrl: "undefined",
  source: "local",
};

describe("songPurgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlaylistStore.setState({
      songs: [validSong, brokenSong, ghostSong],
      filteredSongs: [validSong, brokenSong, ghostSong],
      recentPlayed: [brokenSong, validSong],
      selectedSongIds: new Set(["broken-1"]),
      selectedSong: brokenSong,
    });

    useQueueStore.setState({
      queue: [validSong, brokenSong],
      insertNextList: [ghostSong],
      history: [brokenSong],
    });

    useAudioStore.setState({
      currentSong: brokenSong,
      isPlaying: true,
      setIsPlaying: (playing: boolean) => useAudioStore.setState({ isPlaying: playing }),
      setCurrentSong: (song: Song | null) => useAudioStore.setState({ currentSong: song }),
    });

    useLibraryHealthStore.setState({
      healthReport: null,
    });
  });

  it("accurately identifies invalid and ghost songs with specific reasons", () => {
    const validEval = evaluateSongIntegrity(validSong);
    expect(validEval.isInvalid).toBe(false);
    expect(validEval.reasons).toHaveLength(0);

    const brokenEval = evaluateSongIntegrity(brokenSong);
    expect(brokenEval.isInvalid).toBe(true);
    expect(brokenEval.reasons).toContain("缺失有效音频链接或本地源已失效");
    expect(brokenEval.reasons).toContain("音频时长异常 (0秒或无效时长)");

    const ghostEval = evaluateSongIntegrity(ghostSong);
    expect(ghostEval.isInvalid).toBe(true);
    expect(ghostEval.reasons).toContain("核心元数据完全缺失 (无有效标题与歌手)");
  });

  it("scans and extracts only invalid songs from a playlist", () => {
    const scanned = scanInvalidSongs([validSong, brokenSong, ghostSong]);
    expect(scanned).toHaveLength(2);
    expect(scanned.map((s) => s.song.id)).toEqual(["broken-1", "ghost-1"]);
  });

  it("completely purges targeted invalid songs across all stores, queue, and playback state", async () => {
    const report = await purgeInvalidSongs(["broken-1", "ghost-1"]);

    expect(report.purgedCount).toBe(2);
    expect(report.remainingSongsCount).toBe(1);
    expect(report.stoppedPlayback).toBe(true);

    const playlist = usePlaylistStore.getState();
    expect(playlist.songs).toEqual([validSong]);
    expect(playlist.filteredSongs).toEqual([validSong]);
    expect(playlist.recentPlayed).toEqual([validSong]);
    expect(playlist.selectedSong).toBeNull();
    expect(playlist.selectedSongIds.has("broken-1")).toBe(false);

    const queue = useQueueStore.getState();
    expect(queue.queue).toEqual([validSong]);
    expect(queue.insertNextList).toEqual([]);
    expect(queue.history).toEqual([]);

    const audio = useAudioStore.getState();
    expect(audio.isPlaying).toBe(false);
    expect(audio.currentSong).toBeNull();
  });
});
