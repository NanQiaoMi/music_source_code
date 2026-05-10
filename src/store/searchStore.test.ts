import { describe, it, expect, beforeEach } from "vitest";
import { useSearchStore } from "./searchStore";

const mockSongs = [
  {
    id: "1",
    title: "Hello World",
    artist: "Artist A",
    album: "Album X",
    duration: 200,
    cover: "/cover.svg",
  },
  {
    id: "2",
    title: "Goodbye World",
    artist: "Artist B",
    album: "Album Y",
    duration: 300,
    cover: "/cover.svg",
  },
  {
    id: "3",
    title: "Hello Again",
    artist: "Artist A",
    album: "Album Z",
    duration: 150,
    cover: "/cover.svg",
  },
  {
    id: "4",
    title: "Test Song",
    artist: "Artist C",
    album: "Album X",
    duration: 400,
    cover: "/cover.svg",
  },
  {
    id: "5",
    title: "Another Hello",
    artist: "Artist D",
    album: "Album W",
    duration: 180,
    cover: "/cover.svg",
  },
  {
    id: "6",
    title: "Long Song",
    artist: "Artist E",
    album: "Album V",
    duration: 500,
    cover: "/cover.svg",
  },
  {
    id: "7",
    title: "Short Song",
    artist: "Artist F",
    album: "Album U",
    duration: 90,
    cover: "/cover.svg",
  },
  {
    id: "8",
    title: "Medium Song",
    artist: "Artist G",
    album: "Album T",
    duration: 250,
    cover: "/cover.svg",
  },
  {
    id: "9",
    title: "Extra Song",
    artist: "Artist H",
    album: "Album S",
    duration: 350,
    cover: "/cover.svg",
  },
  {
    id: "10",
    title: "Last Song",
    artist: "Artist I",
    album: "Album R",
    duration: 120,
    cover: "/cover.svg",
  },
  {
    id: "11",
    title: "Bonus Track",
    artist: "Artist J",
    album: "Album Q",
    duration: 220,
    cover: "/cover.svg",
  },
  {
    id: "12",
    title: "Hidden Gem",
    artist: "Artist K",
    album: "Album P",
    duration: 310,
    cover: "/cover.svg",
  },
];

describe("searchStore", () => {
  beforeEach(() => {
    useSearchStore.setState({
      query: "",
      results: [],
      page: 1,
      pageSize: 5,
      totalResults: 0,
      searchHistory: [],
      filters: { type: "all", durationRange: null },
      isSearching: false,
      recentSearches: [],
      searchType: "all",
      isVoiceSearch: false,
    });
  });

  it("search 返回分页结果", () => {
    const store = useSearchStore.getState();
    store.setQuery("Hello");
    useSearchStore.getState().search(mockSongs);
    const state = useSearchStore.getState();
    expect(state.totalResults).toBe(3);
    expect(state.results.length).toBeLessThanOrEqual(5);
    expect(state.page).toBe(1);
  });

  it("setPage 正确切换页面", () => {
    const store = useSearchStore.getState();
    store.setQuery("Song");
    useSearchStore.getState().search(mockSongs);
    let state = useSearchStore.getState();
    expect(state.totalResults).toBe(6);
    expect(state.results.length).toBeGreaterThan(0);

    useSearchStore.getState().setPage(2);
    state = useSearchStore.getState();
    expect(state.page).toBe(2);
  });

  it("searchHistory 正确保存", () => {
    const store = useSearchStore.getState();
    store.setQuery("Hello");
    store.search(mockSongs);
    let history = useSearchStore.getState().searchHistory;
    expect(history).toContain("Hello");

    useSearchStore.getState().setQuery("World");
    useSearchStore.getState().search(mockSongs);
    history = useSearchStore.getState().searchHistory;
    expect(history[0]).toBe("World");
    expect(history.length).toBe(2);
  });

  it("clearHistory 清空历史", () => {
    useSearchStore.getState().addToHistory("test1");
    useSearchStore.getState().addToHistory("test2");
    expect(useSearchStore.getState().searchHistory.length).toBe(2);
    useSearchStore.getState().clearHistory();
    expect(useSearchStore.getState().searchHistory.length).toBe(0);
  });

  it("filter 过滤正确", () => {
    const store = useSearchStore.getState();
    store.setQuery("Artist A");
    store.setFilterType("artist");
    store.search(mockSongs);
    const state = useSearchStore.getState();
    expect(state.totalResults).toBe(2);
    state.results.forEach((song) => {
      expect(song.artist.toLowerCase()).toContain("artist a");
    });
  });
});
