import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";
import { useAIStore } from "./aiStore";
import { useCrossfadeStore } from "./crossfadeStore";
import { useKnowledgeStore } from "./knowledgeStore";
import { useLibraryManagerStore } from "./libraryManagerStore";
import { useLinerNotesStore } from "./linerNotesStore";
import {
  extractMetadataFromFilename,
  useMetadataEditorStore,
  type BatchEditOperation,
} from "./metadataEditorStore";

function resetStores() {
  localStorage.clear();
  useAIStore.setState(useAIStore.getInitialState(), true);
  useCrossfadeStore.setState(useCrossfadeStore.getInitialState(), true);
  useKnowledgeStore.setState(useKnowledgeStore.getInitialState(), true);
  useLibraryManagerStore.setState(useLibraryManagerStore.getInitialState(), true);
  useLinerNotesStore.setState(useLinerNotesStore.getInitialState(), true);
  useMetadataEditorStore.setState(useMetadataEditorStore.getInitialState(), true);
}

function createSong(
  overrides: Partial<Song> & { id: string; title: string; artist: string }
): Song {
  return {
    duration: 180,
    source: "local",
    ...overrides,
  };
}

function configureAI() {
  useAIStore.setState({
    isEnabled: true,
    activeConfigId: "cfg-1",
    configs: [
      {
        id: "cfg-1",
        name: "Test AI",
        baseUrl: "https://ai.example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        status: "online",
      },
    ],
  });
}

