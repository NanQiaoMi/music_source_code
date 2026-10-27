import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MotionMockProps = {
  children?: React.ReactNode;
  [prop: string]: unknown;
};

const player3DTestState = vi.hoisted(() => ({
  reducedMotion: false,
  getAudioAnalyser: vi.fn(() => null),
  resumeAudioContext: vi.fn(() => Promise.resolve()),
  motionExitTargets: [] as Array<{ childTypes: string[]; exit: unknown }>,
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("next/image", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      fill: _fill,
      priority: _priority,
      unoptimized: _unoptimized,
      ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      priority?: boolean;
      unoptimized?: boolean;
    }) => ReactModule.createElement("img", props),
  };
});

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const motionComponents = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const existing = motionComponents.get(tag);
        if (existing) return existing;

        const component = ReactModule.forwardRef<HTMLElement, MotionMockProps>((props, ref) => {
          if (props.exit !== undefined) {
            const childTypes = ReactModule.Children.toArray(
              props.children as React.ReactNode
            ).flatMap((child) => {
              if (!ReactModule.isValidElement(child)) return [];

              const childType = child.type as string | { displayName?: string; name?: string };
              return [
                typeof childType === "string"
                  ? childType
                  : (childType.displayName ?? childType.name ?? "unknown"),
              ];
            });
            player3DTestState.motionExitTargets.push({
              childTypes,
              exit: props.exit,
            });
          }

          const {
            animate: _animate,
            exit: _exit,
            initial: _initial,
            layoutId: _layoutId,
            style: _style,
            transition: _transition,
            whileHover: _whileHover,
            whileTap: _whileTap,
            ...elementProps
          } = props;
          return ReactModule.createElement(tag, { ...elementProps, ref });
        });
        motionComponents.set(tag, component);
        return component;
      },
    }
  );

  return {
    AnimatePresence: ({ children, mode }: { children: React.ReactNode; mode?: string }) =>
      ReactModule.createElement(
        "div",
        { "data-presence-mode": mode, style: { display: "contents" } },
        children
      ),
    motion,
    useMotionValue: <T,>(initialValue: T) => {
      const valueRef = ReactModule.useRef<{
        get: () => unknown;
        set: (next: unknown) => void;
      } | null>(null);
      if (!valueRef.current) {
        let current = initialValue as unknown;
        valueRef.current = {
          get: () => current,
          set: (next) => {
            current = next;
          },
        };
      }
      return valueRef.current as { get: () => T; set: (next: T) => void };
    },
    useReducedMotion: () => player3DTestState.reducedMotion,
  };
});

vi.mock("@/hooks/useAlbumTheme", () => ({
  useAlbumTheme: () => ({ themeColors: null }),
}));

vi.mock("@/hooks/useAudioPlayer", () => ({
  getAudioAnalyser: player3DTestState.getAudioAnalyser,
}));

vi.mock("@/lib/audio/AudioEngine", () => ({
  AudioEngine: {
    getInstance: () => ({ resume: player3DTestState.resumeAudioContext }),
  },
}));

vi.mock("@/components/player/AppleAudioSourceIndicator", () => ({
  AppleAudioSourceIndicator: () => null,
}));

vi.mock("@/components/shared/GlassProgressBar", () => ({
  GlassProgressBar: () => null,
}));

import { Player3D } from "./Player3D";
import { useAudioStore } from "@/store/audioStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import { useUIStore } from "@/store/uiStore";

const song = {
  id: "track-a",
  title: "Track A",
  artist: "Artist A",
  album: "Album A",
  duration: 180,
  source: "local",
  audioUrl: "stored://track-a",
};

