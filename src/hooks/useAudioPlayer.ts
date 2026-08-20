"use client";

import { useEffect, useCallback, useState } from "react";
import { useAudioStore, registerAudioSeekHandler } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useEQStore } from "@/store/eqStore";
import { getStoredMusic, createBlobUrlFromStoredMusic } from "@/services/localMusicStorage";
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

// Module-level shared state to persist across hook unmounts/remounts
let audioInstance: HTMLAudioElement | null = null;
let secondaryAudioInstance: HTMLAudioElement | null = null;
const audioElementRef: { current: HTMLAudioElement | null } = { current: null };
const secondaryElementRef: { current: HTMLAudioElement | null } = { current: null };
const currentAudioUrlRef: { current: string | null } = { current: null };
const isPlayingRef: { current: boolean } = { current: false };
const currentSongIdRef: { current: string | null } = { current: null };
const lastRecordedSongIdRef: { current: string | null } = { current: null };
let activeManagerId: string | null = null;
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

function stopForMissingAudioSource(audio: HTMLAudioElement): void {
  audio.pause();
  if (currentAudioUrlRef.current?.startsWith("blob:")) {
    URL.revokeObjectURL(currentAudioUrlRef.current);
  }
  currentAudioUrlRef.current = null;
  currentSongIdRef.current = null;
  isPlayingRef.current = false;
  audio.removeAttribute("src");
  audio.load();

  usePlayerStore.getState().setIsPlaying(false);
  usePlayerStore.getState().setIsLoading(false);
  useAudioStore.setState({
    isPlaying: false,
    isLoading: false,
    error: { type: "load", message: MISSING_AUDIO_SOURCE_MESSAGE, timestamp: Date.now() },
  });
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
  };
  const onLoadedMetadata = () => {
    setDuration(audio.duration);
    setIsLoading(false);
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
  const onPlaying = () => setIsLoading(false);
  const onPlay = () => useAudioStore.getState().setIsPlaying(true);
  const onPause = () => useAudioStore.getState().setIsPlaying(false);
  const onEnded = () => {
    if (useAudioStore.getState().loopMode === "single") {
      audio.currentTime = 0;
      audio.play().catch(handlePlayError);
    } else {
      nextSong();
    }
  };
  const onError = (event: Event) => {
    const audioEl = event.target as HTMLAudioElement;
    const error = audioEl.error;
    const hasValidSrc = Boolean(audioEl.currentSrc);

    if (hasValidSrc && error) {
      const loadError = createAudioElementLoadError(error);
      logHandledAudioWarning("Audio element load failed", loadError.message);
      setError(loadError);
      setIsLoading(false);
      isPlayingRef.current = false;
      useAudioStore.getState().setIsPlaying(false);
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
    (error: PlaybackErrorLike) => {
      const playbackError = getPlaybackError(error);
      const message = getPlaybackErrorMessage(error);
      const isAbortError =
        playbackError.name === "AbortError" ||
        playbackError.code === 20 ||
        message.includes("interrupted") ||
        message.includes("new load request") ||
        message.includes("pause");

      if (isAbortError) return;
      logHandledAudioWarning("Playback failed", message);
      setError({
        type: "play",
        message: "Playback failed: " + message,
        timestamp: Date.now(),
      });
      setIsPlaying(false);
    },
    [setError, setIsPlaying]
  );

  // Initialization Effect
  useEffect(() => {
    const audio = ensureAudioElements();
    if (audio && audioElement !== audio) {
      queueMicrotask(() => setLocalAudioElement(audio));
    }

    // Global ref for legacy components
    if (typeof window !== "undefined") {
      (window as AudioWindow).audioElementRef = audioElementRef;
    }

    // Manager election
    if (!activeManagerId) {
      activeManagerId = hookId;
    }

    registerAudioSeekHandler((time: number) => {
      const activeAudio = audioElementRef.current;
      if (activeAudio && typeof activeAudio.duration === "number" && !isNaN(activeAudio.duration)) {
        const clamped = Math.max(0, Math.min(time, activeAudio.duration || 0));
        activeAudio.currentTime = clamped;
      }
    });

    return () => {
      if (activeManagerId === hookId) {
        activeManagerId = null;
      }
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
    if (activeManagerId !== hookId) return;

    const managePlayback = async () => {
      const audio = audioElementRef.current;
      if (!audio || !currentSong) return;

      isPlayingRef.current = isPlaying;
      const songId = currentSong.id;

      if (!hasPlayableAudioSource(currentSong)) {
        stopForMissingAudioSource(audio);
        return;
      }

      if (currentSongIdRef.current === songId) {
        if (isPlaying) {
          await initializeAudioGraph(audio);
          await AudioEngine.getInstance().resume();
          audio.play().catch(handlePlayError);
        } else {
          audio.pause();
        }
        return;
      }

      // Load new song
      setIsLoading(true);
      setError(null);

      if (currentAudioUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }

      const previousSongId = currentSongIdRef.current;
      currentSongIdRef.current = songId;
      if (previousSongId !== songId) {
        lastRecordedSongIdRef.current = null;
      }

      let audioUrl = currentSong.audioUrl?.trim();
      if (audioUrl?.startsWith("stored://")) {
        const id = audioUrl.replace("stored://", "");
        const storedMusic = await getStoredMusic(id);
        if (storedMusic) {
          audioUrl = createBlobUrlFromStoredMusic(storedMusic);
          currentAudioUrlRef.current = audioUrl;
        } else {
          audioUrl = undefined;
          currentAudioUrlRef.current = null;
        }
      }

      // 如果当前歌曲没有 audioUrl，自动调用 MultiSourceResolver 实时解析
      if (!audioUrl && currentSong) {
        try {
          const resolved = await multiSourceResolver.resolvePlayableAudio({
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album,
          });
          if (resolved?.url) {
            audioUrl = resolved.url;
            currentSong.audioUrl = resolved.url;
            currentSong.source = resolved.source;
            currentAudioUrlRef.current = audioUrl;
            usePlayerStore.getState().setCurrentSong({ ...currentSong });
            useAudioStore.setState({ currentSong: { ...currentSong } });
          }
        } catch (e) {
          console.warn("[useAudioPlayer] Failed to auto-resolve playable stream:", e);
        }
      }

      // 如果当前歌曲没有歌词，自动拉取在线歌词
      if (!currentSong.lyrics && currentSong.id) {
        try {
          const lrcData = await multiSourceResolver.fetchOnlineLyrics(currentSong.id, currentSong.source);
          if (lrcData.lyrics) {
            currentSong.lyrics = lrcData.lyrics;
            currentSong.translationLyrics = lrcData.translationLyrics;
            usePlayerStore.getState().setCurrentSong({ ...currentSong });
            useAudioStore.setState({ currentSong: { ...currentSong } });
          }
        } catch (e) {
          console.warn("[useAudioPlayer] Failed to fetch online lyrics:", e);
        }
      }

      if (!audioUrl) {
        stopForMissingAudioSource(audio);
        return;
      }

      if (isPlaying) {
        await initializeAudioGraph(audio);
        await AudioEngine.getInstance().resume();
      }

      if (isPlaying && isEmotionCurveMode && previousSongId && secondaryElementRef.current) {
        const mixer = CrossfadeMixer.getInstance();
        const duration = mixer.calculateDynamicDuration(previousSongId, songId);
        setDynamicCrossfadeDuration(duration);

        const fromAudio = audio;
        const toAudio = secondaryElementRef.current;

        toAudio.src = audioUrl;
        mixer.crossfade(fromAudio, toAudio, duration).catch(handlePlayError);

        audioElementRef.current = toAudio;
        secondaryElementRef.current = fromAudio;
        setLocalAudioElement(toAudio);
      } else {
        audio.src = audioUrl;
        audio.load();
        if (isPlaying) {
          audio.play().catch(handlePlayError);
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
    if (activeManagerId !== hookId || !currentSong || !isPlaying) return;

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
