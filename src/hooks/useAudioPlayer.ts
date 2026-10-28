"use client";

import { useEffect, useCallback, useState } from "react";
import { useAudioStore, registerAudioSeekHandler } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useEQStore } from "@/store/eqStore";
import type { Song } from "@/types/song";
import {
  getStoredMusic,
  createBlobUrlFromStoredMusic,
  getOfflineAudio,
  saveOfflineAudio,
} from "@/services/localMusicStorage";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useListeningJournalStore } from "@/store/listeningJournalStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useABLoopStore } from "@/store/abLoopStore";
import { getAudioEffectsManager } from "@/lib/audio/AudioEffectsManager";
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { CrossfadeMixer } from "@/lib/audio/CrossfadeMixer";
import { deriveJournalMood } from "@/lib/journal/listeningJournal";
import {
  MISSING_AUDIO_SOURCE_MESSAGE,
  createAudioElementLoadError,
  logHandledAudioWarning,
} from "@/lib/audio/playableAudioSource";
import { multiSourceResolver } from "@/services/MultiSourceResolver";
import {
  getCachedAudio,
  createBlobUrlFromCache,
  updateLastPlayed,
  makeCacheKey,
} from "@/services/networkAudioCache";
import { triggerBackgroundCache } from "@/hooks/useNetworkAudioCache";
import {
  createBackgroundCacheScheduler,
  DEFAULT_BACKGROUND_CACHE_DELAY_MS,
  DEFAULT_BACKGROUND_CACHE_MAX_ATTEMPTS,
  DEFAULT_BACKGROUND_CACHE_MIN_BUFFER_SECONDS,
} from "@/lib/audio/backgroundCacheScheduler";
import { audioPrefetcher } from "@/lib/audio/audioPrefetcher";
import { BlobUrlRegistry } from "@/services/BlobUrlRegistry";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";
import { useUserAccountStore, isPlatformLoggedIn, PlatformType } from "@/store/userAccountStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import type { PlaybackMachineEvent } from "@/lib/audio/playbackStateMachine";
import { playbackClock } from "@/lib/audio/PlaybackClock";
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";
import { shouldAcceptPlaybackMediaEvent } from "@/lib/audio/playbackMediaEventGuard";

// Module-level shared state to persist across hook unmounts/remounts
let audioInstance: HTMLAudioElement | null = null;
let secondaryAudioInstance: HTMLAudioElement | null = null;
const audioElementRef: { current: HTMLAudioElement | null } = { current: null };
const secondaryElementRef: { current: HTMLAudioElement | null } = { current: null };
const currentAudioUrlRef: { current: string | null } = { current: null };
const isPlayingRef: { current: boolean } = { current: false };
const currentSongIdRef: { current: string | null } = { current: null };
const loadedSongIdRef: { current: string | null } = { current: null };
const loadedSongSourceKeyRef: { current: string | null } = { current: null };
const lastRecordedSongIdRef: { current: string | null } = { current: null };
const lastToastSongIdRef: { current: string | null } = { current: null };
export const rescueInProgressRef: { current: boolean } = { current: false };
export const rescuedUrlsRef: { current: Set<string> } = { current: new Set() };
export const songRescueAttemptsRef: { current: Map<string, number> } = { current: new Map() };
export const failedUrlsRef: { current: Set<string> } = { current: new Set() };
export const waitingTimeoutRef: { current: ReturnType<typeof setTimeout> | null } = {
  current: null,
};
export const stutterRetryCountRef: { current: number } = { current: 0 };
// 起播缓冲保护窗口：新 src 加载后的这段时间内，onWaiting 不做自 seek。
// 自 seek（audio.currentTime = cur）会中止在途的 Range 请求并重新发起，
// 把已经缓冲的内容清零，表现为"卡 2 秒 → 重启 → 再卡 2 秒"。
const INITIAL_BUFFERING_GRACE_MS = 8000;
const stallGraceUntilRef: { current: number } = { current: 0 };

function beginInitialBufferingWindow(): void {
  stallGraceUntilRef.current = Date.now() + INITIAL_BUFFERING_GRACE_MS;
}
const audioDeckIds = new WeakMap<HTMLAudioElement, string>();
const audioRequestIds = new WeakMap<HTMLAudioElement, number>();
let nextAudioDeckId = 1;

function getAudioDeckId(audio: HTMLAudioElement): string {
  let deckId = audioDeckIds.get(audio);
  if (!deckId) {
    deckId = `audio-deck-${nextAudioDeckId++}`;
    audioDeckIds.set(audio, deckId);
  }
  return deckId;
}

function getMediaSourceIdentity(source: string): string {
  if (typeof window === "undefined") return source;
  try {
    return new URL(source, window.location.href).href;
  } catch {
    return source;
  }
}

function getPlaybackSongIdentity(song: Song | null): string | null {
  return song ? String(song.id || song.title || "") || null : null;
}

function isCurrentPlaybackRequest(requestId: number, songId?: string): boolean {
  const state = usePlaybackRuntimeStore.getState();
  return state.requestId === requestId && (songId === undefined || state.targetSongId === songId);
}

function bindActivePlaybackDeck(
  audio: HTMLAudioElement,
  requestId: number,
  songId: string | null,
  source: string
): void {
  if (!isCurrentPlaybackRequest(requestId, songId ?? undefined)) return;
  const sourceIdentity = getMediaSourceIdentity(source);
  audioRequestIds.set(audio, requestId);
  usePlaybackRuntimeStore
    .getState()
    .bindActiveDeck(requestId, songId, getAudioDeckId(audio), sourceIdentity);
  playbackClock.attach(audio, requestId, songId, getAudioDeckId(audio), sourceIdentity);
}

function getCurrentAudioOwner(
  audio: HTMLAudioElement
): { requestId: number; deckId: string; source: string } | null {
  const state = usePlaybackRuntimeStore.getState();
  const requestId = audioRequestIds.get(audio);
  const deckId = getAudioDeckId(audio);
  if (
    requestId === undefined ||
    requestId !== state.requestId ||
    deckId !== state.activeDeckId ||
    !state.activeSource
  ) {
    return null;
  }

  const elementSource = audio.src ? getMediaSourceIdentity(audio.src) : null;
  const currentSource = audio.currentSrc ? getMediaSourceIdentity(audio.currentSrc) : null;
  // currentSrc may be the final redirect URL. The requested element src remains
  // the canonical ownership key, while currentSrc is accepted as a fallback.
  if (elementSource !== state.activeSource && currentSource !== state.activeSource) {
    return null;
  }

  return { requestId, deckId, source: state.activeSource };
}

function dispatchCurrentAudioEvent(
  audio: HTMLAudioElement,
  type: Exclude<PlaybackMachineEvent["type"], "request" | "request-error" | "activate">,
  message?: string
): number | null {
  const owner = getCurrentAudioOwner(audio);
  if (!owner) return null;
  const event = type === "error" ? { type, ...owner, message } : { type, ...owner };
  usePlaybackRuntimeStore
    .getState()
    .dispatchMediaEvent(event as Exclude<PlaybackMachineEvent, { type: "request" }>);
  return owner.requestId;
}

function dispatchPlaybackRequestError(requestId: number, message: string): void {
  usePlaybackRuntimeStore.getState().dispatchMediaEvent({
    type: "request-error",
    requestId,
    message,
  });
}

// handlePlayError 抢救成功后会重试 play()，其失败要回到自身。
// 直接写 handlePlayError 会构成"在声明前访问"（const 的 TDZ），运行时靠闭包侥幸生效；
// 改为经由先声明的句柄转发，在 effect 中赋值（渲染期不允许修改 ref）。
const handlePlayErrorSelfRef: {
  current: ((error: PlaybackErrorLike, requestId?: number) => void) | null;
} = { current: null };

