import { create } from "zustand";
import { songsData, searchSongs, filterSongsByArtist, filterSongsByAlbum } from "@/data/songsData";
import { getAllStoredMusic } from "@/services/localMusicStorage";
import {
  getCoverFromCache,
  saveCoverToCache,
  deleteCoverFromCache,
  preloadCovers,
} from "@/services/coverCache";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover: string;
  audioUrl?: string;
  lyrics?: string;
  duration: number;
  source?: "local" | "demo" | "imported" | string;
  addedAt?: number;
  playCount?: number;
}

export interface PlaylistState {
  songs: Song[];
  recentPlayed: Song[];
  selectedSong: Song | null;
  searchQuery: string;
  filteredSongs: Song[];

  initializePlaylist: () => Promise<void>;
  addSong: (song: Song) => void;
  removeSong: (songId: string) => void;
  updateSong: (songId: string, updates: Partial<Song>) => void;
  setSelectedSong: (song: Song | null) => void;
  addToRecentPlayed: (song: Song) => void;
  searchSongs: (query: string) => void;
  filterByArtist: (artist: string) => void;
  filterByAlbum: (album: string) => void;
  clearFilters: () => void;
  importSongs: (songs: Song[]) => void;
  exportSongs: () => Song[];
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  songs: [],
  recentPlayed: [],
  selectedSong: null,
  searchQuery: "",
  filteredSongs: [],

  initializePlaylist: async () => {
    const songsDataLength = songsData.length;
    const demoSongs = songsData.map((song, index) => ({
      ...song,
      addedAt: Date.now() - (songsDataLength - index) * 86400000,
      playCount: Math.floor(Math.random() * 20),
    }));

    let storedSongs: Song[] = [];
    try {
      const stored = await getAllStoredMusic();
      storedSongs = stored.map((music, index) => ({
        id: music.id,
        title: music.title,
        artist: music.artist,
        album: music.album,
        cover:
          music.coverData ||
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
        audioUrl: `stored://${music.id}`,
        lyrics: music.lyrics,
        duration: music.duration,
        source: "local" as const,
        addedAt: Date.now() - (stored.length - index) * 86400000,
        playCount: 0,
      }));
    } catch (error) {
      console.error("Error loading stored music:", error);
    }

    const allSongs = [...demoSongs, ...storedSongs];

    const songsWithCachedCovers = await Promise.all(
      allSongs.map(async (song) => {
        if (song.source === "local" && song.cover && song.cover.length > 1000) {
          return song;
        }

        const cachedCover = await getCoverFromCache(song.id);
        if (cachedCover) {
          return { ...song, cover: cachedCover };
        }

        if (song.cover && !song.cover.startsWith("data:") && !song.cover.startsWith("blob:")) {
          saveCoverToCache(song.id, song.cover, song.cover).catch(console.error);
        }

        return song;
      })
    );

    set({
      songs: songsWithCachedCovers,
      filteredSongs: songsWithCachedCovers,
      recentPlayed: songsWithCachedCovers,
    });
  },

  addSong: (song) =>
    set((state) => ({
      songs: [...state.songs, song],
      filteredSongs: [...state.songs, song],
    })),

  removeSong: (songId) =>
    set((state) => {
      const newSongs = state.songs.filter((s) => s.id !== songId);
      deleteCoverFromCache(songId).catch(console.error);
      return {
        songs: newSongs,
        filteredSongs: newSongs,
      };
    }),

  updateSong: (songId, updates) =>
    set((state) => {
      const newSongs = state.songs.map((s) => (s.id === songId ? { ...s, ...updates } : s));
      return {
        songs: newSongs,
        filteredSongs: newSongs,
      };
    }),

  setSelectedSong: (song) => set({ selectedSong: song }),

  addToRecentPlayed: (song) =>
    set((state) => {
      const filtered = state.recentPlayed.filter((s) => s.id !== song.id);
      return {
        recentPlayed: [song, ...filtered],
      };
    }),

  searchSongs: (query) => {
    const { songs } = get();
    if (!query.trim()) {
      set({ filteredSongs: songs, searchQuery: "" });
      return;
    }
    const results = searchSongs(query, songs);
    set({ filteredSongs: results, searchQuery: query });
  },

  filterByArtist: (artist) => {
    const { songs } = get();
    const results = filterSongsByArtist(artist, songs);
    set({ filteredSongs: results });
  },

  filterByAlbum: (album) => {
    const { songs } = get();
    const results = filterSongsByAlbum(album, songs);
    set({ filteredSongs: results });
  },

  clearFilters: () => {
    const { songs } = get();
    set({ filteredSongs: songs, searchQuery: "" });
  },

  importSongs: (newSongs) =>
    set((state) => {
      const merged = [...state.songs, ...newSongs];
      const unique = merged.filter(
        (song, index, self) => index === self.findIndex((s) => s.id === song.id)
      );
      const newRecentPlayed = [...newSongs, ...state.recentPlayed].filter(
        (song, index, self) => index === self.findIndex((s) => s.id === song.id)
      );
      return {
        songs: unique,
        filteredSongs: unique,
        recentPlayed: newRecentPlayed,
      };
    }),

  exportSongs: () => get().songs,
}));
