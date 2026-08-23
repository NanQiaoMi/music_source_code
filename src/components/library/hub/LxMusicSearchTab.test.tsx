import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LxMusicSearchTab } from "./LxMusicSearchTab";

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

vi.mock("@/store/audioStore", () => ({
  useAudioStore: () => ({
    playSong: vi.fn(),
    playQueue: vi.fn(),
  }),
}));

vi.mock("@/store/queueStore", () => ({
  useQueueStore: () => ({
    addToQueue: vi.fn(),
    insertNext: vi.fn(),
  }),
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: () => ({
    addSong: vi.fn(),
    importSongs: vi.fn(),
  }),
}));

vi.mock("@/store/useOfflineDownloadStore", () => ({
  useOfflineDownloadStore: () => ({
    addBatchDownloads: vi.fn(),
    isSongOffline: () => false,
    offlineRecords: [],
    offlineSongIds: new Set(),
  }),
}));

vi.mock("@/services/MultiSourceResolver", () => ({
  multiSourceResolver: {
    searchOnlineMusicSegmented: vi.fn().mockResolvedValue({
      all: [
        {
          id: "song-1",
          title: "晴天",
          artist: "周杰伦",
          album: "叶惠美",
          duration: 269,
          cover: "/default-cover.svg",
          source: "kuwo",
        },
      ],
    }),
  },
}));

vi.mock("@/lib/sources/lxRunner", () => ({
  LXRunner: {
    search: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/store/sourceConfigStore", () => {
  const fn: any = () => ({
    lxScripts: [],
    openManagementModal: vi.fn(),
  });
  fn.getState = () => ({
    lxScripts: [],
    openManagementModal: vi.fn(),
  });
  return {
    useSourceConfigStore: fn,
  };
});

describe("LxMusicSearchTab", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders search input and all source tabs correctly", async () => {
    await act(async () => {
      root.render(<LxMusicSearchTab />);
    });

    expect(container.textContent).toContain("聚合大会");
    expect(container.textContent).toContain("酷我音乐");
    expect(container.textContent).toContain("QQ 音乐");
    expect(container.textContent).toContain("网易云");
    expect(container.textContent).toContain("落雪母带");
    expect(container.textContent).toContain("歌曲搜索");
    expect(container.textContent).toContain("歌单搜索");
  });
});