// ---- 网络歌曲的后台离线缓存调度 ----
// 旧实现在 onPlaying 里立刻整段下载，而那一刻音频正抢同一条连接做首段缓冲，
// 起播那几秒因此更容易卡。规则（让路多久 / 缓冲门槛 / 重试上限 / 换歌取消）
// 都放在可单测的 backgroundCacheScheduler 里，这里只把它接到播放器的真实状态上。
const backgroundCacheScheduler = createBackgroundCacheScheduler({
  delayMs: DEFAULT_BACKGROUND_CACHE_DELAY_MS,
  minBufferSeconds: DEFAULT_BACKGROUND_CACHE_MIN_BUFFER_SECONDS,
  maxAttempts: DEFAULT_BACKGROUND_CACHE_MAX_ATTEMPTS,
  getCurrentSongId: () => currentSongIdRef.current,
  getBufferedSeconds: () => {
    const audio = audioElementRef.current;
    if (!audio || !audio.buffered.length) return 0;
    return audio.buffered.end(audio.buffered.length - 1);
  },
  startCache: (song, src) => {
    triggerBackgroundCache(song, src).catch(() => {});
  },
});

const loadingInProgressRequestIdRef: { current: number | null } = { current: null };
const activeHookIds = new Set<string>();

function isLeader(hookId: string): boolean {
  if (activeHookIds.size === 0) {
    activeHookIds.add(hookId);
    return true;
  }
  const first = activeHookIds.values().next().value;
  return first === hookId;
}

const CONFIRMED_PLAYBACK_SECONDS = 5;

type ManagedAudioElement = HTMLAudioElement & {
  _vibeListenersAttached?: boolean;
  _vibeCleanup?: () => void;
};

type PlaybackErrorLike = {
  name?: string;
  code?: number;
  message?: string;
};

type AudioWindow = Window & {
  audioElementRef?: typeof audioElementRef;
  /** 播放中曲目的全局镜像，供网络缓存回写歌词/封面时读取 */
  __VIBE_CURRENT_SONG__?: Song | null;
};

function ensureAudioElements(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return audioElementRef.current;

  if (!audioInstance) {
    audioInstance = new Audio();
    audioInstance.crossOrigin = "anonymous";
    const initialRate = usePlayerStore.getState().playbackRate || 1.0;
    audioInstance.defaultPlaybackRate = initialRate;
    audioInstance.playbackRate = initialRate;
    audioElementRef.current = audioInstance;

    secondaryAudioInstance = new Audio();
    secondaryAudioInstance.crossOrigin = "anonymous";
    secondaryAudioInstance.defaultPlaybackRate = initialRate;
    secondaryAudioInstance.playbackRate = initialRate;
    secondaryElementRef.current = secondaryAudioInstance;
  }

  return audioElementRef.current;
}

function getPlaybackError(error: unknown): PlaybackErrorLike {
  return typeof error === "object" && error !== null ? (error as PlaybackErrorLike) : {};
}

function getPlaybackErrorMessage(error: unknown): string {
  const playbackError = getPlaybackError(error);
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (playbackError.message) return playbackError.message;
  return "unknown reason";
}

