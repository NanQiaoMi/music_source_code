/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueuePanel } from "./QueuePanel";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";

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

vi.mock("next/image", () => ({
  default: ({ fill: _fill, sizes: _sizes, unoptimized: _unoptimized, ...props }: any) => (
    <img {...props} alt={props.alt || ""} />
  ),
}));

describe("QueuePanel", () => {
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
      currentSong: {
        id: "song-1",
        title: "Midnight City",
        artist: "M83",
        duration: 240,
        source: "local",
      },
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

  it("renders pure queue list with total duration when isOpen is true", async () => {
    await act(async () => {
      root.render(<QueuePanel isOpen={true} onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain("播放队列");
    expect(container.textContent).toContain("2 首");
    expect(container.textContent).toContain("Midnight City");
    expect(container.textContent).toContain("Starboy");
  });

  it("marks and removes one duplicate queue occurrence by its index", async () => {
    const activeSong = {
      id: "repeated-song",
      title: "Repeated Track",
      artist: "M83",
      duration: 240,
      source: "local",
    };
    useQueueStore.setState({
      queue: [
        activeSong,
        { id: "song-2", title: "Starboy", artist: "The Weeknd", duration: 230, source: "netease" },
        { ...activeSong, title: "Repeated Track (queued again)" },
      ],
      currentIndex: 2,
    });
    useAudioStore.setState({ currentSong: activeSong, isPlaying: true });

    await act(async () => root.render(<QueuePanel isOpen={true} onClose={vi.fn()} />));

    const currentRows = container.querySelectorAll('[aria-current="true"]');
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0].getAttribute("data-queue-index")).toBe("2");

    const firstDuplicateRow = container.querySelector('[data-queue-index="0"]');
    await act(async () => {
      firstDuplicateRow
        ?.querySelector<HTMLButtonElement>('[title="移出队列"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useQueueStore.getState().queue.map((song) => song.id)).toEqual([
      "song-2",
      "repeated-song",
    ]);
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it("opens full-screen shelf3D panel when clicking 3D button", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<QueuePanel isOpen={true} onClose={onClose} />);
    });

    const btn3D = container.querySelector('[title*="进入全屏 Mineradio 3D 空间唱片架"]');
    expect(btn3D).not.toBeNull();

    await act(async () => {
      btn3D?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();
    expect(useUIStore.getState().panels.shelf3D).toBe(true);
  });

  it("filters songs when searching in the queue", async () => {
    await act(async () => {
      root.render(<QueuePanel isOpen={true} onClose={vi.fn()} />);
    });

    const searchBtn = container.querySelector('[title*="过滤队列曲目"]');
    expect(searchBtn).not.toBeNull();

    await act(async () => {
      searchBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const searchInput = container.querySelector(
      'input[placeholder*="在队列中搜索"]'
    ) as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      searchInput.value = "Starboy";
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // After filtering, Starboy should be in the list
    expect(container.textContent).toContain("Starboy");
  });

  it("calls onClose when clicking close button", async () => {
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
