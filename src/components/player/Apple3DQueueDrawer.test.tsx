import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Apple3DQueueDrawer } from "./Apple3DQueueDrawer";
import { useUIStore } from "@/store/uiStore";
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

describe("Apple3DQueueDrawer", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useUIStore.setState({
      panels: {
        queue: false,
        shelf3D: false,
      } as any,
    });

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

  it("renders the smart right edge handle when closed on desktop", async () => {
    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    const handle = container.querySelector('[title*="点击或停驻呼出播放列表"]');
    expect(handle).not.toBeNull();
  });

  it("opens the drawer when clicking the handle", async () => {
    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    const handle = container.querySelector('[title*="点击或停驻呼出播放列表"]');
    expect(handle).not.toBeNull();

    await act(async () => {
      handle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useUIStore.getState().panels.queue).toBe(true);
  });

  it("renders the 2D queue list with songs when opened", async () => {
    useUIStore.setState({
      panels: { queue: true, shelf3D: false } as any,
    });

    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    expect(container.textContent).toContain("播放队列");
    expect(container.textContent).toContain("Midnight City");
    expect(container.textContent).toContain("Starboy");
  });

  it("switches to 3D Space Shelf view mode when clicking 3D toggle", async () => {
    useUIStore.setState({
      panels: { queue: true, shelf3D: false } as any,
    });

    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const btn3D = buttons.find((b) => b.textContent?.includes("3D"));
    expect(btn3D).toBeDefined();

    await act(async () => {
      btn3D?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="shelf3d-view"]')).not.toBeNull();
  });

  it("toggles the drawer when pressing Q shortcut", async () => {
    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
    });

    expect(useUIStore.getState().panels.queue).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
    });

    expect(useUIStore.getState().panels.queue).toBe(false);
  });

  it("closes the drawer when pressing Escape", async () => {
    useUIStore.setState({
      panels: { queue: true, shelf3D: false } as any,
    });

    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(useUIStore.getState().panels.queue).toBe(false);
    expect(useUIStore.getState().panels.shelf3D).toBe(false);
  });
});
