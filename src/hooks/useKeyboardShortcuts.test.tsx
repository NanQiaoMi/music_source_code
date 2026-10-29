import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import { useKeyboardShortcutsStore } from "@/store/keyboardShortcutsStore";

const Probe = () => {
  useKeyboardShortcuts();
  return null;
};

describe("useKeyboardShortcuts isPlaying consumer", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(async () => {
    useKeyboardShortcutsStore.getState().resetAll();
    usePlayerStore.setState({
      currentSong: {
        id: "shortcut-song",
        title: "Shortcut",
        artist: "Mimi",
        duration: 120,
        source: "local",
        audioUrl: "file:///shortcut.mp3",
      },
    });
    useAudioStore.setState({ isPlaying: false });
    usePlaybackRuntimeStore.getState().reset();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<Probe />));
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container.remove();
    usePlayerStore.setState({ currentSong: null });
    useAudioStore.setState({ isPlaying: false });
    usePlaybackRuntimeStore.getState().reset();
  });

  it("toggles runtime play intent without reading the audioStore isPlaying mirror", async () => {
    usePlaybackRuntimeStore
      .getState()
      .requestPlayback("shortcut-song", "file:///shortcut.mp3", true);
    // 兼容投影与真实播放态短暂不一致时，快捷键仍以 runtime 意图为准。
    useAudioStore.setState({ isPlaying: false });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });

    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);
    expect(useAudioStore.getState().isPlaying).toBe(false);
  });
});
