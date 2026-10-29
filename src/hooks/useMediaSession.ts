"use client";

import { useEffect, useCallback } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";
import {
  getCurrentPlayerSong,
  nextPlayback,
  prevPlayback,
  setPlaybackCurrentTime,
  setPlaybackIsPlaying,
} from "@/store/actions/playbackEngineActions";
import { usePlaybackClock } from "@/hooks/usePlaybackClock";

export const useMediaSession = () => {
  // 回调/定时器只需要「此刻」快照（S6-9d：读取收口到 store/actions 动作层），
  // 渲染期只订阅下面两个 selector，避免 currentTime 的 60fps 重渲染。

  const updateMediaSession = useCallback(() => {
    // S6-4: 身份字段读 playerStore；播放态读 PlaybackClock（audioStore 兼容投影之上）
    const currentSong = getCurrentPlayerSong();
    const isPlaying = getPlaybackClockSnapshot().isPlaying;

    if (!("mediaSession" in navigator)) {
      return;
    }

    if (currentSong) {
      const artwork = currentSong.cover
        ? [{ src: currentSong.cover, sizes: "512x512", type: "image/jpeg" as const }]
        : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title || "Unknown Title",
        artist: currentSong.artist || "Unknown Artist",
        album: currentSong.album || "Unknown Album",
        artwork,
      });
    }

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, []);

  const setupMediaSessionHandlers = useCallback(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.setActionHandler("play", () => {
      setPlaybackIsPlaying(true);
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      setPlaybackIsPlaying(false);
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      prevPlayback();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      nextPlayback();
    });

    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const progress = getPlaybackClockSnapshot();
      const skipTime = details.seekOffset || 10;
      const newTime = Math.max(0, progress.currentTime - skipTime);
      setPlaybackCurrentTime(newTime);
    });

    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const progress = getPlaybackClockSnapshot();
      const skipTime = details.seekOffset || 10;
      const newTime = Math.min(progress.duration, progress.currentTime + skipTime);
      setPlaybackCurrentTime(newTime);
    });

    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        setPlaybackCurrentTime(details.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler("stop", () => {
      setPlaybackIsPlaying(false);
      setPlaybackCurrentTime(0);
    });
  }, []);

  useEffect(() => {
    setupMediaSessionHandlers();
    updateMediaSession();
  }, [setupMediaSessionHandlers, updateMediaSession]);

  // Subscribe to only the fields needed for periodic updates
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlaybackClock((state) => state.isPlaying);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && currentSong) {
        updateMediaSession();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentSong, updateMediaSession]);

  return {
    updateMediaSession,
    setupMediaSessionHandlers,
  };
};
