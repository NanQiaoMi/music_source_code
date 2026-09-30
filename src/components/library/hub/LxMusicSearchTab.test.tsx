/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LxMusicSearchTab } from "./LxMusicSearchTab";
import { useDataManagerStore } from "@/store/useDataManagerStore";
import { useUserAccountStore } from "@/store/userAccountStore";

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
    useDataManagerStore.setState(useDataManagerStore.getInitialState(), true);
    useUserAccountStore.setState(useUserAccountStore.getInitialState(), true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders search input and all source tabs correctly", async () => {
    await act(async () => {
      root.render(<LxMusicSearchTab />);
    });

    expect(container.textContent).toContain("全网聚合");
    expect(container.textContent).toContain("酷我音乐");
    expect(container.textContent).toContain("QQ 音乐");
    expect(container.textContent).toContain("网易云");
    expect(container.textContent).toContain("落雪母带");
    expect(container.textContent).toContain("歌曲搜索");
    expect(container.textContent).toContain("歌单搜索");
    expect(container.textContent).toContain("全网音乐搜索链路未开启");
  });

  it("shows a distinct request error and retries a rejected song search with the current query and platform", async () => {
    const query = "retry-song-query-981";
    useDataManagerStore.setState({
      keyword: query,
      activeSourceTab: "netease",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    useUserAccountStore.setState({ neteaseUser: { loggedIn: true } });

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ songs: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<LxMusicSearchTab />);
    });
    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => {
      searchButton?.click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("搜索请求失败");

    const retryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("重试")
    );
    await act(async () => {
      retryButton?.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain(encodeURIComponent(query));
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/search");
    expect(container.textContent).toContain("未检索到相关曲目");
  });

  it("treats non-OK playlist responses as errors and retries with the current query, platform, and mode", async () => {
    const query = "retry-playlist-query-982";
    useDataManagerStore.setState({
      keyword: query,
      activeSourceTab: "netease",
      searchMode: "playlists",
      songResults: [],
      playlistResults: [],
    });
    useUserAccountStore.setState({ neteaseUser: { loggedIn: true } });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ playlists: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<LxMusicSearchTab />);
    });
    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => {
      searchButton?.click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("搜索请求失败");

    const retryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("重试")
    );
    await act(async () => {
      retryButton?.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retriedUrl = String(fetchMock.mock.calls[1][0]);
    expect(retriedUrl).toContain("/api/playlist/search");
    expect(retriedUrl).toContain(encodeURIComponent(query));
    expect(retriedUrl).toContain("source=netease");
    expect(container.textContent).toContain("未检索到相关歌单");
  });

  it("keeps the account login action available when a source is locked", async () => {
    await act(async () => {
      root.render(<LxMusicSearchTab />);
    });

    const loginButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("立即登录账号开启链路")
    );
    await act(async () => {
      loginButton?.click();
    });

    expect(useUserAccountStore.getState().isAccountModalOpen).toBe(true);
  });
});
