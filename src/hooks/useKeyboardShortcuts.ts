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

// 比较单个绑定串（"Q"、"Ctrl+M"、"Ctrl+Shift+A"）
function matchesSingleSpec(e: KeyboardEvent, spec: string): boolean {
  const parts = String(spec)
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const expectedKey = parts[parts.length - 1];
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase());

  const wantCtrl = mods.includes("ctrl") || mods.includes("meta") || mods.includes("cmd");
  const wantShift = mods.includes("shift");
  const wantAlt = mods.includes("alt");

  const hasCtrl = e.ctrlKey || e.metaKey;
  const hasShift = e.shiftKey;
  const hasAlt = e.altKey;

  // 严格比对修饰键的有无：多余的修饰键一律拒绝。
  // 否则 Shift+ArrowLeft 会先命中 ArrowLeft（−5 秒），−10 秒那条永远轮不到；
  // Ctrl+ArrowUp 这类没有任何绑定的组合也会误触发音量调节。
  if (wantCtrl !== hasCtrl) return false;
  if (wantShift !== hasShift) return false;
  if (wantAlt !== hasAlt) return false;

  const actualKey = e.key === " " ? "Space" : e.key;
  // 字母键大小写不敏感：真实键盘在不按 Shift 时给出小写（Ctrl+M 的 e.key 是 "m"，
  // 不按 Shift 的 F 是 "f"），而绑定表里写的是大写，直接比较永远不相等。
  return actualKey.toLowerCase() === expectedKey.toLowerCase();
}

function matchKeys(e: KeyboardEvent, pattern: string[]): boolean {
  if (!pattern || pattern.length === 0) return false;

  // 数组里每个元素都是一条独立绑定，必须逐个比对。
  // 不能先 flatten 成一个数组：["Q", "Ctrl+L"] 会被拼成 Q/Ctrl/L，
  // 变成"必须按 Ctrl+L"这一种，裸 Q 那条就失效了。
  return pattern.some((spec) => matchesSingleSpec(e, spec));
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

      // 只走绑定表这一条。原先还硬编码了「裸 q」与「⌘/Ctrl+L」两个兜底：
      // matchKeys 修好后已能正确处理大小写，裸 q 那条冗余；而 Ctrl+L 那条与 HomeView 的
      // 「⌘L 唤出 3D 歌单架」重复，会让同一个键触发两个动作。
      if (matchKeys(e, bind("toggle-queue"))) {
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
