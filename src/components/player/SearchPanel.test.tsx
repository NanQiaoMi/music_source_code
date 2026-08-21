import { act } from "react";
import type { ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "@/store/searchStore";

const mocks = vi.hoisted(() => ({
  playSong: vi.fn(),
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
            (onMouseLeave as unknown as (e: React.MouseEvent<HTMLElement>) => void)(e as unknown as React.MouseEvent<HTMLElement>);
          }
        };
        el.addEventListener("mouseleave", leaveHandler);
        return () => el.removeEventListener("mouseleave", leaveHandler);
      }, [onMouseLeave]);

      return (
        <div
          ref={setRefs}
          onMouseLeave={onMouseLeave}
          onPointerLeave={onPointerLeave}
          {...props}
        />
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
  usePlaylistStore: () => ({ songs: [] }),
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

function getVoiceButton(container: HTMLElement) {
  const input = container.querySelector(
    'input[placeholder="搜索歌曲、歌手、专辑..."]'
  ) as HTMLInputElement | null;
  expect(input).not.toBeNull();
  const button = input?.parentElement?.querySelector('button[title*="语音"]') ?? input?.parentElement?.nextElementSibling;
  return button as HTMLButtonElement;
}

describe("SearchPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
});
