import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

type CapturedHub = {
  label: string;
  items: Array<{
    id: string;
    label: string;
    action: () => void;
  }>;
};

const mocks = vi.hoisted(() => ({
  openPanel: vi.fn(),
  toggleFullscreen: vi.fn(),
  toggleGestureEnabled: vi.fn(),
  capturedHubs: [] as CapturedHub[],
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    currentView: "home",
    openPanel: mocks.openPanel,
    panels: {
      keyboardShortcuts: false,
    },
    isFullscreen: false,
    toggleFullscreen: mocks.toggleFullscreen,
  }),
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: () => ({
    songs: [],
  }),
}));

vi.mock("@/store/gestureStore", () => ({
  useGestureStore: () => ({
    isEnabled: false,
    toggleGestureEnabled: mocks.toggleGestureEnabled,
  }),
}));

vi.mock("@/components/layout/Logo", () => ({
  Logo: () => <div data-testid="logo" />,
}));

vi.mock("@/components/layout/AIToolbox", () => ({
  AIToolbox: () => <div data-testid="ai-toolbox" />,
}));

vi.mock("@/components/layout/HoverHub", () => ({
  HoverHub: ({
    label,
    items,
  }: {
    label: string;
    mainIcon: ReactNode;
    items: CapturedHub["items"];
    accentColor?: string;
  }) => {
    mocks.capturedHubs.push({ label, items });

    return <div data-hub-label={label}>{items.map((item) => item.id).join(",")}</div>;
  },
}));

describe("HeaderToolbar", () => {
  beforeEach(() => {
    mocks.openPanel.mockClear();
    mocks.toggleFullscreen.mockClear();
    mocks.toggleGestureEnabled.mockClear();
    mocks.capturedHubs.length = 0;
  });

  it("exposes Listening Journal from the inspiration hub", async () => {
    const { HeaderToolbar } = await import("./HeaderToolbar");

    renderToStaticMarkup(<HeaderToolbar />);

    const item = mocks.capturedHubs
      .flatMap((hub) => hub.items)
      .find((hubItem) => hubItem.id === "listeningJournal");

    expect(item?.label).toBe("Listening Journal");

    item?.action();

    expect(mocks.openPanel).toHaveBeenCalledWith("listeningJournal");
  });
});
