"use client";

import { useEffect, useState, useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";
import { useAudioPlayer } from "./useAudioPlayer";

export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);
  const [isDesktopLyricsOpen, setIsDesktopLyricsOpen] = useState(false);
  const currentSong = useAudioStore((state) => state.currentSong);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);
  const { togglePlay } = useAudioPlayer();

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electronAPI);
  }, []);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    window.electronAPI.onTogglePlay(() => togglePlay());
    window.electronAPI.onPrevSong(() => prevSong());
    window.electronAPI.onNextSong(() => nextSong());

    return () => {
      window.electronAPI?.removeAllListeners();
    };
  }, [isElectron, togglePlay, prevSong, nextSong]);

  useEffect(() => {
    if (!isElectron || !window.electronAPI || !currentSong) return;

    window.electronAPI.updateSongInfo({
      title: currentSong.title || "未知歌曲",
      artist: currentSong.artist || "未知艺术家",
    });
  }, [isElectron, currentSong]);

  const toggleDesktopLyrics = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return false;
    const result = await window.electronAPI.toggleDesktopLyrics();
    setIsDesktopLyricsOpen(result);
    return result;
  }, [isElectron]);

  const checkDesktopLyricsOpen = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return false;
    const result = await window.electronAPI.isDesktopLyricsOpen();
    setIsDesktopLyricsOpen(result);
    return result;
  }, [isElectron]);

  return {
    isElectron,
    isDesktopLyricsOpen,
    toggleDesktopLyrics,
    checkDesktopLyricsOpen,
  };
}
