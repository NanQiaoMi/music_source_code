"use client";

import { useEffect, useCallback, useState } from "react";
import { useAudioStore, registerAudioSeekHandler } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useEQStore } from "@/store/eqStore";
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
  hasPlayableAudioSource,
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
import { audioPrefetcher } from "@/lib/audio/audioPrefetcher";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";

// Module-level shared state to persist across hook unmounts/remounts
let audioInstance: HTMLAudioElement | null = null;
let secondaryAudioInstance: HTMLAudioElement | null = null;
const audioElementRef: { current: HTMLAudioElement | null } = { current: null };
const secondaryElementRef: { current: HTMLAudioElement | null } = { current: null };
const currentAudioUrlRef: { current: string | null } = { current: null };
const isPlayingRef: { current: boolean } = { current: false };
const currentSongIdRef: { current: string | null } = { current: null };
const lastRecordedSongIdRef: { current: string | null } = { current: null };
const lastToastSongIdRef: { current: string | null } = { current: null };
const rescueInProgressRef: { current: boolean } = { current: false };
const rescuedUrlsRef: { current: Set<string> } = { current: new Set() };
const playbackRequestIdRef: { current: number } = { current: 0 };
const loadingInProgressSongIdRef: { current: string | null } = { current: null };
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
};

function ensureAudioElements(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return audioElementRef.current;

  if (!audioInstance) {
    audioInstance = new Audio();
    audioInstance.crossOrigin = "anonymous";
    audioElementRef.current = audioInstance;

    secondaryAudioInstance = new Audio();
    secondaryAudioInstance.crossOrigin = "anonymous";
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
    URL.revokeObjectURL(currentAudioUrlRef.current);
  }
  currentAudioUrlRef.current = null;
  currentSongIdRef.current = null;
  isPlayingRef.current = false;
  audio.removeAttribute("src");
  audio.src = "";

  const currentSong = usePlayerStore.getState().currentSong;
  usePlayerStore.getState().setIsPlaying(false);
  usePlayerStore.getState().setIsLoading(false);
  useAudioStore.setState({
    isPlaying: false,
    isLoading: false,
    error: { type: "load", message: MISSING_AUDIO_SOURCE_MESSAGE, timestamp: Date.now() },
  });
  useUIStore.getState().showToast(`⚠️ 无法播放: 《${currentSong?.title || "该歌曲"}》没有可用音频直链，请导入本地文件或切换音源`, "warning", 4000);
}

