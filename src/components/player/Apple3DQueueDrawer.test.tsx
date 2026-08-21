import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Apple3DQueueDrawer } from "./Apple3DQueueDrawer";
import { useUIStore } from "@/store/uiStore";
import { useQueueStore } from "@/store/queueStore";

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

    const handle = container.querySelector('[title*="点击或停驻呼出 3D 空间唱片架"]');
    expect(handle).not.toBeNull();
  });

  it("directly opens the 3D shelf when clicking the handle", async () => {
    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    const handle = container.querySelector('[title*="点击或停驻呼出 3D 空间唱片架"]');
    expect(handle).not.toBeNull();

    await act(async () => {
      handle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useUIStore.getState().panels.shelf3D).toBe(true);
  });

  it("toggles the 3D shelf when pressing Q shortcut", async () => {
    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
    });

    expect(useUIStore.getState().panels.shelf3D).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
    });

    expect(useUIStore.getState().panels.shelf3D).toBe(false);
  });

  it("closes the 3D shelf when pressing Escape", async () => {
    useUIStore.setState({
      panels: { queue: false, shelf3D: true } as any,
    });

    await act(async () => {
      root.render(<Apple3DQueueDrawer />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(useUIStore.getState().panels.shelf3D).toBe(false);
  });
});
