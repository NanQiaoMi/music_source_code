import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";

const songs: Song[] = [
  {
    id: "seed",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up",
    duration: 245,
    source: "local",
  },
  {
    id: "track-2",
    title: "Intro",
    artist: "The xx",
    album: "xx",
    duration: 132,
    source: "local",
  },
];

const mocks = vi.hoisted(() => ({
  playQueue: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: () => ({ songs }),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: { playQueue: typeof mocks.playQueue }) => unknown) =>
    selector({ playQueue: mocks.playQueue }),
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("LibraryManagerPanel", () => {
  beforeEach(async () => {
    vi.setSystemTime(new Date("2026-05-21T00:00:00.000Z"));
    mocks.playQueue.mockClear();
    localStorage.clear();

    const { usePlaylistGroupStore } = await import("@/store/playlistGroupStore");
    usePlaylistGroupStore.setState({
      groups: [
        {
          id: "mix-1",
          type: "custom",
          name: "Road mix",
          cover: "cover.jpg",
          songs,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      currentGroupId: "mix-1",
    });
  });

  it("shows saved custom playlists and can play or delete them", async () => {
    const { LibraryManagerPanel } = await import("./LibraryManagerPanel");
    const { usePlaylistGroupStore } = await import("@/store/playlistGroupStore");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LibraryManagerPanel isOpen={true} onClose={() => undefined} />);
    });

    expect(container.textContent).toContain("Music Library");
    expect(container.textContent).toContain("Saved playlists");
    expect(container.textContent).toContain("Road mix");
    expect(container.textContent).toContain("Midnight City");

    const playButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Play"
    );

    await act(async () => {
      playButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mocks.playQueue).toHaveBeenCalledWith(songs, 0);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Playing Road mix with 2 tracks."
    );

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Delete"
    );

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(usePlaylistGroupStore.getState().groups).toHaveLength(0);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Deleted playlist Road mix."
    );

    await act(async () => {
      root.unmount();
    });
  });
});
