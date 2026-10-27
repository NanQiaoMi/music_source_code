import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/store/uiStore";
import { GlobalClientComponents } from "./GlobalClientComponents";
import { PanelOrchestrator } from "./PanelOrchestrator";
import { UnifiedDataManagerHub } from "@/components/library/UnifiedDataManagerHub";

// 宿主桩：每个宿主渲染一个可计数标记。任何位置再次挂载
// GlassToastContainer / SourceManagementModal 都会让下面的计数断言 > 1。
vi.mock("@/components/shared/GlassToast", () => ({
  GlassToastContainer: () => <div data-testid="glass-toast-container" />,
}));
vi.mock("@/components/sources/SourceManagementModal", () => ({
  SourceManagementModal: () => <div data-testid="source-management-modal" />,
}));

// GlobalClientComponents 的全局服务与悬浮层与本测试无关，全部静音。
const mocks = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/hooks/useAudioPlayer", () => ({ useAudioPlayer: vi.fn() }));
vi.mock("@/hooks/useMediaSession", () => ({ useMediaSession: vi.fn() }));
vi.mock("@/hooks/useElectron", () => ({ useElectron: vi.fn() }));
vi.mock("@/lib/bootstrap", () => ({ bootstrapApp: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/storage/safeStorage", () => ({ compactExistingStorage: vi.fn() }));
vi.mock("@/components/shared/AchievementToast", () => ({ AchievementToastContainer: () => null }));
vi.mock("@/components/interaction/GestureController", () => ({ GestureController: () => null }));
vi.mock("@/components/interaction/GestureFeedback", () => ({ GestureFeedback: () => null }));
vi.mock("@/components/widgets/AILinerNotes", () => ({ AILinerNotes: () => null }));
vi.mock("@/components/layout/TopEdgeSearchTrigger", () => ({ TopEdgeSearchTrigger: () => null }));

// PanelOrchestrator 只负责面板懒加载；这里只关心它不再挂载宿主。
vi.mock("@/components/shared/LazyPanel", () => ({
  createLazyPanelComponent: (name: string) => name,
  prefetchPanel: vi.fn(),
  LazyPanel: () => null,
}));

// UnifiedDataManagerHub 的标签页内容与宿主数量无关，全部桩掉。
vi.mock("@/components/library/hub/DataDashboardTab", () => ({ DataDashboardTab: () => null }));
vi.mock("@/components/library/hub/LxMusicSearchTab", () => ({ LxMusicSearchTab: () => null }));
vi.mock("@/components/library/hub/CloudAssetsTab", () => ({ CloudAssetsTab: () => null }));
vi.mock("@/components/library/hub/OfflineDownloadsTab", () => ({
  OfflineDownloadsTab: () => null,
}));
vi.mock("@/components/library/hub/PlaylistHubTab", () => ({ PlaylistHubTab: () => null }));
vi.mock("@/components/library/hub/HealthStorageTab", () => ({ HealthStorageTab: () => null }));
vi.mock("@/components/library/LocalMusicManager", () => ({ LocalMusicManager: () => null }));

describe("global host singletons", () => {
  let roots: Root[];
  let containers: HTMLDivElement[];

  const mount = async (element: React.ReactElement) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    containers.push(container);
    roots.push(root);
    await act(async () => {
      root.render(element);
    });
    await act(async () => {
      await Promise.resolve();
    });
    return container;
  };

  // 模拟真实运行时同时存在的三棵树：layout(GlobalClientComponents)、
  // page(PanelOrchestrator) 与 /data-manager(UnifiedDataManagerHub)。
  const mountAppShell = async () => {
    await mount(<GlobalClientComponents />);
    await mount(<PanelOrchestrator />);
    await mount(<UnifiedDataManagerHub initialTab="dashboard" />);
  };

  beforeEach(() => {
    mocks.pathname = "/";
    useUIStore.setState(useUIStore.getInitialState(), true);
    roots = [];
    containers = [];
  });

  afterEach(async () => {
    await act(async () => {
      roots.forEach((root) => root.unmount());
    });
    containers.forEach((container) => container.remove());
    vi.restoreAllMocks();
  });

  it("renders exactly one toast host across the layout and page shells", async () => {
    await mountAppShell();

    expect(document.querySelectorAll('[data-testid="glass-toast-container"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-global-host="toast"]')).toHaveLength(1);
  });

  it("renders exactly one source-management host across layout, page and data-manager shells", async () => {
    await mountAppShell();

    expect(document.querySelectorAll('[data-testid="source-management-modal"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-global-host="source-modal"]')).toHaveLength(1);
  });

  it("mounts both global hosts once without console errors or warnings", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await mountAppShell();

    const hosts = Array.from(document.querySelectorAll("[data-global-host]"));
    expect(hosts.map((host) => host.getAttribute("data-global-host")).sort()).toEqual([
      "source-modal",
      "toast",
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("keeps the single toast host available on the data-manager route", async () => {
    mocks.pathname = "/data-manager";
    await mount(<GlobalClientComponents />);

    expect(document.querySelectorAll('[data-testid="glass-toast-container"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-global-host="toast"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="source-management-modal"]')).toHaveLength(1);
  });
});
