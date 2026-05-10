"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useAudioStore, AudioError } from "@/store/audioStore";
import { getStoredMusic, createBlobUrlFromStoredMusic } from "@/services/localMusicStorage";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useABLoopStore } from "@/store/abLoopStore";
import { getAudioEffectsManager } from "@/lib/audio/AudioEffectsManager";
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { CrossfadeMixer } from "@/lib/audio/CrossfadeMixer";

// Module-level shared state to persist across hook unmounts/remounts
let audioInstance: HTMLAudioElement | null = null;
let secondaryAudioInstance: HTMLAudioElement | null = null;
let audioElementRef: { current: HTMLAudioElement | null } = { current: null };
let secondaryElementRef: { current: HTMLAudioElement | null } = { current: null };
let currentAudioUrlRef: { current: string | null } = { current: null };
let isPlayingRef: { current: boolean } = { current: false };
let currentSongIdRef: { current: string | null } = { current: null };
let activeManagerId: string | null = null;
let playStartTime: number = 0;

// Stable event handlers outside the hook to prevent duplicate listeners
// and ensure we can attach them once to each audio element
const attachListeners = (audio: HTMLAudioElement, handlePlayError: (e: any) => void) => {
  if ((audio as any)._vibeListenersAttached) return;
  (audio as any)._vibeListenersAttached = true;

  const { setCurrentTime, setDuration, setIsLoading, setError, nextSong, loopMode } =
    useAudioStore.getState();

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
  const onError = (e: any) => {
    const error = (e.target as HTMLAudioElement).error;
    console.error("Audio element error event:", error);
    if (error) {
      setError({
        type: "load",
        message: `音频错误: ${error.code}`,
        timestamp: Date.now(),
      });
    }
    setIsLoading(false);
    isPlayingRef.current = false;
    useAudioStore.getState().setIsPlaying(false);
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

  // No cleanup for these global-style listeners to ensure they keep working
  // when temporary views unmount. They are attached to long-lived audio instances.
};

export const useAudioPlayer = () => {
  const [hookId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [audioElement, setLocalAudioElement] = useState<HTMLAudioElement | null>(null);

  const isPlaying = useAudioStore((state) => state.isPlaying);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const currentSong = useAudioStore((state) => state.currentSong);
  const eqBands = useAudioStore((state) => state.eqBands);
  const isEQEnabled = useAudioStore((state) => state.isEQEnabled);
  const isEmotionCurveMode = useAudioStore((state) => state.isEmotionCurveMode);

  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime);
  const setDuration = useAudioStore((state) => state.setDuration);
  const setIsLoading = useAudioStore((state) => state.setIsLoading);
  const setError = useAudioStore((state) => state.setError);
  const setDynamicCrossfadeDuration = useAudioStore((state) => state.setDynamicCrossfadeDuration);

  const { recordPlay } = useStatsAchievementsStore();

  const handlePlayError = useCallback(
    (error: any) => {
      const isAbortError =
        error.name === "AbortError" ||
        error.code === 20 ||
        error.message?.includes("interrupted") ||
        error.message?.includes("new load request") ||
        error.message?.includes("pause");

      if (isAbortError) return;

      console.error("Playback error:", error);
      setError({
        type: "play",
        message: `播放失败: ${error.message || "未知原因"}`,
        timestamp: Date.now(),
      });
      setIsPlaying(false);
    },
    [setError, setIsPlaying]
  );

  // Initialization Effect
  useEffect(() => {
    if (!audioInstance) {
      audioInstance = new Audio();
      audioInstance.crossOrigin = "anonymous";
      audioElementRef.current = audioInstance;

      secondaryAudioInstance = new Audio();
      secondaryAudioInstance.crossOrigin = "anonymous";
      secondaryElementRef.current = secondaryAudioInstance;
    }

    setLocalAudioElement(audioElementRef.current);

    // Global ref for legacy components
    if (typeof window !== "undefined") {
      (window as any).audioElementRef = audioElementRef;
    }

    // Manager election
    if (!activeManagerId) {
      activeManagerId = hookId;
    }

    return () => {
      if (activeManagerId === hookId) {
        activeManagerId = null;
      }
    };
  }, [hookId]);

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

    // Initialize AudioEngine if not done
    const engine = AudioEngine.getInstance();
    engine.init(audio);

    // Connect effects
    const analyser = engine.getAnalyser();
    const context = engine.getContext();
    if (analyser && context) {
      const effectsManager = getAudioEffectsManager();
      effectsManager.init().then(() => {
        effectsManager.connect(analyser, context.destination, audio);
      });
    }
  }, [audioElement, handlePlayError, setDuration, setCurrentTime]);

  // Playback Management Effect (Only run by the manager instance)
  useEffect(() => {
    if (activeManagerId !== hookId) return;

    const managePlayback = async () => {
      const audio = audioElementRef.current;
      if (!audio || !currentSong) return;

      isPlayingRef.current = isPlaying;
      const songId = currentSong.id;

      if (currentSongIdRef.current === songId) {
        if (isPlaying) {
          await AudioEngine.getInstance().resume();
          if (audio.readyState >= 2) {
            audio.play().catch(handlePlayError);
          }
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

      let audioUrl = currentSong.audioUrl;
      if (audioUrl?.startsWith("stored://")) {
        const id = audioUrl.replace("stored://", "");
        const storedMusic = await getStoredMusic(id);
        if (storedMusic) {
          audioUrl = createBlobUrlFromStoredMusic(storedMusic);
          currentAudioUrlRef.current = audioUrl;
        }
      }

      if (!audioUrl) {
        setIsLoading(false);
        setError({ type: "load", message: "无法加载音频", timestamp: Date.now() });
        return;
      }

      if (isEmotionCurveMode && previousSongId && secondaryElementRef.current) {
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

  const togglePlay = useCallback(() => setIsPlaying(!isPlaying), [isPlaying, setIsPlaying]);

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
