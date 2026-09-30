import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalClientComponents } from "./GlobalClientComponents";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  useAudioPlayer: vi.fn(),
  useMediaSession: vi.fn(),
  useElectron: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
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

vi.mock("@/hooks/useAudioPlayer", () => ({ useAudioPlayer: mocks.useAudioPlayer }));
vi.mock("@/hooks/useMediaSession", () => ({ useMediaSession: mocks.useMediaSession }));
vi.mock("@/hooks/useElectron", () => ({ useElectron: mocks.useElectron }));
vi.mock("@/lib/storage/safeStorage", () => ({ compactExistingStorage: vi.fn() }));
vi.mock("@/components/player/FloatingPlayer", () => ({
  FloatingPlayer: () => <div data-testid="floating-player" />,
}));
vi.mock("@/components/player/DataManagerPlayerDock", () => ({
  DataManagerPlayerDock: () => <div data-testid="manager-player-dock" />,
}));
vi.mock("@/components/shared/AchievementToast", () => ({
  AchievementToastContainer: () => null,
}));
vi.mock("@/components/interaction/GestureController", () => ({ GestureController: () => null }));
vi.mock("@/components/interaction/GestureFeedback", () => ({ GestureFeedback: () => null }));
vi.mock("@/components/widgets/AILinerNotes", () => ({ AILinerNotes: () => null }));
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
    mocks.useAudioPlayer.mockClear();
    mocks.useMediaSession.mockClear();
    mocks.useElectron.mockClear();
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
    expect(mocks.useMediaSession).toHaveBeenCalledTimes(1);
    expect(mocks.useElectron).toHaveBeenCalledTimes(1);
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
