"use client";

import { useEffect, useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";

export const useMediaSession = () => {
  // Use getState() for all store access - this hook only needs state in callbacks
  // and intervals, not during render. Prevents 60fps re-renders from currentTime.

  const updateMediaSession = useCallback(() => {
    const { currentSong, isPlaying } = useAudioStore.getState();

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
      useAudioStore.getState().setIsPlaying(true);
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      useAudioStore.getState().setIsPlaying(false);
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      useAudioStore.getState().prevSong();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      useAudioStore.getState().nextSong();
    });

    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const state = useAudioStore.getState();
      const skipTime = details.seekOffset || 10;
      const newTime = Math.max(0, state.currentTime - skipTime);
      state.setCurrentTime(newTime);
    });

    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const state = useAudioStore.getState();
      const skipTime = details.seekOffset || 10;
      const newTime = Math.min(state.duration, state.currentTime + skipTime);
      state.setCurrentTime(newTime);
    });

    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        useAudioStore.getState().setCurrentTime(details.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler("stop", () => {
      const state = useAudioStore.getState();
      state.setIsPlaying(false);
      state.setCurrentTime(0);
    });
  }, []);

  useEffect(() => {
    setupMediaSessionHandlers();
    updateMediaSession();
  }, [setupMediaSessionHandlers, updateMediaSession]);

  // Subscribe to only the fields needed for periodic updates
  const currentSong = useAudioStore(state => state.currentSong);
  const isPlaying = useAudioStore(state => state.isPlaying);

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
