import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FloatingSpeedControl } from "./FloatingSpeedControl";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onMouseDown?: React.MouseEventHandler<HTMLElement>;
    className?: string;
    style?: React.CSSProperties;
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
  }: MotionProps) => <div {...props} />;

  const MotionButton = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    layoutId: _layoutId,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: MotionProps) => <button {...props} />;

  return {
    motion: {
      div: MotionDiv,
      button: MotionButton,
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <ReactModule.Fragment>{children}</ReactModule.Fragment>
    ),
  };
});

describe("FloatingSpeedControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useAudioStore.setState({ playbackRate: 1.0 });
    usePlayerStore.setState({ playbackRate: 1.0 });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("renders trigger button in collapsed state initially", () => {
    act(() => {
      root.render(<FloatingSpeedControl />);
    });

    const trigger = container.querySelector('[data-testid="floating-speed-trigger"]');
    expect(trigger).toBeTruthy();
    expect(container.querySelector('[data-testid="floating-speed-menu"]')).toBeNull();
  });

  it("expands speed menu when trigger button is clicked", () => {
    act(() => {
      root.render(<FloatingSpeedControl />);
    });

    const trigger = container.querySelector('[data-testid="floating-speed-trigger"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
      vi.advanceTimersByTime(300);
    });

    const menu = container.querySelector('[data-testid="floating-speed-menu"]');
    expect(menu).toBeTruthy();
    expect(container.textContent).toContain("播放速度");
    expect(container.textContent).toContain("1.00x");
  });

  it("switches speed when preset chip is clicked", () => {
    act(() => {
      root.render(<FloatingSpeedControl />);
    });

    const trigger = container.querySelector('[data-testid="floating-speed-trigger"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
      vi.advanceTimersByTime(300);
    });

    const chip125 = container.querySelector('[data-testid="speed-preset-1.25"]') as HTMLButtonElement;
    expect(chip125).toBeTruthy();

    act(() => {
      chip125.click();
    });

    expect(useAudioStore.getState().playbackRate).toBe(1.25);
    expect(usePlayerStore.getState().playbackRate).toBe(1.25);
  });

  it("shows reset button when custom speed is active and clicking resets to 1.0x", () => {
    useAudioStore.setState({ playbackRate: 1.5 });
    usePlayerStore.setState({ playbackRate: 1.5 });

    act(() => {
      root.render(<FloatingSpeedControl />);
    });

    const trigger = container.querySelector('[data-testid="floating-speed-trigger"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
      vi.advanceTimersByTime(300);
    });

    const resetButton = container.querySelector('[data-testid="speed-reset-button"]') as HTMLButtonElement;
    expect(resetButton).toBeTruthy();

    act(() => {
      resetButton.click();
    });

    expect(useAudioStore.getState().playbackRate).toBe(1.0);
    expect(usePlayerStore.getState().playbackRate).toBe(1.0);
  });

  it("closes the menu when clicking outside", () => {
    act(() => {
      root.render(<FloatingSpeedControl />);
    });

    const trigger = container.querySelector('[data-testid="floating-speed-trigger"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
      vi.advanceTimersByTime(300);
    });

    expect(container.querySelector('[data-testid="floating-speed-menu"]')).toBeTruthy();

    act(() => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="floating-speed-menu"]')).toBeNull();
  });
});
