import { act, Profiler } from "react";
import type { ProfilerOnRenderCallback, ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";

// 重组件在提交次数测试里只保留 DOM 语义：淡入动画与外链图片不参与 commit 计数。
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const cache = new Map<string, unknown>();
  const motion = new Proxy(
    {},
    {
      get(_target, tag: string) {
        if (!cache.has(tag)) {
          const Component = ({
            children,
            ...props
          }: { children?: React.ReactNode } & Record<string, unknown>) => {
            const clean: Record<string, unknown> = { ...props };
            for (const key of [
              "initial",
              "animate",
              "exit",
              "transition",
              "variants",
              "layout",
              "layoutId",
              "whileHover",
              "whileTap",
              "drag",
            ]) {
              delete clean[key];
            }
            return React.createElement(
              tag,
              clean as unknown as React.HTMLAttributes<HTMLElement>,
              children
            );
          };
          cache.set(tag, Component);
        }
        return cache.get(tag);
      },
    }
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
  };
});

vi.mock("next/image", () => ({
  default: ({ fill: _fill, ...props }: { fill?: boolean } & Record<string, unknown>) => (
    <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}));

// Provider 的清理副作用与本回归无关，避免真实 queue/stats 写入干扰 commit 计数。
vi.mock("@/hooks/useMusicLibrarySync", () => ({
  useMusicLibrarySync: () => ({ syncAllData: vi.fn(), hasInvalidData: () => false }),
}));

import { MusicLibrarySyncProvider } from "@/components/library/MusicLibrarySyncProvider";
import { CloudAssetsTab } from "@/components/library/hub/CloudAssetsTab";
import { SearchPanel } from "@/components/player/SearchPanel";
import { usePlaylistStore } from "@/store/playlistStore";

const initialPlaylistState = usePlaylistStore.getInitialState();
const song: Song = { id: "s3-8", title: "Selector", artist: "S3", duration: 200, source: "local" };

function createCommitCounter() {
  let updates = 0;
  const onRender: ProfilerOnRenderCallback = (_id, phase) => {
    if (phase === "update") updates += 1;
  };
  return {
    onRender,
    reset: () => {
      updates = 0;
    },
    updates: () => updates,
  };
}

const consumers: Array<[string, () => ReactElement]> = [
  ["MusicLibrarySyncProvider", () => <MusicLibrarySyncProvider />],
  ["SearchPanel", () => <SearchPanel isOpen={false} onClose={() => undefined} />],
  ["CloudAssetsTab", () => <CloudAssetsTab />],
];

describe("playlistStore narrow subscriptions", () => {
  let container: HTMLDivElement;
  let root: Root;
  const counter = createCommitCounter();

  beforeEach(() => {
    usePlaylistStore.setState(initialPlaylistState, true);
    counter.reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    usePlaylistStore.setState(initialPlaylistState, true);
  });

  async function mount(node: ReactElement) {
    await act(async () => {
      root.render(
        <Profiler id="playlist-consumer" onRender={counter.onRender}>
          {node}
        </Profiler>
      );
    });
    await act(async () => {});
    counter.reset();
  }

  it.each(consumers)("%s ignores unrelated playlist fields", async (_name, make) => {
    await mount(make());

    await act(async () => {
      usePlaylistStore.setState({
        selectedSong: song,
        searchQuery: "selector",
        selectedSongIds: new Set([song.id]),
      });
    });

    expect(counter.updates()).toBe(0);
  });

  it.each(consumers)("%s commits when the songs slice changes", async (_name, make) => {
    await mount(make());

    await act(async () => {
      usePlaylistStore.setState({ songs: [song], filteredSongs: [song] });
    });

    expect(counter.updates()).toBeGreaterThan(0);
  });
});
