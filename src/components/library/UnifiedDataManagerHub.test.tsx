import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { UnifiedDataManagerHub } from "./UnifiedDataManagerHub";
import { useUIStore } from "@/store/uiStore";
import { usePlaylistStore } from "@/store/playlistStore";

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

    useUIStore.setState({
      currentView: "home",
      panels: { dataManager: true } as any,
    });

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
    expect(container.textContent).toContain("云端曲库");
    expect(container.textContent).toContain("离线下载");
    expect(container.textContent).toContain("歌单编排");
    expect(container.textContent).toContain("本地导入");
    expect(container.textContent).toContain("存储体检");
  });
});
