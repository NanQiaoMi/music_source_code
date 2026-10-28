/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueuePanel } from "./QueuePanel";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUIStore } from "@/store/uiStore";
import type { Song } from "@/types/song";

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
  default: ({
    fill: _fill,
    sizes: _sizes,
    unoptimized: _unoptimized,
    blurDataURL: _blurDataURL,
    placeholder: _placeholder,
    ...props
  }: any) => <img {...props} alt={props.alt || ""} />,
}));

const VIEWPORT_HEIGHT = 480;
// Must match QUEUE_ROW_HEIGHT in QueuePanel.tsx (66px row + 6px gap).
const QUEUE_ROW_HEIGHT = 72;

const makeQueue = (count: number): Song[] =>
  Array.from({ length: count }, (_, index) => ({
    id: "song-" + index,
    title: "Track " + index,
    artist: "Artist " + index,
    duration: 200,
    source: "local",
  }));

describe("QueuePanel", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let originalClientHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    // jsdom has no layout: pin the measured list height so windowing math is deterministic.
    originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => VIEWPORT_HEIGHT,
    });

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

    // S6-4: 身份字段由 playerStore 提供，audioStore 侧只是兼容投影
    usePlayerStore.getState().setCurrentSong({
      id: "song-1",
      title: "Midnight City",
      artist: "M83",
      duration: 240,
      source: "local",
    });
    useAudioStore.setState({ isPlaying: true });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
    vi.clearAllMocks();
  });

  const getVirtualList = (): HTMLElement => {
    const list = container.querySelector<HTMLElement>("[data-virtual-list]");
    expect(list).not.toBeNull();
    return list as HTMLElement;
  };

  const renderPanel = async (): Promise<void> => {
    await act(async () => {
      root.render(<QueuePanel isOpen={true} onClose={vi.fn()} />);
    });
  };

  const seedLongQueue = (count: number, currentIndex: number): Song[] => {
    const queue = makeQueue(count);
    useQueueStore.setState({ queue, currentIndex });
    usePlayerStore.getState().setCurrentSong(queue[currentIndex]);
    useAudioStore.setState({ isPlaying: true });
    return queue;
  };

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
    usePlayerStore.getState().setCurrentSong(activeSong);
    useAudioStore.setState({ isPlaying: true });

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

  it("renders a bounded DOM window for a 500-song queue", async () => {
    seedLongQueue(500, 0);

    await renderPanel();

    const rows = container.querySelectorAll("[data-queue-index]");
    // 480px / 72px = 7 viewport rows + 5 overscan; the other ~488 rows stay unmounted.
    expect(rows).toHaveLength(12);
    expect(rows.length).toBeLessThan(100);
    expect(container.textContent).toContain("Track 0");
    expect(container.textContent).not.toContain("Track 400");
  });

  it("renders the correct rows after scrolling a 500-song queue to the end", async () => {
    seedLongQueue(500, 0);
    await renderPanel();

    const list = getVirtualList();
    list.scrollTop = 499 * QUEUE_ROW_HEIGHT;
    await act(async () => {
      list.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(container.textContent).toContain("Track 499");
    expect(container.textContent).not.toContain("Track 0");

    const indices = Array.from(container.querySelectorAll("[data-queue-index]")).map((el) =>
      Number(el.getAttribute("data-queue-index"))
    );
    expect(indices).toContain(499);
    expect(Math.min(...indices)).toBeGreaterThan(480);
    expect(indices.length).toBeLessThan(100);
  });

  it("reveals and marks the current song deep inside a long queue", async () => {
    seedLongQueue(500, 320);

    await renderPanel();

    const currentRows = container.querySelectorAll('[aria-current="true"]');
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0].getAttribute("data-queue-index")).toBe("320");
    expect(container.textContent).toContain("Track 320");
    expect(container.textContent).not.toContain("Track 0");
  });

  it("plays the clicked row of a virtualized list by its original index", async () => {
    seedLongQueue(500, 0);
    await renderPanel();

    const row = container.querySelector('[data-queue-index="5"]');
    expect(row).not.toBeNull();
    await act(async () => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useQueueStore.getState().currentIndex).toBe(5);
    expect(useQueueStore.getState().queue).toHaveLength(500);
  });

  it("removes a virtualized row by its original queue index", async () => {
    seedLongQueue(500, 0);
    await renderPanel();

    const row = container.querySelector('[data-queue-index="6"]');
    expect(row).not.toBeNull();
    await act(async () => {
      row
        ?.querySelector<HTMLButtonElement>('[title="移出队列"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useQueueStore.getState().queue).toHaveLength(499);
    expect(useQueueStore.getState().queue[6].id).toBe("song-7");
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
