import React, { act, useEffect } from "react";
import type { ImgHTMLAttributes } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useFloatingDragPhysics,
  FLOATING_SPRING_CONFIG,
  type UseFloatingDragPhysicsReturn,
  type UseFloatingDragPhysicsOptions,
} from "./useFloatingDragPhysics";
import { FloatingDockState } from "./FloatingDockState";
import { useAudioStore } from "@/store/audioStore";

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

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    motion: {
      button: MotionButton,
      div: MotionDiv,
      span: MotionSpan,
    },
  };
});

describe("useFloatingDragPhysics", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function TestHookComponent({
    options,
    onReady,
  }: {
    options?: UseFloatingDragPhysicsOptions;
    onReady: (hook: UseFloatingDragPhysicsReturn) => void;
  }) {
    const hook = useFloatingDragPhysics(options);
    useEffect(() => {
      onReady(hook);
    });
    return <div data-testid="physics-harness" />;
  }

  it("initializes with default options and exported spring configuration", async () => {
    let hookResult!: UseFloatingDragPhysicsReturn;

    await act(async () => {
      root.render(
        <TestHookComponent
          onReady={(res) => {
            hookResult = res;
          }}
        />
      );
    });

    expect(hookResult.playerState).toBe("pill");
    expect(hookResult.position).toEqual({ x: 24, y: 300 });
    expect(hookResult.isDragging).toBe(false);
    expect(hookResult.isAnimating).toBe(false);
    expect(hookResult.isDocked).toBe(false);
    expect(FLOATING_SPRING_CONFIG.type).toBe("spring");
    expect(FLOATING_SPRING_CONFIG.stiffness).toBe(380);
  });

  it("clamps position within viewport safety boundaries", async () => {
    let hookResult!: UseFloatingDragPhysicsReturn;

    await act(async () => {
      root.render(
        <TestHookComponent
          options={{
            safePadding: 20,
            pillDimensions: { width: 300, height: 80 },
          }}
          onReady={(res) => {
            hookResult = res;
          }}
        />
      );
    });

    const clamped = hookResult.clampPosition({ x: -50, y: -100 }, "pill");
    expect(clamped.x).toBe(20);
    expect(clamped.y).toBe(20);
  });

  it("snaps to dock-left and dock-right properly", async () => {
    let hookResult!: UseFloatingDragPhysicsReturn;

    await act(async () => {
      root.render(
        <TestHookComponent
          onReady={(res) => {
            hookResult = res;
          }}
        />
      );
    });

    await act(async () => {
      hookResult.snapToDock("left");
    });
    expect(hookResult.playerState).toBe("dock-left");
    expect(hookResult.isDocked).toBe(true);
    expect(hookResult.position.x).toBe(0);

    await act(async () => {
      hookResult.snapToDock("right");
    });
    expect(hookResult.playerState).toBe("dock-right");
    expect(hookResult.isDocked).toBe(true);
  });

  it("restores to pill view from dock state", async () => {
    let hookResult!: UseFloatingDragPhysicsReturn;

    await act(async () => {
      root.render(
        <TestHookComponent
          options={{
            initialState: "dock-left",
          }}
          onReady={(res) => {
            hookResult = res;
          }}
        />
      );
    });

    expect(hookResult.isDocked).toBe(true);

    await act(async () => {
      hookResult.restoreFromDock("pill");
    });

    expect(hookResult.playerState).toBe("pill");
    expect(hookResult.isDocked).toBe(false);
    expect(hookResult.position.x).toBeGreaterThan(0);
  });
});

describe("FloatingDockState", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useAudioStore.setState({
      isPlaying: true,
      currentSong: {
        id: "song-1",
        title: "Cyber City Vibes",
        artist: "MIMI Artist",
        album: "Future Beats",
        cover: "/test-cover.jpg",
        audioUrl: "/test.mp3",
        duration: 200,
        source: "local",
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders left dock crescent state properly and handles click restore", async () => {
    const onRestore = vi.fn();

    await act(async () => {
      root.render(<FloatingDockState side="dock-left" onRestore={onRestore} />);
    });

    const dockNode = container.querySelector('[data-dock-side="dock-left"]');
    expect(dockNode).not.toBeNull();
    expect(container.innerHTML).toContain("rounded-r-full");

    await act(async () => {
      dockNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRestore).toHaveBeenCalledWith("pill");
  });

  it("renders right dock crescent state properly", async () => {
    const onRestore = vi.fn();

    await act(async () => {
      root.render(<FloatingDockState side="dock-right" onRestore={onRestore} />);
    });

    const dockNode = container.querySelector('[data-dock-side="dock-right"]');
    expect(dockNode).not.toBeNull();
    expect(container.innerHTML).toContain("rounded-l-full");
  });
});