describe("business intelligence stores", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetStores();
  });

  it("manages crossfade BPM data, queue state, presets, and bounded persisted history", () => {
    const store = useCrossfadeStore.getState();

    for (let i = 0; i < 105; i++) {
      store.addBPMInfo({ songId: `song-${i}`, bpm: 100 + i, confidence: 0.8, timestamp: i });
    }
    store.addBPMInfo({ songId: "song-104", bpm: 128, confidence: 0.99, timestamp: 999 });
    store.setSettings({ minBPMDiff: 5, duration: 10 });
    store.addToQueue("song-1", "song-2", 120, 123);

    const item = useCrossfadeStore.getState().queue[0];
    store.updateQueueItemStatus(item.id, "completed", 100, new Blob(["mix"]));
    store.incrementProcessed();
    store.applyPreset("quick");
    store.saveAsPreset("Custom");

    expect(store.getBPMInfo("song-104")).toMatchObject({ bpm: 128, confidence: 0.99 });
    expect(useCrossfadeStore.getState().queue[0]).toMatchObject({
      status: "completed",
      progress: 100,
      bpmMatchScore: 90,
    });
    expect(useCrossfadeStore.getState().settings).toMatchObject({
      duration: 3,
      curveType: "linear",
      autoBPM: false,
    });
    expect(
      useCrossfadeStore.getState().findCompatiblePairs([
        { id: "a", bpm: 120 },
        { id: "b", bpm: 121 },
        { id: "c", bpm: 160 },
      ])
    ).toEqual([{ from: "a", to: "b", score: 100 }]);

    const persisted = localStorage.getItem("crossfade-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.bpmDatabase).toHaveLength(100);
    expect(parsed.state.queue).toBeUndefined();
    expect(parsed.state.totalProcessed).toBe(1);
  });

  it("generates and caches knowledge cards from AI responses while handling failed requests", async () => {
    configureAI();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "A concise backstory" } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '[{"term":"mirror","meaning":"self reflection"}]',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"archetype":"Night Pilot","motto":"Stay awake","genre":"Ambient","description":"Soft focus listener"}',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const store = useKnowledgeStore.getState();
    await store.fetchBackstory("Song", "Artist");
    await store.fetchBackstory("Song", "Artist");
    await store.fetchMetaphors("Song", "Artist", "lyrics");
    await store.generateDNAJournal({
      totalSongs: 10,
      averageValence: 0.1,
      averageEnergy: 0.2,
      dominantQuadrant: "Q1",
      genres: ["ambient"],
    });
    await store.fetchBackstory("Broken", "Artist", true);

    const state = useKnowledgeStore.getState();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(state.backstories["artist-song"].content).toBe("A concise backstory");
    expect(state.metaphors["artist-song"]).toEqual([
      { term: "mirror", meaning: "self reflection" },
    ]);
    expect(state.dnaJournal).toMatchObject({ archetype: "Night Pilot", genre: "Ambient" });
    expect(state.lastRawResponse).toContain("AI request failed: 500");

    store.clearCache();
    expect(useKnowledgeStore.getState()).toMatchObject({
      backstories: {},
      metaphors: {},
      dnaJournal: null,
    });
  });

  it("generates liner notes only when AI is enabled, caches by artist and title, and supports force refresh", async () => {
    configureAI();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "grainy silver pulse" } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "warm glass echo" } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const store = useLinerNotesStore.getState();
    await expect(store.getNotes("Artist", "Song", "lyrics", { x: 0.5, y: 0.6 })).resolves.toBe(
      "grainy silver pulse"
    );
    await expect(store.getNotes("Artist", "Song")).resolves.toBe("grainy silver pulse");
    await expect(store.getNotes("Artist", "Song", undefined, undefined, true)).resolves.toBe(
      "warm glass echo"
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useLinerNotesStore.getState().isGenerating).toBe(false);
    expect(useLinerNotesStore.getState().notes["Artist-Song"]).toBe("warm glass echo");

    useAIStore.getState().setEnabled(false);
    await expect(store.getNotes("Other", "Song")).resolves.toBeNull();

    useAIStore.getState().setEnabled(true);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(store.getNotes("FailedArtist", "FailedSong")).resolves.toBeNull();
    expect(useLinerNotesStore.getState().isGenerating).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("previews and applies metadata batch edits without changing non-targeted songs", () => {
    const first = createSong({ id: "1", title: "Old Mix", artist: "Artist", album: "Draft" });
    const second = createSong({ id: "2", title: "Other", artist: "Artist" });
    const operations: BatchEditOperation[] = [
      {
        id: "set-album",
        type: "set",
        field: "album",
        value: "Final",
        applyToSelected: true,
        selectedSongIds: [],
        createdAt: 1,
      },
      {
        id: "replace-title",
        type: "replace",
        field: "title",
        value: "New",
        searchValue: "Old",
        applyToSelected: false,
        selectedSongIds: ["1"],
        createdAt: 2,
      },
      {
        id: "append-genre",
        type: "append",
        field: "genre",
        value: " live",
        applyToSelected: false,
        selectedSongIds: ["2"],
        createdAt: 3,
      },
    ];
    const store = useMetadataEditorStore.getState();

    store.setSelectedSongs([first, second]);
    operations.forEach((operation) => store.addOperation(operation));
    store.saveCustomPattern("artist-title", "^(.+) - (.+)$");
    store.generatePreview();

    expect(store.getCustomPattern("artist-title")).toBe("^(.+) - (.+)$");
    expect(useMetadataEditorStore.getState().previewChanges.get("1")).toMatchObject({
      album: "Final",
      title: "New Mix",
    });
    expect(useMetadataEditorStore.getState().previewChanges.get("2")).toMatchObject({
      album: "Final",
      genre: " live",
    });

    store.applyChanges();
    expect(first).toMatchObject({ title: "New Mix", album: "Final" });
    expect(second).toMatchObject({ title: "Other", album: "Final", genre: " live" });
    expect(useMetadataEditorStore.getState().operations).toEqual([]);

    expect(
      extractMetadataFromFilename("12 - A Song", "^(\\d+)\\s*-\\s*(.+)$", [
        { field: "trackNumber", group: 1 },
        { field: "title", group: 2 },
      ])
    ).toEqual({ trackNumber: "12", title: "A Song" });

    const persisted = localStorage.getItem("metadata-editor-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.customPatterns["artist-title"]).toBe("^(.+) - (.+)$");
    expect(parsed.state.selectedSongs).toBeUndefined();
  });

  it("finds duplicate songs, recommends the higher quality copy, and updates real library stats", async () => {
    const store = useLibraryManagerStore.getState();
    const songs = [
      createSong({
        id: "low",
        title: "Same Song",
        artist: "Artist",
        album: "A",
        duration: 180,
        fileSize: 3_000_000,
        bitRate: 128,
        format: ".mp3",
      }),
      createSong({
        id: "high",
        title: " Same  Song ",
        artist: " artist ",
        album: "A",
        duration: 181,
        fileSize: 30_000_000,
        bitRate: 960,
        format: ".flac",
      }),
      createSong({
        id: "unique",
        title: "Unique",
        artist: "Other",
        album: "B",
        duration: 200,
        fileSize: 5_000_000,
        bitRate: 320,
        format: ".mp3",
      }),
    ];

    await store.findDuplicates(songs);
    store.updateLibraryStats(songs);

    const group = useLibraryManagerStore.getState().duplicateGroups[0];
    expect(group.recommendedSongId).toBe("high");
    expect(group.songs.find((song) => song.id === "high")).toMatchObject({
      fileSize: 30_000_000,
      bitrate: 960,
      format: ".flac",
      isRecommended: true,
    });
    expect(useLibraryManagerStore.getState().libraryStats).toMatchObject({
      totalSongs: 3,
      totalDuration: 561,
      totalFileSize: 38_000_000,
      artistsCount: 2,
      albumsCount: 2,
      duplicatesCount: 1,
    });

    store.keepDuplicate(group.groupId, "low");
    expect(useLibraryManagerStore.getState().duplicateGroups[0].recommendedSongId).toBe("low");
    await store.deleteSelectedDuplicates();
    expect(useLibraryManagerStore.getState().duplicateGroups[0].songs).toEqual([
      expect.objectContaining({ id: "low", isRecommended: true }),
    ]);
  });

  it("manages library rename rules, scan filters, folder monitors, and persisted manager preferences", () => {
    const store = useLibraryManagerStore.getState();

    store.addRenameRule({ id: "custom", name: "Custom", pattern: "{title}", example: "Song" });
    store.setSelectedRenameRule("custom");
    store.updateRenameRule("custom", { pattern: "{artist}-{title}" });
    store.setScanFilters({ formats: [".flac"], minDuration: 30 });
    store.addFolderMonitor({
      id: "folder-1",
      path: "D:/Music",
      name: "Music",
      isEnabled: true,
      lastScanTime: 0,
    });
    store.toggleFolderMonitor("folder-1");
    store.setIsWatchingFolders(true);

    expect(
      useLibraryManagerStore.getState().renameRules.find((rule) => rule.id === "custom")
    ).toMatchObject({
      pattern: "{artist}-{title}",
    });
    expect(useLibraryManagerStore.getState().scanFilters).toMatchObject({
      formats: [".flac"],
      minDuration: 30,
    });
    expect(useLibraryManagerStore.getState().folderMonitors[0].isEnabled).toBe(false);
    expect(useLibraryManagerStore.getState().isWatchingFolders).toBe(true);

    const persisted = localStorage.getItem("library-manager-store-v4");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.folderMonitors).toHaveLength(1);
    expect(parsed.state.libraryStats).toBeUndefined();
  });
});
