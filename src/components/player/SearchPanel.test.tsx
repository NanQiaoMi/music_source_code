import { act } from "react";
import type { ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "@/store/searchStore";

const mocks = vi.hoisted(() => ({
  playSong: vi.fn(),
  playQueue: vi.fn(),
  addToQueue: vi.fn(),
  insertNext: vi.fn(),
  clearQueue: vi.fn(),
  shuffleQueue: vi.fn(),
  setIsPlaying: vi.fn(),
  nextSong: vi.fn(),
  prevSong: vi.fn(),
  setVolume: vi.fn(),
  setSleepTimer: vi.fn(),
}));

type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
};

vi.mock("next/image", () => ({
  default: ({ fill: _fill, ...props }: MockImageProps) => <img {...props} />,
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    className?: string;
    style?: React.CSSProperties;
  } & Record<string, unknown>;

  const MotionElement = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      exit?: unknown;
      initial?: unknown;
      transition?: unknown;
      whileHover?: unknown;
      whileTap?: unknown;
    }
  >(
    (
      {
        animate: _animate,
        exit: _exit,
        initial: _initial,
        transition: _transition,
        whileHover: _whileHover,
        whileTap: _whileTap,
        onMouseLeave,
        onPointerLeave,
        ...props
      },
      forwardedRef
    ) => {
      const localRef = React.useRef<HTMLDivElement | null>(null);
      const setRefs = React.useCallback(
        (node: HTMLDivElement | null) => {
          localRef.current = node;
          if (typeof forwardedRef === "function") {
            forwardedRef(node);
          } else if (forwardedRef) {
            (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
        },
        [forwardedRef]
      );

      React.useEffect(() => {
        const el = localRef.current;
        if (!el) return;
        const leaveHandler = (e: MouseEvent) => {
          if (typeof onMouseLeave === "function") {
            (onMouseLeave as unknown as (e: React.MouseEvent<HTMLElement>) => void)(
              e as unknown as React.MouseEvent<HTMLElement>
            );
          }
        };
        el.addEventListener("mouseleave", leaveHandler);
        return () => el.removeEventListener("mouseleave", leaveHandler);
      }, [onMouseLeave]);

      return (
        <div ref={setRefs} onMouseLeave={onMouseLeave} onPointerLeave={onPointerLeave} {...props} />
      );
    }
  );

  MotionElement.displayName = "MotionElement";

  const MotionButton = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: MotionProps) => React.createElement("button", props);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: {
      button: MotionButton,
      div: MotionElement,
    },
  };
});

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: (selector: (state: { songs: never[] }) => unknown) => selector({ songs: [] }),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: typeof mocks) => unknown) => selector(mocks),
}));

vi.mock("@/store/queueStore", () => ({
  useQueueStore: (selector: (state: typeof mocks) => unknown) => selector(mocks),
}));

vi.mock("@/store/sleepTimerStore", () => ({
  useSleepTimerStore: (selector: (state: { setTimer: typeof mocks.setSleepTimer }) => unknown) =>
    selector({ setTimer: mocks.setSleepTimer }),
}));

function removeSpeechRecognition() {
  const speechWindow = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  delete speechWindow.SpeechRecognition;
  delete speechWindow.webkitSpeechRecognition;
}

function _getVoiceButton(container: HTMLElement) {
  const input = container.querySelector(
    'input[placeholder="搜索歌曲、歌手、专辑..."]'
  ) as HTMLInputElement | null;
  expect(input).not.toBeNull();
  const button =
    input?.parentElement?.querySelector('button[title*="语音"]') ??
    input?.parentElement?.nextElementSibling;
  return button as HTMLButtonElement;
}

const SEARCH_VIEWPORT_HEIGHT = 480;
// Must match SEARCH_RESULT_ROW_HEIGHT in SearchPanel.tsx (48px row + 4px gap).
const SEARCH_ROW_HEIGHT = 52;

const makeResults = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: "song-" + index,
    title: "Track " + index,
    artist: "Artist " + index,
    duration: 200,
    source: "local" as const,
  }));

