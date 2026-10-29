import { create } from "zustand";
import { persist } from "zustand/middleware";
import { evaluateSmartPlaylistRules } from "@/lib/smart-playlist/ruleEngine";
import { Song } from "@/types/song";
import { useQueueStore } from "./queueStore";
import { useStatsAchievementsStore } from "./statsAchievementsStore";

import {
  DEFAULT_SMART_PLAYLISTS,
  findMatchingSong,
  generateM3U,
  generatePLS,
  generateWPL,
  generateXSPF,
  parseM3UExtInfo,
  parseXmlAttribute,
  parseXmlValue,
  withSongCount,
  type PlaylistExportFormat,
  type SmartPlaylist,
  type SmartPlaylistInputs,
  type SmartPlaylistRule,
  type SmartPlaylistState,
  type SmartPlaylistType,
} from "./smartPlaylist/helpers";

export type {
  PlaylistExportFormat,
  SmartPlaylist,
  SmartPlaylistInputs,
  SmartPlaylistRule,
  SmartPlaylistType,
};
export { DEFAULT_SMART_PLAYLISTS };

export const useSmartPlaylistStore = create<SmartPlaylistState>()(
  persist(
    (set, get) => ({
      smartPlaylists: DEFAULT_SMART_PLAYLISTS,
      customPlaylists: [],
      selectedPlaylist: null,
      isGenerating: false,
      generateProgress: 0,

      createSmartPlaylist: (name, type, rules = []) => {
        const playlist: SmartPlaylist = {
          id: `smart-${Date.now()}`,
          name,
          type,
          rules,
          isEnabled: true,
          lastUpdated: Date.now(),
          songCount: 0,
        };

        set((state) => ({ customPlaylists: [...state.customPlaylists, playlist] }));
        return playlist;
      },

      updateSmartPlaylist: (id, updates) => {
        set((state) => ({
          smartPlaylists: state.smartPlaylists.map((playlist) =>
            playlist.id === id ? { ...playlist, ...updates } : playlist
          ),
          customPlaylists: state.customPlaylists.map((playlist) =>
            playlist.id === id ? { ...playlist, ...updates } : playlist
          ),
        }));
      },

      deleteSmartPlaylist: (id) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.filter((playlist) => playlist.id !== id),
          selectedPlaylist: state.selectedPlaylist?.id === id ? null : state.selectedPlaylist,
        }));
      },

      toggleSmartPlaylist: (id) => {
        set((state) => ({
          smartPlaylists: state.smartPlaylists.map((playlist) =>
            playlist.id === id ? { ...playlist, isEnabled: !playlist.isEnabled } : playlist
          ),
          customPlaylists: state.customPlaylists.map((playlist) =>
            playlist.id === id ? { ...playlist, isEnabled: !playlist.isEnabled } : playlist
          ),
        }));
      },

      setSelectedPlaylist: (playlist) => set({ selectedPlaylist: playlist }),

      addRule: (playlistId, rule) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, rules: [...playlist.rules, rule], lastUpdated: Date.now() }
              : playlist
          ),
        }));
      },

      updateRule: (playlistId, ruleId, updates) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.map((playlist) =>
            playlist.id === playlistId
              ? {
                  ...playlist,
                  rules: playlist.rules.map((rule) =>
                    rule.id === ruleId ? { ...rule, ...updates } : rule
                  ),
                  lastUpdated: Date.now(),
                }
              : playlist
          ),
        }));
      },

      deleteRule: (playlistId, ruleId) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.map((playlist) =>
            playlist.id === playlistId
              ? {
                  ...playlist,
                  rules: playlist.rules.filter((rule) => rule.id !== ruleId),
                  lastUpdated: Date.now(),
                }
              : playlist
          ),
        }));
      },

      generatePlaylist: (playlist, allSongs, inputs = {}) => {
        let results: Song[] = [];

        switch (playlist.type) {
          case "recently-added":
            results = allSongs.filter(
              (song) => song.addedAt && Date.now() - song.addedAt < 30 * 86400000
            );
            if (results.length === 0) results = allSongs.slice(0, 50);
            break;

          case "recently-played": {
            const recentlyPlayedIds = new Set(
              useQueueStore
                .getState()
                .history.slice(0, 50)
                .map((song) => song.id)
            );
            results = allSongs.filter((song) => recentlyPlayedIds.has(song.id));
            if (results.length === 0) results = allSongs.slice(0, 50);
            break;
          }

          case "most-played":
            results = [...allSongs]
              .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
              .slice(0, 50);
            break;

          case "least-played":
            results = [...allSongs]
              .sort((a, b) => (a.playCount || 0) - (b.playCount || 0))
              .slice(0, 50);
            break;

          case "favorites": {
            const statsStore = useStatsAchievementsStore.getState();
            results =
              statsStore.listeningStats.topSongs
                ?.map((item) => item.song)
                .filter(Boolean)
                .slice(0, 50) || allSongs.slice(0, 50);
            break;
          }

          case "never-played":
            results = allSongs.filter((song) => (song.playCount || 0) === 0);
            if (results.length === 0) results = allSongs.slice(0, 50);
            break;

          case "custom":
            results = allSongs.filter((song) =>
              evaluateSmartPlaylistRules(song, playlist.rules, inputs.emotions || {})
            );
            break;

          default:
            results = allSongs;
        }

        return results;
      },

      generateAllPlaylists: async (allSongs, inputs = {}) => {
        set({ isGenerating: true, generateProgress: 0 });

        const allPlaylists = [...get().smartPlaylists, ...get().customPlaylists];
        for (let i = 0; i < allPlaylists.length; i++) {
          const playlist = allPlaylists[i];
          if (playlist.isEnabled) {
            const songs = get().generatePlaylist(playlist, allSongs, inputs);
            get().updateSmartPlaylist(playlist.id, withSongCount(playlist, songs.length));
          }

          set({ generateProgress: Math.round(((i + 1) / allPlaylists.length) * 100) });
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        set({ isGenerating: false, generateProgress: 100 });
      },

      exportPlaylist: (songs, format) => {
        if (format === "m3u" || format === "m3u8") return generateM3U(songs);
        if (format === "pls") return generatePLS(songs);
        if (format === "xspf") return generateXSPF(songs);
        if (format === "wpl") return generateWPL(songs);
        if (format === "txt")
          return songs.map((song) => `${song.artist} - ${song.title}`).join("\n");
        return generateM3U(songs);
      },

      importPlaylist: (content, format, allSongs) => {
        const matchedSongs: Song[] = [];
        const lines = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        const pushMatch = (song: Song | undefined) => {
          if (song && !matchedSongs.some((matched) => matched.id === song.id)) {
            matchedSongs.push(song);
          }
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if ((format === "m3u" || format === "m3u8") && line.startsWith("#")) {
            const label = parseM3UExtInfo(line);
            if (label) pushMatch(findMatchingSong(label, allSongs));
            continue;
          }

          if (
            format === "pls" &&
            (line.startsWith("Title") || line.startsWith("File")) &&
            line.includes("=")
          ) {
            const value = line.slice(line.indexOf("=") + 1);
            pushMatch(findMatchingSong(value, allSongs));
            continue;
          }

          if (format === "xspf") {
            const value = parseXmlValue(line, "title") || parseXmlValue(line, "location");
            if (value) pushMatch(findMatchingSong(value, allSongs));
            continue;
          }

          if (format === "wpl" && line.includes("<media")) {
            const value = parseXmlAttribute(line, "title") || parseXmlAttribute(line, "src");
            if (value) pushMatch(findMatchingSong(value, allSongs));
            continue;
          }

          if (line.startsWith("#") || line.startsWith("<") || line.includes("=")) continue;
          pushMatch(findMatchingSong(line, allSongs));
        }

        return matchedSongs;
      },

      getDefaultSmartPlaylists: () => DEFAULT_SMART_PLAYLISTS,

      resetToDefaults: () => {
        set({
          smartPlaylists: DEFAULT_SMART_PLAYLISTS,
          customPlaylists: [],
          selectedPlaylist: null,
        });
      },

      clearAll: () => {
        set({
          smartPlaylists: DEFAULT_SMART_PLAYLISTS,
          customPlaylists: [],
          selectedPlaylist: null,
        });
      },
    }),
    {
      skipHydration: true,
      name: "smart-playlist-store-v4",
      partialize: (state) => ({
        smartPlaylists: state.smartPlaylists,
        customPlaylists: state.customPlaylists,
      }),
    }
  )
);
