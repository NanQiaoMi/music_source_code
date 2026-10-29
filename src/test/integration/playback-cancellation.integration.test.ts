/**
 * 集成测试 (S1-8b)：播放管线取消语义
 *
 * 驱动顺序与 useAudioPlayer.managePlayback 完全一致：
 *   begin({ songId, source }) → resolvePlayableAudio({ signal }) →
 *   throwIfAborted(signal) → 写 store → finally complete(token)
 * 这里刻意使用真实的 playbackRequestCoordinator / MultiSourceResolver / audioStore，
 * 只把网络层（fetch）替换成可控 mock，因此覆盖的是"多次快速切歌时的取消契约"。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isAbortError,
  playbackRequestCoordinator,
  throwIfAborted,
  type PlaybackRequestToken,
} from "@/lib/playback/requestCoordinator";
import { MultiSourceResolver, multiSourceResolver } from "@/services/MultiSourceResolver";
import { useAudioStore } from "@/store/audioStore";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { useUserAccountStore } from "@/store/userAccountStore";

interface TestSong {
  id: string;
  title: string;
  artist: string;
  source: string;
}

type AttemptStatus = "ok" | "aborted" | "empty";

interface AttemptResult {
  songId: string;
  signal: AbortSignal;
  status: AttemptStatus;
  url?: string;
}

const songs: TestSong[] = Array.from({ length: 5 }, (_, index) => ({
  id: `song-${index + 1}`,
  title: `测试歌曲 ${index + 1}`,
  artist: "测试歌手",
  source: "netease",
}));

/** 与 hook 中一致的一次播放尝试：只有仍是"当前请求"的结果才允许落库。 */
function startPlaybackAttempt(song: TestSong): Promise<AttemptResult> {
  const token: PlaybackRequestToken = playbackRequestCoordinator.begin({
    songId: song.id,
    source: song.source,
  });
  const signal = token.controller.signal;

  const run = async (): Promise<AttemptResult> => {
    try {
      const resolved = await multiSourceResolver.resolvePlayableAudio(
        { id: song.id, title: song.title, artist: song.artist, source: song.source },
        { bypassCache: true, signal }
      );
      // hook 在每次 await 之后、写 store 之前调用
      throwIfAborted(signal);
      if (!playbackRequestCoordinator.isCurrent(token)) {
        return { songId: song.id, signal, status: "empty" };
      }
      useAudioStore.setState({ error: null });
      return { songId: song.id, signal, status: "ok", url: resolved?.url };
    } catch (error) {
      // abort 不是错误：静默退出，不写 store / 不产生 toast
      if (isAbortError(error)) return { songId: song.id, signal, status: "aborted" };
      throw error;
    } finally {
      playbackRequestCoordinator.complete(token);
    }
  };

  return run();
}

