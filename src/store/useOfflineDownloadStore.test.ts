import { describe, it, expect, beforeEach, vi } from "vitest";
import { useOfflineDownloadStore } from "./useOfflineDownloadStore";
import { Song } from "@/types/song";

describe("useOfflineDownloadStore", () => {
  beforeEach(() => {
    useOfflineDownloadStore.setState({
      tasks: {},
      activeCount: 0,
      concurrencyLimit: 3,
      totalSpeed: 0,
      totalSpeedFormatted: "0 KB/s",
      offlineRecords: [],
      offlineSongIds: new Set(),
      isLoadingRecords: false,
    });
  });

  it("should initialize with default empty state", () => {
    const state = useOfflineDownloadStore.getState();
    expect(state.tasks).toEqual({});
    expect(state.activeCount).toBe(0);
    expect(state.concurrencyLimit).toBe(3);
  });

  it("should update concurrency limit within 1..5 bounds", () => {
    const { setConcurrency } = useOfflineDownloadStore.getState();
    setConcurrency(4);
    expect(useOfflineDownloadStore.getState().concurrencyLimit).toBe(4);

    setConcurrency(10);
    expect(useOfflineDownloadStore.getState().concurrencyLimit).toBe(5);

    setConcurrency(0);
    expect(useOfflineDownloadStore.getState().concurrencyLimit).toBe(1);
  });

  it("should add a single download task into pending state", async () => {
    const dummySong: Song = {
      id: "song-101",
      title: "晴天",
      artist: "周杰伦",
      album: "叶惠美",
      duration: 269,
      source: "netease",
    };

    const { addDownload } = useOfflineDownloadStore.getState();
    await addDownload(dummySong, "lossless");

    const state = useOfflineDownloadStore.getState();
    expect(state.tasks["song-101"]).toBeDefined();
    expect(state.tasks["song-101"].song.title).toBe("晴天");
  });

  it("should add batch download tasks", async () => {
    const songs: Song[] = [
      { id: "song-1", title: "Track 1", artist: "Artist 1", duration: 180, source: "netease" },
      { id: "song-2", title: "Track 2", artist: "Artist 2", duration: 200, source: "qq" },
    ];

    const { addBatchDownloads } = useOfflineDownloadStore.getState();
    await addBatchDownloads(songs);

    const state = useOfflineDownloadStore.getState();
    expect(state.tasks["song-1"]).toBeDefined();
    expect(state.tasks["song-2"]).toBeDefined();
  });

  it("should pause and cancel download tasks", () => {
    const dummySong: Song = {
      id: "song-102",
      title: "七里香",
      artist: "周杰伦",
      duration: 299,
      source: "netease",
    };

    useOfflineDownloadStore.setState({
      tasks: {
        "song-102": {
          id: "song-102",
          song: dummySong,
          status: "downloading",
          progress: 45,
          downloadedBytes: 45000,
          totalBytes: 100000,
          speed: 10240,
          speedFormatted: "10 KB/s",
          quality: "lossless",
          addedAt: Date.now(),
        },
      },
      activeCount: 1,
    });

    const { pauseDownload, cancelDownload } = useOfflineDownloadStore.getState();
    pauseDownload("song-102");
    expect(useOfflineDownloadStore.getState().tasks["song-102"].status).toBe("paused");

    cancelDownload("song-102");
    expect(useOfflineDownloadStore.getState().tasks["song-102"]).toBeUndefined();
  });
});
