import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createBackgroundCacheScheduler,
  DEFAULT_BACKGROUND_CACHE_DELAY_MS,
  DEFAULT_BACKGROUND_CACHE_MAX_ATTEMPTS,
  DEFAULT_BACKGROUND_CACHE_MIN_BUFFER_SECONDS,
  type BackgroundCacheSchedulerOptions,
} from "./backgroundCacheScheduler";
import type { Song } from "@/types/song";

const SONG_A = { id: "song-a", title: "A", artist: "x" } as Song;
const SONG_B = { id: "song-b", title: "B", artist: "x" } as Song;
const DELAY = DEFAULT_BACKGROUND_CACHE_DELAY_MS;

function setup(initial: { buffered?: number; songId?: string | null } = {}) {
  const state = {
    songId: initial.songId ?? SONG_A.id,
    buffered: initial.buffered ?? 60,
  };
  const started: { song: Song; src: string }[] = [];

  const options: BackgroundCacheSchedulerOptions = {
    delayMs: DELAY,
    minBufferSeconds: DEFAULT_BACKGROUND_CACHE_MIN_BUFFER_SECONDS,
    maxAttempts: DEFAULT_BACKGROUND_CACHE_MAX_ATTEMPTS,
    getCurrentSongId: () => state.songId,
    getBufferedSeconds: () => state.buffered,
    startCache: (song, src) => started.push({ song, src }),
  };
  const scheduler = createBackgroundCacheScheduler(options);

  return { scheduler, state, started };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("backgroundCacheScheduler 起播让路", () => {
  it("让路窗口内绝不发起整段下载", () => {
    const { scheduler, started } = setup();

    scheduler.schedule(SONG_A, "http://cdn/a.mp3");
    vi.advanceTimersByTime(DELAY - 1);
    expect(started).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(started).toHaveLength(1);
    expect(started[0].song.id).toBe(SONG_A.id);
    expect(started[0].src).toBe("http://cdn/a.mp3");
  });

  it("缓冲一直不达标时重试到上限才放行", () => {
    const { scheduler, started } = setup({ buffered: 0 });
    scheduler.schedule(SONG_A, "http://cdn/a.mp3");

    // 缓冲一直不达标：重试到 maxAttempts 次之后才放行
    vi.advanceTimersByTime(DELAY * DEFAULT_BACKGROUND_CACHE_MAX_ATTEMPTS);
    expect(started).toHaveLength(0);

    vi.advanceTimersByTime(DELAY);
    expect(started).toHaveLength(1);

    // 放行后不再有遗留定时器继续触发
    vi.advanceTimersByTime(DELAY * 3);
    expect(started).toHaveLength(1);
  });

  it("换歌后放弃旧调度（不给上一首白拉几十 MB）", () => {
    const { scheduler, state, started } = setup();
    scheduler.schedule(SONG_A, "http://cdn/a.mp3");

    state.songId = SONG_B.id; // 换歌
    vi.advanceTimersByTime(DELAY * 3);

    expect(started).toHaveLength(0);
  });

  it("重新调度会取代上一次（只下载最新的那首）", () => {
    const { scheduler, state, started } = setup();

    scheduler.schedule(SONG_A, "http://cdn/a.mp3");
    vi.advanceTimersByTime(DELAY - 1);
    // 真实场景里切歌会同时更新 currentSongId，调度器以它为准判断"还在给谁下载"
    state.songId = SONG_B.id;
    scheduler.schedule(SONG_B, "http://cdn/b.mp3");

    vi.advanceTimersByTime(DELAY);
    expect(started.map((s) => s.song.id)).toEqual([SONG_B.id]);
    expect(started[0].src).toBe("http://cdn/b.mp3");
  });

  it("cancel() 之后不再触发", () => {
    const { scheduler, started } = setup();

    scheduler.schedule(SONG_A, "http://cdn/a.mp3");
    scheduler.cancel();
    vi.advanceTimersByTime(DELAY * 4);

    expect(started).toHaveLength(0);
  });

  it("缓冲始终为空也按上限放行，避免永远不缓存", () => {
    const { scheduler, started } = setup({ buffered: 0 });

    scheduler.schedule(SONG_A, "http://cdn/a.mp3");
    vi.advanceTimersByTime(DELAY * (DEFAULT_BACKGROUND_CACHE_MAX_ATTEMPTS + 1));

    expect(started).toHaveLength(1);
  });
});
