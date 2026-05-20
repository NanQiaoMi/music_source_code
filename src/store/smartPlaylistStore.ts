import { create } from "zustand";
import { persist } from "zustand/middleware";
import { evaluateSmartPlaylistRules, type RuleEmotionMap } from "@/lib/smart-playlist/ruleEngine";
import { Song } from "@/types/song";
import { useQueueStore } from "./queueStore";
import { useStatsAchievementsStore } from "./statsAchievementsStore";

export type SmartPlaylistType =
  | "recently-added"
  | "recently-played"
  | "most-played"
  | "least-played"
  | "favorites"
  | "never-played"
  | "custom";

export interface SmartPlaylistRule {
  id: string;
  field:
    | "artist"
    | "album"
    | "genre"
    | "duration"
    | "playCount"
    | "addedTime"
    | "title"
    | "emotion";
  operator:
    | "contains"
    | "equals"
    | "greaterThan"
    | "lessThan"
    | "notContains"
    | "notEquals"
    | "inQuadrant";
  value: string | number;
}

export interface SmartPlaylist {
  id: string;
  name: string;
  type: SmartPlaylistType;
  description?: string;
  rules: SmartPlaylistRule[];
  isEnabled: boolean;
  lastUpdated: number;
  songCount: number;
}

export type PlaylistExportFormat = "m3u" | "m3u8" | "txt" | "pls" | "xspf" | "wpl";

export interface SmartPlaylistInputs {
  emotions?: RuleEmotionMap;
}

interface SmartPlaylistState {
  smartPlaylists: SmartPlaylist[];
  customPlaylists: SmartPlaylist[];
  selectedPlaylist: SmartPlaylist | null;
  isGenerating: boolean;
  generateProgress: number;

  createSmartPlaylist: (
    name: string,
    type: SmartPlaylistType,
    rules?: SmartPlaylistRule[]
  ) => SmartPlaylist;
  updateSmartPlaylist: (id: string, updates: Partial<SmartPlaylist>) => void;
  deleteSmartPlaylist: (id: string) => void;
  toggleSmartPlaylist: (id: string) => void;
  setSelectedPlaylist: (playlist: SmartPlaylist | null) => void;

  addRule: (playlistId: string, rule: SmartPlaylistRule) => void;
  updateRule: (playlistId: string, ruleId: string, updates: Partial<SmartPlaylistRule>) => void;
  deleteRule: (playlistId: string, ruleId: string) => void;

  generatePlaylist: (
    playlist: SmartPlaylist,
    allSongs: Song[],
    inputs?: SmartPlaylistInputs
  ) => Song[];
  generateAllPlaylists: (allSongs: Song[], inputs?: SmartPlaylistInputs) => Promise<void>;

  exportPlaylist: (songs: Song[], format: PlaylistExportFormat) => string;
  importPlaylist: (content: string, format: PlaylistExportFormat, allSongs: Song[]) => Song[];

  getDefaultSmartPlaylists: () => SmartPlaylist[];
  resetToDefaults: () => void;

  clearAll: () => void;
}

const DEFAULT_SMART_PLAYLISTS: SmartPlaylist[] = [
  {
    id: "recently-added",
    name: "Recently Added",
    type: "recently-added",
    description: "Songs added in the last 30 days",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "recently-played",
    name: "Recently Played",
    type: "recently-played",
    description: "Songs from recent queue history",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "most-played",
    name: "Most Played",
    type: "most-played",
    description: "Top 50 songs by play count",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "least-played",
    name: "Least Played",
    type: "least-played",
    description: "Songs with the lowest play count",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "favorites",
    name: "Favorites From Stats",
    type: "favorites",
    description: "Top songs from listening statistics",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "never-played",
    name: "Never Played",
    type: "never-played",
    description: "Songs with no play count yet",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "emotion-energetic",
    name: "Energetic Mood (Q1)",
    type: "custom",
    description: "Positive and high-energy tracks",
    rules: [{ id: "r1", field: "emotion", operator: "inQuadrant", value: "Q1" }],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "emotion-calm",
    name: "Calm Mood (Q4)",
    type: "custom",
    description: "Positive and relaxed tracks",
    rules: [{ id: "r2", field: "emotion", operator: "inQuadrant", value: "Q4" }],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
];

function withSongCount(playlist: SmartPlaylist, songCount: number): SmartPlaylist {
  return { ...playlist, songCount, lastUpdated: Date.now() };
}

function generateM3U(songs: Song[]): string {
  let m3u = "#EXTM3U\n";

  for (const song of songs) {
    m3u += `#EXTINF:${Math.round(song.duration)},${song.artist} - ${song.title}\n`;
    m3u += `${song.filePath || song.audioUrl || `${song.id}.mp3`}\n`;
  }

  return m3u;
}

function generatePLS(songs: Song[]): string {
  let pls = "[playlist]\n";
  pls += `NumberOfEntries=${songs.length}\n\n`;

  songs.forEach((song, i) => {
    const num = i + 1;
    pls += `File${num}=${song.filePath || song.audioUrl || `${song.id}.mp3`}\n`;
    pls += `Title${num}=${song.artist} - ${song.title}\n`;
    pls += `Length${num}=${Math.round(song.duration)}\n\n`;
  });

  pls += "Version=2\n";
  return pls;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const normalized = String(entity).toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";

    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);

    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
  });
}