export function getPlayableStreamUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return "";
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("stored://") ||
    trimmed.startsWith("local://") ||
    trimmed.startsWith("/api/audio/proxy")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("cached://")) {
    return "";
  }

  // 对外链进行本地代理中转，赋予完整 CORS 与 Range 206 拖拽支持，杜绝防盗链 403 与 Format error
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (typeof window !== "undefined" && trimmed.startsWith(window.location.origin)) {
      return trimmed;
    }
    return `/api/audio/proxy?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}

function stopForMissingAudioSource(audio: HTMLAudioElement): void {
  audio.pause();
  if (currentAudioUrlRef.current?.startsWith("blob:")) {
    BlobUrlRegistry.getInstance().revoke(currentAudioUrlRef.current);
  }
  currentAudioUrlRef.current = null;
  currentSongIdRef.current = null;
  loadedSongIdRef.current = null;
  loadedSongSourceKeyRef.current = null;
  isPlayingRef.current = false;
  audio.removeAttribute("src");
  audio.src = "";

  const currentSong = usePlayerStore.getState().currentSong;
  const runtimeState = usePlaybackRuntimeStore.getState();
  if (runtimeState.targetSongId === getPlaybackSongIdentity(currentSong)) {
    dispatchPlaybackRequestError(runtimeState.requestId, MISSING_AUDIO_SOURCE_MESSAGE);
  }
  useAudioStore.setState({ isPlaying: false, isLoading: false });
  usePlayerStore.setState({ isPlaying: false, isLoading: false });

  const src = currentSong?.source;
  const isNetworkPlatform =
    src &&
    ["netease", "wy", "qq", "tx", "kugou", "kg", "kuwo", "kw", "qishui"].includes(
      String(src).toLowerCase()
    );
  const platformNameMap: Record<string, string> = {
    netease: "网易云音乐",
    wy: "网易云音乐",
    qq: "QQ 音乐",
    tx: "QQ 音乐",
    kugou: "酷狗音乐",
    kg: "酷狗音乐",
    kuwo: "酷我音乐",
    kw: "酷我音乐",
    qishui: "汽水音乐",
  };

  if (isNetworkPlatform && !isPlatformLoggedIn(src)) {
    const rawKey = String(src).toLowerCase();
    const platformLabel = platformNameMap[rawKey] || "该平台";
    const mappedPlatform = (
      rawKey === "wy"
        ? "netease"
        : rawKey === "tx"
          ? "qq"
          : rawKey === "kg"
            ? "kugou"
            : rawKey === "kw"
              ? "kuwo"
              : rawKey
    ) as PlatformType;
    useAudioStore.setState({
      isPlaying: false,
      isLoading: false,
      error: {
        type: "load",
        message: `【${platformLabel}】链路未连接，请先登录账号以获取专属母带音频流。`,
        timestamp: Date.now(),
      },
    });
    useUIStore
      .getState()
      .showToast(
        `🔒 无法播放: 《${currentSong?.title || "此歌曲"}》来自【${platformLabel}】，未登录账号。请先登录以开启链路`,
        "warning",
        4000
      );
    // 自动定向激活并打开该平台账号登录弹窗
    useUserAccountStore.getState().setActivePlatform(mappedPlatform);
    useUserAccountStore.getState().setIsAccountModalOpen(true);
  } else {
    useAudioStore.setState({
      isPlaying: false,
      isLoading: false,
      error: { type: "load", message: MISSING_AUDIO_SOURCE_MESSAGE, timestamp: Date.now() },
    });
    useUIStore
      .getState()
      .showToast(
        `⚠️ 无法播放: 《${currentSong?.title || "该歌曲"}》没有可用音频直链，请导入本地文件或切换音源`,
        "warning",
        4000
      );
  }
}

function setConfirmedPlaybackState(isPlaying: boolean, isLoading: boolean): void {
  useAudioStore.setState({ isPlaying, isLoading });
  usePlayerStore.setState({ isPlaying, isLoading });
}

function syncPersistedPlaybackProgress(audio: HTMLAudioElement): void {
  if (!getCurrentAudioOwner(audio)) return;
  const currentTime = Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  useAudioStore.setState({ currentTime, duration });
  usePlayerStore.setState({ currentTime, duration });
  playbackClock.resync();
}

// Stable event handlers outside the hook to prevent duplicate listeners
// and ensure we can attach them once to each audio element
const attachListeners = (
  audio: ManagedAudioElement,
  handlePlayError: (error: PlaybackErrorLike, requestId?: number) => void
) => {
  detachListeners(audio);

  const {
    // 这两个只在组件外层的 effect deps 里用到，attachListeners 内部并未使用，_ 前缀标记
    setCurrentTime: _setCurrentTime,
    setDuration: _setDuration,
    setIsLoading,
    setError,
    nextSong,
    loopMode: _loopMode,
  } = useAudioStore.getState();

  // timeupdate 在部分浏览器上可达每秒 10 次，而 audio-store / player-store 的 persist
  // 会在**每次 setState** 时同步展开整个 state、JSON.stringify 并写 localStorage，
  // 两个 store 叠加即每秒 20 次序列化 + 写盘 —— 这是"出声之后控件迟钝"的来源之一。
  // 进度条按 4Hz 刷新已足够细腻；AB 循环与预取判断读的是 audio.currentTime 原值，
  // 不受这里节流影响，暂停/结束时还会强制补写一次。
  const TIMEUPDATE_THROTTLE_MS = 250;
  let lastTimeUpdateWriteAt = 0;

  const onTimeUpdate = () => {
    if (!getCurrentAudioOwner(audio)) return;
    const t = audio.currentTime;
    if (Number.isFinite(t)) {
      const now = Date.now();
      if (now - lastTimeUpdateWriteAt >= TIMEUPDATE_THROTTLE_MS) {
        lastTimeUpdateWriteAt = now;
        useAudioStore.setState({ currentTime: t });
        usePlayerStore.setState({ currentTime: t });
      }
    }

    const abState = useABLoopStore.getState();
    if (abState.isEnabled && abState.pointA !== null && abState.pointB !== null) {
      if (audio.currentTime >= abState.pointB) {
        audio.currentTime = abState.pointA;
        useABLoopStore.getState().incrementLoopCount();
      }
    }

    // 后台智能预拉取下一曲音频流 (实现 < 10ms 零等待秒切)
    if (
      audio.duration > 20 &&
      (audio.currentTime / audio.duration > 0.75 || audio.duration - audio.currentTime < 20)
    ) {
      const qState = useQueueStore.getState();
      if (qState.queue.length > 1) {
        const nextIdx = (qState.currentIndex + 1) % qState.queue.length;
        const nextSong = qState.queue[nextIdx];
        if (nextSong && nextSong.id) {
          audioPrefetcher.prefetchSong(nextSong).catch(() => {});
        }
      }
    }
  };
  const onLoadedMetadata = () => {
    const owner = getCurrentAudioOwner(audio);
    if (!owner) return;
    const requestId = owner.requestId;
    const d = audio.duration;
    if (d && !isNaN(d) && Number.isFinite(d)) {
      useAudioStore.setState({ duration: d });
      usePlayerStore.setState({ duration: d });
    }
    // 播放速度恢复：确保流媒体元数据解析后精准恢复用户设置的目标倍速
    const currentRate = usePlayerStore.getState().playbackRate || 1.0;
    audio.defaultPlaybackRate = currentRate;
    if (audio.playbackRate !== currentRate) {
      audio.playbackRate = currentRate;
    }

    // 断点续播恢复：如果本地持久化记录了上次播放秒数，且尚未开始播放，则安全恢复到该断点
    const savedTime =
      usePlayerStore.getState().currentTime || getPlaybackClockSnapshot().currentTime;
    if (
      savedTime > 0 &&
      Math.abs(audio.currentTime - savedTime) > 1 &&
      savedTime < (d || Infinity)
    ) {
      try {
        audio.currentTime = savedTime;
      } catch {
        // Ignored
      }
    }

    // 智能防试听截断：若加载出的流时长 <= 95s (如 30s/60s VIP试听)，自动抢救全网完整母带
    // 使用防重入标志与单曲抢救次数上限，避免抢救后 audio.load() 再次触发 onLoadedMetadata 形成死循环
    const currentSong = usePlayerStore.getState().currentSong;
    const songKey = String(currentSong?.id || currentSong?.title || "");
    const rescueAttempts = songKey ? songRescueAttemptsRef.current.get(songKey) || 0 : 0;

    if (
      audio.duration > 0 &&
      audio.duration <= 95 &&
      currentSong &&
      (currentSong.title || currentSong.id) &&
      !rescueInProgressRef.current &&
      rescueAttempts < 1 &&
      !rescuedUrlsRef.current.has(audio.src)
    ) {
      rescueInProgressRef.current = true;
      songRescueAttemptsRef.current.set(songKey, rescueAttempts + 1);

      logHandledAudioWarning(
        "Detected trial snippet (" + Math.round(audio.duration) + "s), auto-rescuing full song for",
        currentSong.title
      );
      multiSourceResolver
        .resolvePlayableAudio(
          {
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album,
            source: currentSong.source,
          },
          true
        )
        .then((rescued) => {
          if (
            !isCurrentPlaybackRequest(requestId, getPlaybackSongIdentity(currentSong) ?? undefined)
          ) {
            return;
          }
          if (
            rescued?.url &&
            rescued.url !== currentSong.audioUrl &&
            !rescued.isTrial &&
            !failedUrlsRef.current.has(rescued.url)
          ) {
            const streamUrl = getPlayableStreamUrl(rescued.url);
            if (!failedUrlsRef.current.has(streamUrl)) {
              rescuedUrlsRef.current.add(streamUrl);
              bindActivePlaybackDeck(
                audio,
                requestId,
                getPlaybackSongIdentity(currentSong),
                streamUrl
              );
              const mixer = CrossfadeMixer.getInstance();
              mixer.prepareForDirectPlayback(audio);
              if (secondaryElementRef.current && secondaryElementRef.current !== audio) {
                mixer.pauseAndReset(secondaryElementRef.current, true);
              }
              audio.src = streamUrl;
              currentAudioUrlRef.current = streamUrl;
              // 直接修改对象属性而不创建新引用，避免触发 Playback Effect 重执行导致状态重置
              currentSong.audioUrl = rescued.url;
              currentSong.source = rescued.source;
              loadedSongIdRef.current = getPlaybackSongIdentity(currentSong);
              loadedSongSourceKeyRef.current = `${currentSong.source || ""}\u0000${currentSong.audioUrl || ""}`;
              useAudioStore.setState({ error: null });
              audio.load();
              if (isPlayingRef.current) {
                audio.play().catch((error) => handlePlayError(error, owner.requestId));
              }
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          rescueInProgressRef.current = false;
        });
    }
  };
  const onDurationChange = () => {
    if (!getCurrentAudioOwner(audio)) return;
    const d = audio.duration;
    if (d && Number.isFinite(d) && d > 0) {
      useAudioStore.getState().setDuration(d);
      usePlayerStore.getState().setDuration(d);
    } else {
      useAudioStore.setState({ duration: 0 });
      usePlayerStore.setState({ duration: 0 });
    }
  };
  const onLoadStart = () => {
    const requestId = dispatchCurrentAudioEvent(audio, "loadstart");
    if (requestId === null) return;
    // 每次新资源开始加载都重开启播缓冲保护窗口（设置 src 会隐式触发 load 算法，
    // 所以这里能覆盖主路径、试听抢救、onError 抢救与交叉淡入四条装载路径）
    beginInitialBufferingWindow();
    useAudioStore.getState().setIsLoading(true);
    usePlayerStore.getState().setIsLoading(true);
  };
  const onCanPlay = () => {
    const owner = getCurrentAudioOwner(audio);
    if (!owner) return;
    dispatchCurrentAudioEvent(audio, "canplay");
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    if (!usePlaybackRuntimeStore.getState().shouldPlay) {
      setConfirmedPlaybackState(false, false);
    }
    const currentRate = usePlayerStore.getState().playbackRate || 1.0;
    if (audio.playbackRate !== currentRate) {
      audio.playbackRate = currentRate;
    }
    if (isPlayingRef.current) {
      audio.play().catch((error) => handlePlayError(error, owner.requestId));
    }
  };
  const onWaiting = () => {
    const owner = getCurrentAudioOwner(audio);
    if (
      !owner ||
      !shouldAcceptPlaybackMediaEvent("waiting", {
        paused: audio.paused,
        ended: audio.ended,
        readyState: audio.readyState,
        hasError: Boolean(audio.error),
        shouldPlay: usePlaybackRuntimeStore.getState().shouldPlay,
      })
    ) {
      return;
    }
    if (!usePlaybackRuntimeStore.getState().shouldPlay) return;
    dispatchCurrentAudioEvent(audio, "waiting");
    setConfirmedPlaybackState(false, true);

    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
    }

    // 起播缓冲期内等更久再介入，并且不自 seek —— 否则会把在途请求打断、缓冲清零
    const inInitialBuffering = Date.now() < stallGraceUntilRef.current;
    const delay = inInitialBuffering ? 6000 : 2000;

    waitingTimeoutRef.current = setTimeout(() => {
      waitingTimeoutRef.current = null;
      const currentOwner = getCurrentAudioOwner(audio);
      if (
        !currentOwner ||
        currentOwner.requestId !== owner.requestId ||
        currentOwner.source !== owner.source ||
        !usePlaybackRuntimeStore.getState().shouldPlay
      ) {
        return;
      }
      if (stutterRetryCountRef.current < 2) {
        stutterRetryCountRef.current += 1;
        console.warn(
          `[useAudioPlayer] Stutter detected (waiting > ${(delay / 1000).toFixed(1)}s` +
            `${inInitialBuffering ? ", 起播缓冲期" : ""}), executing soft resume #${stutterRetryCountRef.current}`
        );
        try {
          if (!inInitialBuffering) {
            const cur = audio.currentTime;
            if (Number.isFinite(cur)) {
              audio.currentTime = cur;
            }
          }
          if (isPlayingRef.current || !audio.paused) {
            audio.play().catch((error) => handlePlayError(error, owner.requestId));
          }
        } catch (e) {
          console.warn("[useAudioPlayer] Stutter soft resume failed:", e);
        }
      } else {
        console.warn("[useAudioPlayer] Stutter recovery limit reached (max 2 retries per stall)");
      }
    }, delay);
  };
  const onPlaying = () => {
    if (
      !shouldAcceptPlaybackMediaEvent("playing", {
        paused: audio.paused,
        ended: audio.ended,
        readyState: audio.readyState,
        hasError: Boolean(audio.error),
        shouldPlay: usePlaybackRuntimeStore.getState().shouldPlay,
      })
    ) {
      return;
    }
    const requestId = dispatchCurrentAudioEvent(audio, "playing");
    if (requestId === null || usePlaybackRuntimeStore.getState().phase !== "playing") return;
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    stutterRetryCountRef.current = 0;

    setConfirmedPlaybackState(true, false);
    syncPersistedPlaybackProgress(audio);
    // 仅在切歌或新曲目初次播放成功时弹出 Toast 提示（杜绝快进/倒退/拖动进度条 seek 时重复刷屏）
    const playingSong = usePlayerStore.getState().currentSong;
    if (playingSong && playingSong.title) {
      const songKey = `${playingSong.id || playingSong.title}`;
      if (lastToastSongIdRef.current !== songKey) {
        lastToastSongIdRef.current = songKey;
        useUIStore
          .getState()
          .showToast(
            `▶ 正在播放: 《${playingSong.title}》· ${playingSong.artist || "未知歌手"}`,
            "success",
            2500
          );
      }
    }
    // 后台缓存延后到缓冲就绪再发起（见 backgroundCacheScheduler），避免和首段缓冲抢带宽
    const currentSrc = audio.src;
    if (
      playingSong &&
      playingSong.source !== "local" &&
      playingSong.source !== "upload" &&
      playingSong.source !== "demo" &&
      currentSrc &&
      !currentSrc.startsWith("blob:")
    ) {
      backgroundCacheScheduler.schedule(playingSong, currentSrc);
    }
  };
  const onPlay = () => {
    // A play event reports intent only; the current source's `playing` event confirms playback.
  };
  const onPause = () => {
    if (
      !shouldAcceptPlaybackMediaEvent("pause", {
        paused: audio.paused,
        ended: audio.ended,
        readyState: audio.readyState,
        hasError: Boolean(audio.error),
        shouldPlay: usePlaybackRuntimeStore.getState().shouldPlay,
      })
    ) {
      return;
    }
    const runtime = usePlaybackRuntimeStore.getState();
    if (runtime.shouldPlay && (runtime.phase === "loading" || runtime.phase === "buffering")) {
      return;
    }
    const requestId = dispatchCurrentAudioEvent(audio, "pause");
    if (requestId === null) return;
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    isPlayingRef.current = false;
    setConfirmedPlaybackState(false, false);
    syncPersistedPlaybackProgress(audio);
  };
  const onEnded = () => {
    if (
      !shouldAcceptPlaybackMediaEvent("ended", {
        paused: audio.paused,
        ended: audio.ended,
        readyState: audio.readyState,
        hasError: Boolean(audio.error),
        shouldPlay: usePlaybackRuntimeStore.getState().shouldPlay,
      })
    ) {
      return;
    }
    const requestId = dispatchCurrentAudioEvent(audio, "ended");
    if (requestId === null) return;
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    stutterRetryCountRef.current = 0;
    isPlayingRef.current = false;
    setConfirmedPlaybackState(false, false);
    syncPersistedPlaybackProgress(audio);

    // 播放结束双重保险触发离线持久化缓存
    const endedSong = usePlayerStore.getState().currentSong;
    const currentSrc = audio.src;
    if (
      endedSong &&
      endedSong.source !== "local" &&
      endedSong.source !== "upload" &&
      endedSong.source !== "demo" &&
      currentSrc &&
      !currentSrc.startsWith("blob:")
    ) {
      triggerBackgroundCache(endedSong, currentSrc).catch(() => {});
    }

    const currentLoopMode = usePlayerStore.getState().loopMode;

    if (currentLoopMode === "single") {
      console.info("[useAudioPlayer] 🔁 触发单曲循环重播:", endedSong?.title);
      useAudioStore.getState().setCurrentTime(0);
      usePlayerStore.getState().setCurrentTime(0);
      audio.currentTime = 0;
      const runtime = usePlaybackRuntimeStore.getState();
      const replayRequestId = runtime.requestPlayback(
        runtime.targetSongId,
        runtime.targetSource,
        true
      );
      isPlayingRef.current = true;
      bindActivePlaybackDeck(
        audio,
        replayRequestId,
        runtime.targetSongId,
        currentAudioUrlRef.current || audio.src
      );
      audio.play().catch((error) => handlePlayError(error, replayRequestId));
    } else {
      nextSong();
    }
  };
  const onError = async (event: Event) => {
    const audioEl = event.target as HTMLAudioElement;
    const owner = getCurrentAudioOwner(audioEl);
    if (!owner) return;
    const requestId = owner.requestId;
    const error = audioEl.error;

    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }

    // 记录所有失败的 URL，防止后续抢救或嗅探再次陷入同一坏链
    if (audioEl.src) failedUrlsRef.current.add(audioEl.src);
    if (audioEl.currentSrc) failedUrlsRef.current.add(audioEl.currentSrc);

    // 过滤中断与取消错误 (MEDIA_ERR_ABORTED = 1)
    if (!error || error.code === 1) {
      return;
    }

    const hasValidSrc = Boolean(audioEl.currentSrc || audioEl.src);
    if (!hasValidSrc) return;

    // Strict guard check to strictly prevent concurrent or recursive re-entry
    if (rescueInProgressRef.current) {
      return;
    }

    const currentSong = usePlayerStore.getState().currentSong;
    const songKey = String(currentSong?.id || currentSong?.title || "");
    const rescueAttempts = songKey ? songRescueAttemptsRef.current.get(songKey) || 0 : 0;

    if (currentSong && (currentSong.title || currentSong.id) && rescueAttempts < 1) {
      rescueInProgressRef.current = true;
      songRescueAttemptsRef.current.set(songKey, rescueAttempts + 1);

      logHandledAudioWarning(
        "Audio element load failed, attempting auto-rescue",
        audioEl.currentSrc || audioEl.src
      );

      try {
        multiSourceResolver.invalidateSong({
          id: currentSong.id,
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album,
          source: currentSong.source,
        });

        const rescued = await multiSourceResolver.resolvePlayableAudio(
          {
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album,
          },
          true
        );

        if (
          !isCurrentPlaybackRequest(requestId, getPlaybackSongIdentity(currentSong) ?? undefined)
        ) {
          return;
        }

        if (rescued?.url && !failedUrlsRef.current.has(rescued.url)) {
          const streamUrl = getPlayableStreamUrl(rescued.url);
          if (!failedUrlsRef.current.has(streamUrl)) {
            rescuedUrlsRef.current.add(streamUrl);
            bindActivePlaybackDeck(
              audioEl,
              requestId,
              usePlaybackRuntimeStore.getState().targetSongId,
              streamUrl
            );
            audioEl.src = streamUrl;
            currentAudioUrlRef.current = streamUrl;
            // 直接修改属性而不创建新引用，避免触发 Playback Effect 级联重置
            currentSong.audioUrl = rescued.url;
            currentSong.source = rescued.source;
            loadedSongIdRef.current = getPlaybackSongIdentity(currentSong);
            loadedSongSourceKeyRef.current = `${currentSong.source || ""}\u0000${currentSong.audioUrl || ""}`;
            useAudioStore.setState({ error: null });
            audioEl.load();
            if (isPlayingRef.current) {
              audioEl.play().catch((playError) => handlePlayError(playError, requestId));
            }
            return;
          }
        }
      } catch (e) {
        console.warn("[useAudioPlayer] Auto-rescue error:", e);
      } finally {
        rescueInProgressRef.current = false;
      }
    }

    // Graceful fallback when rescue limit is reached (sets error state, stops loading, shows 1 toast, never loops)
    const loadError = createAudioElementLoadError(error);
    dispatchPlaybackRequestError(requestId, loadError.message);
    logHandledAudioWarning("Audio element load failed", loadError.message);
    setError(loadError);
    setIsLoading(false);
    isPlayingRef.current = false;
    setConfirmedPlaybackState(false, false);

    if (songKey && lastToastSongIdRef.current !== `error-${songKey}`) {
      lastToastSongIdRef.current = `error-${songKey}`;
      useUIStore
        .getState()
        .showToast(
          `❌ 播放失败: 无法解析《${currentSong?.title || "此歌曲"}》的音频流，请尝试更换音源`,
          "error",
          4000
        );
    }
  };

  const onRateChange = () => {
    if (!getCurrentAudioOwner(audio)) return;
    const currentRate = audio.playbackRate;
    if (Number.isFinite(currentRate) && currentRate > 0) {
      const rounded = Math.round(currentRate * 100) / 100;
      const storeRate = usePlayerStore.getState().playbackRate || 1.0;
      if (Math.abs(storeRate - rounded) > 0.01) {
        usePlayerStore.setState({ playbackRate: rounded });
      }
    }
  };

  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  audio.addEventListener("durationchange", onDurationChange);
  audio.addEventListener("loadstart", onLoadStart);
  audio.addEventListener("canplay", onCanPlay);
  audio.addEventListener("waiting", onWaiting);
  audio.addEventListener("playing", onPlaying);
  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);
  audio.addEventListener("ratechange", onRateChange);

  audio._vibeListenersAttached = true;
  audio._vibeCleanup = () => {
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    audio.removeEventListener("timeupdate", onTimeUpdate);
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    audio.removeEventListener("durationchange", onDurationChange);
    audio.removeEventListener("loadstart", onLoadStart);
    audio.removeEventListener("canplay", onCanPlay);
    audio.removeEventListener("waiting", onWaiting);
    audio.removeEventListener("playing", onPlaying);
    audio.removeEventListener("play", onPlay);
    audio.removeEventListener("pause", onPause);
    audio.removeEventListener("ended", onEnded);
    audio.removeEventListener("error", onError);
    audio.removeEventListener("ratechange", onRateChange);
    audio._vibeListenersAttached = false;
    audio._vibeCleanup = undefined;
  };
};