// Stable event handlers outside the hook to prevent duplicate listeners
// and ensure we can attach them once to each audio element
const attachListeners = (
  audio: ManagedAudioElement,
  handlePlayError: (error: PlaybackErrorLike) => void
) => {
  detachListeners(audio);

  const {
    setCurrentTime,
    setDuration,
    setIsLoading,
    setError,
    nextSong,
    loopMode: _loopMode,
  } = useAudioStore.getState();

  const onTimeUpdate = () => {
    setCurrentTime(audio.currentTime);

    const abState = useABLoopStore.getState();
    if (abState.isEnabled && abState.pointA !== null && abState.pointB !== null) {
      if (audio.currentTime >= abState.pointB) {
        audio.currentTime = abState.pointA;
        useABLoopStore.getState().incrementLoopCount();
      }
    }

    // 后台智能预拉取下一曲音频流 (实现 < 10ms 零等待秒切)
    if (audio.duration > 20 && (audio.currentTime / audio.duration > 0.75 || audio.duration - audio.currentTime < 20)) {
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
    setDuration(audio.duration);
    setIsLoading(false);

    // 智能防试听截断：若加载出的流时长 <= 95s (如 30s/60s VIP试听)，自动抢救全网完整母带
    // 使用防重入标志避免抢救后 audio.load() 再次触发 onLoadedMetadata 形成死循环
    const currentSong = usePlayerStore.getState().currentSong;
    if (
      audio.duration > 0 &&
      audio.duration <= 95 &&
      currentSong &&
      (currentSong.title || currentSong.id) &&
      !rescueInProgressRef.current &&
      !rescuedUrlsRef.current.has(audio.src)
    ) {
      rescueInProgressRef.current = true;
      logHandledAudioWarning("Detected trial snippet (" + Math.round(audio.duration) + "s), auto-rescuing full song for", currentSong.title);
      multiSourceResolver.resolvePlayableAudio({
        id: currentSong.id,
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
        source: currentSong.source,
      }).then((rescued) => {
        if (rescued?.url && rescued.url !== currentSong.audioUrl && !rescued.isTrial) {
          const streamUrl = getPlayableStreamUrl(rescued.url);
          rescuedUrlsRef.current.add(streamUrl);
          audio.src = streamUrl;
          currentAudioUrlRef.current = streamUrl;
          // 直接修改对象属性而不创建新引用，避免触发 Playback Effect 重执行导致状态重置
          currentSong.audioUrl = rescued.url;
          currentSong.source = rescued.source;
          audio.load();
          if (isPlayingRef.current) {
            audio.play().catch(handlePlayError);
          }
        }
        rescueInProgressRef.current = false;
      }).catch(() => {
        rescueInProgressRef.current = false;
      });
    }
  };
  const onDurationChange = () => setDuration(audio.duration);
  const onLoadStart = () => setIsLoading(true);
  const onCanPlay = () => {
    setIsLoading(false);
    if (isPlayingRef.current) {
      audio.play().catch(handlePlayError);
    }
  };
  const onWaiting = () => setIsLoading(true);
  const onPlaying = () => {
    setIsLoading(false);
    // 仅在切歌或新曲目初次播放成功时弹出 Toast 提示（杜绝快进/倒退/拖动进度条 seek 时重复刷屏）
    const playingSong = usePlayerStore.getState().currentSong;
    if (playingSong && playingSong.title) {
      const songKey = `${playingSong.id || playingSong.title}`;
      if (lastToastSongIdRef.current !== songKey) {
        lastToastSongIdRef.current = songKey;
        useUIStore.getState().showToast(`▶ 正在播放: 《${playingSong.title}》· ${playingSong.artist || "未知歌手"}`, "success", 2500);
      }
    }
    // 对网络歌曲触发后台缓存（不阻塞播放）
    const currentSrc = audio.src;
    if (
      playingSong &&
      playingSong.source !== "local" &&
      playingSong.source !== "upload" &&
      playingSong.source !== "demo" &&
      currentSrc &&
      !currentSrc.startsWith("blob:")
    ) {
      triggerBackgroundCache(playingSong, currentSrc).catch(() => {});
    }
  };
  const onPlay = () => {
    isPlayingRef.current = true;
    useAudioStore.getState().setIsPlaying(true);
    usePlayerStore.getState().setIsPlaying(true);
  };
  const onPause = () => {
    // 只有当 isPlayingRef 为 false 时才同步 store（杜绝浏览器在更换 src / load 阶段原生抛出 pause 事件导致状态被误重置）
    if (!isPlayingRef.current) {
      useAudioStore.getState().setIsPlaying(false);
      usePlayerStore.getState().setIsPlaying(false);
    }
  };
  const onEnded = () => {
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

    if (useAudioStore.getState().loopMode === "single") {
      audio.currentTime = 0;
      audio.play().catch(handlePlayError);
    } else {
      nextSong();
    }
  };
  const onError = async (event: Event) => {
    const audioEl = event.target as HTMLAudioElement;
    const error = audioEl.error;
    // 过滤中断与取消错误 (MEDIA_ERR_ABORTED = 1)
    if (!error || error.code === 1) {
      return;
    }

    const hasValidSrc = Boolean(audioEl.currentSrc || audioEl.src);

    if (hasValidSrc && error) {
      const currentSong = usePlayerStore.getState().currentSong;
      if (currentSong && (currentSong.title || currentSong.id)) {
        logHandledAudioWarning("Audio element load failed, attempting auto-rescue", audioEl.currentSrc);
        try {
          const rescued = await multiSourceResolver.resolvePlayableAudio({
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album,
          });
          if (rescued?.url) {
            const streamUrl = getPlayableStreamUrl(rescued.url);
            rescuedUrlsRef.current.add(streamUrl);
            audioEl.src = streamUrl;
            currentAudioUrlRef.current = streamUrl;
            // 直接修改属性而不创建新引用，避免触发 Playback Effect 级联重置
            currentSong.audioUrl = rescued.url;
            currentSong.source = rescued.source;
            audioEl.load();
            if (isPlayingRef.current) {
              audioEl.play().catch(handlePlayError);
            }
            return;
          }
        } catch (e) {
          console.warn("[useAudioPlayer] Auto-rescue error:", e);
        }
      }

      const loadError = createAudioElementLoadError(error);
      logHandledAudioWarning("Audio element load failed", loadError.message);
      setError(loadError);
      setIsLoading(false);
      isPlayingRef.current = false;
      useAudioStore.getState().setIsPlaying(false);
      usePlayerStore.getState().setIsPlaying(false);
      useUIStore.getState().showToast(`❌ 播放失败: 无法解析《${currentSong?.title || "此歌曲"}》的音频流，请尝试更换音源`, "error", 4000);
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

  audio._vibeListenersAttached = true;
  audio._vibeCleanup = () => {
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
    audio._vibeListenersAttached = false;
    audio._vibeCleanup = undefined;
  };
};

const detachListeners = (audio: ManagedAudioElement) => {
  if (typeof audio._vibeCleanup === "function") {
    audio._vibeCleanup();
  }
};

async function initializeAudioGraph(audio: HTMLAudioElement): Promise<void> {
  const engine = AudioEngine.getInstance();
  engine.init(audio);

  const analyser = engine.getAnalyser();
  const context = engine.getContext();
  if (!analyser || !context) return;

  const effectsManager = getAudioEffectsManager();
  await effectsManager.init();
  effectsManager.connect(analyser, context.destination, audio);
}

export const useAudioPlayer = () => {
  const [hookId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [audioElement, setLocalAudioElement] = useState<HTMLAudioElement | null>(() =>
    ensureAudioElements()
  );

  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const eqBands = useEQStore((state) => state.eqBands);
  const isEQEnabled = useEQStore((state) => state.isEQEnabled);
  const isEmotionCurveMode = useAudioStore((state) => state.isEmotionCurveMode);

  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setIsLoading = usePlayerStore((state) => state.setIsLoading);
  const setError = useAudioStore((state) => state.setError);
  const setDynamicCrossfadeDuration = useAudioStore((state) => state.setDynamicCrossfadeDuration);

  const recordStatsPlay = useStatsAchievementsStore((state) => state.recordPlay);
  const recordJournalPlay = useListeningJournalStore((state) => state.recordPlay);

  const handlePlayError = useCallback(
    async (error: PlaybackErrorLike) => {
      const playbackError = getPlaybackError(error);
      const message = getPlaybackErrorMessage(error);
      const isAbortError =
        playbackError.name === "AbortError" ||
        playbackError.code === 20 ||
        message.includes("interrupted") ||
        message.includes("new load request") ||
        message.includes("pause");

      if (isAbortError) return;

      const currentSong = usePlayerStore.getState().currentSong;
      const audio = audioElementRef.current;
      if (audio && currentSong && (currentSong.title || currentSong.id)) {
        try {
          const rescued = await multiSourceResolver.resolvePlayableAudio({
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album,
          });
          if (rescued?.url) {
            const streamUrl = getPlayableStreamUrl(rescued.url);
            rescuedUrlsRef.current.add(streamUrl);
            audio.src = streamUrl;
            currentAudioUrlRef.current = streamUrl;
            currentSong.audioUrl = rescued.url;
            currentSong.source = rescued.source;
            useAudioStore.setState({ error: null });
            audio.load();
            audio.play().catch(() => {});
            return;
          }
        } catch {
          // ignore
        }
      }

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
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      logHandledAudioWarning("Playback failed", message);
      setError({
        type: "play",
        message: "Playback failed: " + message,
        timestamp: Date.now(),
      });
      setIsPlaying(false);
      setIsLoading(false);
    },
    [setError, setIsPlaying, setIsLoading]
  );

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
      if (activeAudio && typeof activeAudio.duration === "number" && !isNaN(activeAudio.duration)) {
        const clamped = Math.max(0, Math.min(time, activeAudio.duration || 0));
        activeAudio.currentTime = clamped;
      }
    });

    return () => {
      activeHookIds.delete(hookId);
    };
  }, [audioElement, hookId]);

  // Sync state with shared element whenever it changes
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    attachListeners(audio, handlePlayError);
    if (secondaryElementRef.current) {
      attachListeners(secondaryElementRef.current, handlePlayError);
    }

    // Sync current values if already loaded
    if (audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }
    if (audio.currentTime) {
      setCurrentTime(audio.currentTime);
    }

    return () => {
      detachListeners(audio);
      if (secondaryElementRef.current) {
        detachListeners(secondaryElementRef.current);
      }
    };
  }, [audioElement, handlePlayError, setDuration, setCurrentTime]);

  // Playback Management Effect (Only run by the manager instance)
  useEffect(() => {
    if (!isLeader(hookId)) return;

    const managePlayback = async () => {
      const audio = audioElementRef.current;
      if (!audio || !currentSong) return;

      if (typeof window !== "undefined") {
        (window as any).__VIBE_CURRENT_SONG__ = currentSong;
      }

      const songId = currentSong.id;
      const targetPlaying = isPlaying;
      isPlayingRef.current = targetPlaying;

      // 1. 同一首歌曲且已有音频流时：仅做播放/暂停状态同步，绝不重复加载或重置管道
      if (
        currentSongIdRef.current === songId &&
        audio.src &&
        currentAudioUrlRef.current &&
        !audio.error
      ) {
        if (targetPlaying) {
          if (audio.paused) {
            try {
              await initializeAudioGraph(audio);
              await AudioEngine.getInstance().resume();
              audio.play().catch(handlePlayError);
            } catch (e) {
              handlePlayError(e as PlaybackErrorLike);
            }
          }
        } else {
          if (!audio.paused) {
            audio.pause();
          }
        }
        return;
      }

      // 如果这首歌曲正在嗅探解析中，不重复触发任务
      if (loadingInProgressSongIdRef.current === songId && currentSongIdRef.current === songId) {
        return;
      }

      const previousSongId = currentSongIdRef.current;
      currentSongIdRef.current = songId;
      loadingInProgressSongIdRef.current = songId;

      setIsLoading(true);
      setError(null);

      if (previousSongId !== songId) {
        if (currentAudioUrlRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
        lastRecordedSongIdRef.current = null;
        lastToastSongIdRef.current = null;
        rescueInProgressRef.current = false;
        rescuedUrlsRef.current.clear();
      }

      try {
        let audioUrl = currentSong.audioUrl?.trim();
        let isOfflineDirectHit = false;

        // 0. ===== 本地持久化离线下载文件沙盒 (最高优先级，零网络 0ms 本地直读) =====
        if (currentSong.id) {
          try {
            const offlineRecord = await getOfflineAudio(String(currentSong.id));
            if (currentSongIdRef.current !== songId) return;
            if (offlineRecord && offlineRecord.fileData && offlineRecord.fileData.byteLength > 1000) {
              const blob = new Blob([offlineRecord.fileData], { type: offlineRecord.mimeType || "audio/mpeg" });
              const blobUrl = URL.createObjectURL(blob);
              audioUrl = blobUrl;
              currentAudioUrlRef.current = blobUrl;
              isOfflineDirectHit = true;

              // 同步恢复已下载的离线歌词与高清封面
              if (offlineRecord.lyrics && !currentSong.lyrics) {
                currentSong.lyrics = offlineRecord.lyrics;
                currentSong.translationLyrics = offlineRecord.translationLyrics;
                useAudioStore.getState().updateCurrentSongLyrics(offlineRecord.lyrics, offlineRecord.translationLyrics);
              }
              if (offlineRecord.cover && (!currentSong.cover || currentSong.cover === "/default-cover.svg")) {
                currentSong.cover = offlineRecord.cover;
                useAudioStore.getState().updateCurrentSongCover(offlineRecord.cover);
              }

              console.info(`[useAudioPlayer] 🚀 命中本地离线母带文件 (0ms 纯本地直读秒播): 《${currentSong.title}》- ${(offlineRecord.fileSize / 1024 / 1024).toFixed(2)}MB`);
            }
          } catch (e) {
            console.warn("[useAudioPlayer] Offline audio retrieval error, fallback to standard flow:", e);
          }
        }

        if (currentSongIdRef.current !== songId) return;

        // 1. ===== 本地用户自导入音乐 (stored://, local:// 或 source: local) =====
        if (!isOfflineDirectHit && (audioUrl?.startsWith("stored://") || audioUrl?.startsWith("local://") || currentSong.source === "local")) {
          const id = audioUrl?.startsWith("stored://") || audioUrl?.startsWith("local://")
            ? audioUrl.replace(/^(stored|local):\/\//, "")
            : String(currentSong.id);
          const storedMusic = await getStoredMusic(id);
          if (currentSongIdRef.current !== songId) return;
          if (storedMusic && storedMusic.fileData) {
            audioUrl = createBlobUrlFromStoredMusic(storedMusic);
            currentAudioUrlRef.current = audioUrl;
            isOfflineDirectHit = true;
            console.info(`[useAudioPlayer] 📁 命中本地导入音频 (0ms 直读): 《${currentSong.title}》`);
          }
        }

        if (currentSongIdRef.current !== songId) return;

        // 2. ===== 临时流媒体网络缓存 (cached://) =====
        if (!isOfflineDirectHit && (audioUrl?.startsWith("cached://") || (currentSong.source !== "local" && currentSong.source !== "upload"))) {
          try {
            const cached = await getCachedAudio(currentSong.id, currentSong.source);
            if (currentSongIdRef.current !== songId) return;
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
                if ((!currentSong.cover || currentSong.cover === "/default-cover.svg") && cached.cover) {
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

        if (currentSongIdRef.current !== songId) return;

        // 3. ===== 仅在本地无缓存、或本地文件不存在/损坏时，才作为智能回退（Fallback）方案走网络音源嗅探 =====
        if (!isOfflineDirectHit) {
          const isRiskyOuterUrl = Boolean(audioUrl && audioUrl.includes("music.163.com/song/media/outer/url"));
          const isInvalidUrl = !audioUrl || (!audioUrl.startsWith("http") && !audioUrl.startsWith("blob:") && !audioUrl.startsWith("data:"));
          if ((isInvalidUrl || isRiskyOuterUrl) && currentSong) {
            useUIStore.getState().showToast(`⚡ 正在通过音源引擎嗅探直链: 《${currentSong.title}》...`, "info", 2000);
            try {
              const resolved = await multiSourceResolver.resolvePlayableAudio({
                id: currentSong.id,
                title: currentSong.title,
                artist: currentSong.artist,
                album: currentSong.album,
                source: currentSong.source,
              });
              if (currentSongIdRef.current !== songId) return;
              if (resolved?.url) {
                audioUrl = resolved.url;
                currentSong.audioUrl = resolved.url;
                currentSong.source = resolved.source;
                currentAudioUrlRef.current = audioUrl;
              }
            } catch (e) {
              console.warn("[useAudioPlayer] Failed to auto-resolve playable stream:", e);
            }
          }
        }

        if (currentSongIdRef.current !== songId) return;

        // 4. 歌词与封面：若本地尚未缓存歌词或封面，后台静默拉取并自动持久化固化至本地离线数据库
        if (!currentSong.lyrics && (currentSong.id || currentSong.title)) {
          multiSourceResolver.fetchOnlineLyrics(
            String(currentSong.id || ""),
            currentSong.source,
            {
              id: String(currentSong.id || ""),
              title: currentSong.title,
              artist: currentSong.artist,
              album: currentSong.album,
            }
          ).then(async (lrcData) => {
            if (lrcData.lyrics && currentSongIdRef.current === songId) {
              currentSong.lyrics = lrcData.lyrics;
              currentSong.translationLyrics = lrcData.translationLyrics;
              useAudioStore.getState().updateCurrentSongLyrics(lrcData.lyrics, lrcData.translationLyrics);

              try {
                const offlineRec = await getOfflineAudio(String(songId));
                if (offlineRec && !offlineRec.lyrics) {
                  offlineRec.lyrics = lrcData.lyrics;
                  offlineRec.translationLyrics = lrcData.translationLyrics;
                  await saveOfflineAudio(offlineRec);
                }
              } catch {}
            }
          }).catch(() => {});
        }

        if ((!currentSong.cover || currentSong.cover.includes("default-cover")) && currentSong.title) {
          multiSourceResolver.fetchOnlineCover({
            id: String(currentSong.id || ""),
            title: currentSong.title,
            artist: currentSong.artist,
            source: currentSong.source,
          }).then(async (coverUrl) => {
            if (coverUrl && currentSongIdRef.current === songId) {
              currentSong.cover = coverUrl;
              useAudioStore.getState().updateCurrentSongCover(coverUrl);

              try {
                const offlineRec = await getOfflineAudio(String(songId));
                if (offlineRec && (!offlineRec.cover || offlineRec.cover === "/default-cover.svg")) {
                  offlineRec.cover = coverUrl;
                  await saveOfflineAudio(offlineRec);
                }
              } catch {}
            }
          }).catch(() => {});
        }

        if (!audioUrl) {
          stopForMissingAudioSource(audio);
          return;
        }

        const streamUrl = getPlayableStreamUrl(audioUrl);
        currentAudioUrlRef.current = streamUrl;

        if (targetPlaying) {
          try {
            await initializeAudioGraph(audio);
            await AudioEngine.getInstance().resume();
          } catch (e) {
            console.warn("[useAudioPlayer] AudioGraph init warning:", e);
          }
        }

        if (currentSongIdRef.current !== songId) return;

        if (targetPlaying && isEmotionCurveMode && previousSongId && secondaryElementRef.current) {
          const mixer = CrossfadeMixer.getInstance();
          const duration = mixer.calculateDynamicDuration(previousSongId, songId);
          setDynamicCrossfadeDuration(duration);

          const fromAudio = audio;
          const toAudio = secondaryElementRef.current;

          toAudio.src = streamUrl;
          mixer.crossfade(fromAudio, toAudio, duration).catch(handlePlayError);

          audioElementRef.current = toAudio;
          secondaryElementRef.current = fromAudio;
          setLocalAudioElement(toAudio);
        } else {
          audio.src = streamUrl;
          audio.load();
          if (targetPlaying) {
            audio.play().catch(handlePlayError);
          }
        }
      } finally {
        if (loadingInProgressSongIdRef.current === songId) {
          loadingInProgressSongIdRef.current = null;
        }
      }
    };

    managePlayback();
  }, [
    hookId,
    currentSong,
    isPlaying,
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
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const engine = AudioEngine.getInstance();
    if (!isEQEnabled) {
      engine.updateEQ(new Array(30).fill(0));
    } else {
      engine.updateEQ(eqBands);
    }
  }, [eqBands, isEQEnabled]);

  const togglePlay = useCallback(() => {
    useAudioStore.getState().setIsPlaying(!isPlaying);
  }, [isPlaying]);

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

export const getAudioAnalyser = (): AnalyserNode | null => AudioEngine.getInstance().getAnalyser();
export const getAudioContext = (): AudioContext | null => AudioEngine.getInstance().getContext();
