import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaybackCommands, playbackCommands } from "./playbackCommands";
import type { PlaybackPorts, PlaybackSnapshot } from "./ports";
import { clearDomainEvents, on } from "@/domain/events";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import type { Song } from "@/types/song";

const makeSong = (id: string): Song => ({
  id,
  title: id,
  artist: "Mimi",
  duration: 100,
  source: "local",
  audioUrl: `file:///${id}.mp3`,
});

const makeFakePorts = (initial: Partial<PlaybackSnapshot> = {}) => {
  let snapshot: PlaybackSnapshot = {
    currentSong: null,
    shouldPlay: false,
    isPlaying: false,
    volume: 0.7,
    isMuted: false,
    currentTime: 0,
    duration: 100,
    ...initial,
  };
  const playSong = vi.fn();
  const toggleIntent = vi.fn(() => {
    snapshot = {
      ...snapshot,
      shouldPlay: !snapshot.shouldPlay,
      isPlaying: !snapshot.shouldPlay,
    };
  });
  const seek = vi.fn();
  const next = vi.fn();
  const prev = vi.fn();
  const setVolume = vi.fn((volume: number) => {
    snapshot = { ...snapshot, volume };
  });
  const toggleMute = vi.fn(() => {
    snapshot = { ...snapshot, isMuted: !snapshot.isMuted };
  });
  const clearCurrentSong = vi.fn(() => {
    snapshot = { ...snapshot, currentSong: null, isPlaying: false };
  });
  const ports: PlaybackPorts = {
    playSong,
    toggleIntent,
    seek,
    next,
    prev,
    setVolume,
    toggleMute,
    clearCurrentSong,
    getSnapshot: vi.fn(() => snapshot),
  };
  return {
    ports,
    playSong,
    toggleIntent,
    seek,
    next,
    prev,
    setVolume,
    toggleMute,
    clearCurrentSong,
  };
};

