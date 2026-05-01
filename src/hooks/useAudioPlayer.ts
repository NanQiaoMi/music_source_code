import { useRef, useEffect, useCallback, useState } from "react";
import { useAudioStore, AudioError } from "@/store/audioStore";
import { getStoredMusic, createBlobUrlFromStoredMusic } from "@/services/localMusicStorage";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { getAudioEffectsManager } from "@/lib/audio/AudioEffectsManager";
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { CrossfadeMixer } from "@/lib/audio/CrossfadeMixer";
import { useEmotionStore } from "@/store/emotionStore";

let audioInstance: HTMLAudioElement | null = null;
let secondaryAudioInstance: HTMLAudioElement | null = null;
let audioElementRef: { current: HTMLAudioElement | null } = { current: null };
let secondaryElementRef: { current: HTMLAudioElement | null } = { current: null };
let currentAudioUrlRef: { current: string | null } = { current: null };
let isPlayingRef: { current: boolean } = { current: false };
let currentSongIdRef: { current: string | null } = { current: null };
let isInitialized = false;
let eventListenersAdded = false;
let playStartTime: number = 0;
let playStartPosition: number = 0;

export const useAudioPlayer = () => {
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const audioRef = audioElementRef;
  const currentAudioUrl = currentAudioUrlRef;
  const isPlaying = useAudioStore(state => state.isPlaying);
  const volume = useAudioStore(state => state.volume);
  const isMuted = useAudioStore(state => state.isMuted);
  const playbackRate = useAudioStore(state => state.playbackRate);
  const loopMode = useAudioStore(state => state.loopMode);
  const currentSong = useAudioStore(state => state.currentSong);
  const isLoading = useAudioStore(state => state.isLoading);
  const eqBands = useAudioStore(state => state.eqBands);
  const isEQEnabled = useAudioStore(state => state.isEQEnabled);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);
  const setCurrentTime = useAudioStore(state => state.setCurrentTime);
  const setDuration = useAudioStore(state => state.setDuration);
  const setIsLoading = useAudioStore(state => state.setIsLoading);
  const setError = useAudioStore(state => state.setError);
  const setBufferedRanges = useAudioStore(state => state.setBufferedRanges);
  const nextSong = useAudioStore(state => state.nextSong);
  const isEmotionCurveMode = useAudioStore(state => state.isEmotionCurveMode);
  const setDynamicCrossfadeDuration = useAudioStore(state => state.setDynamicCrossfadeDuration);

  const { recordPlay } = useStatsAchievementsStore();

  const initAudioContext = useCallback(() => {
    if (typeof window === "undefined" || !audioRef.current) return;

    const engine = AudioEngine.getInstance();
    engine.init(audioRef.current);

    const analyser = engine.getAnalyser();
    const context = engine.getContext();
    
    if (analyser && context) {
      const effectsManager = getAudioEffectsManager();
      effectsManager.init().then(() => {
        effectsManager.connect(analyser, context.destination, audioRef.current ?? undefined);
      });
    }
  }, []);

  const updateEQ = useCallback(() => {
    const engine = AudioEngine.getInstance();
    if (!isEQEnabled) {
      engine.updateEQ(new Array(30).fill(0));
      return;
    }
    engine.updateEQ(eqBands);
  }, [eqBands, isEQEnabled]);

  const recordListeningTime = useCallback(() => {
    if (currentSong && playStartTime > 0 && audioRef.current) {
      const currentPlayTime = Date.now() - playStartTime;
      const listenedSeconds = Math.floor(currentPlayTime / 1000);
      
      if (listenedSeconds > 0) {
        const duration = audioRef.current.duration || 0;
        const currentTime = audioRef.current.currentTime;
        
        // Determine completion and skip status
        const isCompleted = duration > 0 && (currentTime / duration) > 0.95;
        const isSkipped = duration > 0 && listenedSeconds < 30 && (currentTime / duration) < 0.5;
        
        // Determine audio quality
        let quality = "standard";
        const format = (currentSong as any).format?.toLowerCase() || "";
        if (format.includes("dsd") || format.includes("dsf") || format.includes("dff")) {
          quality = "dsd";
        } else if (format.includes("flac") || format.includes("alac") || (currentSong as any).isHiRes) {
          quality = "hi-res";
        } else if (format.includes("wav") || format.includes("aiff")) {
          quality = "lossless";
        }

        recordPlay(currentSong, listenedSeconds, isCompleted, isSkipped, quality);
      }
    }
    playStartTime = 0;
  }, [currentSong, recordPlay]);

  const stopAndClearAudio = useCallback(
    (keepRefs = false) => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {
          console.warn("Error clearing audio:", e);
        }
      }
      recordListeningTime();
      if (!keepRefs) {
        isPlayingRef.current = false;
      }
    },
    [recordListeningTime]
  );

  useEffect(() => {
    if (!isInitialized) {
      isInitialized = true;

      if (!audioRef.current) {
        audioInstance = new Audio();
        audioInstance.crossOrigin = "anonymous"; // Important for AudioContext
        audioRef.current = audioInstance;
        setAudioElement(audioInstance);
      } else {
        setAudioElement(audioRef.current);
      }

      if (typeof window !== "undefined") {
        (window as any).audioElementRef = audioRef;
      }

      if (!secondaryElementRef.current) {
        secondaryAudioInstance = new Audio();
        secondaryAudioInstance.crossOrigin = "anonymous";
        secondaryElementRef.current = secondaryAudioInstance;
      }
    }

    if (!eventListenersAdded && audioRef.current) {
      eventListenersAdded = true;
      const audio = audioRef.current;

      initAudioContext();

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);

        // Pre-emptive crossfade check (e.g., 5s before end if in emotion curve mode)
        if (isEmotionCurveMode && audio.duration > 0 && audio.currentTime > audio.duration - 5) {
          // Trigger next song early for crossfade? 
          // Actually, let's keep it simple and trigger on song change first.
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener("loadstart", () => {
        setIsLoading(true);
      });

      audio.addEventListener("canplay", () => {
        setIsLoading(false);
        if (isPlayingRef.current) {
          audio.play().catch(handlePlayError);
        }
      });

      audio.addEventListener("waiting", () => {
        setIsLoading(true);
      });

      audio.addEventListener("playing", () => {
        setIsLoading(false);
      });

      audio.addEventListener("ended", () => {
        if (loopMode === "single") {
          audio.currentTime = 0;
          audio.play().catch(handlePlayError);
        } else {
          nextSong();
        }
      });

      audio.addEventListener("error", (e) => {
        const error = (e.target as HTMLAudioElement).error;
        let errorInfo: AudioError = {
          type: "unknown",
          message: "音频播放发生未知错误",
          timestamp: Date.now(),
        };

        if (error) {
          switch (error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorInfo = {
                type: "load",
                message: "音频加载被中止",
                timestamp: Date.now(),
              };
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorInfo = {
                type: "network",
                message: "网络错误导致音频加载失败",
                timestamp: Date.now(),
              };
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorInfo = {
                type: "decode",
                message: "音频解码错误，文件可能已损坏",
                timestamp: Date.now(),
              };
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorInfo = {
                type: "load",
                message: "不支持的音频格式或无法访问音频文件",
                timestamp: Date.now(),
              };
              break;
          }
        }

        setError(errorInfo);
        setIsLoading(false);
        isPlayingRef.current = false;
      });

      audio.addEventListener("progress", () => {
        const buffered = audio.buffered;
        const ranges: { start: number; end: number }[] = [];
        for (let i = 0; i < buffered.length; i++) {
          ranges.push({
            start: buffered.start(i),
            end: buffered.end(i),
          });
        }
        setBufferedRanges(ranges);
      });
    }
  }, [setCurrentTime, setDuration, setIsLoading, setError, setBufferedRanges, nextSong, loopMode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      AudioEngine.getInstance().setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const loadAudio = async () => {
      if (audioRef.current && currentSong) {
        const songId = currentSong.id;

        if (currentSongIdRef.current === songId) {
          return;
        }

        setIsLoading(true);
        setError(null);

        if (currentAudioUrlRef.current && currentAudioUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }

        stopAndClearAudio(true);

        if (currentSong.audioUrl) {
          let audioUrl = currentSong.audioUrl;

          if (audioUrl.startsWith("stored://")) {
            const id = audioUrl.replace("stored://", "");
            const storedMusic = await getStoredMusic(id);
            if (storedMusic) {
              const blobUrl = createBlobUrlFromStoredMusic(storedMusic);
              audioUrl = blobUrl;
              currentAudioUrlRef.current = blobUrl;
            } else {
              setIsLoading(false);
              setError({
                type: "load",
                message: "无法加载本地音频文件",
                timestamp: Date.now(),
              });
              return;
            }
          }

          const previousSongId = currentSongIdRef.current;
          currentSongIdRef.current = songId;
          isPlayingRef.current = true;

          // DYNAMIC CROSSFADE LOGIC
          if (isEmotionCurveMode && previousSongId && previousSongId !== songId && audioRef.current && secondaryElementRef.current) {
            const mixer = CrossfadeMixer.getInstance();
            const duration = mixer.calculateDynamicDuration(previousSongId, songId);
            setDynamicCrossfadeDuration(duration);

            const fromAudio = audioRef.current;
            const toAudio = secondaryElementRef.current;
            
            toAudio.src = audioUrl;
            // No await here, let the crossfade handle the async nature
            mixer.crossfade(fromAudio, toAudio, duration);
            
            // IMMEDIATE SWAP to prevent navigation deadlocks
            audioElementRef.current = toAudio;
            secondaryElementRef.current = fromAudio;
            setAudioElement(toAudio);
            
            setIsPlaying(true);
          } else {
            try {
              audioRef.current.src = audioUrl;
              audioRef.current.load();
              setIsPlaying(true);
            } catch (e) {
              console.error("Error loading audio:", e);
              setIsLoading(false);
              setError({
                type: "load",
                message: "音频加载失败",
                timestamp: Date.now(),
              });
            }
          }
        } else {
          setIsLoading(false);
          setError({
            type: "load",
            message: "该歌曲暂无音频文件",
            timestamp: Date.now(),
          });
        }
      }
    };

    loadAudio();
  }, [currentSong]);

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      if (isLoading) return;

      isPlayingRef.current = true;
      playStartTime = Date.now();
      playStartPosition = audioRef.current.currentTime;

      const engine = AudioEngine.getInstance();
      engine.resume();
      initAudioContext();
      updateEQ();

      if (audioRef.current.readyState >= 2) {
        audioRef.current.play().catch(handlePlayError);
      } else {
        const handleCanPlay = () => {
          if (isPlayingRef.current) {
            audioRef.current?.play().catch(handlePlayError);
          }
          audioRef.current?.removeEventListener("canplay", handleCanPlay);
        };
        audioRef.current.addEventListener("canplay", handleCanPlay);
        return () => {
          audioRef.current?.removeEventListener("canplay", handleCanPlay);
        };
      }
    } else {
      isPlayingRef.current = false;
      recordListeningTime();
      audioRef.current.pause();
    }
  }, [isPlaying, isLoading, initAudioContext, updateEQ, recordListeningTime]);

  useEffect(() => {
    updateEQ();
  }, [eqBands, isEQEnabled, updateEQ]);

  const handlePlayError = (error: any) => {
    // Silently ignore AbortError as it's expected during rapid track changes
    if (error.name === "AbortError" || error.message?.includes("interrupted by a call to pause") || error.message?.includes("new load request")) {
      return;
    }

    const errorInfo: AudioError = {
      type: "play",
      message: `播放失败: ${error.message}`,
      timestamp: Date.now(),
    };
    setError(errorInfo);
    setIsPlaying(false);
  };

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const seek = useCallback(
    (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
        setCurrentTime(audioRef.current.currentTime);
      }
    },
    [setCurrentTime]
  );

  const seekRelative = useCallback(
    (delta: number) => {
      if (audioRef.current) {
        const newTime = audioRef.current.currentTime + delta;
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(newTime, audioRef.current.duration || 0)
        );
        setCurrentTime(audioRef.current.currentTime);
      }
    },
    [setCurrentTime]
  );

  const changeVolume = useCallback(
    (delta: number) => {
      const newVolume = Math.max(0, Math.min(1, volume + delta));
      useAudioStore.getState().setVolume(newVolume);
    },
    [volume]
  );

  return {
    togglePlay,
    seek,
    seekRelative,
    changeVolume,
    audioRef,
    audioElement,
  };
};

export const getAudioAnalyser = (): AnalyserNode | null => AudioEngine.getInstance().getAnalyser();
export const getAudioContext = (): AudioContext | null => AudioEngine.getInstance().getContext();