describe("Player3D", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    player3DTestState.reducedMotion = false;
    player3DTestState.getAudioAnalyser.mockClear();
    player3DTestState.resumeAudioContext.mockClear();
    player3DTestState.motionExitTargets.length = 0;
    usePlaybackRuntimeStore.getState().reset();
    // Player3D 只在播放页跑采样循环；其余用例都按播放页的真实挂载场景准备。
    useUIStore.getState().setCurrentView("player");
    useAudioStore.setState({
      currentSong: song,
      isPlaying: false,
      isLoading: false,
      error: null,
      duration: song.duration,
      bufferedRanges: [],
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    player3DTestState.reducedMotion = false;
    vi.restoreAllMocks();
  });

  it("uses the latest playback intent for repeated clicks while loading", async () => {
    const togglePlaybackIntent = vi.spyOn(useAudioStore.getState(), "togglePlaybackIntent");

    await act(async () => root.render(<Player3D />));
    const playButton = host.querySelector<HTMLButtonElement>(
      'button[class*="w-16"][class*="h-16"]'
    );

    expect(playButton).not.toBeNull();
    await act(async () => {
      playButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(player3DTestState.resumeAudioContext).toHaveBeenCalledTimes(1);
    expect(player3DTestState.resumeAudioContext.mock.invocationCallOrder[0]).toBeLessThan(
      togglePlaybackIntent.mock.invocationCallOrder[0]
    );
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(true);
    expect(usePlaybackRuntimeStore.getState().phase).toBe("loading");

    await act(async () => {
      playButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(togglePlaybackIntent).toHaveBeenCalledTimes(2);
    expect(player3DTestState.resumeAudioContext).toHaveBeenCalledTimes(2);
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);
    expect(usePlaybackRuntimeStore.getState().phase).toBe("paused");
  });

  it("shows a newly requested track immediately in pop-layout transitions", async () => {
    await act(async () => root.render(<Player3D />));
    const nextSong = { ...song, id: "track-b", title: "Track B", album: "Album B" };

    await act(async () => {
      useAudioStore.setState({ currentSong: nextSong });
    });

    expect(host.textContent).toContain("Track B");
    expect(host.textContent).toContain("Album B");
    expect(host.textContent).not.toContain("Track A");
    expect(host.querySelectorAll('[data-presence-mode="popLayout"]')).toHaveLength(2);
  });

  it("disables pointer events on keyed cover and track-info exit layers", async () => {
    await act(async () => root.render(<Player3D />));

    const coverExitTarget = player3DTestState.motionExitTargets.find((target) =>
      target.childTypes.includes("CoverWith3DEffect")
    );
    const trackInfoExitTarget = player3DTestState.motionExitTargets.find((target) =>
      target.childTypes.includes("h2")
    );

    expect(coverExitTarget?.exit).toMatchObject({ pointerEvents: "none" });
    expect(trackInfoExitTarget?.exit).toMatchObject({ pointerEvents: "none" });
  });

  it("keeps a static loading cue while the latest track request is pending", async () => {
    useAudioStore.setState({ isPlaying: true });
    usePlaybackRuntimeStore.getState().requestPlayback("track-a", song.audioUrl, true, true);

    await act(async () => root.render(<Player3D />));

    const playButton = host.querySelector<HTMLButtonElement>(
      'button[class*="w-16"][class*="h-16"]'
    );
    expect(host.textContent).toContain("Track A");
    expect(playButton?.getAttribute("aria-busy")).toBe("true");
    expect(playButton?.className).toContain("ring-4");
    expect(playButton?.className).not.toContain("animate-pulse");
  });

  it("starts audio-reactive motion only after confirmed playback and stops on pause", async () => {
    useAudioStore.setState({ isPlaying: true });
    const runtime = usePlaybackRuntimeStore.getState();
    const requestId = runtime.requestPlayback("track-a", song.audioUrl, true, true);
    runtime.bindActiveDeck(requestId, "track-a", "deck-a", song.audioUrl ?? "");

    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        const frameId = nextFrameId++;
        scheduledFrames.set(frameId, callback);
        return frameId;
      });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      scheduledFrames.delete(frameId);
    });

    await act(async () => root.render(<Player3D />));
    expect(usePlaybackRuntimeStore.getState().phase).toBe("loading");
    expect(requestFrame).not.toHaveBeenCalled();

    await act(async () => {
      usePlaybackRuntimeStore.getState().dispatchMediaEvent({
        type: "playing",
        requestId,
        deckId: "deck-a",
        source: song.audioUrl ?? "",
      });
    });

    expect(requestFrame).toHaveBeenCalledOnce();
    expect(player3DTestState.getAudioAnalyser).not.toHaveBeenCalled();
    await act(async () => scheduledFrames.get(1)?.(16));
    expect(player3DTestState.getAudioAnalyser).toHaveBeenCalledOnce();
    expect(requestFrame).toHaveBeenCalledTimes(2);

    await act(async () => {
      usePlaybackRuntimeStore.getState().dispatchMediaEvent({
        type: "pause",
        requestId,
        deckId: "deck-a",
        source: song.audioUrl ?? "",
      });
    });

    expect(cancelFrame).toHaveBeenCalledWith(2);
  });

  it("stops the analyser loop while hidden and restarts exactly once when visible", async () => {
    const runtime = usePlaybackRuntimeStore.getState();
    const requestId = runtime.requestPlayback("track-a", song.audioUrl, true, true);
    runtime.bindActiveDeck(requestId, "track-a", "deck-a", song.audioUrl ?? "");
    runtime.dispatchMediaEvent({
      type: "playing",
      requestId,
      deckId: "deck-a",
      source: song.audioUrl ?? "",
    });

    let visibilityState: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState);

    const scheduledFrames = new Map<number, FrameRequestCallback>();
    const allFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        const frameId = nextFrameId++;
        scheduledFrames.set(frameId, callback);
        allFrames.set(frameId, callback);
        return frameId;
      });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      scheduledFrames.delete(frameId);
    });

    await act(async () => root.render(<Player3D />));
    expect(requestFrame).toHaveBeenCalledOnce();

    visibilityState = "hidden";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(cancelFrame).toHaveBeenCalledWith(1);
    expect(scheduledFrames.size).toBe(0);

    await act(async () => allFrames.get(1)?.(32));
    expect(player3DTestState.getAudioAnalyser).not.toHaveBeenCalled();
    expect(requestFrame).toHaveBeenCalledOnce();

    visibilityState = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(requestFrame).toHaveBeenCalledTimes(2);
    expect([...scheduledFrames.keys()]).toEqual([2]);

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(requestFrame).toHaveBeenCalledTimes(2);
    expect([...scheduledFrames.keys()]).toEqual([2]);
  });

  it("keeps the analyser loop off outside the player view and resumes on return", async () => {
    const runtime = usePlaybackRuntimeStore.getState();
    const requestId = runtime.requestPlayback("track-a", song.audioUrl, true, true);
    runtime.bindActiveDeck(requestId, "track-a", "deck-a", song.audioUrl ?? "");
    runtime.dispatchMediaEvent({
      type: "playing",
      requestId,
      deckId: "deck-a",
      source: song.audioUrl ?? "",
    });
    useUIStore.getState().setCurrentView("home");

    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.useFakeTimers();
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        const frameId = nextFrameId++;
        scheduledFrames.set(frameId, callback);
        return frameId;
      });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      scheduledFrames.delete(frameId);
    });

    try {
      await act(async () => root.render(<Player3D />));
      expect(usePlaybackRuntimeStore.getState().phase).toBe("playing");

      // Home 页停留 60s：循环从未排帧，analyser 一次都没被采样。
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(requestFrame).not.toHaveBeenCalled();
      expect(scheduledFrames.size).toBe(0);
      expect(player3DTestState.getAudioAnalyser).not.toHaveBeenCalled();

      // 切回播放页：effect 依赖翻转，同步排第一帧。
      await act(async () => {
        useUIStore.getState().setCurrentView("player");
      });
      expect(requestFrame).toHaveBeenCalledOnce();
      expect([...scheduledFrames.keys()]).toEqual([1]);

      // 第一帧立即采样并续排下一帧（执行后从待执行表移除，模拟真实 rAF）。
      await act(async () => {
        const frame = scheduledFrames.get(1);
        scheduledFrames.delete(1);
        frame?.(16);
      });
      expect(player3DTestState.getAudioAnalyser).toHaveBeenCalledOnce();
      expect(requestFrame).toHaveBeenCalledTimes(2);

      // 离开播放页：取消已排帧，回 Home 后 60s 也不再起新帧。
      await act(async () => {
        useUIStore.getState().setCurrentView("home");
      });
      expect(cancelFrame).toHaveBeenCalledWith(2);
      expect(scheduledFrames.size).toBe(0);

      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(requestFrame).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps audio-reactive motion stopped when reduced motion is preferred", async () => {
    player3DTestState.reducedMotion = true;
    const runtime = usePlaybackRuntimeStore.getState();
    const requestId = runtime.requestPlayback("track-a", song.audioUrl, true, true);
    runtime.bindActiveDeck(requestId, "track-a", "deck-a", song.audioUrl ?? "");
    usePlaybackRuntimeStore.getState().dispatchMediaEvent({
      type: "playing",
      requestId,
      deckId: "deck-a",
      source: song.audioUrl ?? "",
    });
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");

    await act(async () => root.render(<Player3D />));

    expect(requestFrame).not.toHaveBeenCalled();
  });

  it("keeps one analyser loop when a new cover enters", async () => {
    const runtime = usePlaybackRuntimeStore.getState();
    const requestId = runtime.requestPlayback("track-a", song.audioUrl, true, true);
    runtime.bindActiveDeck(requestId, "track-a", "deck-a", song.audioUrl ?? "");
    usePlaybackRuntimeStore.getState().dispatchMediaEvent({
      type: "playing",
      requestId,
      deckId: "deck-a",
      source: song.audioUrl ?? "",
    });
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    await act(async () => root.render(<Player3D />));
    expect(requestFrame).toHaveBeenCalledOnce();

    await act(async () => {
      useAudioStore.setState({
        currentSong: { ...song, id: "track-b", title: "Track B", audioUrl: "stored://track-b" },
      });
    });

    expect(requestFrame).toHaveBeenCalledOnce();
  });
});
