"use client";

import { useEffect, useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useVisualizationStore } from "@/store/visualizationStore";
import { useKeyboardShortcutsStore } from "@/store/keyboardShortcutsStore";

export interface ShortcutValidationResult {
  valid: boolean;
  conflicts: [string, string][];
}

export function normalizeShortcutValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join("+") : value;
}

export function validateShortcutMap(
  shortcuts: Record<string, string | string[]>
): ShortcutValidationResult {
  const seen = new Map<string, string>();
  const conflicts: [string, string][] = [];

  Object.entries(shortcuts).forEach(([id, value]) => {
    const normalized = normalizeShortcutValue(value).trim();
    if (!normalized) return;

    const existing = seen.get(normalized);
    if (existing) {
      conflicts.push([existing, id]);
      return;
    }

    seen.set(normalized, id);
  });

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}

function matchKeys(e: KeyboardEvent, pattern: string[]): boolean {
  const hasCtrl = e.ctrlKey || e.metaKey;
  const hasShift = e.shiftKey;
  const hasAlt = e.altKey;
  const key = e.key === " " ? "Space" : e.key;

  let modIndex = 0;
  const keyIndex = pattern.length - 1;

  if (pattern[modIndex] === "Ctrl") {
    if (!hasCtrl) return false;
    modIndex++;
  }
  if (pattern[modIndex] === "Shift") {
    if (!hasShift) return false;
    modIndex++;
  }
  if (pattern[modIndex] === "Alt") {
    if (!hasAlt) return false;
    modIndex++;
  }

  return modIndex === keyIndex && pattern[keyIndex] === key;
}

export const useKeyboardShortcuts = () => {
  const getBinding = useKeyboardShortcutsStore((s) => s.getBinding);

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
          uiStore.showToast?.("收藏快捷键已触发", "success");
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

      if (
        matchKeys(e, bind("toggle-queue")) ||
        ((e.key === "q" || e.key === "Q") && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.metaKey || e.ctrlKey) && (e.key === "l" || e.key === "L"))
      ) {
        e.preventDefault();
        uiStore.togglePanel("shelf3D");
        return;
      }

      if (matchKeys(e, bind("speed-up"))) {
        e.preventDefault();
        const nextRate = Math.min(2.0, Math.round((audioStore.playbackRate + 0.25) * 100) / 100);
        audioStore.setPlaybackRate(nextRate);
        uiStore.showToast?.(`播放速度: ${nextRate.toFixed(2)}x`, "info");
        return;
      }

      if (matchKeys(e, bind("speed-down"))) {
        e.preventDefault();
        const nextRate = Math.max(0.5, Math.round((audioStore.playbackRate - 0.25) * 100) / 100);
        audioStore.setPlaybackRate(nextRate);
        uiStore.showToast?.(`播放速度: ${nextRate.toFixed(2)}x`, "info");
        return;
      }

      if (
        matchKeys(e, bind("speed-reset")) ||
        ((e.ctrlKey || e.metaKey) && (e.key === "0" || e.code === "Digit0"))
      ) {
        e.preventDefault();
        audioStore.resetPlaybackRate();
        uiStore.showToast?.("播放速度已恢复: 1.00x (原速)", "info");
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
    },
    [getBinding]
  );

  useEffect(() => {
    const handleFSChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = document as any;
      const isFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      useUIStore.setState({ isFullscreen: isFs });
      useVisualizationStore.setState({ isFullscreen: isFs });
    };

    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ];
    events.forEach((event) => document.addEventListener(event, handleFSChange));
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      events.forEach((event) => document.removeEventListener(event, handleFSChange));
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
