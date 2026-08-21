import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { HealthReport } from "@/store/libraryHealthStore";
import type { Song } from "@/types/song";

const playlistState = vi.hoisted(() => ({
  songs: [] as Song[],
}));

const healthStoreState = vi.hoisted(() => ({
  state: {
    lastScan: null as number | null,
    isScanning: false,
    scanProgress: 0,
    healthReport: null as HealthReport | null,
    ignoredIssueIds: [] as string[],
    autoScan: true,
    scanInterval: 7,
    setHealthReport: vi.fn(),
    setAutoScan: vi.fn(),
    setScanning: vi.fn(),
    setScanProgress: vi.fn(),
    ignoreIssue: vi.fn(),
    clearIssues: vi.fn(),
    exportHealthReport: vi.fn(),
  },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: "div",
  },
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: () => ({ songs: playlistState.songs }),
}));

vi.mock("@/store/libraryHealthStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/libraryHealthStore")>();

  return {
    ...actual,
    useLibraryHealthStore: () => healthStoreState.state,
  };
});

function createSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-1",
    title: "Song",
    artist: "Artist",
    duration: 180,
    source: "local",
    audioUrl: "stored://song-1",
    cover: "/cover.png",
    lyrics: "[00:01.00]Line",
    ...overrides,
  };
}

describe("LibraryHealthPanel", () => {
  beforeEach(async () => {
    playlistState.songs = [];
    healthStoreState.state = {
      ...healthStoreState.state,
      lastScan: null,
      isScanning: false,
      scanProgress: 0,
      healthReport: null,
      ignoredIssueIds: [],
      autoScan: true,
      scanInterval: 7,
    };
  });

  it("renders an immediate status banner for an empty library", async () => {
    const { LibraryHealthPanel } = await import("./LibraryHealthPanel");

    const html = renderToStaticMarkup(
      <LibraryHealthPanel isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain("Health status");
    expect(html).toContain("Empty library");
    expect(html).toContain("Import songs before cleanup checks");
    expect(html).toContain("Scan folder");
  });

  it("renders an immediate healthy status after a clean scan", async () => {
    const { generateHealthReport } = await import("@/store/libraryHealthStore");
    playlistState.songs = [createSong()];
    healthStoreState.state.healthReport = generateHealthReport(playlistState.songs);
    const { LibraryHealthPanel } = await import("./LibraryHealthPanel");

    const html = renderToStaticMarkup(
      <LibraryHealthPanel isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain("Health status");
    expect(html).toContain("Healthy library");
    expect(html).toContain("No active issues in the latest scan");
    expect(html).toContain("Run weekly check");
  });

  it("renders an immediate attention-needed status when issues are present", async () => {
    const { generateHealthReport } = await import("@/store/libraryHealthStore");
    playlistState.songs = [createSong({ audioUrl: "" })];
    healthStoreState.state.healthReport = generateHealthReport(playlistState.songs);
    const { LibraryHealthPanel } = await import("./LibraryHealthPanel");

    const html = renderToStaticMarkup(
      <LibraryHealthPanel isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain("Health status");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Review and resolve active library issues");
    expect(html).toContain("Resolve 1 broken path");
  });
});
