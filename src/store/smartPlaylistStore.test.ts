import { beforeEach, describe, expect, it } from "vitest";
import type { Song } from "@/types/song";
import { useSmartPlaylistStore, type SmartPlaylistRule } from "./smartPlaylistStore";

const songs: Song[] = [
  {
    id: "s1",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up",
    duration: 245,
    source: "local",
    playCount: 12,
  },
  {
    id: "s2",
    title: "Intro",
    artist: "The xx",
    album: "xx",
    duration: 130,
    source: "local",
    playCount: 2,
  },
];

beforeEach(() => {
  useSmartPlaylistStore.getState().clearAll();
});

describe("smartPlaylistStore", () => {
  it("creates custom playlists and updates rules", () => {
    const store = useSmartPlaylistStore.getState();
    const playlist = store.createSmartPlaylist("Night drive", "custom");
    const rule: SmartPlaylistRule = {
      id: "rule-1",
      field: "artist",
      operator: "contains",
      value: "m83",
    };

    store.addRule(playlist.id, rule);
    const updated = useSmartPlaylistStore
      .getState()
      .customPlaylists.find((item) => item.id === playlist.id);

    expect(updated?.rules).toEqual([rule]);
  });

  it("generates custom playlists with injected emotion data", () => {
    const store = useSmartPlaylistStore.getState();
    const playlist = store.createSmartPlaylist("High energy", "custom", [
      { id: "rule-1", field: "emotion", operator: "inQuadrant", value: "Q1" },
    ]);

    const result = store.generatePlaylist(playlist, songs, {
      emotions: { s1: { x: 0.7, y: 0.6 }, s2: { x: -0.2, y: 0.4 } },
    });

    expect(result.map((song) => song.id)).toEqual(["s1"]);
  });

  it("exports playlist formats", () => {
    const store = useSmartPlaylistStore.getState();

    expect(store.exportPlaylist(songs, "pls")).toContain("NumberOfEntries=2");
    expect(store.exportPlaylist(songs, "xspf")).toContain("<trackList>");
    expect(store.exportPlaylist(songs, "wpl")).toContain('<media src="s1.mp3"');
    expect(store.exportPlaylist(songs, "txt")).toContain("M83 - Midnight City");
  });
});
