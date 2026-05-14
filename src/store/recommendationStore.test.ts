import { beforeEach, describe, expect, it } from "vitest";
import { useRecommendationStore } from "./recommendationStore";
import { usePlaylistStore } from "./playlistStore";
import type { Song } from "@/types/song";

const songs: Song[] = [
  {
    id: "s1",
    title: "Song One",
    artist: "Artist A",
    album: "Album 1",
    cover: "/cover.png",
    duration: 200,
    source: "local",
  },
  {
    id: "s2",
    title: "Song Two",
    artist: "Artist A",
    album: "Album 1",
    cover: "/cover.png",
    duration: 180,
    source: "local",
  },
  {
    id: "s3",
    title: "Song Three",
    artist: "Artist B",
    album: "Album 2",
    cover: "/cover.png",
    duration: 220,
    source: "local",
  },
];

const createContext = () => ({
  recentSongs: [],
  topArtists: ["Artist A"],
  topGenres: [],
  skippedSongIds: new Set<string>(),
});

describe("recommendationStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecommendationStore.setState({
      playHistory: [],
      recommendations: [],
      dismissedSongIds: [],
      lastGeneratedAt: 0,
      isLoading: false,
      negativeFeedback: [],
    });
    usePlaylistStore.setState({ songs });
  });

  it("recordPlay should record a new song", () => {
    useRecommendationStore.getState().recordPlay(songs[0]);

    const history = useRecommendationStore.getState().playHistory;
    expect(history).toHaveLength(1);
    expect(history[0].songId).toBe("s1");
    expect(history[0].playCount).toBe(1);
  });

  it("recordPlay should increment play count for existing song", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay(songs[0]);
    store.recordPlay(songs[0]);

    const history = useRecommendationStore.getState().playHistory;
    expect(history).toHaveLength(1);
    expect(history[0].playCount).toBe(2);
  });

  it("getRecommendations should return empty array when playHistory is empty", () => {
    const result = useRecommendationStore.getState().getRecommendations();
    expect(result).toEqual([]);
  });

  it("getRecommendations should return recommendations based on play history", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay(songs[0]);

    const result = useRecommendationStore.getState().getRecommendations();
    expect(result.length).toBeGreaterThan(0);
    result.forEach((song) => {
      expect(song.id).toBeDefined();
      expect(song.title).toBeDefined();
      expect(song.artist).toBeDefined();
    });
  });

  it("getFavoriteArtists should return sorted artist counts", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay(songs[0]);
    store.recordPlay(songs[0]);
    store.recordPlay(songs[2]);

    const artists = useRecommendationStore.getState().getFavoriteArtists();
    expect(artists).toHaveLength(2);
    expect(artists[0].artist).toBe("Artist A");
    expect(artists[0].playCount).toBe(2);
    expect(artists[1].artist).toBe("Artist B");
    expect(artists[1].playCount).toBe(1);
  });

  it("clearPlayHistory should clear all records", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay(songs[0]);
    store.clearPlayHistory();

    expect(useRecommendationStore.getState().playHistory).toHaveLength(0);
  });

  it("refreshRecommendations stores explainable recommendations", () => {
    const store = useRecommendationStore.getState();
    store.refreshRecommendations(usePlaylistStore.getState().songs, createContext());

    const recommendations = useRecommendationStore.getState().recommendations;
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].song.id).toBeDefined();
    expect(recommendations[0].reasons.length).toBeGreaterThan(0);
    expect(useRecommendationStore.getState().lastGeneratedAt).toBeGreaterThan(0);
  });

  it("dismissRecommendation removes a song from stored recommendations", () => {
    const store = useRecommendationStore.getState();
    store.refreshRecommendations(usePlaylistStore.getState().songs, createContext());

    const firstId = useRecommendationStore.getState().recommendations[0].song.id;
    store.dismissRecommendation(firstId);

    expect(useRecommendationStore.getState().dismissedSongIds).toContain(firstId);
    expect(useRecommendationStore.getState().recommendations.some((item) => item.song.id === firstId)).toBe(false);
  });

  it("removes dismissed songs from active recommendations", () => {
    const store = useRecommendationStore.getState();
    store.refreshRecommendations(usePlaylistStore.getState().songs, createContext());

    store.dismissRecommendation("s1");

    expect(useRecommendationStore.getState().recommendations.map((item) => item.song.id)).not.toContain("s1");
  });

  it("filters negative-feedback artists when fallback recommendations are generated", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay(songs[2]);
    store.addNegativeFeedback(songs[0]);

    const result = store.getRecommendations();

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((song) => song.artist === "Artist A")).toBe(false);
  });
});
