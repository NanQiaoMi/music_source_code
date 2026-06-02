import { act } from "react";
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";
import type { Song } from "@/types/song";
type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

type MockLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string | { toString(): string };
  children?: ReactNode;
};

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: MockImageProps) => <img {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: MockLinkProps) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLElement>;
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
      div: MotionDiv,
    },
  };
});

const playlistInitialState = usePlaylistStore.getInitialState();
const audioInitialState = useAudioStore.getInitialState();
const playerInitialState = usePlayerStore.getInitialState();
const queueInitialState = useQueueStore.getInitialState();
const uiInitialState = useUIStore.getInitialState();

function demoSong(): Song {
  return {
    id: "demo-empty",
    title: "Import Your Music",
    artist: "MIMI Demo",
    album: "Getting Started",
    cover: "/default-cover.svg",
    audioUrl: "",
    duration: 180,
    source: "demo",
  };
}

describe("MusicCardStack", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    usePlaylistStore.setState(playlistInitialState, true);
    useAudioStore.setState(audioInitialState, true);
    usePlayerStore.setState(playerInitialState, true);
    useQueueStore.setState(queueInitialState, true);
    useUIStore.setState(uiInitialState, true);
    usePlaylistStore.setState({ songs: [demoSong()], filteredSongs: [demoSong()] });
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

  it("keeps empty demo tracks out of playback and queue when clicked", async () => {
    const { MusicCardStack } = await import("./MusicCardStack");

    await act(async () => {
      root.render(<MusicCardStack />);
    });

    const title = Array.from(container.querySelectorAll("h3")).find((node) =>
      node.textContent?.includes("Import Your Music")
    );

    await act(async () => {
      title?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useUIStore.getState().currentView).toBe("home");
    expect(useAudioStore.getState().currentSong).toBeNull();
    expect(usePlayerStore.getState().currentSong).toBeNull();
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(useQueueStore.getState().queue).toEqual([]);
    expect(useUIStore.getState().toasts.at(-1)).toMatchObject({
      type: "warning",
      message: "这首示例歌曲没有音频文件，请先到数据管理页导入本地音乐。",
    });
  });
});
