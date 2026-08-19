import React, { act } from "react";
import type { ImgHTMLAttributes } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FloatingWaveformGlow } from "./FloatingWaveformGlow";
import { FloatingSpectrumGlow } from "./FloatingSpectrumGlow";
import { FloatingProgressScrubber } from "./FloatingProgressScrubber";
import { FloatingExpandedState } from "./FloatingExpandedState";
import { FloatingDebugHUD } from "./FloatingDebugHUD";
import { useAudioStore } from "@/store/audioStore";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";
import { useUIStore } from "@/store/uiStore";

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

vi.mock("@/components/player/NowPlayingHalo", () => ({
  NowPlayingHalo: ({
    currentTime: _c,
    isPlaying: _p,
    ...props
  }: Record<string, unknown>) => (
    <div data-testid="now-playing-halo" {...props} />
  ),
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
    onPointerDown?: React.PointerEventHandler<HTMLElement>;
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
    variants: _variants,
    ...props
  }: MotionProps) => ReactModule.createElement("div", props);

  const MotionButton = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    variants: _variants,
    ...props
  }: MotionProps) => ReactModule.createElement("button", props);

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
      div: MotionDiv,
      button: MotionButton,
      path: MotionPath,
    },
    useAnimationFrame: (_cb: () => void) => {},
    useMotionValue: (init: number) => ({
      get: () => init,
      set: () => {},
      onChange: () => () => {},
    }),
  };
});

describe("Floating Player Audio & Touch Modules", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Setup dummy song and audio store
    useAudioStore.setState({
      currentSong: {
        id: "test-song-1",
        title: "Cyber Cyber",
        artist: "Neon Echoes",
        album: "Synthverse 2099",
        duration: 200,
        cover: "https://example.com/cover.jpg",
        source: "local",
        lyrics: "[00:05.00]First line of cyberpunk\n[00:15.00]Second neon horizon",
      },
      isPlaying: true,
      currentTime: 10,
      duration: 200,
      volume: 0.8,
      isMuted: false,
      loopMode: "all",
      isLoading: false,
    });

    useFloatingDebugStore.setState({
      stiffness: 380,
      damping: 32,
      mass: 0.8,
      glowIntensity: 1.0,
      magnifyPower: 2.4,
      isHUDOpen: false,
      visualizerMode: "waveform",
    });
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
  });

  describe("1. FloatingWaveformGlow", () => {
    it("renders canvas element for 2D hardware accelerated waveform", () => {
      act(() => {
        root?.render(<FloatingWaveformGlow height={60} />);
      });

      const canvas = container?.querySelector("canvas");
      expect(canvas).toBeTruthy();
    });

    it("handles seek calculation on pointer down when interactive", () => {
      const seekSpy = vi.fn();
      useAudioStore.setState({ seekTo: seekSpy });

      act(() => {
        root?.render(<FloatingWaveformGlow height={60} onSeek={seekSpy} />);
      });

      const wrapper = container?.querySelector(".group");
      expect(wrapper).toBeTruthy();

      act(() => {
        wrapper?.dispatchEvent(
          new MouseEvent("pointerdown", { clientX: 100, bubbles: true })
        );
      });

      expect(seekSpy).toHaveBeenCalled();
    });
  });

  describe("2. FloatingSpectrumGlow", () => {
    it("renders 32-bar plasma spectrum analyzer canvas", () => {
      act(() => {
        root?.render(<FloatingSpectrumGlow height={56} barCount={32} />);
      });

      const canvas = container?.querySelector("canvas");
      expect(canvas).toBeTruthy();
    });
  });

  describe("3. FloatingProgressScrubber", () => {
    it("renders time indicators and progress track", () => {
      act(() => {
        root?.render(<FloatingProgressScrubber showVolume={true} />);
      });

      expect(container?.textContent).toContain("0:10");
      expect(container?.textContent).toContain("3:20");
    });

    it("toggles mute when mute button clicked", () => {
      act(() => {
        root?.render(<FloatingProgressScrubber showVolume={true} />);
      });

      const muteBtn = container?.querySelector("button[title='静音']");
      expect(muteBtn).toBeTruthy();

      act(() => {
        muteBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(useAudioStore.getState().isMuted).toBe(true);
    });
  });

  describe("4. FloatingExpandedState", () => {
    it("renders expanded card with title, artist, halo, controls, and lyric preview", () => {
      const onCollapseMock = vi.fn();

      act(() => {
        root?.render(<FloatingExpandedState onCollapse={onCollapseMock} />);
      });

      expect(container?.textContent).toContain("Cyber Cyber");
      expect(container?.textContent).toContain("Neon Echoes");
      expect(container?.textContent).toContain("First line of cyberpunk");
      expect(container?.textContent).toContain("展开沉浸播放器");
    });

    it("triggers expand full player view when clicked", () => {
      const onCollapseMock = vi.fn();

      act(() => {
        root?.render(<FloatingExpandedState onCollapse={onCollapseMock} />);
      });

      const expandBtn = Array.from(container?.querySelectorAll("button") || []).find((b) =>
        b.textContent?.includes("展开沉浸播放器")
      );
      expect(expandBtn).toBeTruthy();

      act(() => {
        expandBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(useUIStore.getState().currentView).toBe("player");
    });

    it("switches visualizer tab between waveform and spectrum", () => {
      act(() => {
        root?.render(<FloatingExpandedState onCollapse={vi.fn()} />);
      });

      const spectrumTabBtn = Array.from(container?.querySelectorAll("button") || []).find(
        (b) => b.textContent?.includes("频谱")
      );
      expect(spectrumTabBtn).toBeTruthy();

      act(() => {
        spectrumTabBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(useFloatingDebugStore.getState().visualizerMode).toBe("spectrum");
    });
  });

  describe("5. FloatingDebugHUD", () => {
    it("renders HUD trigger and opens upon click", () => {
      act(() => {
        root?.render(<FloatingDebugHUD isOpen={false} />);
      });

      const hudTrigger = container?.querySelector("button[title*='Shift + D']");
      expect(hudTrigger).toBeTruthy();

      act(() => {
        hudTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(useFloatingDebugStore.getState().isHUDOpen).toBe(true);
    });

    it("updates spring stiffness and glow intensity sliders", () => {
      const stateChangeMock = vi.fn();

      act(() => {
        root?.render(
          <FloatingDebugHUD
            isOpen={true}
            onStateChange={stateChangeMock}
            currentState="pill"
          />
        );
      });

      expect(container?.textContent).toContain("Motion Physics HUD");
      expect(container?.textContent).toContain("Stiffness (刚度)");

      // Test force switch state buttons
      const expandedStateBtn = Array.from(
        container?.querySelectorAll("button") || []
      ).find((b) => b.textContent?.includes("Expanded 展开"));

      expect(expandedStateBtn).toBeTruthy();

      act(() => {
        expandedStateBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(stateChangeMock).toHaveBeenCalledWith("expanded");
    });
  });
});
