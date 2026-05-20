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

  it("uses readable labels for the primary navigation hubs", async () => {
    const { HeaderToolbar } = await import("./HeaderToolbar");

    const html = renderToStaticMarkup(<HeaderToolbar />);

    expect(html).toContain("Music Library");
    expect(html).toContain("Import music to begin");
    expect(html).toContain('title="Quick search"');
    expect(html).toContain('title="Professional tools"');

    expect(mocks.capturedHubs.map((hub) => hub.label)).toEqual([
      "Lyrics",
      "Library",
      "Discover",
      "Tools",
    ]);

    const labelsById = Object.fromEntries(
      mocks.capturedHubs.flatMap((hub) => hub.items).map((item) => [item.id, item.label])
    );

    expect(labelsById).toMatchObject({
      lyricSettings: "Lyric style",
      lyricsSearch: "Online lyrics",
      lyricsImport: "Import lyrics",
      lyricsCoverEditor: "Cover editor",
      libraryManager: "Music library",
      smartPlaylist: "Smart playlists",
      offlineCache: "Offline cache",
      backupRestore: "Backup and restore",
      dailyRecommendation: "Daily recommendations",
      dnaJournal: "Listening DNA",
      listeningHistory: "Listening history",
      listeningJournal: "Listening Journal",
      statsAchievements: "Stats and badges",
      instantMix: "Instant mix",
      smartMixSession: "Smart Mix",
      settings: "Preferences",
      playerSkins: "Player skins",
      sleepTimer: "Sleep timer",
      share: "Share music",
      keyboardShortcuts: "Keyboard shortcuts",
    });
  });
});
