/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LxMusicSearchTab } from "./LxMusicSearchTab";
import { useDataManagerStore } from "@/store/useDataManagerStore";
import { useUserAccountStore } from "@/store/userAccountStore";

const searchOnlineMusicSegmentedMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
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
  })
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeSong(id: string, title: string) {
  return {
    id,
    title,
    artist: "测试歌手",
    album: "测试专辑",
    duration: 180,
    cover: "/default-cover.svg",
    source: "netease",
  };
}

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
    searchOnlineMusicSegmented: searchOnlineMusicSegmentedMock,
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

  it("shows the retry state when aggregate providers fail, then shows empty after an empty success", async () => {
    useDataManagerStore.setState({
      keyword: "aggregate-retry-query-983",
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });

    searchOnlineMusicSegmentedMock.mockReset();
    searchOnlineMusicSegmentedMock
      .mockRejectedValueOnce(new Error("all aggregate providers failed"))
      .mockResolvedValueOnce({ all: [] } as any);

    await act(async () => {
      root.render(<LxMusicSearchTab />);
    });

    await act(async () => {
      useUserAccountStore.setState({
        neteaseUser: { ...useUserAccountStore.getState().neteaseUser, loggedIn: true },
      });
    });
    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => {
      searchButton?.click();
    });

    expect(searchOnlineMusicSegmentedMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("搜索请求失败");

    const retryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("重试")
    );
    await act(async () => {
      retryButton?.click();
    });

    expect(searchOnlineMusicSegmentedMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
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

  it("ignores an older resolve after a newer keyword and source-tab search succeeds", async () => {
    const oldRequest = deferred<any>();
    const newRequest = deferred<any>();
    const oldQuery = "stale-resolve-old-query-101";
    const newQuery = "stale-resolve-new-query-101";

    useDataManagerStore.setState({
      keyword: oldQuery,
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    searchOnlineMusicSegmentedMock.mockReset().mockReturnValueOnce(oldRequest.promise);
    const fetchMock = vi.fn().mockReturnValueOnce(newRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<LxMusicSearchTab />));
    await act(async () => {
      useUserAccountStore.setState({ neteaseUser: { loggedIn: true } as any });
    });

    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => searchButton?.click());

    await act(async () => {
      useDataManagerStore.setState({ keyword: newQuery });
    });
    const neteaseTab = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("网易云")
    );
    await act(async () => neteaseTab?.click());

    await act(async () => {
      newRequest.resolve({
        ok: true,
        status: 200,
        json: async () => ({ songs: [makeSong("new-result", "新查询结果")] }),
      });
      await newRequest.promise;
    });
    expect(useDataManagerStore.getState().songResults.map((song) => song.id)).toEqual([
      "new-result",
    ]);

    await act(async () => {
      oldRequest.resolve({ all: [makeSong("old-result", "旧查询结果")] });
      await oldRequest.promise;
    });

    expect(useDataManagerStore.getState().songResults.map((song) => song.id)).toEqual([
      "new-result",
    ]);
    expect(container.textContent).toContain("新查询结果");
    expect(container.textContent).not.toContain("旧查询结果");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(newQuery)),
      expect.any(Object)
    );
  });

  it("ignores an older rejection after a newer keyword and mode search succeeds", async () => {
    const oldRequest = deferred<any>();
    const newRequest = deferred<any>();
    const newQuery = "stale-reject-new-query-102";

    useDataManagerStore.setState({
      keyword: "stale-reject-old-query-102",
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    searchOnlineMusicSegmentedMock.mockReset().mockReturnValueOnce(oldRequest.promise);
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(newRequest.promise));

    await act(async () => root.render(<LxMusicSearchTab />));
    await act(async () => {
      useUserAccountStore.setState({ neteaseUser: { loggedIn: true } as any });
    });

    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => searchButton?.click());
    await act(async () => {
      useDataManagerStore.setState({ keyword: newQuery });
    });
    const playlistModeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("歌单搜索")
    );
    await act(async () => playlistModeButton?.click());

    await act(async () => {
      newRequest.resolve({ ok: true, status: 200, json: async () => ({ playlists: [] }) });
      await newRequest.promise;
    });
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();

    await act(async () => {
      oldRequest.reject(new Error("stale request rejected"));
      await oldRequest.promise.catch(() => undefined);
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
    expect(useDataManagerStore.getState().searchMode).toBe("playlists");
  });

  it("keeps the loading state while the latest mode search is still pending", async () => {
    const oldRequest = deferred<any>();
    const newRequest = deferred<any>();

    useDataManagerStore.setState({
      keyword: "stale-finally-old-query-103",
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    searchOnlineMusicSegmentedMock.mockReset().mockReturnValueOnce(oldRequest.promise);
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(newRequest.promise));

    await act(async () => root.render(<LxMusicSearchTab />));
    await act(async () => {
      useUserAccountStore.setState({ neteaseUser: { loggedIn: true } as any });
    });

    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => searchButton?.click());
    const playlistModeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("歌单搜索")
    );
    await act(async () => playlistModeButton?.click());

    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();

    await act(async () => {
      oldRequest.resolve({ all: [makeSong("stale-result", "过期结果")] });
      await oldRequest.promise;
    });

    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();

    await act(async () => {
      newRequest.resolve({ ok: true, status: 200, json: async () => ({ playlists: [] }) });
      await newRequest.promise;
    });
    expect(container.querySelector('[data-state="loading"]')).toBeNull();
  });

  it("invalidates a pending request when the keyword input changes", async () => {
    const oldRequest = deferred<any>();
    useDataManagerStore.setState({
      keyword: "edit-keyword-old-query-104",
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    searchOnlineMusicSegmentedMock.mockReset().mockReturnValueOnce(oldRequest.promise);

    await act(async () => root.render(<LxMusicSearchTab />));
    await act(async () => {
      useUserAccountStore.setState({ neteaseUser: { loggedIn: true } as any });
    });
    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => searchButton?.click());

    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(input).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "edit-keyword-new-query-104");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      oldRequest.resolve({ all: [makeSong("edit-stale-result", "编辑前旧结果")] });
      await oldRequest.promise;
    });

    expect(useDataManagerStore.getState().keyword).toBe("edit-keyword-new-query-104");
    expect(useDataManagerStore.getState().songResults).toEqual([]);
    expect(container.textContent).not.toContain("编辑前旧结果");
  });

  it("invalidates a pending request when the clear-keyword control is used", async () => {
    const oldRequest = deferred<any>();
    useDataManagerStore.setState({
      keyword: "clear-keyword-old-query-105",
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    searchOnlineMusicSegmentedMock.mockReset().mockReturnValueOnce(oldRequest.promise);

    await act(async () => root.render(<LxMusicSearchTab />));
    await act(async () => {
      useUserAccountStore.setState({ neteaseUser: { loggedIn: true } as any });
    });
    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => searchButton?.click());

    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    const clearButton = input?.parentElement?.querySelectorAll("button")[0];
    expect(clearButton).toBeDefined();
    await act(async () => clearButton?.click());

    await act(async () => {
      oldRequest.resolve({ all: [makeSong("clear-stale-result", "清空前旧结果")] });
      await oldRequest.promise;
    });

    expect(useDataManagerStore.getState().keyword).toBe("");
    expect(useDataManagerStore.getState().songResults).toEqual([]);
    expect(container.textContent).not.toContain("清空前旧结果");
  });

  it("does not let an unmounted search instance overwrite results after remount", async () => {
    const oldRequest = deferred<any>();
    const newRequest = deferred<any>();
    useDataManagerStore.setState({
      keyword: "unmount-old-query-106",
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    searchOnlineMusicSegmentedMock
      .mockReset()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    await act(async () => root.render(<LxMusicSearchTab />));
    await act(async () => {
      useUserAccountStore.setState({ neteaseUser: { loggedIn: true } as any });
    });
    const firstSearchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => firstSearchButton?.click());
    await act(async () => root.unmount());

    useDataManagerStore.setState({
      keyword: "unmount-new-query-106",
      activeSourceTab: "all",
      searchMode: "songs",
      songResults: [],
      playlistResults: [],
    });
    useUserAccountStore.setState({ neteaseUser: { loggedIn: false } as any });
    root = createRoot(container);
    await act(async () => root.render(<LxMusicSearchTab />));
    await act(async () => {
      useUserAccountStore.setState({ neteaseUser: { loggedIn: true } as any });
    });
    const secondSearchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("检索")
    );
    await act(async () => secondSearchButton?.click());

    await act(async () => {
      oldRequest.resolve({ all: [makeSong("unmounted-stale", "卸载前旧结果")] });
      await oldRequest.promise;
    });
    expect(useDataManagerStore.getState().songResults).toEqual([]);
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();

    await act(async () => {
      newRequest.resolve({ all: [makeSong("remounted-current", "重新挂载新结果")] });
      await newRequest.promise;
    });

    expect(useDataManagerStore.getState().songResults.map((song) => song.id)).toEqual([
      "remounted-current",
    ]);
    expect(container.textContent).toContain("重新挂载新结果");
    expect(container.textContent).not.toContain("卸载前旧结果");
  });
});