const detachListeners = (audio: ManagedAudioElement) => {
  if (typeof audio._vibeCleanup === "function") {
    audio._vibeCleanup();
  }
};

let isAudioGraphInitialized = false;
let lastConnectedAudioElement: HTMLAudioElement | null = null;

async function initializeAudioGraph(audio: HTMLAudioElement): Promise<void> {
  const engine = AudioEngine.getInstance();
  engine.init(audio);

  const analyser = engine.getAnalyser();
  const context = engine.getContext();
  if (!analyser || !context) return;

  if (isAudioGraphInitialized && lastConnectedAudioElement === audio) {
    if (context.state === "suspended") {
      await context.resume().catch(() => {});
    }
    return;
  }

  const effectsManager = getAudioEffectsManager();
  await effectsManager.init();
  effectsManager.connect(analyser, context.destination, audio);
  isAudioGraphInitialized = true;
  lastConnectedAudioElement = audio;
}

export const useAudioPlayer = () => {
  const [hookId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [audioElement, setLocalAudioElement] = useState<HTMLAudioElement | null>(() =>
    ensureAudioElements()
  );

  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const shouldPlay = usePlaybackRuntimeStore((state) => state.shouldPlay);
  const playbackRequestId = usePlaybackRuntimeStore((state) => state.requestId);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const eqBands = useEQStore((state) => state.eqBands);
  const isEQEnabled = useEQStore((state) => state.isEQEnabled);
  const isEmotionCurveMode = useAudioStore((state) => state.isEmotionCurveMode);
  const loopMode = usePlayerStore((state) => state.loopMode);

  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setIsLoading = usePlayerStore((state) => state.setIsLoading);
  const setError = useAudioStore((state) => state.setError);
  const setDynamicCrossfadeDuration = useAudioStore((state) => state.setDynamicCrossfadeDuration);

  const recordStatsPlay = useStatsAchievementsStore((state) => state.recordPlay);
  const recordJournalPlay = useListeningJournalStore((state) => state.recordPlay);

  const handlePlayError = useCallback(
    async (error: PlaybackErrorLike, requestId = usePlaybackRuntimeStore.getState().requestId) => {
      if (!isCurrentPlaybackRequest(requestId) || !usePlaybackRuntimeStore.getState().shouldPlay) {
        return;
      }
      const playbackError = getPlaybackError(error);
      const message = getPlaybackErrorMessage(error);
      const isAbortError =
        playbackError.name === "AbortError" ||
        playbackError.code === 20 ||
        message.includes("interrupted") ||
        message.includes("new load request") ||
        message.includes("pause");

      if (isAbortError) return;

      const audio = audioElementRef.current;
      if (audio?.src) failedUrlsRef.current.add(audio.src);
      if (audio?.currentSrc) failedUrlsRef.current.add(audio.currentSrc);

      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
        waitingTimeoutRef.current = null;
      }

      // Guard check to strictly prevent concurrent or recursive re-entry
      if (rescueInProgressRef.current) {
        return;
      }

      const currentSong = usePlayerStore.getState().currentSong;
      if (
        !currentSong ||
        !isCurrentPlaybackRequest(requestId, getPlaybackSongIdentity(currentSong) ?? undefined)
      ) {
        return;
      }
      const songKey = String(currentSong?.id || currentSong?.title || "");
      const rescueAttempts = songKey ? songRescueAttemptsRef.current.get(songKey) || 0 : 0;

      if (audio && currentSong && (currentSong.title || currentSong.id) && rescueAttempts < 1) {
        rescueInProgressRef.current = true;
        songRescueAttemptsRef.current.set(songKey, rescueAttempts + 1);

        try {
          multiSourceResolver.invalidateSong({
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album,
            source: currentSong.source,
          });

          const rescued = await multiSourceResolver.resolvePlayableAudio(
            {
              id: currentSong.id,
              title: currentSong.title,
              artist: currentSong.artist,
              album: currentSong.album,
            },
            true
          );

          if (
            !isCurrentPlaybackRequest(requestId, getPlaybackSongIdentity(currentSong) ?? undefined)
          ) {
            return;
          }

          if (rescued?.url && !failedUrlsRef.current.has(rescued.url)) {
            const streamUrl = getPlayableStreamUrl(rescued.url);
            if (!failedUrlsRef.current.has(streamUrl)) {
              rescuedUrlsRef.current.add(streamUrl);
              bindActivePlaybackDeck(
                audio,
                requestId,
                getPlaybackSongIdentity(currentSong),
                streamUrl
              );
              const mixer = CrossfadeMixer.getInstance();
              mixer.prepareForDirectPlayback(audio);
              if (secondaryElementRef.current && secondaryElementRef.current !== audio) {
                mixer.pauseAndReset(secondaryElementRef.current, true);
              }
              audio.src = streamUrl;
              currentAudioUrlRef.current = streamUrl;
              currentSong.audioUrl = rescued.url;
              currentSong.source = rescued.source;
              loadedSongIdRef.current = getPlaybackSongIdentity(currentSong);
              loadedSongSourceKeyRef.current = `${currentSong.source || ""}\u0000${currentSong.audioUrl || ""}`;
              useAudioStore.setState({ error: null });
              audio.load();
              audio
                .play()
                .catch((playError) => handlePlayErrorSelfRef.current?.(playError, requestId));
              return;
            }
          }
        } catch {
          // ignore
        } finally {
          rescueInProgressRef.current = false;
        }
      }

      // Graceful fallback when rescue limit is reached (sets error state, stops loading, shows 1 toast, never loops)
      if (!isCurrentPlaybackRequest(requestId, getPlaybackSongIdentity(currentSong) ?? undefined)) {
        return;
      }
      isPlayingRef.current = false;
      dispatchPlaybackRequestError(requestId, message);
      setConfirmedPlaybackState(false, false);
      setIsLoading(false);

      if (
        message.includes("no supported sources") ||
        message.includes("empty src") ||
        playbackError.name === "NotSupportedError"
      ) {
        logHandledAudioWarning("Playback fallback", "Audio source missing or unsupported");
        setError({
          type: "load",
          message: MISSING_AUDIO_SOURCE_MESSAGE,
          timestamp: Date.now(),
        });
        if (songKey && lastToastSongIdRef.current !== `error-${songKey}`) {
          lastToastSongIdRef.current = `error-${songKey}`;
          useUIStore
            .getState()
            .showToast(
              `⚠️ 无法播放: 《${currentSong?.title || "该歌曲"}》没有可用音频直链，请导入本地文件或切换音源`,
              "warning",
              4000
            );
        }
        return;
      }

      logHandledAudioWarning("Playback failed", message);
      setError({
        type: "play",
        message: "Playback failed: " + message,
        timestamp: Date.now(),
      });
      if (songKey && lastToastSongIdRef.current !== `error-${songKey}`) {
        lastToastSongIdRef.current = `error-${songKey}`;
        useUIStore
          .getState()
          .showToast(
            `❌ 播放失败: 无法解析《${currentSong?.title || "此歌曲"}》的音频流，请尝试更换音源`,
            "error",
            4000
          );
      }
    },
    [setError, setIsLoading]
  );

  useEffect(() => {
    handlePlayErrorSelfRef.current = handlePlayError;
  }, [handlePlayError]);

  // Initialization Effect
  useEffect(() => {
    activeHookIds.add(hookId);
    const audio = ensureAudioElements();
    if (audio && audioElement !== audio) {
      queueMicrotask(() => setLocalAudioElement(audio));
    }

    // Global ref for legacy components
    if (typeof window !== "undefined") {
      (window as AudioWindow).audioElementRef = audioElementRef;
    }

    registerAudioSeekHandler((time: number) => {
      const activeAudio = audioElementRef.current;
      if (activeAudio) {
        try {
          const maxTime =
            Number.isFinite(activeAudio.duration) && activeAudio.duration > 0
              ? activeAudio.duration
              : time;
          const clamped = Math.max(0, Math.min(time, maxTime));
          activeAudio.currentTime = clamped;
          useAudioStore.setState({ currentTime: clamped });
          usePlayerStore.setState({ currentTime: clamped });
          if (isPlayingRef.current && activeAudio.paused) {
            AudioEngine.getInstance()
              .resume()
              .catch(() => {});
            const requestId = usePlaybackRuntimeStore.getState().requestId;
            activeAudio.play().catch((error) => handlePlayError(error, requestId));
          }
        } catch {
          // 恢复播放失败时保持当前进度，交给上层错误处理
        }
      }
      if (secondaryElementRef.current) {
        try {
          secondaryElementRef.current.currentTime = time;
        } catch {
          // 交叉淡入期间副元素可能尚未加载完元数据，seek 失败可忽略
        }
      }
    });

    return () => {
      activeHookIds.delete(hookId);
    };
  }, [audioElement, hookId, handlePlayError]);

  // Sync state with shared element whenever it changes
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    attachListeners(audio, handlePlayError);
    if (secondaryElementRef.current) {
      attachListeners(secondaryElementRef.current, handlePlayError);
    }

    // Sync current values if already loaded
    if (audio.duration && !isNaN(audio.duration) && Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
      useAudioStore.setState({ duration: audio.duration });
      usePlayerStore.setState({ duration: audio.duration });
    }
    if (
      audio.currentTime !== undefined &&
      !isNaN(audio.currentTime) &&
      Number.isFinite(audio.currentTime)
    ) {
      setCurrentTime(audio.currentTime);
      useAudioStore.setState({ currentTime: audio.currentTime });
      usePlayerStore.setState({ currentTime: audio.currentTime });
    }

    const handleVisiblePlaybackResync = () => {
      if (document.visibilityState === "hidden") return;
      playbackClock.handleVisibilityChange();
      const activeAudio = audioElementRef.current;
      if (activeAudio) syncPersistedPlaybackProgress(activeAudio);
    };
    document.addEventListener("visibilitychange", handleVisiblePlaybackResync);

    return () => {
      document.removeEventListener("visibilitychange", handleVisiblePlaybackResync);
      detachListeners(audio);
      if (secondaryElementRef.current) {
        detachListeners(secondaryElementRef.current);
      }
    };
  }, [audioElement, handlePlayError, setDuration, setCurrentTime]);

  // 同步原生 HTMLAudioElement 的 loop 属性与单曲循环状态
  useEffect(() => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.loop = loopMode === "single";
    }
    if (secondaryElementRef.current) {
      secondaryElementRef.current.loop = loopMode === "single";
    }
  }, [loopMode]);

  // Playback Management Effect (Only run by the manager instance)
  useEffect(() => {
    if (!isLeader(hookId)) return;

    const managePlayback = async () => {
      const audio = audioElementRef.current;
      if (!audio || !currentSong) return;

      if (typeof window !== "undefined") {
        (window as AudioWindow).__VIBE_CURRENT_SONG__ = currentSong;
      }

      const songId = String(currentSong.id || currentSong.title || "");
      const currentRuntime = usePlaybackRuntimeStore.getState();
      const requestId =
        currentRuntime.targetSongId === songId
          ? currentRuntime.requestId
          : usePlaybackRuntimeStore
              .getState()
              .requestPlayback(songId || null, currentSong.audioUrl || null, isPlaying, true);
      if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;
      const targetPlaying = usePlaybackRuntimeStore.getState().shouldPlay;
      isPlayingRef.current = targetPlaying;
      const targetSourceKey = `${currentSong.source || ""}\u0000${currentSong.audioUrl || ""}`;
      const targetNeedsLoad =
        loadedSongIdRef.current !== songId || loadedSongSourceKeyRef.current !== targetSourceKey;

      // 1. 同一首歌曲且已有音频流时：仅做播放/暂停状态同步，绝不重复加载或重置管道
      if (!targetNeedsLoad && audio.src && currentAudioUrlRef.current && !audio.error) {
        bindActivePlaybackDeck(audio, requestId, songId || null, currentAudioUrlRef.current);
        if (targetPlaying) {
          if (audio.paused) {
            const mixer = CrossfadeMixer.getInstance();
            mixer.prepareForDirectPlayback(audio);
            if (secondaryElementRef.current && secondaryElementRef.current !== audio) {
              mixer.pauseAndReset(secondaryElementRef.current, true);
            }
            // 仅当音频已播放至末尾且用户明确要求恢复播放时，才重置进度归零
            if (audio.ended) {
              audio.currentTime = 0;
              useAudioStore.getState().setCurrentTime(0);
              usePlayerStore.getState().setCurrentTime(0);
            }
            try {
              await initializeAudioGraph(audio);
              await AudioEngine.getInstance().resume();
              if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;
              audio.play().catch((error) => handlePlayError(error, requestId));
            } catch (e) {
              handlePlayError(e as PlaybackErrorLike, requestId);
            }
          }
        } else {
          const mixer = CrossfadeMixer.getInstance();
          mixer.pauseAndReset(audio);
          if (secondaryElementRef.current && secondaryElementRef.current !== audio) {
            mixer.pauseAndReset(secondaryElementRef.current, true);
          }
        }
        return;
      }

      // 如果这首歌曲正在嗅探解析中，不重复触发任务
      if (loadingInProgressRequestIdRef.current === requestId) {
        return;
      }

      const previousSongId = currentSongIdRef.current;
      currentSongIdRef.current = songId;
      loadingInProgressRequestIdRef.current = requestId;

      setIsLoading(true);
      setError(null);

      if (previousSongId !== songId || targetNeedsLoad) {
        if (currentAudioUrlRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
        }
        currentAudioUrlRef.current = null;
        loadedSongIdRef.current = null;
        loadedSongSourceKeyRef.current = null;
        lastRecordedSongIdRef.current = null;
        lastToastSongIdRef.current = null;
        rescueInProgressRef.current = false;
        rescuedUrlsRef.current.clear();
        // 上一首的后台缓存还没发起就换歌了 —— 取消，别给旧歌白拉几十 MB
        backgroundCacheScheduler.cancel();
        if (waitingTimeoutRef.current) {
          clearTimeout(waitingTimeoutRef.current);
          waitingTimeoutRef.current = null;
        }
        stutterRetryCountRef.current = 0;
        useAudioStore.setState({ currentTime: 0 });
        usePlayerStore.setState({ currentTime: 0 });
        if (audio) {
          audio.currentTime = 0;
        }
      }

      try {
        let audioUrl = currentSong.audioUrl?.trim();
        let isOfflineDirectHit = false;

        // 0. ===== 本地持久化离线下载文件沙盒 (最高优先级，零网络 0ms 本地直读) =====
        if (currentSong.id) {
          try {
            const offlineRecord = await getOfflineAudio(String(currentSong.id));
            if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;
            if (
              offlineRecord &&
              offlineRecord.fileData &&
              offlineRecord.fileData.byteLength > 1000
            ) {
              const blob = new Blob([offlineRecord.fileData], {
                type: offlineRecord.mimeType || "audio/mpeg",
              });
              const blobUrl = BlobUrlRegistry.getInstance().register(
                blob,
                `offline_${currentSong.id}`
              );
              audioUrl = blobUrl;
              currentAudioUrlRef.current = blobUrl;
              isOfflineDirectHit = true;

              // 同步恢复已下载的离线歌词与高清封面
              if (offlineRecord.lyrics && !currentSong.lyrics) {
                currentSong.lyrics = offlineRecord.lyrics;
                currentSong.translationLyrics = offlineRecord.translationLyrics;
                usePlayerStore
                  .getState()
                  .updateCurrentSongLyrics(offlineRecord.lyrics, offlineRecord.translationLyrics);
              }
              if (
                offlineRecord.cover &&
                (!currentSong.cover || currentSong.cover === "/default-cover.svg")
              ) {
                currentSong.cover = offlineRecord.cover;
                usePlayerStore.getState().updateCurrentSongCover(offlineRecord.cover);
              }

              console.info(
                `[useAudioPlayer] 🚀 命中本地离线母带文件 (0ms 纯本地直读秒播): 《${currentSong.title}》- ${(offlineRecord.fileSize / 1024 / 1024).toFixed(2)}MB`
              );
            }
          } catch (e) {
            console.warn(
              "[useAudioPlayer] Offline audio retrieval error, fallback to standard flow:",
              e
            );
          }
        }

        if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;

        // 1. ===== 本地用户自导入音乐 (stored://, local:// 或 source: local) =====
        if (
          !isOfflineDirectHit &&
          (audioUrl?.startsWith("stored://") ||
            audioUrl?.startsWith("local://") ||
            currentSong.source === "local")
        ) {
          const id =
            audioUrl?.startsWith("stored://") || audioUrl?.startsWith("local://")
              ? audioUrl.replace(/^(stored|local):\/\//, "")
              : String(currentSong.id);
          const storedMusic = await getStoredMusic(id);
          if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;
          if (storedMusic && storedMusic.fileData) {
            audioUrl = createBlobUrlFromStoredMusic(storedMusic);
            currentAudioUrlRef.current = audioUrl;
            isOfflineDirectHit = true;
            console.info(
              `[useAudioPlayer] 📁 命中本地导入音频 (0ms 直读): 《${currentSong.title}》`
            );
          }
        }

        if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;

        // 2. ===== 临时流媒体网络缓存 (cached://) =====
        if (
          !isOfflineDirectHit &&
          (audioUrl?.startsWith("cached://") ||
            (currentSong.source !== "local" && currentSong.source !== "upload"))
        ) {
          try {
            const cached = await getCachedAudio(currentSong.id, currentSong.source);
            if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;
            if (cached) {
              const cachedBlobUrl = createBlobUrlFromCache(cached);
              if (cachedBlobUrl) {
                audioUrl = cachedBlobUrl;
                currentAudioUrlRef.current = cachedBlobUrl;
                isOfflineDirectHit = true;
                if (!currentSong.lyrics && cached.lyrics) {
                  currentSong.lyrics = cached.lyrics;
                  currentSong.translationLyrics = cached.translationLyrics;
                }
                if (
                  (!currentSong.cover || currentSong.cover === "/default-cover.svg") &&
                  cached.cover
                ) {
                  currentSong.cover = cached.cover;
                }
                updateLastPlayed(makeCacheKey(currentSong.id, currentSong.source)).catch(() => {});
                console.info("[useAudioPlayer] 🎵 命中临时音频缓存，离线秒开:", currentSong.title);
              }
            }
          } catch {
            // 缓存未命中继续后续链路
          }
        }

        if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;

        // 3. ===== 仅在本地无缓存、或本地文件不存在/损坏时，才作为智能回退（Fallback）方案走网络音源嗅探 =====
        if (!isOfflineDirectHit) {
          const isRiskyOuterUrl = Boolean(
            audioUrl && audioUrl.includes("music.163.com/song/media/outer/url")
          );
          const isInvalidUrl =
            !audioUrl ||
            (!audioUrl.startsWith("http") &&
              !audioUrl.startsWith("blob:") &&
              !audioUrl.startsWith("data:"));
          if ((isInvalidUrl || isRiskyOuterUrl) && currentSong) {
            useUIStore
              .getState()
              .showToast(`⚡ 正在通过音源引擎嗅探直链: 《${currentSong.title}》...`, "info", 2000);
            try {
              const resolved = await multiSourceResolver.resolvePlayableAudio({
                id: currentSong.id,
                title: currentSong.title,
                artist: currentSong.artist,
                album: currentSong.album,
                source: currentSong.source,
              });
              if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;
              if (resolved?.url && !failedUrlsRef.current.has(resolved.url)) {
                const streamUrl = getPlayableStreamUrl(resolved.url);
                if (!failedUrlsRef.current.has(streamUrl)) {
                  audioUrl = resolved.url;
                  currentSong.audioUrl = resolved.url;
                  currentSong.source = resolved.source;
                  currentAudioUrlRef.current = streamUrl;
                }
              }
            } catch (e) {
              console.warn("[useAudioPlayer] Failed to auto-resolve playable stream:", e);
            }
          }
        }

        if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;

        // 4. 歌词与封面：若本地尚未缓存歌词或封面，后台静默拉取并自动持久化固化至本地离线数据库
        if (!currentSong.lyrics && (currentSong.id || currentSong.title)) {
          multiSourceResolver
            .fetchOnlineLyrics(String(currentSong.id || ""), currentSong.source, {
              id: String(currentSong.id || ""),
              title: currentSong.title,
              artist: currentSong.artist,
              album: currentSong.album,
            })
            .then(async (lrcData) => {
              if (lrcData.lyrics && isCurrentPlaybackRequest(requestId, songId || undefined)) {
                currentSong.lyrics = lrcData.lyrics;
                currentSong.translationLyrics = lrcData.translationLyrics;
                usePlayerStore
                  .getState()
                  .updateCurrentSongLyrics(lrcData.lyrics, lrcData.translationLyrics);

                try {
                  const offlineRec = await getOfflineAudio(String(songId));
                  if (offlineRec && !offlineRec.lyrics) {
                    offlineRec.lyrics = lrcData.lyrics;
                    offlineRec.translationLyrics = lrcData.translationLyrics;
                    await saveOfflineAudio(offlineRec);
                  }
                } catch {
                  // 离线记录回写失败不影响本次播放，歌词已写入 store
                }
              }
            })
            .catch(() => {});
        }

        if (
          (!currentSong.cover || currentSong.cover.includes("default-cover")) &&
          currentSong.title
        ) {
          multiSourceResolver
            .fetchOnlineCover({
              id: String(currentSong.id || ""),
              title: currentSong.title,
              artist: currentSong.artist,
              source: currentSong.source,
            })
            .then(async (coverUrl) => {
              if (coverUrl && isCurrentPlaybackRequest(requestId, songId || undefined)) {
                currentSong.cover = coverUrl;
                usePlayerStore.getState().updateCurrentSongCover(coverUrl);

                try {
                  const offlineRec = await getOfflineAudio(String(songId));
                  if (
                    offlineRec &&
                    (!offlineRec.cover || offlineRec.cover === "/default-cover.svg")
                  ) {
                    offlineRec.cover = coverUrl;
                    await saveOfflineAudio(offlineRec);
                  }
                } catch {
                  // 离线记录回写失败不影响本次播放，封面已写入 store
                }
              }
            })
            .catch(() => {});
        }

        if (!audioUrl || failedUrlsRef.current.has(audioUrl)) {
          stopForMissingAudioSource(audio);
          return;
        }

        const streamUrl = getPlayableStreamUrl(audioUrl);
        if (failedUrlsRef.current.has(streamUrl)) {
          stopForMissingAudioSource(audio);
          return;
        }
        if (targetPlaying) {
          try {
            await initializeAudioGraph(audio);
            await AudioEngine.getInstance().resume();
          } catch (e) {
            console.warn("[useAudioPlayer] AudioGraph init warning:", e);
          }
        }

        if (!isCurrentPlaybackRequest(requestId, songId || undefined)) return;

        if (targetPlaying && isEmotionCurveMode && previousSongId && secondaryElementRef.current) {
          const mixer = CrossfadeMixer.getInstance();
          const duration = mixer.calculateDynamicDuration(previousSongId, songId);
          setDynamicCrossfadeDuration(duration);

          const fromAudio = audio;
          const toAudio = secondaryElementRef.current;

          const targetRate = usePlayerStore.getState().playbackRate || 1.0;
          bindActivePlaybackDeck(toAudio, requestId, songId || null, streamUrl);
          toAudio.src = streamUrl;
          currentAudioUrlRef.current = streamUrl;
          loadedSongIdRef.current = songId;
          loadedSongSourceKeyRef.current = `${currentSong.source || ""}\u0000${currentSong.audioUrl || ""}`;
          toAudio.defaultPlaybackRate = targetRate;
          toAudio.playbackRate = targetRate;
          const targetDeckId = getAudioDeckId(toAudio);
          const targetSource = getMediaSourceIdentity(streamUrl);
          const isCurrentCrossfade = () => {
            const runtime = usePlaybackRuntimeStore.getState();
            return (
              runtime.shouldPlay &&
              isCurrentPlaybackRequest(requestId, songId || undefined) &&
              runtime.activeDeckId === targetDeckId &&
              runtime.activeSource === targetSource
            );
          };
          mixer
            .crossfade(
              fromAudio,
              toAudio,
              duration,
              isCurrentCrossfade,
              () => audioElementRef.current !== fromAudio,
              () => audioElementRef.current !== toAudio
            )
            .then(() => {
              if (isCurrentPlaybackRequest(requestId, songId || undefined) && toAudio.paused) {
                return handlePlayError(new Error("Crossfade target did not start"), requestId);
              }
            })
            .catch((error) => handlePlayError(error, requestId));

          audioElementRef.current = toAudio;
          secondaryElementRef.current = fromAudio;
          setLocalAudioElement(toAudio);
        } else {
          const targetRate = usePlayerStore.getState().playbackRate || 1.0;
          const mixer = CrossfadeMixer.getInstance();
          mixer.prepareForDirectPlayback(audio);
          if (secondaryElementRef.current && secondaryElementRef.current !== audio) {
            mixer.pauseAndReset(secondaryElementRef.current, true);
          }
          bindActivePlaybackDeck(audio, requestId, songId || null, streamUrl);
          audio.src = streamUrl;
          currentAudioUrlRef.current = streamUrl;
          loadedSongIdRef.current = songId;
          loadedSongSourceKeyRef.current = `${currentSong.source || ""}\u0000${currentSong.audioUrl || ""}`;
          audio.defaultPlaybackRate = targetRate;
          audio.playbackRate = targetRate;
          audio.load();
          if (targetPlaying) {
            audio.play().catch((error) => handlePlayError(error, requestId));
          }
        }
      } finally {
        if (loadingInProgressRequestIdRef.current === requestId) {
          loadingInProgressRequestIdRef.current = null;
        }
      }
    };

    managePlayback();
  }, [
    hookId,
    currentSong,
    isPlaying,
    shouldPlay,
    playbackRequestId,
    isEmotionCurveMode,
    handlePlayError,
    setError,
    setIsLoading,
    setDynamicCrossfadeDuration,
  ]);

  useEffect(() => {
    if (!isLeader(hookId) || !currentSong || !isPlaying) return;

    const songId = currentSong.id;
    if (lastRecordedSongIdRef.current === songId) return;

    const playedAt = Date.now();
    const timer = window.setTimeout(() => {
      const playerState = usePlayerStore.getState();
      if (!playerState.isPlaying || playerState.currentSong?.id !== songId) return;

      const audio = audioElementRef.current;
      const elapsedSeconds = Math.round(audio?.currentTime || CONFIRMED_PLAYBACK_SECONDS);
      const songDuration = Math.round(currentSong.duration || elapsedSeconds);
      const listenSeconds = Math.min(
        Math.max(CONFIRMED_PLAYBACK_SECONDS, elapsedSeconds),
        Math.max(CONFIRMED_PLAYBACK_SECONDS, songDuration)
      );
      const mood = deriveJournalMood(useEmotionStore.getState().emotionMap[songId]);

      lastRecordedSongIdRef.current = songId;
      recordStatsPlay(currentSong, listenSeconds, false, false, currentSong.format || "standard");
      recordJournalPlay({ songId, playedAt, listenSeconds, mood });
      useListeningJournalStore.getState().trimToLast90Days();
    }, CONFIRMED_PLAYBACK_SECONDS * 1000);

    return () => window.clearTimeout(timer);
  }, [hookId, currentSong, isPlaying, recordStatsPlay, recordJournalPlay]);

  // Side effects sync
  useEffect(() => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
      AudioEngine.getInstance().setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const rate = playbackRate || 1.0;
    if (audioElementRef.current) {
      audioElementRef.current.defaultPlaybackRate = rate;
      audioElementRef.current.playbackRate = rate;
    }
    if (secondaryElementRef.current) {
      secondaryElementRef.current.defaultPlaybackRate = rate;
      secondaryElementRef.current.playbackRate = rate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const engine = AudioEngine.getInstance();
    engine.setEQEnabled(isEQEnabled);
    if (isEQEnabled) {
      engine.updateEQ(eqBands);
    }
  }, [eqBands, isEQEnabled]);

  const togglePlay = useCallback(() => {
    useAudioStore.getState().togglePlaybackIntent();
  }, []);

  const seek = useCallback(
    (time: number) => {
      const audio = audioElementRef.current;
      if (audio) {
        audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
        setCurrentTime(audio.currentTime);
      }
    },
    [setCurrentTime]
  );

  const seekRelative = useCallback(
    (delta: number) => {
      const audio = audioElementRef.current;
      if (audio) {
        const newTime = audio.currentTime + delta;
        audio.currentTime = Math.max(0, Math.min(newTime, audio.duration || 0));
        setCurrentTime(audio.currentTime);
      }
    },
    [setCurrentTime]
  );

  return {
    togglePlay,
    seek,
    seekRelative,
    audioRef: audioElementRef,
    audioElement: audioElement,
  };
};

export { getAudioAnalyser, getAudioContext } from "@/lib/audio/audioEngineAccess";
