import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePlaylistStore } from "./playlistStore";
import { songsData } from "@/data/songsData";
import { getAllStoredMusic, type StoredMusic } from "@/services/localMusicStorage";
import type { Song } from "@/types/song";

vi.mock("@/services/localMusicStorage", () => ({
  getAllStoredMusic: vi.fn(),
}));

vi.mock("@/services/coverCache", () => ({
  getCoverFromCache: vi.fn().mockResolvedValue(null),
  saveCoverToCache: vi.fn().mockResolvedValue(undefined),
  deleteCoverFromCache: vi.fn().mockResolvedValue(undefined),
}));

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

function createStoredMusic(id: string): StoredMusic {
  return {
    id,
    fileData: new ArrayBuffer(0),
    fileType: "audio/mpeg",
    fileName: `${id}.mp3`,
    title: `Stored ${id}`,
    artist: "Local Artist",
    album: "Local Album",
    duration: 180,
    addedAt: 1000,
  };
}

function resetPlaylistStore() {
  usePlaylistStore.setState({
    songs: [],
    recentPlayed: [],
    selectedSong: null,
    searchQuery: "",
    filteredSongs: [],
    selectedSongIds: new Set<string>(),
  });
}

describe("playlistStore - initialization", () => {
  beforeEach(() => {
    resetPlaylistStore();
    vi.mocked(getAllStoredMusic).mockReset();
  });

  it("shows demo songs when no stored music exists", async () => {
    vi.mocked(getAllStoredMusic).mockResolvedValue([]);

    await usePlaylistStore.getState().initializePlaylist();

    const songs = usePlaylistStore.getState().songs;
    expect(songs.map((song) => song.id)).toEqual(songsData.map((song) => song.id));
    expect(songs.every((song) => song.source === "demo")).toBe(true);
  });

  it("replaces demo songs with stored music once the user has imported tracks", async () => {
    vi.mocked(getAllStoredMusic).mockResolvedValue([createStoredMusic("stored-1")]);

    await usePlaylistStore.getState().initializePlaylist();

    const state = usePlaylistStore.getState();
    expect(state.songs).toHaveLength(1);
    expect(state.songs[0]).toMatchObject({
      id: "stored-1",
      title: "Stored stored-1",
      source: "local",
      audioUrl: "stored://stored-1",
    });
    expect(state.songs.some((song) => song.source === "demo" || song.id.startsWith("demo-"))).toBe(
      false
    );
    expect(state.filteredSongs.map((song) => song.id)).toEqual(["stored-1"]);
    expect(state.recentPlayed.map((song) => song.id)).toEqual(["stored-1"]);
  });
});

describe("playlistStore - demo replacement", () => {
  beforeEach(() => {
    resetPlaylistStore();
  });

  it("removes demo songs when importing real tracks in the current session", () => {
    const demoSong = { ...songsData[0], source: "demo" };
    const realSong = createMockSong("real-1");
    usePlaylistStore.setState({
      songs: [demoSong],
      filteredSongs: [demoSong],
      recentPlayed: [demoSong],
      selectedSongIds: new Set<string>(),
    });

    usePlaylistStore.getState().importSongs([realSong]);

    const state = usePlaylistStore.getState();
    expect(state.songs.map((song) => song.id)).toEqual(["real-1"]);
    expect(state.filteredSongs.map((song) => song.id)).toEqual(["real-1"]);
    expect(state.recentPlayed.map((song) => song.id)).toEqual(["real-1"]);
  });

  it("removes demo songs when adding the first real track", () => {
    const demoSong = { ...songsData[0], source: "demo" };
    const realSong = createMockSong("real-1");
    usePlaylistStore.setState({
      songs: [demoSong],
      filteredSongs: [demoSong],
      recentPlayed: [demoSong],
      selectedSongIds: new Set<string>(),
    });

    usePlaylistStore.getState().addSong(realSong);

    const state = usePlaylistStore.getState();
    expect(state.songs.map((song) => song.id)).toEqual(["real-1"]);
    expect(state.filteredSongs.map((song) => song.id)).toEqual(["real-1"]);
    expect(state.recentPlayed).toEqual([]);
  });
});

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
