import { describe, expect, it } from "vitest";
import type { Song } from "@/types/song";
import { usePlaylistStore, type PlaylistState } from "../playlistStore";
import {
  selectAddSong,
  selectClearFilters,
  selectExportSongs,
  selectFilteredSongs,
  selectHasSongs,
  selectImportSongs,
  selectRemoveSong,
  selectSearchQuery,
  selectSearchSongs,
  selectSelectedSongIds,
  selectSongCount,
  selectSongs,
  selectUpdateSong,
} from "./playlistSelectors";

const makeSong = (id: string): Song => ({
  id,
  title: `Song ${id}`,
  artist: "Artist",
  duration: 180,
  source: "local",
});

function makeState(patch: Partial<PlaylistState> = {}): PlaylistState {
  return { ...usePlaylistStore.getInitialState(), ...patch };
}

describe("playlistSelectors", () => {
  it("returns the subscribed field slices by reference", () => {
    const songs = [makeSong("1"), makeSong("2")];
    const filteredSongs = [songs[1]];
    const selectedSongIds = new Set(["2"]);
    const state = makeState({ songs, filteredSongs, searchQuery: "two", selectedSongIds });

    expect(selectSongs(state)).toBe(songs);
    expect(selectFilteredSongs(state)).toBe(filteredSongs);
    expect(selectSearchQuery(state)).toBe("two");
    expect(selectSelectedSongIds(state)).toBe(selectedSongIds);
    expect(selectSongCount(state)).toBe(2);
    expect(selectHasSongs(state)).toBe(true);
  });

  it("handles an empty library", () => {
    const state = makeState();

    expect(selectSongs(state)).toEqual([]);
    expect(selectFilteredSongs(state)).toEqual([]);
    expect(selectSongCount(state)).toBe(0);
    expect(selectHasSongs(state)).toBe(false);
  });

  it("exposes stable action references", () => {
    const state = makeState();

    expect(selectAddSong(state)).toBe(state.addSong);
    expect(selectRemoveSong(state)).toBe(state.removeSong);
    expect(selectUpdateSong(state)).toBe(state.updateSong);
    expect(selectSearchSongs(state)).toBe(state.searchSongs);
    expect(selectClearFilters(state)).toBe(state.clearFilters);
    expect(selectImportSongs(state)).toBe(state.importSongs);
    expect(selectExportSongs(state)).toBe(state.exportSongs);
  });
});
