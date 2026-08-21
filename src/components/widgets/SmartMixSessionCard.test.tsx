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
    genre: "Synthpop",
    duration: 245,
    source: "local",
    bpm: 128,
  },
  {
    id: "track-2",
    title: "Intro",
    artist: "The xx",
    album: "xx",
    genre: "Indie",
    duration: 132,
    source: "local",
    bpm: 92,
  },
  {
    id: "track-3",
    title: "A Real Hero",
    artist: "College",
    album: "Drive",
    genre: "Synthpop",
    duration: 267,
    source: "local",
    bpm: 112,
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
  usePlaylistStore: (selector: (state: { songs: Song[] }) => unknown) => selector({ songs }),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: { playQueue: typeof mocks.playQueue }) => unknown) =>
    selector({ playQueue: mocks.playQueue }),
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("SmartMixSessionCard", () => {
  beforeEach(async () => {
    mocks.playQueue.mockClear();
    const { useSmartMixStore } = await import("@/store/smartMixStore");
    const { usePlaylistGroupStore } = await import("@/store/playlistGroupStore");
    useSmartMixStore.setState({ currentSession: null, lastInput: null });
    usePlaylistGroupStore.setState({ groups: [], currentGroupId: null });
    localStorage.clear();
  });

  it("announces session status when a mix is started and played", async () => {
    vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));
    const { SmartMixSessionCard } = await import("./SmartMixSessionCard");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SmartMixSessionCard />);
    });

    const startButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start mix")
    );

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Mix ready: 3 首曲目 from Midnight City");
    expect(container.textContent).toContain("Midnight City");
    expect(container.textContent).toContain("A Real Hero");

    const playButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("播放混音")
    );

    await act(async () => {
      playButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(status?.textContent).toContain("Queued 3 Smart Mix 首曲目");
    expect(mocks.playQueue).toHaveBeenCalledWith(expect.any(Array), 0);

    await act(async () => {
      root.unmount();
    });
  });

  it("announces when an existing mix is regenerated", async () => {
    vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));
    const { SmartMixSessionCard } = await import("./SmartMixSessionCard");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SmartMixSessionCard />);
    });

    const startButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start mix")
    );

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const regenerateButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("重新生成")
    );

    await act(async () => {
      regenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Regenerated mix: 3 首曲目 from Midnight City");

    await act(async () => {
      root.unmount();
    });
  });

  it("saves the current mix as a custom playlist", async () => {
    vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));
    const { SmartMixSessionCard } = await import("./SmartMixSessionCard");
    const { usePlaylistGroupStore } = await import("@/store/playlistGroupStore");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SmartMixSessionCard />);
    });

    const startButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start mix")
    );

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("保存播放列表")
    );

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const status = container.querySelector('[role="status"]');
    const savedGroup = usePlaylistGroupStore
      .getState()
      .groups.find((group) => group.name.includes("Midnight City"));

    expect(status?.textContent).toContain("Saved 3 首曲目 to Smart Mix - Midnight City");
    expect(savedGroup?.type).toBe("custom");
    expect(savedGroup?.songs.map((song) => song.id)).toEqual(["seed", "track-3", "track-2"]);

    await act(async () => {
      root.unmount();
    });
  });
});
