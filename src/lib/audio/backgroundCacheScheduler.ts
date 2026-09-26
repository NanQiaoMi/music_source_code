import type { Song } from "@/types/song";

/**
 * 网络歌曲后台离线缓存的调度器。
 *
 * 为什么需要它：`onPlaying` 触发的那一刻，音频正抢同一条连接做首段缓冲。
 * 旧实现在这里立刻发起整段下载（几十 MB），和首段缓冲抢带宽，起播那几秒更容易卡。
 *
 * 这里把"什么时候可以开始下载"的判断从播放器里剥出来，好处是：
 * - 播放器只管调 schedule/cancel，不掺定时器细节
 * - 该逻辑可被单测覆盖（换歌守卫 / 重试上限 / 取消），而 useAudioPlayer 太重没法直接测
 */
export interface BackgroundCacheSchedulerOptions {
  /** 起播后先让路多久，再考虑后台整段下载 */
  delayMs: number;
  /** 缓冲达到多少秒才算"首段已经稳了" */
  minBufferSeconds: number;
  /** 缓冲不足时最多重试几轮（总上限 = delayMs × maxAttempts） */
  maxAttempts: number;
  /** 当前正在播放的曲目 id，用于判断换歌 */
  getCurrentSongId: () => string | null;
  /** 当前已缓冲的秒数 */
  getBufferedSeconds: () => number;
  /** 真正发起缓存下载 */
  startCache: (song: Song, src: string) => void;
}

export interface BackgroundCacheScheduler {
  schedule: (song: Song, src: string) => void;
  cancel: () => void;
}

export const DEFAULT_BACKGROUND_CACHE_DELAY_MS = 4000;
export const DEFAULT_BACKGROUND_CACHE_MIN_BUFFER_SECONDS = 20;
export const DEFAULT_BACKGROUND_CACHE_MAX_ATTEMPTS = 5;

export function createBackgroundCacheScheduler(
  options: BackgroundCacheSchedulerOptions
): BackgroundCacheScheduler {
  type Pending = {
    timer: ReturnType<typeof setTimeout> | null;
    song: Song;
    src: string;
    attempt: number;
  };

  let pending: Pending | null = null;

  const cancel = (): void => {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;
  };

  const schedule = (song: Song, src: string): void => {
    cancel();
    const entry: Pending = { timer: null, song, src, attempt: 0 };
    pending = entry;

    const tick = () => {
      entry.timer = null;
      // 已换歌 / 已被新的调度取代 → 放弃，避免给上一首白拉几十 MB
      if (pending !== entry || options.getCurrentSongId() !== song.id) return;

      if (
        options.getBufferedSeconds() < options.minBufferSeconds &&
        entry.attempt < options.maxAttempts
      ) {
        entry.attempt += 1;
        entry.timer = setTimeout(tick, options.delayMs);
        return;
      }

      pending = null;
      options.startCache(entry.song, entry.src);
    };

    entry.timer = setTimeout(tick, options.delayMs);
  };

  return { schedule, cancel };
}
