import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalClientComponents } from "./GlobalClientComponents";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  currentView: "home" as "home" | "player" | "lyrics" | "visualization" | "emotion",
  useAudioPlayer: vi.fn(),
  audioPlayerMounts: 0,
  audioPlayerUnmounts: 0,
  floatingPlayerMounts: 0,
  floatingPlayerUnmounts: 0,
  useMediaSession: vi.fn(),
  useElectron: vi.fn(),
  bootstrapApp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (state: { currentView: string }) => unknown) =>
    selector({ currentView: mocks.currentView }),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<React.ComponentType>) => {
    return function TestDynamicComponent() {
      const [LoadedComponent, setLoadedComponent] = React.useState<React.ComponentType | null>(
        null
      );
      React.useEffect(() => {
        let active = true;
        loader().then((component) => {
          if (active) setLoadedComponent(() => component);
        });
        return () => {
          active = false;
        };
      }, []);
      return LoadedComponent ? React.createElement(LoadedComponent) : null;
    };
  },
}));

vi.mock("@/hooks/useAudioPlayer", () => ({
  useAudioPlayer: () => {
    mocks.useAudioPlayer();
    React.useEffect(() => {
      mocks.audioPlayerMounts += 1;
      return () => {
        mocks.audioPlayerUnmounts += 1;
      };
    }, []);
  },
}));
vi.mock("@/hooks/useMediaSession", () => ({ useMediaSession: mocks.useMediaSession }));
vi.mock("@/hooks/useElectron", () => ({ useElectron: mocks.useElectron }));
vi.mock("@/lib/bootstrap", () => ({ bootstrapApp: mocks.bootstrapApp }));
vi.mock("@/lib/storage/safeStorage", () => ({ compactExistingStorage: vi.fn() }));
vi.mock("@/components/player/FloatingPlayer", () => ({
  FloatingPlayer: () => {
    React.useEffect(() => {
      mocks.floatingPlayerMounts += 1;
      return () => {
        mocks.floatingPlayerUnmounts += 1;
      };
    }, []);
    return <div data-testid="floating-player" />;
  },
}));
vi.mock("@/components/player/DataManagerPlayerDock", () => ({
  DataManagerPlayerDock: () => <div data-testid="manager-player-dock" />,
}));
vi.mock("@/components/shared/AchievementToast", () => ({
  AchievementToastContainer: () => null,
}));
vi.mock("@/components/interaction/GestureController", () => ({ GestureController: () => null }));
vi.mock("@/components/interaction/GestureFeedback", () => ({ GestureFeedback: () => null }));
vi.mock("@/components/widgets/AILinerNotes", () => ({
  AILinerNotes: () => <div data-testid="ai-liner-notes" />,
}));
vi.mock("@/components/layout/TopEdgeSearchTrigger", () => ({ TopEdgeSearchTrigger: () => null }));
vi.mock("@/components/sources/SourceManagementModal", () => ({
  SourceManagementModal: () => null,
}));
vi.mock("@/components/shared/GlassToast", () => ({ GlassToastContainer: () => null }));