describe("SearchPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalClientHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    // jsdom has no layout: pin the measured list height so windowing math is deterministic.
    originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => SEARCH_VIEWPORT_HEIGHT,
    });
    removeSpeechRecognition();
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    useSearchStore.setState(useSearchStore.getInitialState(), true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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
    vi.restoreAllMocks();
  });

  it("shows visible feedback when voice search is unsupported", async () => {
    const { SearchPanel } = await import("./SearchPanel");

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={() => undefined} />);
    });

    const voiceBtn = container.querySelector('button[title*="语音搜索"]');
    expect(voiceBtn).not.toBeNull();

    await act(async () => {
      voiceBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(container.textContent).toContain("当前浏览器不支持语音搜索。");
    expect(useSearchStore.getState().isVoiceSearch).toBe(false);
  });

  it("renders compact Dynamic Island search pill when open and closes on Escape key", async () => {
    const { SearchPanel } = await import("./SearchPanel");
    const onClose = vi.fn();

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={onClose} />);
    });

    const drawer = container.querySelector('[data-testid="top-search-drawer"]');
    expect(drawer).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("auto-closes immediately on mouse leave when query is empty", async () => {
    const { SearchPanel } = await import("./SearchPanel");
    const onClose = vi.fn();

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={onClose} />);
    });

    const drawer = container.querySelector('[data-testid="top-search-drawer"]');
    expect(drawer).not.toBeNull();

    await act(async () => {
      drawer?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not auto-close on mouse leave when query is non-empty", async () => {
    const { SearchPanel } = await import("./SearchPanel");
    const onClose = vi.fn();

    useSearchStore.setState({ query: "Jay Chou" });

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={onClose} />);
    });

    const drawer = container.querySelector('[data-testid="top-search-drawer"]');
    expect(drawer).not.toBeNull();

    await act(async () => {
      drawer?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders result covers through CoverImage with lazy async loading", async () => {
    useSearchStore.setState({
      query: "Jay",
      results: [
        {
          id: "song-1",
          title: "晴天",
          artist: "周杰伦",
          duration: 269,
          cover: "https://example.com/qingtian.jpg",
          source: "netease",
        },
      ],
      totalResults: 1,
    });

    const { SearchPanel } = await import("./SearchPanel");

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={() => undefined} />);
    });

    const cover = container.querySelector('img[alt="晴天"]');
    expect(cover).not.toBeNull();
    expect(cover?.getAttribute("src")).toBe("https://example.com/qingtian.jpg");
    expect(cover?.getAttribute("loading")).toBe("lazy");
    expect(cover?.getAttribute("decoding")).toBe("async");
    expect(cover?.getAttribute("sizes")).toBe("36px");
  });

  it("renders a bounded DOM window for 500 search results", async () => {
    useSearchStore.setState({ query: "Track", results: makeResults(500), totalResults: 500 });
    const { SearchPanel } = await import("./SearchPanel");

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={() => undefined} />);
    });

    const rows = container.querySelectorAll("[data-search-index]");
    // 480px / 52px = 10 viewport rows + 5 overscan; the other ~485 rows stay unmounted.
    expect(rows).toHaveLength(15);
    expect(rows.length).toBeLessThan(100);
    expect(container.textContent).toContain("Track 0");
    expect(container.textContent).not.toContain("Track 400");
  });

  it("renders the correct rows after scrolling 500 results to the end", async () => {
    useSearchStore.setState({ query: "Track", results: makeResults(500), totalResults: 500 });
    const { SearchPanel } = await import("./SearchPanel");

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={() => undefined} />);
    });

    const list = container.querySelector<HTMLElement>("[data-virtual-list]");
    expect(list).not.toBeNull();
    list!.scrollTop = 499 * SEARCH_ROW_HEIGHT;
    await act(async () => {
      list!.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(container.textContent).toContain("Track 499");
    expect(container.textContent).not.toContain("Track 0");

    const indices = Array.from(container.querySelectorAll("[data-search-index]")).map((el) =>
      Number(el.getAttribute("data-search-index"))
    );
    expect(indices).toContain(499);
    expect(Math.min(...indices)).toBeGreaterThan(480);
    expect(indices.length).toBeLessThan(100);
  });

  it("plays the clicked row of a virtualized result list by its original index", async () => {
    const results = makeResults(500);
    const onClose = vi.fn();
    useSearchStore.setState({ query: "Track", results, totalResults: 500 });
    const { SearchPanel } = await import("./SearchPanel");

    await act(async () => {
      root.render(<SearchPanel isOpen={true} onClose={onClose} />);
    });

    const row = container.querySelector('[data-search-index="5"]');
    expect(row).not.toBeNull();
    await act(async () => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mocks.playQueue).toHaveBeenCalledTimes(1);
    const [playedList, playedIndex] = mocks.playQueue.mock.calls[0];
    expect(playedList).toHaveLength(500);
    expect(playedIndex).toBe(5);
    expect(playedList[5].id).toBe("song-5");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
