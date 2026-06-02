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
    className?: string;
    style?: React.CSSProperties;
  } & Record<string, unknown>;

  const MotionElement = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: MotionProps) => React.createElement("div", props);

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
    'input[placeholder="Search songs, artists, albums..."]'
  ) as HTMLInputElement | null;
  expect(input).not.toBeNull();
  const button = input?.parentElement?.nextElementSibling;
  expect(button).toBeInstanceOf(HTMLButtonElement);
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

    await act(async () => {
      getVoiceButton(container).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Voice search is not supported in this browser.");
    expect(useSearchStore.getState().isVoiceSearch).toBe(false);
  });
});
