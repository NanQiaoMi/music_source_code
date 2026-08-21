import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueuePanel } from "./QueuePanel";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, ...props }: any) => React.createElement(prop, props, children);
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/library/Shelf3DView", () => ({
  Shelf3DView: () => <div data-testid="shelf3d-view">3D Shelf View</div>,
}));

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} alt={props.alt || ""} />,
}));

describe("QueuePanel", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useQueueStore.setState({
      queue: [
        { id: "song-1", title: "Midnight City", artist: "M83", duration: 240, source: "local" },
        { id: "song-2", title: "Starboy", artist: "The Weeknd", duration: 230, source: "netease" },
      ],
      currentIndex: 0,
    });

    useAudioStore.setState({
      currentSong: { id: "song-1", title: "Midnight City", artist: "M83", duration: 240, source: "local" },
      isPlaying: true,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", async () => {
    await act(async () => {
      root.render(<QueuePanel isOpen={false} onClose={vi.fn()} />);
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders pure queue list and song items when isOpen is true", async () => {
    await act(async () => {
      root.render(<QueuePanel isOpen={true} onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain("播放队列");
    expect(container.textContent).toContain("Midnight City");
    expect(container.textContent).toContain("Starboy");
  });

  it("switches to 3D mode when clicking 3D toggle button", async () => {
    await act(async () => {
      root.render(<QueuePanel isOpen={true} onClose={vi.fn()} />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const btn3D = buttons.find((b) => b.textContent?.includes("3D"));
    expect(btn3D).toBeDefined();

    await act(async () => {
      btn3D?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="shelf3d-view"]')).not.toBeNull();
  });

  it("calls onClose when clicking close button or Escape", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<QueuePanel isOpen={true} onClose={onClose} />);
    });

    const closeBtn = container.querySelector('[title*="收起播放列表"]');
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();
  });
});
