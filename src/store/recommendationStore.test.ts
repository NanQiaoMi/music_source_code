import { describe, it, expect, beforeEach } from "vitest";
import { useRecommendationStore } from "./recommendationStore";
import { usePlaylistStore } from "./playlistStore";

describe("recommendationStore", () => {
  beforeEach(() => {
    useRecommendationStore.setState({
      playHistory: [],
      recommendations: [],
      isLoading: false,
    });
    usePlaylistStore.setState({
      songs: [
        {
          id: "s1",
          title: "Song One",
          artist: "Artist A",
          album: "Album 1",
          cover: "/cover.png",
          duration: 200,
        },
        {
          id: "s2",
          title: "Song Two",
          artist: "Artist A",
          album: "Album 1",
          cover: "/cover.png",
          duration: 180,
        },
        {
          id: "s3",
          title: "Song Three",
          artist: "Artist B",
          album: "Album 2",
          cover: "/cover.png",
          duration: 220,
        },
      ],
    });
  });

  it("recordPlay should record a new song", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay({
      id: "s1",
      title: "Song One",
      artist: "Artist A",
      album: "Album 1",
      cover: "/cover.png",
      duration: 200,
    });

    const history = useRecommendationStore.getState().playHistory;
    expect(history).toHaveLength(1);
    expect(history[0].songId).toBe("s1");
    expect(history[0].playCount).toBe(1);
  });

  it("recordPlay should increment play count for existing song", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay({
      id: "s1",
      title: "Song One",
      artist: "Artist A",
      cover: "/cover.png",
      duration: 200,
    });
    store.recordPlay({
      id: "s1",
      title: "Song One",
      artist: "Artist A",
      cover: "/cover.png",
      duration: 200,
    });

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
    store.recordPlay({
      id: "s1",
      title: "Song One",
      artist: "Artist A",
      cover: "/cover.png",
      duration: 200,
    });

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
    store.recordPlay({
      id: "s1",
      title: "Song One",
      artist: "Artist A",
      cover: "/cover.png",
      duration: 200,
    });
    store.recordPlay({
      id: "s1",
      title: "Song One",
      artist: "Artist A",
      cover: "/cover.png",
      duration: 200,
    });
    store.recordPlay({
      id: "s3",
      title: "Song Three",
      artist: "Artist B",
      cover: "/cover.png",
      duration: 220,
    });

    const artists = useRecommendationStore.getState().getFavoriteArtists();
    expect(artists).toHaveLength(2);
    expect(artists[0].artist).toBe("Artist A");
    expect(artists[0].playCount).toBe(2);
    expect(artists[1].artist).toBe("Artist B");
    expect(artists[1].playCount).toBe(1);
  });

  it("clearPlayHistory should clear all records", () => {
    const store = useRecommendationStore.getState();
    store.recordPlay({
      id: "s1",
      title: "Song One",
      artist: "Artist A",
      cover: "/cover.png",
      duration: 200,
    });
    useRecommendationStore.getState().clearPlayHistory();

    expect(useRecommendationStore.getState().playHistory).toHaveLength(0);
  });
});