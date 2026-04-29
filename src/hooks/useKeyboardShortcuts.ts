"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";

export const useKeyboardShortcuts = () => {
  // Use getState() inside event handlers to avoid subscribing to the entire store.
  // This prevents this hook from causing re-renders on every currentTime tick.

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const audioStore = useAudioStore.getState();
      const uiStore = useUIStore.getState();

      const key = e.key.toLowerCase();
      const hasCtrl = e.ctrlKey || e.metaKey;
      const hasShift = e.shiftKey;

      switch (key) {
        case " ":
        case "enter":
          e.preventDefault();
          if (!audioStore.currentSong && audioStore.queue.length > 0) {
            audioStore.setCurrentSong(audioStore.queue[0]);
            audioStore.setCurrentIndex(0);
          }
          audioStore.setIsPlaying(!audioStore.isPlaying);
          break;

        case "arrowleft":
          e.preventDefault();
          if (hasShift) {
            audioStore.setCurrentTime(Math.max(0, audioStore.currentTime - 10));
          } else {
            audioStore.setCurrentTime(Math.max(0, audioStore.currentTime - 5));
          }
          break;

        case "arrowright":
          e.preventDefault();
          if (hasShift) {
            audioStore.setCurrentTime(Math.min(audioStore.duration, audioStore.currentTime + 10));
          } else {
            audioStore.setCurrentTime(Math.min(audioStore.duration, audioStore.currentTime + 5));
          }
          break;

        case "arrowup":
          e.preventDefault();
          if (hasShift) {
            audioStore.setVolume(Math.min(1, audioStore.volume + 0.1));
          } else {
            audioStore.setVolume(Math.min(1, audioStore.volume + 0.05));
          }
          break;

        case "arrowdown":
          e.preventDefault();
          if (hasShift) {
            audioStore.setVolume(Math.max(0, audioStore.volume - 0.1));
          } else {
            audioStore.setVolume(Math.max(0, audioStore.volume - 0.05));
          }
          break;

        case "d":
          if (hasCtrl) {
            e.preventDefault();
            if (audioStore.currentSong) {
              uiStore.showToast?.("已收藏歌曲", "success");
            }
          }
          break;

        case "r":
          if (hasCtrl) {
            e.preventDefault();
            audioStore.cycleLoopMode();
            const modeNames: Record<string, string> = {
              none: "顺序播放",
              all: "列表循环",
              single: "单曲循环",
              shuffle: "随机播放",
            };
            uiStore.showToast?.(`播放模式: ${modeNames[audioStore.loopMode]}`, "info");
          }
          break;

        case "escape":
          e.preventDefault();
          if (uiStore.currentView === "player") {
            uiStore.setCurrentView("home");
          }
          if (uiStore.isSettingsOpen) {
            uiStore.setIsSettingsOpen(false);
          }
          if (uiStore.isLyricSettingsOpen) {
            uiStore.setIsLyricSettingsOpen(false);
          }
          break;

        case "m":
          if (hasCtrl) {
            e.preventDefault();
            audioStore.toggleMute();
            uiStore.showToast?.(audioStore.isMuted ? "已静音" : "已取消静音", "info");
          }
          break;

        case "l":
          if (hasCtrl) {
            e.preventDefault();
            audioStore.cycleLoopMode();
            const modeNames: Record<string, string> = {
              none: "顺序播放",
              all: "列表循环",
              single: "单曲循环",
              shuffle: "随机播放",
            };
            uiStore.showToast?.(`播放模式: ${modeNames[audioStore.loopMode]}`, "info");
          }
          break;

        case "n":
          if (hasCtrl) {
            e.preventDefault();
            audioStore.nextSong();
            uiStore.showToast?.("下一首", "info");
          }
          break;

        case "p":
          if (hasCtrl) {
            e.preventDefault();
            audioStore.prevSong();
            uiStore.showToast?.("上一首", "info");
          }
          break;

        case "f":
          if (hasCtrl) {
            e.preventDefault();
            uiStore.toggleFullscreenLyrics?.();
          }
          break;

        case "=":
        case "+":
          e.preventDefault();
          audioStore.setPlaybackRate(Math.min(2.0, audioStore.playbackRate + 0.25));
          uiStore.showToast?.(`播放速度: ${audioStore.playbackRate.toFixed(2)}x`, "info");
          break;

        case "-":
          e.preventDefault();
          audioStore.setPlaybackRate(Math.max(0.5, audioStore.playbackRate - 0.25));
          uiStore.showToast?.(`播放速度: ${audioStore.playbackRate.toFixed(2)}x`, "info");
          break;

        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          if (!hasCtrl) {
            e.preventDefault();
            const percent = parseInt(key) * 10;
            const newTime = (percent / 100) * audioStore.duration;
            audioStore.setCurrentTime(newTime);
          }
          break;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
