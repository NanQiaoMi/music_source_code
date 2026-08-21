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

  it("imports M3U entries from labels, generated file names, and stored paths", () => {
    const store = useSmartPlaylistStore.getState();
    const localSongs: Song[] = [
      ...songs,
      {
        id: "s3",
        title: "Untitled source",
        artist: "Tape Archive",
        album: "Loose cuts",
        duration: 90,
        source: "local",
        filePath: "D:\\library\\loose-track.wav",
      },
    ];

    const imported = store.importPlaylist(
      [
        "#EXTM3U",
        "#EXTINF:245,M83 - Midnight City",
        "s1.mp3",
        "D:\\library\\loose-track.wav",
        "s1.mp3",
      ].join("\n"),
      "m3u",
      localSongs
    );

    expect(imported.map((song) => song.id)).toEqual(["s1", "s3"]);
  });

  it("imports XML playlist titles with escaped entities", () => {
    const store = useSmartPlaylistStore.getState();
    const specialSong: Song = {
      id: "special",
      title: "Salt & Light",
      artist: "ATB <Live>",
      album: "Entity checks",
      duration: 180,
      source: "local",
      audioUrl: "stored://special",
    };

    expect(
      store.importPlaylist(store.exportPlaylist([specialSong], "xspf"), "xspf", [specialSong])
    ).toEqual([specialSong]);
    expect(
      store.importPlaylist(store.exportPlaylist([specialSong], "wpl"), "wpl", [specialSong])
    ).toEqual([specialSong]);
  });
});