describe("GlobalClientComponents player routing", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    mocks.pathname = "/";
    mocks.currentView = "home";
    mocks.audioPlayerMounts = 0;
    mocks.audioPlayerUnmounts = 0;
    mocks.floatingPlayerMounts = 0;
    mocks.floatingPlayerUnmounts = 0;
    mocks.useAudioPlayer.mockClear();
    mocks.useMediaSession.mockClear();
    mocks.useElectron.mockClear();
    mocks.bootstrapApp.mockReset().mockResolvedValue(true);
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container.remove();
  });

  const renderRoot = async () => {
    root = createRoot(container);
    await act(async () => root?.render(<GlobalClientComponents />));
    await act(async () => Promise.resolve());
  };

  it("keeps the existing floating player outside the manager route", async () => {
    mocks.pathname = "/";

    await renderRoot();

    expect(container.querySelector('[data-testid="floating-player"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="manager-player-dock"]')).toBeNull();
    expect(mocks.useAudioPlayer).toHaveBeenCalledTimes(1);
    expect(mocks.audioPlayerMounts).toBe(1);
    expect(mocks.audioPlayerUnmounts).toBe(0);
    expect(mocks.useMediaSession).toHaveBeenCalledTimes(1);
    expect(mocks.useElectron).toHaveBeenCalledTimes(1);
  });

  it("hides immersive overlays while keeping the root audio owner mounted and restores them on exit", async () => {
    mocks.currentView = "visualization";

    await renderRoot();

    const floatingPlayer = container.querySelector('[data-testid="floating-player"]');
    expect(floatingPlayer).not.toBeNull();
    expect(floatingPlayer?.parentElement?.hidden).toBe(true);
    expect(mocks.floatingPlayerMounts).toBe(1);
    expect(container.querySelector('[data-testid="ai-liner-notes"]')).toBeNull();
    expect(mocks.audioPlayerMounts).toBe(1);
    expect(mocks.audioPlayerUnmounts).toBe(0);

    mocks.currentView = "home";
    await act(async () => root?.render(<GlobalClientComponents />));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-testid="floating-player"]')).not.toBeNull();
    expect(floatingPlayer?.parentElement?.hidden).toBe(false);
    expect(mocks.floatingPlayerMounts).toBe(1);
    expect(mocks.floatingPlayerUnmounts).toBe(0);
    expect(container.querySelector('[data-testid="ai-liner-notes"]')).not.toBeNull();
    expect(mocks.audioPlayerMounts).toBe(1);
    expect(mocks.audioPlayerUnmounts).toBe(0);
  });

  it("keeps the manager dock and auxiliary UI when visualization is persisted on manager routes", async () => {
    mocks.pathname = "/data-manager/collections";
    mocks.currentView = "visualization";

    await renderRoot();

    expect(container.querySelector('[data-testid="manager-player-dock"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="floating-player"]')).toBeNull();
    expect(container.querySelector('[data-testid="ai-liner-notes"]')).not.toBeNull();
    expect(mocks.audioPlayerMounts).toBe(1);
    expect(mocks.audioPlayerUnmounts).toBe(0);
  });

  it("shows the fixed manager dock while keeping root playback hooks mounted", async () => {
    mocks.pathname = "/data-manager";

    await renderRoot();

    expect(container.querySelector('[data-testid="manager-player-dock"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="floating-player"]')).toBeNull();
    expect(mocks.useAudioPlayer).toHaveBeenCalledTimes(1);
    expect(mocks.useMediaSession).toHaveBeenCalledTimes(1);
    expect(mocks.useElectron).toHaveBeenCalledTimes(1);
  });

  it("initializes shared services on direct manager entry and keeps one audio owner across navigation", async () => {
    mocks.pathname = "/data-manager";

    await renderRoot();

    expect(container.querySelector('[data-testid="manager-player-dock"]')).not.toBeNull();
    expect(mocks.bootstrapApp).toHaveBeenCalledTimes(1);

    mocks.pathname = "/";
    await act(async () => root?.render(<GlobalClientComponents />));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-testid="floating-player"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="manager-player-dock"]')).toBeNull();
    expect(mocks.bootstrapApp).toHaveBeenCalledTimes(1);
    expect(mocks.audioPlayerMounts).toBe(1);
    expect(mocks.audioPlayerUnmounts).toBe(0);
  });

  it("keeps the manager dock on nested library routes", async () => {
    mocks.pathname = "/data-manager/search";

    await renderRoot();

    expect(container.querySelector('[data-testid="manager-player-dock"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="floating-player"]')).toBeNull();
  });

  it("does not classify similarly prefixed routes as manager routes", async () => {
    mocks.pathname = "/data-managerial";

    await renderRoot();

    expect(container.querySelector('[data-testid="floating-player"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="manager-player-dock"]')).toBeNull();
  });
});
