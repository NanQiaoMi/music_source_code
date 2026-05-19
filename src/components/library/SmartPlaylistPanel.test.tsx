import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SmartPlaylist } from "@/store/smartPlaylistStore";
import type { Song } from "@/types/song";

const songs: Song[] = [
  {
    id: "s1",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up",
    genre: "Synthpop",
    duration: 245,
    source: "local",
    playCount: 12,
  },
  {
    id: "s2",
    title: "Intro",
    artist: "The xx",
    album: "xx",
    genre: "Indie",
    duration: 130,
    source: "local",
    playCount: 2,
  },
];

const customPlaylist: SmartPlaylist = {
  id: "playlist-1",
  name: "Night drive",
  type: "custom",
  rules: [
    {
      id: "rule-1",
      field: "artist",
      operator: "contains",
      value: "M83",
    },
  ],
  isEnabled: true,
  lastUpdated: 0,
  songCount: 1,
};

type EmotionStoreSnapshot = {
  emotionMap: Record<string, { x: number; y: number }>;
};

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: () => ({ songs }),
}));

vi.mock("@/store/emotionStore", () => ({
  useEmotionStore: (selector: (state: EmotionStoreSnapshot) => unknown) =>
    selector({ emotionMap: {} }),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: {
    getState: () => ({
      playQueue: vi.fn(),
    }),
  },
}));

vi.mock("@/store/queueStore", () => ({
  useQueueStore: {
    getState: () => ({
      setQueue: vi.fn(),
    }),
  },
}));

vi.mock("@/components/shared/GlassToast", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/store/smartPlaylistStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/smartPlaylistStore")>();

  return {
    ...actual,
    useSmartPlaylistStore: () => ({
      customPlaylists: [customPlaylist],
      createSmartPlaylist: vi.fn(),
      deleteSmartPlaylist: vi.fn(),
      addRule: vi.fn(),
      deleteRule: vi.fn(),
      generatePlaylist: (playlist: SmartPlaylist) =>
        playlist.rules.length === 0 ? songs : songs.filter((song) => song.artist === "M83"),
      exportPlaylist: vi.fn(),
      importPlaylist: vi.fn(),
      getDefaultSmartPlaylists: () => [],
    }),
  };
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SmartPlaylistPanel", () => {
  it("shows operator chips and a live draft preview count in the rule editor", async () => {
    const { SmartPlaylistPanel } = await import("./SmartPlaylistPanel");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SmartPlaylistPanel isOpen={true} onClose={() => undefined} />);
    });

    const rulesTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Rules"
    );

    await act(async () => {
      rulesTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Operator chips");
    expect(container.textContent).toContain("contains");
    expect(container.textContent).toContain("equals");
    expect(container.textContent).toContain("Draft preview");
    expect(container.textContent).toContain("2 songs would match this rule");

    await act(async () => {
      root.unmount();
    });
  });
});
