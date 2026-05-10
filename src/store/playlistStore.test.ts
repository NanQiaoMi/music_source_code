import { describe, it, expect, beforeEach } from "vitest";
import { usePlaylistStore } from "./playlistStore";
import { Song } from "@/types/song";

function createMockSong(id: string): Song {
  return {
    id,
    title: `Song ${id}`,
    artist: "Artist",
    cover: "cover.jpg",
    duration: 200,
    source: "local",
  };
}

describe("playlistStore - batch operations", () => {
  const song1 = createMockSong("1");
  const song2 = createMockSong("2");
  const song3 = createMockSong("3");

  beforeEach(() => {
    usePlaylistStore.setState({
      songs: [song1, song2, song3],
      filteredSongs: [song1, song2, song3],
      selectedSongIds: new Set<string>(),
    });
  });

  it("selectSong toggles selection state", () => {
    usePlaylistStore.getState().selectSong("1");
    expect(usePlaylistStore.getState().selectedSongIds.has("1")).toBe(true);

    usePlaylistStore.getState().selectSong("1");
    expect(usePlaylistStore.getState().selectedSongIds.has("1")).toBe(false);
  });

  it("selectAllSongs selects all songs", () => {
    usePlaylistStore.getState().selectAllSongs();
    const ids = usePlaylistStore.getState().selectedSongIds;
    expect(ids.size).toBe(3);
    expect(ids.has("1")).toBe(true);
    expect(ids.has("2")).toBe(true);
    expect(ids.has("3")).toBe(true);
  });

  it("deselectAllSongs clears selection", () => {
    usePlaylistStore.setState({
      selectedSongIds: new Set(["1", "2", "3"]),
    });

    usePlaylistStore.getState().deselectAllSongs();
    expect(usePlaylistStore.getState().selectedSongIds.size).toBe(0);
  });

  it("removeSelectedSongs deletes selected songs", () => {
    usePlaylistStore.setState({
      selectedSongIds: new Set(["1", "3"]),
    });

    usePlaylistStore.getState().removeSelectedSongs();
    const remaining = usePlaylistStore.getState().songs;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("2");
    expect(usePlaylistStore.getState().selectedSongIds.size).toBe(0);
  });

  it("getSelectedSongs returns selected songs", () => {
    usePlaylistStore.setState({
      selectedSongIds: new Set(["2"]),
    });

    const selected = usePlaylistStore.getState().getSelectedSongs();
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe("2");
  });

  it("areAllSongsSelected returns true when all selected", () => {
    usePlaylistStore.getState().selectAllSongs();
    expect(usePlaylistStore.getState().areAllSongsSelected()).toBe(true);
  });

  it("areAllSongsSelected returns false when not all selected", () => {
    usePlaylistStore.getState().selectSong("1");
    expect(usePlaylistStore.getState().areAllSongsSelected()).toBe(false);
  });

  it("areAllSongsSelected returns false when songs empty", () => {
    usePlaylistStore.setState({ songs: [], selectedSongIds: new Set() });
    expect(usePlaylistStore.getState().areAllSongsSelected()).toBe(false);
  });
});