function generateXSPF(songs: Song[]): string {
  let xspf = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xspf += '<playlist version="1" xmlns="http://xspf.org/ns/0/">\n';
  xspf += "  <trackList>\n";

  for (const song of songs) {
    xspf += "    <track>\n";
    xspf += `      <location>${escapeXml(song.filePath || song.audioUrl || `${song.id}.mp3`)}</location>\n`;
    xspf += `      <title>${escapeXml(song.title)}</title>\n`;
    xspf += `      <creator>${escapeXml(song.artist)}</creator>\n`;
    if (song.album) xspf += `      <album>${escapeXml(song.album)}</album>\n`;
    xspf += `      <duration>${Math.round(song.duration * 1000)}</duration>\n`;
    xspf += "    </track>\n";
  }

  xspf += "  </trackList>\n";
  xspf += "</playlist>\n";
  return xspf;
}

function generateWPL(songs: Song[]): string {
  let wpl = '<?xml version="1.0" encoding="UTF-8"?>\n';
  wpl += "<smil>\n";
  wpl += "  <head>\n";
  wpl += "    <title>Playlist</title>\n";
  wpl += '    <meta name="PlaylistType" content="audio"/>\n';
  wpl += `    <meta name="TotalDuration" content="${songs.reduce((sum, song) => sum + song.duration, 0)}"/>\n`;
  wpl += `    <meta name="ItemCount" content="${songs.length}"/>\n`;
  wpl += "  </head>\n";
  wpl += "  <body>\n";
  wpl += "    <seq>\n";

  for (const song of songs) {
    wpl += `      <media src="${escapeXml(song.filePath || song.audioUrl || `${song.id}.mp3`)}"`;
    wpl += ` title="${escapeXml(song.title)}"`;
    wpl += ` artist="${escapeXml(song.artist)}"`;
    if (song.album) wpl += ` album="${escapeXml(song.album)}"`;
    wpl += ` duration="${Math.round(song.duration * 1000)}"/>\n`;
  }

  wpl += "    </seq>\n";
  wpl += "  </body>\n";
  wpl += "</smil>\n";
  return wpl;
}

function normalizePlaylistMatchValue(value: string | undefined): string {
  return decodeXml(value || "")
    .trim()
    .replace(/^file:\/\/+/i, "")
    .toLowerCase();
}

function fileNameFromPath(value: string | undefined): string {
  return normalizePlaylistMatchValue(value).split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] || "";
}

function withoutExtension(value: string): string {
  return value.replace(/\.[a-z0-9]+$/i, "");
}

function songMatchCandidates(song: Song): string[] {
  const fileName = fileNameFromPath(song.filePath || song.audioUrl || `${song.id}.mp3`);
  const values = [
    song.title,
    song.artist,
    `${song.artist} - ${song.title}`,
    song.id,
    `${song.id}.mp3`,
    song.filePath,
    song.audioUrl,
    fileName,
    withoutExtension(fileName),
  ];

  return Array.from(
    new Set(values.map((value) => normalizePlaylistMatchValue(value)).filter(Boolean))
  );
}

function findMatchingSong(line: string, allSongs: Song[]): Song | undefined {
  const searchTerm = normalizePlaylistMatchValue(line);
  if (!searchTerm) return undefined;

  return allSongs.find((song) =>
    songMatchCandidates(song).some(
      (candidate) =>
        searchTerm === candidate || searchTerm.includes(candidate) || candidate.includes(searchTerm)
    )
  );
}

function parseXmlValue(line: string, tag: string): string | null {
  const match = line.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return match?.[1] ? decodeXml(match[1]) : null;
}

function parseXmlAttribute(line: string, attribute: string): string | null {
  const match = line.match(new RegExp(`${attribute}=["'](.*?)["']`));
  return match?.[1] ? decodeXml(match[1]) : null;
}

function parseM3UExtInfo(line: string): string | null {
  if (!line.toUpperCase().startsWith("#EXTINF")) return null;
  const commaIndex = line.indexOf(",");
  return commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : null;
}

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
      name: "smart-playlist-store-v4",
      partialize: (state) => ({
        smartPlaylists: state.smartPlaylists,
        customPlaylists: state.customPlaylists,
      }),
    }
  )
);
