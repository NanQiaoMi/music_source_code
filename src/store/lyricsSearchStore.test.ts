import { describe, it, expect, beforeEach } from "vitest";
import { useLyricsSearchStore } from "./lyricsSearchStore";

describe("lyricsSearchStore", () => {
  beforeEach(() => {
    useLyricsSearchStore.setState({
      searchQuery: "",
      searchResults: [],
      isLoading: false,
      error: null,
      currentLyrics: null,
      parsedLyrics: [],
      searchHistory: [],
      favoriteLyrics: [],
      currentSongId: null,
      lyricSourceState: "none",
    });
    localStorage.clear();
  });

  it("keeps manual imported lyrics for the current song", () => {
    const store = useLyricsSearchStore.getState();

    store.setCurrentSongId("song-1");
    store.importManualLyrics("[00:01.00]Hello");

    const state = useLyricsSearchStore.getState();
    expect(state.currentSongId).toBe("song-1");
    expect(state.lyricSourceState).toBe("manual");
    expect(state.currentLyrics?.source).toBe("manual");
    expect(state.parsedLyrics[0].text).toBe("Hello");
  });
});
