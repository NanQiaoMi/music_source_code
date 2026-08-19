import React, { act } from "react";
import type { ImgHTMLAttributes } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FloatingAmbientGlow } from "./FloatingAmbientGlow";
import {
  FloatingControls,
  MorphingPlayPauseButton,
  VinylRecord,
  HeartFavoriteButton,
  JellyButton,
} from "./FloatingControls";
import { FloatingPillState } from "./FloatingPillState";
import { useAudioStore } from "@/store/audioStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useEmotionStore } from "@/store/emotionStore";

type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: MockImageProps) => <img {...props} />,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLElement>;
    className?: string;
    style?: React.CSSProperties;
    onMouseDown?: React.MouseEventHandler<HTMLElement>;
    onTouchStart?: React.TouchEventHandler<HTMLElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    d?: string;
  } & Record<string, unknown>;

  const MotionDiv = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    layoutId: _layoutId,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: MotionProps) => ReactModule.createElement("div", props);

  const MotionButton = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: MotionProps) => ReactModule.createElement("button", props);

  const MotionSpan = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: MotionProps) => ReactModule.createElement("span", props);

  const MotionH4 = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: MotionProps) => ReactModule.createElement("h4", props);

  const MotionPath = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    d,
    ...props
  }: MotionProps) => ReactModule.createElement("path", { d, ...props });

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    motion: {
      button: MotionButton,
      div: MotionDiv,
      span: MotionSpan,
      h4: MotionH4,
      path: MotionPath,
    },
    useAnimationFrame: (_callback: (time: number, delta: number) => void) => {},
  };
});

describe("FloatingAmbientGlow", () => {
  beforeEach(() => {
    useAudioStore.setState({
      isPlaying: true,
      currentSong: {
        id: "song-ambient-1",
        title: "Ambient Sunset",
        artist: "Chill Wave",
        album: "Summer Dreams",
        cover: "/test-cover.jpg",
        audioUrl: "/test.mp3",
        duration: 180,
        source: "local",
      },
    });

    useEmotionStore.setState({
      realtimeCoordinates: { x: 0.6, y: 0.8 },
      globalEmotion: { x: 0.5, y: 0.7 },
    });
  });

  it("renders with radial mesh gradient and border beam", () => {
    const html = renderToStaticMarkup(
      <FloatingAmbientGlow rounded="rounded-full" borderBeam={true}>
        <div data-testid="child-element">Child Content</div>
      </FloatingAmbientGlow>
    );

    expect(html).toContain("Child Content");
    expect(html).toContain("rounded-full");
    expect(html).toContain("blur(48px)");
  });
});

describe("FloatingControls", () => {
  beforeEach(() => {
    useAudioStore.setState({
      isPlaying: false,
      isLoading: false,
      currentSong: {
        id: "song-controls-1",
        title: "Cyber Rhythm",
        artist: "Synth Master",
        album: "Neon Grid",
        cover: "/test-cover.jpg",
        audioUrl: "/test.mp3",
        duration: 240,
        source: "local",
      },
    });
    useFavoritesStore.setState({
      favorites: [],
    });
  });

  it("renders MorphingPlayPauseButton with play and pause paths", () => {
    const onToggle = vi.fn();
    const playHtml = renderToStaticMarkup(
      <MorphingPlayPauseButton isPlaying={false} onToggle={onToggle} />
    );
    expect(playHtml).toContain("开始播放");
    expect(playHtml).toContain("M 7 4.5 L 14 8.8 L 14 15.2 L 7 19.5 Z");

    const pauseHtml = renderToStaticMarkup(
      <MorphingPlayPauseButton isPlaying={true} onToggle={onToggle} />
    );
    expect(pauseHtml).toContain("暂停播放");
    expect(pauseHtml).toContain("M 6 4.5 L 10 4.5 L 10 19.5 L 6 19.5 Z");
  });

  it("renders VinylRecord with cover and groove details", () => {
    const html = renderToStaticMarkup(
      <VinylRecord
        coverUrl="/cover.jpg"
        title="Cyber Rhythm"
        isPlaying={true}
        size={56}
      />
    );
    expect(html).toContain('title="Cyber Rhythm"');
    expect(html).toContain('src="/cover.jpg"');
    expect(html).toContain("conic-gradient");
  });

  it("renders HeartFavoriteButton and toggles favorite store state on click", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<HeartFavoriteButton size={18} />);
    });

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).toBeDefined();

    // Toggle favorite on
    await act(async () => {
      button.click();
    });
    expect(useFavoritesStore.getState().isFavorite("song-controls-1")).toBe(true);

    // Toggle favorite off
    await act(async () => {
      button.click();
    });
    expect(useFavoritesStore.getState().isFavorite("song-controls-1")).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders JellyButton and executes click handlers", async () => {
    const onClick = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <JellyButton onClick={onClick} ariaLabel="下一首" nudgeDirection="right">
          <span>Next</span>
        </JellyButton>
      );
    });

    const button = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders full FloatingControls group with shuffle and loop buttons", () => {
    const html = renderToStaticMarkup(
      <FloatingControls compact={false} showShuffleAndLoop={true} showFavorite={true} />
    );
    expect(html).toContain("上一首");
    expect(html).toContain("下一首");
    expect(html).toContain("开始播放");
    expect(html).toContain("切换循环模式");
    expect(html).toContain("随机播放");
  });
});

describe("FloatingPillState", () => {
  beforeEach(() => {
    useAudioStore.setState({
      isPlaying: true,
      isLoading: false,
      currentSong: {
        id: "song-pill-1",
        title: "Super Ultra Long Song Name That Overflows The Capsule Viewport",
        artist: "Starfield Orchestra",
        album: "Cosmos",
        cover: "/star.jpg",
        audioUrl: "/star.mp3",
        duration: 320,
        source: "local",
      },
    });
  });

  it("renders pill capsule state with marquee title, vinyl disc, and controls", async () => {
    const onExpand = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <FloatingPillState onExpand={onExpand} showGlow={true} showBorderBeam={true} />
      );
    });

    expect(container.innerHTML).toContain('data-floating-state="pill"');
    expect(container.textContent).toContain("Super Ultra Long Song Name");
    expect(container.textContent).toContain("Starfield Orchestra");
  });

  it("triggers onExpand when clicking on Dynamic Island pill card body", async () => {
    const onExpand = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<FloatingPillState onExpand={onExpand} />);
    });

    const card = container.querySelector('[data-floating-state="pill"]') as HTMLDivElement;
    expect(card).toBeDefined();

    // Click on card body (triggers onExpand)
    await act(async () => {
      card.click();
    });
    expect(onExpand).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

});
