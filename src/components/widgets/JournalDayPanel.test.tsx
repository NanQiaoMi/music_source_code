import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";

const songs: Song[] = [
  {
    id: "song-1",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up",
    duration: 245,
    source: "local",
  },
];

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: (selector: (state: { songs: Song[] }) => unknown) => selector({ songs }),
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("JournalDayPanel", () => {
  beforeEach(async () => {
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
    localStorage.clear();
    const { useListeningJournalStore } = await import("@/store/listeningJournalStore");
    useListeningJournalStore.setState({
      selectedDate: "2026-05-20",
      days: {
        "2026-05-20": {
          date: "2026-05-20",
          totalMinutes: 2,
          topSongIds: ["song-1"],
          dominantMood: "focus",
        },
      },
      eventsByDate: {
        "2026-05-20": [
          { songId: "song-1", playedAt: 1, listenSeconds: 60, mood: "focus" },
          { songId: "song-1", playedAt: 2, listenSeconds: 60, mood: "focus" },
        ],
      },
    });
  });

  it("announces and persists a journal note when the input is saved", async () => {
    const { JournalDayPanel } = await import("./JournalDayPanel");
    const { useListeningJournalStore } = await import("@/store/listeningJournalStore");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<JournalDayPanel isOpen={true} onClose={() => undefined} />);
    });

    const noteInput = container.querySelector("input");
    expect(noteInput).not.toBeNull();
    expect(container.textContent).toContain("2 plays");
    expect(container.textContent).toContain("2 min");

    await act(async () => {
      noteInput!.value = "Late night listening";
      noteInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Saved note for 2026-05-20");
    expect(useListeningJournalStore.getState().days["2026-05-20"].note).toBe(
      "Late night listening"
    );

    await act(async () => {
      root.unmount();
    });
  });
});
