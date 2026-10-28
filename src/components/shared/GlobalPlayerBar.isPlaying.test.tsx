import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { GlobalPlayerBar } from "./GlobalPlayerBar";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import type { Song } from "@/types/song";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) => {
        return ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);
      },
    }
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    sizes: _sizes,
    unoptimized: _unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    sizes?: string;
    unoptimized?: boolean;
  }) => <img {...props} />,
}));

vi.mock("@/components/player/NowPlayingHalo", () => ({ NowPlayingHalo: () => null }));
vi.mock("@/components/widgets/GlassRadarWidget", () => ({ GlassRadarWidget: () => null }));
vi.mock("@/components/shared/GlobalPlayerProgressBar", () => ({
  GlobalPlayerProgressBar: () => null,
}));
vi.mock("@/hooks/useNetworkAudioCache", () => ({
  useNetworkAudioCache: () => ({ isCached: () => false }),
}));

const song: Song = {
  id: "s6-4-isplaying",
  title: "Clock Authority",
  artist: "Mimi",
  duration: 200,
  source: "local",
  audioUrl: "file:///clock-authority.mp3",
};

const PAUSE_PATH = 'path[d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"]';
const PLAY_PATH = 'path[d="M8 5v14l11-7z"]';

describe("GlobalPlayerBar isPlaying consumer", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    usePlayerStore.setState({ currentSong: song, volume: 0.7, isMuted: false });
    useAudioStore.setState({ isPlaying: false, isLoading: false });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container.remove();
    usePlayerStore.setState({ currentSong: null });
    useAudioStore.setState({ isPlaying: false, isLoading: false });
  });

  it("renders play/pause from PlaybackClock and follows confirmed audioStore state", async () => {
    root = createRoot(container);
    await act(async () => root?.render(<GlobalPlayerBar />));

    expect(container.querySelector(PLAY_PATH)).not.toBeNull();
    expect(container.querySelector(PAUSE_PATH)).toBeNull();

    await act(async () => useAudioStore.setState({ isPlaying: true }));

    expect(container.querySelector(PAUSE_PATH)).not.toBeNull();
    expect(container.querySelector(PLAY_PATH)).toBeNull();
  });
});
