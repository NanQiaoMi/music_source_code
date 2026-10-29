/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { UnifiedDataManagerHub } from "./UnifiedDataManagerHub";
import { usePanelStore } from "@/store/panelStore";
import { useUiShellStore } from "@/store/uiShellStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useDataManagerStore } from "@/store/useDataManagerStore";

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
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

vi.mock("./hub/LxMusicSearchTab", () => ({
  LxMusicSearchTab: () => <div data-testid="lx-search-tab">LxMusicSearchTab Mock</div>,
}));
vi.mock("./hub/DataDashboardTab", () => ({
  DataDashboardTab: () => <div data-testid="dashboard-tab">DataDashboardTab Mock</div>,
}));
vi.mock("./hub/CloudAssetsTab", () => ({
  CloudAssetsTab: () => <div data-testid="cloud-tab">CloudAssetsTab Mock</div>,
}));
vi.mock("./hub/OfflineDownloadsTab", () => ({
  OfflineDownloadsTab: () => <div data-testid="downloads-tab">OfflineDownloadsTab Mock</div>,
}));
vi.mock("./hub/PlaylistHubTab", () => ({
  PlaylistHubTab: () => <div data-testid="playlist-tab">PlaylistHubTab Mock</div>,
}));
vi.mock("./hub/HealthStorageTab", () => ({
  HealthStorageTab: () => <div data-testid="health-tab">HealthStorageTab Mock</div>,
}));
vi.mock("./LocalMusicManager", () => ({
  LocalMusicManager: () => <div data-testid="local-tab">LocalMusicManager Mock</div>,
}));

// Mock Canvas 2D
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  save: vi.fn(),
  restore: vi.fn(),
  clip: vi.fn(),
  fillRect: vi.fn(),
});

describe("UnifiedDataManagerHub", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useUiShellStore.setState({ currentView: "home" });
    usePanelStore.getState().closeAllPanels();
    usePanelStore.getState().openPanel("dataManager");

    usePlaylistStore.setState({
      songs: [
        { id: "song-1", title: "晴天", artist: "周杰伦", duration: 269, source: "netease" },
        { id: "song-2", title: "七里香", artist: "周杰伦", duration: 299, source: "local" },
      ],
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders all 6 top tabs and master title", async () => {
    await act(async () => {
      root.render(<UnifiedDataManagerHub initialTab="dashboard" />);
    });

    expect(container.textContent).toContain("资料库资产管理中枢");
    expect(container.textContent).toContain("全景看板");
    expect(container.textContent).toContain("全网聚搜");
    expect(container.textContent).toContain("云端曲库");
    expect(container.textContent).toContain("离线下载");
    expect(container.textContent).toContain("歌单编排");
    expect(container.textContent).toContain("本地导入");
    expect(container.textContent).toContain("存储体检");
  });

  it("renders a persisted active tab after store hydration", async () => {
    await act(async () => {
      root.render(<UnifiedDataManagerHub initialTab="dashboard" />);
    });

    await act(async () => {
      useDataManagerStore.getState().setActiveHubTab("lx_search");
    });

    const searchTab = container.querySelector('[data-testid="lx-search-tab"]');
    expect(searchTab).not.toBeNull();
    expect(searchTab?.parentElement?.className).toContain("block opacity-100");

    const dashboardButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("全景看板")
    );
    expect(dashboardButton).toBeDefined();
    await act(async () => dashboardButton?.click());
    expect(container.querySelector('[data-testid="lx-search-tab"]')).toBe(searchTab);
    expect(searchTab?.parentElement?.className).toContain("hidden opacity-0");

    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("全网聚搜")
    );
    expect(searchButton).toBeDefined();
    await act(async () => searchButton?.click());
    expect(container.querySelector('[data-testid="lx-search-tab"]')).toBe(searchTab);
    expect(searchTab?.parentElement?.className).toContain("block opacity-100");
  });

  it("uses one width-safe 1720px workspace and preserves the 1400px navigation handoff", async () => {
    await act(async () => {
      root.render(<UnifiedDataManagerHub initialTab="dashboard" />);
    });

    const main = container.querySelector("main");
    expect(main?.className).toContain("max-w-[1720px]");
    expect(main?.className).toContain("min-w-0");

    const wideNavigation = Array.from(container.querySelectorAll("header > div")).find((element) =>
      element.className.includes("min-[1400px]:flex")
    );
    const compactNavigation = Array.from(container.querySelectorAll("div")).find(
      (element) =>
        element.className.includes("min-[1400px]:hidden") &&
        element.className.includes("overflow-x-auto")
    );

    expect(wideNavigation).toBeDefined();
    expect(compactNavigation).toBeDefined();
  });

  it("reserves manager dock space only on the standalone page", async () => {
    await act(async () => {
      root.render(<UnifiedDataManagerHub initialTab="dashboard" isStandalonePage />);
    });
    expect(container.querySelector("main")?.className.split(" ")).toContain("pb-32");

    await act(async () => {
      root.render(<UnifiedDataManagerHub initialTab="dashboard" />);
    });
    expect(container.querySelector("main")?.className.split(" ")).not.toContain("pb-32");
  });
});
