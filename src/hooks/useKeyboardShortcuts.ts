"use client";

import React, { useEffect, useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useKeyboardShortcutsStore } from "@/store/keyboardShortcutsStore";

function matchKeys(e: KeyboardEvent, pattern: string[]): boolean {
  const hasCtrl = e.ctrlKey || e.metaKey;
  const hasShift = e.shiftKey;
  const hasAlt = e.altKey;
  const key = e.key === " " ? "Space" : e.key;

  let modIndex = 0;
  let keyIndex = pattern.length - 1;

  if (pattern[modIndex] === "Ctrl") { if (!hasCtrl) return false; modIndex++; }
  if (pattern[modIndex] === "Shift") { if (!hasShift) return false; modIndex++; }
  if (pattern[modIndex] === "Alt") { if (!hasAlt) return false; modIndex++; }

  return modIndex === keyIndex && pattern[keyIndex] === key;
}

export const useKeyboardShortcuts = () => {
  const getBinding = useKeyboardShortcutsStore((s) => s.getBinding);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }

    const audioStore = useAudioStore.getState();
    const uiStore = useUIStore.getState();

    const bind = (id: string) => getBinding(id);

    if (matchKeys(e, bind("play-pause"))) {
      e.preventDefault();
      if (!audioStore.currentSong && audioStore.queue.length > 0) {
        audioStore.setCurrentSong(audioStore.queue[0]);
        audioStore.setCurrentIndex(0);
      }
      audioStore.setIsPlaying(!audioStore.isPlaying);
      return;
    }

    if (matchKeys(e, bind("seek-back-5"))) {
      e.preventDefault();
      audioStore.setCurrentTime(Math.max(0, audioStore.currentTime - 5));
      return;
    }

    if (matchKeys(e, bind("seek-forward-5"))) {
      e.preventDefault();
      audioStore.setCurrentTime(Math.min(audioStore.duration, audioStore.currentTime + 5));
      return;
    }

    if (matchKeys(e, bind("seek-back-10"))) {
      e.preventDefault();
      audioStore.setCurrentTime(Math.max(0, audioStore.currentTime - 10));
      return;
    }

    if (matchKeys(e, bind("seek-forward-10"))) {
      e.preventDefault();
      audioStore.setCurrentTime(Math.min(audioStore.duration, audioStore.currentTime + 10));
      return;
    }

    if (matchKeys(e, bind("vol-up"))) {
      e.preventDefault();
      audioStore.setVolume(Math.min(1, audioStore.volume + 0.05));
      return;
    }

    if (matchKeys(e, bind("vol-down"))) {
      e.preventDefault();
      audioStore.setVolume(Math.max(0, audioStore.volume - 0.05));
      return;
    }

    if (matchKeys(e, bind("vol-up-more"))) {
      e.preventDefault();
      audioStore.setVolume(Math.min(1, audioStore.volume + 0.1));
      return;
    }

    if (matchKeys(e, bind("vol-down-more"))) {
      e.preventDefault();
      audioStore.setVolume(Math.max(0, audioStore.volume - 0.1));
      return;
    }

    if (matchKeys(e, bind("favorite"))) {
      e.preventDefault();
      if (audioStore.currentSong) {
        const { toggleFavorite, favorites } = useAudioStore.getState();
        toggleFavorite(audioStore.currentSong.id);
        const isFav = favorites?.includes(audioStore.currentSong.id);
        uiStore.showToast?.(isFav ? "已取消收藏" : "已收藏歌曲", "success");
      }
      return;
    }

    if (matchKeys(e, bind("cycle-loop"))) {
      e.preventDefault();
      audioStore.cycleLoopMode();
      const modeNames: Record<string, string> = {
        none: "顺序播放",
        all: "列表循环",
        single: "单曲循环",
        shuffle: "随机播放",
      };
      uiStore.showToast?.(`播放模式: ${modeNames[audioStore.loopMode]}`, "info");
      return;
    }

    if (matchKeys(e, bind("toggle-mute"))) {
      e.preventDefault();
      audioStore.toggleMute();
      uiStore.showToast?.(audioStore.isMuted ? "已静音" : "已取消静音", "info");
      return;
    }

    if (matchKeys(e, bind("next-song"))) {
      e.preventDefault();
      audioStore.nextSong();
      uiStore.showToast?.("下一首", "info");
      return;
    }

    if (matchKeys(e, bind("prev-song"))) {
      e.preventDefault();
      audioStore.prevSong();
      uiStore.showToast?.("上一首", "info");
      return;
    }

    if (matchKeys(e, bind("escape"))) {
      e.preventDefault();
      if (uiStore.currentView === "player") {
        uiStore.setCurrentView("home");
      }
      if (uiStore.isSettingsOpen) uiStore.setIsSettingsOpen(false);
      if (uiStore.isLyricSettingsOpen) uiStore.setIsLyricSettingsOpen(false);
      return;
    }

    if (matchKeys(e, bind("fullscreen-lyrics"))) {
      e.preventDefault();
      uiStore.toggleFullscreenLyrics?.();
      return;
    }

    if (matchKeys(e, bind("fullscreen"))) {
      e.preventDefault();
      uiStore.toggleFullscreen();
      return;
    }

    if (matchKeys(e, bind("speed-up"))) {
      e.preventDefault();
      audioStore.setPlaybackRate(Math.min(2.0, audioStore.playbackRate + 0.25));
      uiStore.showToast?.(`播放速度: ${audioStore.playbackRate.toFixed(2)}x`, "info");
      return;
    }

    if (matchKeys(e, bind("speed-down"))) {
      e.preventDefault();
      audioStore.setPlaybackRate(Math.max(0.5, audioStore.playbackRate - 0.25));
      uiStore.showToast?.(`播放速度: ${audioStore.playbackRate.toFixed(2)}x`, "info");
      return;
    }

    for (let n = 0; n <= 9; n++) {
      if (matchKeys(e, bind(`seek-${n * 10}`))) {
        e.preventDefault();
        const percent = n * 10;
        const newTime = (percent / 100) * audioStore.duration;
        audioStore.setCurrentTime(newTime);
        return;
      }
    }

    if (matchKeys(e, bind("open-ai-settings"))) {
      e.preventDefault();
      uiStore.openPanel("aiSettings");
      return;
    }

    if (matchKeys(e, bind("toggle-ai-panel"))) {
      e.preventDefault();
      uiStore.togglePanel("aiSettings");
      return;
    }
  }, [getBinding]);

  useEffect(() => {
    const handleFSChange = () => {
      useUIStore.setState({ isFullscreen: !!document.fullscreenElement });
    };

    document.addEventListener("fullscreenchange", handleFSChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFSChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};