const resetStores = () => {
  usePlaybackRuntimeStore.getState().reset();
  useQueueStore.setState({ queue: [], currentIndex: 0, history: [] });
  usePlayerStore.setState({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    isMuted: false,
    loopMode: "none",
  });
  useAudioStore.setState({
    currentSong: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    volume: 0.7,
    isMuted: false,
    error: null,
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  clearDomainEvents();
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearDomainEvents();
  resetStores();
});

describe("playbackCommands", () => {
  it("playSong 调用 audioStore.playSong 并发出 playback:started", () => {
    const playSpy = vi.spyOn(useAudioStore.getState(), "playSong").mockImplementation(() => {});
    const started = vi.fn();
    on("playback:started", started);
    const song = makeSong("song-a");

    expect(playbackCommands.playSong(song)).toEqual({ ok: true, songId: "song-a" });
    expect(playSpy).toHaveBeenCalledWith(song);
    expect(started).toHaveBeenCalledWith({
      songId: "song-a",
      previousSongId: null,
      queued: false,
    });
  });

  it("playSong 带 queue 时改走 playQueue 并标记 queued", () => {
    const playQueueSpy = vi
      .spyOn(useAudioStore.getState(), "playQueue")
      .mockImplementation(() => {});
    const started = vi.fn();
    on("playback:started", started);
    const queue = [makeSong("q1"), makeSong("q2")];

    playbackCommands.playSong(queue[1], { queue, startIndex: 1 });

    expect(playQueueSpy).toHaveBeenCalledWith(queue, 1);
    expect(started).toHaveBeenCalledWith(expect.objectContaining({ songId: "q2", queued: true }));
  });

  it("playSong 缺音源时保留 store 错误投影并发出 playback:rejected", () => {
    const playSpy = vi.spyOn(useAudioStore.getState(), "playSong").mockImplementation(() => {});
    const rejected = vi.fn();
    on("playback:rejected", rejected);
    const song = { ...makeSong("no-source"), audioUrl: undefined };

    expect(playbackCommands.playSong(song)).toEqual({
      ok: false,
      songId: "no-source",
      reason: "missing-audio-source",
    });
    expect(playSpy).toHaveBeenCalledWith(song);
    expect(rejected).toHaveBeenCalledWith({ songId: "no-source", reason: "missing-audio-source" });
  });

  it("togglePlayback 从暂停态恢复并发出 playback:resumed", () => {
    usePlayerStore.setState({ currentSong: makeSong("song-a") });
    const toggleSpy = vi
      .spyOn(useAudioStore.getState(), "togglePlaybackIntent")
      .mockImplementation(() => {});
    const resumed = vi.fn();
    on("playback:resumed", resumed);

    expect(playbackCommands.togglePlayback()).toEqual({ changed: true, isPlaying: true });
    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(resumed).toHaveBeenCalledWith({ songId: "song-a" });
  });

  it("togglePlayback 从播放态暂停并发出 playback:paused", () => {
    usePlayerStore.setState({ currentSong: makeSong("song-a") });
    usePlaybackRuntimeStore.getState().requestPlayback("song-a", "file:///song-a.mp3", true);
    const toggleSpy = vi
      .spyOn(useAudioStore.getState(), "togglePlaybackIntent")
      .mockImplementation(() => {});
    const paused = vi.fn();
    on("playback:paused", paused);

    expect(playbackCommands.togglePlayback()).toEqual({ changed: true, isPlaying: false });
    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(paused).toHaveBeenCalledWith({ songId: "song-a" });
  });

  it("暂停时再次暂停是幂等的：不写 store、不发事件", () => {
    const toggleSpy = vi.spyOn(useAudioStore.getState(), "togglePlaybackIntent");
    const paused = vi.fn();
    on("playback:paused", paused);

    expect(playbackCommands.togglePlayback({ target: false })).toEqual({
      changed: false,
      isPlaying: false,
    });
    expect(toggleSpy).not.toHaveBeenCalled();
    expect(paused).not.toHaveBeenCalled();
  });

  it("没有当前曲目时先播队列第一首再切换播放", () => {
    const first = makeSong("first");
    useQueueStore.setState({ queue: [first, makeSong("second")], currentIndex: 0 });
    const setSongSpy = vi
      .spyOn(usePlayerStore.getState(), "setCurrentSong")
      .mockImplementation(() => {});
    const setIndexSpy = vi
      .spyOn(useQueueStore.getState(), "setCurrentIndex")
      .mockImplementation(() => {});
    const toggleSpy = vi
      .spyOn(useAudioStore.getState(), "togglePlaybackIntent")
      .mockImplementation(() => {});

    playbackCommands.togglePlayback();

    expect(setSongSpy).toHaveBeenCalledWith(first);
    expect(setIndexSpy).toHaveBeenCalledWith(0);
    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });

  it("seekTo 按播放时钟时长夹取并发出 playback:seeked", () => {
    useAudioStore.setState({ duration: 100 });
    const seekSpy = vi.spyOn(useAudioStore.getState(), "seekTo").mockImplementation(() => {});
    const seeked = vi.fn();
    on("playback:seeked", seeked);

    expect(playbackCommands.seekTo(150)).toEqual({ seconds: 100 });
    expect(playbackCommands.seekTo(-5)).toEqual({ seconds: 0 });
    expect(seekSpy).toHaveBeenNthCalledWith(1, 100);
    expect(seekSpy).toHaveBeenNthCalledWith(2, 0);
    expect(seeked).toHaveBeenCalledTimes(2);

    // 时长未知（0）时按 0 处理，与旧快捷键 Math.min(duration, ...) 的钳制一致。
    useAudioStore.setState({ duration: 0 });
    const seekAgain = vi.spyOn(useAudioStore.getState(), "seekTo").mockImplementation(() => {});
    expect(playbackCommands.seekTo(5)).toEqual({ seconds: 0 });
    expect(seekAgain).toHaveBeenCalledWith(0);
  });

  it("nextTrack/prevTrack 调用 store 并发出 playback:track-changed", () => {
    const first = makeSong("song-a");
    const second = makeSong("song-b");
    useAudioStore.setState({ currentSong: first });

    const nextSpy = vi.spyOn(useAudioStore.getState(), "nextSong").mockImplementation(() => {
      useAudioStore.setState({ currentSong: second });
    });
    const changed = vi.fn();
    on("playback:track-changed", changed);

    playbackCommands.nextTrack();
    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenNthCalledWith(1, {
      from: "song-a",
      to: "song-b",
      direction: "next",
    });

    // setState 会替换 store 快照对象，spy 需要重新挂到新快照上。
    const prevSpy = vi.spyOn(useAudioStore.getState(), "prevSong").mockImplementation(() => {
      useAudioStore.setState({ currentSong: first });
    });
    playbackCommands.prevTrack();
    expect(prevSpy).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenNthCalledWith(2, {
      from: "song-b",
      to: "song-a",
      direction: "prev",
    });
  });

  it("setVolume 夹取到 0..1 并发出 playback:volume-changed", () => {
    const volumeSpy = vi.spyOn(usePlayerStore.getState(), "setVolume").mockImplementation(() => {});
    const changed = vi.fn();
    on("playback:volume-changed", changed);

    expect(playbackCommands.setVolume(1.5)).toEqual({ volume: 1, changed: true });
    expect(volumeSpy).toHaveBeenCalledWith(1);
    expect(changed).toHaveBeenCalledWith({ volume: 1, previous: 0.7 });
  });

  it("音量未变化时不重复写 store、不发事件", () => {
    const volumeSpy = vi.spyOn(usePlayerStore.getState(), "setVolume");
    const changed = vi.fn();
    on("playback:volume-changed", changed);

    expect(playbackCommands.setVolume(0.7)).toEqual({ volume: 0.7, changed: false });
    expect(volumeSpy).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("toggleMute 调用 playerStore.toggleMute 并发出 playback:mute-changed", () => {
    const muteSpy = vi.spyOn(usePlayerStore.getState(), "toggleMute").mockImplementation(() => {
      usePlayerStore.setState({ isMuted: true });
    });
    const changed = vi.fn();
    on("playback:mute-changed", changed);

    expect(playbackCommands.toggleMute()).toEqual({ isMuted: true });
    expect(muteSpy).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith({ isMuted: true });
  });
});

describe("playbackCommands 注入 fake ports", () => {
  it("命令只走注入的 ports，不触碰 store", () => {
    const fake = makeFakePorts();
    const commands = createPlaybackCommands(fake.ports);
    const song = makeSong("song-x");
    const started = vi.fn();
    const resumed = vi.fn();
    on("playback:started", started);
    on("playback:resumed", resumed);

    expect(commands.playSong(song, { queue: [song], startIndex: 0 })).toEqual({
      ok: true,
      songId: "song-x",
    });
    expect(fake.playSong).toHaveBeenCalledWith(song, { queue: [song], startIndex: 0 });
    expect(started).toHaveBeenCalledWith({
      songId: "song-x",
      previousSongId: null,
      queued: true,
    });

    expect(commands.togglePlayback()).toEqual({ changed: true, isPlaying: true });
    expect(fake.toggleIntent).toHaveBeenCalledTimes(1);
    expect(resumed).toHaveBeenCalledWith({ songId: null });
    expect(commands.togglePlayback()).toEqual({ changed: true, isPlaying: false });

    expect(commands.seekTo(150)).toEqual({ seconds: 100 });
    expect(fake.seek).toHaveBeenCalledWith(100);

    expect(commands.nextTrack()).toEqual({ from: null, to: null, direction: "next" });
    expect(commands.prevTrack()).toEqual({ from: null, to: null, direction: "prev" });
    expect(fake.next).toHaveBeenCalledTimes(1);
    expect(fake.prev).toHaveBeenCalledTimes(1);

    expect(commands.setVolume(0.42)).toEqual({ volume: 0.42, changed: true });
    expect(fake.setVolume).toHaveBeenCalledWith(0.42);
    expect(commands.toggleMute()).toEqual({ isMuted: true });
    expect(fake.toggleMute).toHaveBeenCalledTimes(1);

    // fake ports 承担全部 I/O：默认适配器背后的 store 保持 beforeEach 的重置值。
    expect(useAudioStore.getState().currentSong).toBeNull();
    expect(usePlayerStore.getState().volume).toBe(0.7);
    expect(usePlayerStore.getState().isMuted).toBe(false);
  });
});