/** 替代 /api/song/url：按 songId 决定响应延迟，并遵守 AbortSignal。 */
function stubSongUrlFetch(delayMs: (songId: string) => number) {
  const calls: { url: string; aborted: boolean }[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const songId = new URL(url, "http://localhost").searchParams.get("id") || "song-0";
    const record = { url, aborted: false };
    calls.push(record);

    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({
            url: `http://cdn.test/${songId}.mp3`,
            source: "kuwo",
            level: "lossless",
            br: 320000,
          }),
        } as Response);
      }, delayMs(songId));

      const onAbort = () => {
        record.aborted = true;
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted", "AbortError"));
      };

      const signal = init?.signal ?? undefined;
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("playback cancellation integration (S1-8b)", () => {
  beforeEach(() => {
    MultiSourceResolver.clearCache();
    // 保证走纯兜底分支：未登录任何平台、无洛雪脚本、混合竞速模式
    useUserAccountStore.setState({
      neteaseCookie: "",
      qqCookie: "",
      kugouCookie: "",
      kuwoCookie: "",
      qishuiCookie: "",
    });
    useSourceConfigStore.setState({ resolutionMode: "hybrid_racing", lxScripts: [] });
  });

  afterEach(() => {
    playbackRequestCoordinator.abortAll("test-cleanup");
    MultiSourceResolver.clearCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("5 rapid plays keep exactly 1 in-flight request and abort the first 4 signals", async () => {
    const calls = stubSongUrlFetch(() => 20);
    const setStateSpy = vi.spyOn(useAudioStore, "setState");

    // 同一个 tick 内连续发起 5 次播放：后一次 begin 立刻 abort 前一次
    const attempts = songs.map((song) => startPlaybackAttempt(song));

    expect(playbackRequestCoordinator.inFlight()).toBe(1);

    const results = await Promise.all(attempts);

    const [first, second, third, fourth, fifth] = results;
    for (const stale of [first, second, third, fourth]) {
      expect(stale.status).toBe("aborted");
      expect(stale.signal.aborted).toBe(true);
    }

    // 只有最后一次请求仍然有效
    expect(fifth.status).toBe("ok");
    expect(fifth.signal.aborted).toBe(false);
    expect(fifth.url).toBe("http://cdn.test/song-5.mp3");

    // 前 4 次的结果（含被 abort 的兜底 fetch）一律没有写入 store
    expect(setStateSpy).toHaveBeenCalledTimes(1);
    expect(setStateSpy).toHaveBeenCalledWith({ error: null });

    const fallbackCalls = calls.filter((call) => call.url.includes("/api/song/url"));
    expect(fallbackCalls.length).toBeGreaterThanOrEqual(1);
    expect(fallbackCalls.filter((call) => call.aborted).length).toBeGreaterThanOrEqual(1);
    expect(playbackRequestCoordinator.inFlight()).toBe(0);
  });

  it("drops a resolver result that arrives after a newer playback started", async () => {
    const setStateSpy = vi.spyOn(useAudioStore, "setState");
    // 模拟不理会 signal 的解析器：被 abort 后仍然返回一个有效直链
    vi.spyOn(multiSourceResolver, "resolvePlayableAudio").mockImplementation(
      async (_query, options) => {
        const signal = typeof options === "object" ? options.signal : undefined;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 30);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true }
          );
        });
        return {
          url: "http://cdn.test/stale.mp3",
          source: "kuwo" as const,
          quality: "lossless" as const,
          format: "mp3" as const,
          isTrial: false,
        };
      }
    );

    const staleAttempt = startPlaybackAttempt(songs[0]);
    const latestAttempt = startPlaybackAttempt(songs[1]);

    const staleResult = await staleAttempt;
    expect(staleResult.status).toBe("aborted");
    expect(staleResult.signal.aborted).toBe(true);
    // stale resolver 虽然返回了有效直链，但在写 store 之前就被丢弃
    expect(setStateSpy).not.toHaveBeenCalled();

    const latestResult = await latestAttempt;
    expect(latestResult.status).toBe("ok");
    expect(latestResult.url).toBe("http://cdn.test/stale.mp3");
    expect(setStateSpy).toHaveBeenCalledTimes(1);
  });

  it("does not poison resolvedUrlCache when the signal aborts mid-flight", async () => {
    const calls = stubSongUrlFetch(() => 25);
    const controller = new AbortController();
    const query = {
      id: "cache-song",
      title: "缓存测试",
      artist: "测试歌手",
      source: "netease",
    };

    const pending = multiSourceResolver.resolvePlayableAudio(query, {
      bypassCache: true,
      signal: controller.signal,
    });
    controller.abort();

    expect(await pending).toBeNull();
    expect(calls.some((call) => call.url.includes("id=cache-song"))).toBe(true);

    // abort 的结果没有进缓存：不带 signal 的第二次解析必须重新发起网络请求
    const fresh = await multiSourceResolver.resolvePlayableAudio(query);
    expect(fresh?.url).toBe("http://cdn.test/cache-song.mp3");
    expect(calls.filter((call) => call.url.includes("id=cache-song"))).toHaveLength(2);
  });
});
