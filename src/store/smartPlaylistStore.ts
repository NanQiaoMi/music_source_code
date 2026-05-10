import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "@/types/song";
import { useQueueStore } from "./queueStore";
import { useStatsAchievementsStore } from "./statsAchievementsStore";
import { useEmotionStore } from "./emotionStore";

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

  generatePlaylist: (playlist: SmartPlaylist, allSongs: Song[]) => Song[];
  generateAllPlaylists: (allSongs: Song[]) => Promise<void>;

  exportPlaylist: (songs: Song[], format: PlaylistExportFormat) => string;
  importPlaylist: (content: string, format: PlaylistExportFormat, allSongs: Song[]) => Song[];

  getDefaultSmartPlaylists: () => SmartPlaylist[];
  resetToDefaults: () => void;

  clearAll: () => void;
}

const DEFAULT_SMART_PLAYLISTS: SmartPlaylist[] = [
  {
    id: "recently-added",
    name: "最近添加",
    type: "recently-added",
    description: "最近30天添加的歌曲",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "recently-played",
    name: "最近播放",
    type: "recently-played",
    description: "最近7天播放的歌曲",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "most-played",
    name: "播放最多",
    type: "most-played",
    description: "播放次数最多的50首歌曲",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "least-played",
    name: "播放最少",
    type: "least-played",
    description: "播放次数最少的50首歌曲",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "favorites",
    name: "收藏歌曲",
    type: "favorites",
    description: "收藏的所有歌曲",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "never-played",
    name: "从未播放",
    type: "never-played",
    description: "从未播放过的歌曲",
    rules: [],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "emotion-energetic",
    name: "充满活力 (Q1)",
    type: "custom",
    description: "积极且能量充沛的音乐",
    rules: [{ id: "r1", field: "emotion", operator: "inQuadrant", value: "Q1" }],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
  {
    id: "emotion-calm",
    name: "宁静随心 (Q4)",
    type: "custom",
    description: "轻松且平和的音乐",
    rules: [{ id: "r2", field: "emotion", operator: "inQuadrant", value: "Q4" }],
    isEnabled: true,
    lastUpdated: 0,
    songCount: 0,
  },
];

function evaluateRule(song: Song, rule: SmartPlaylistRule): boolean {
  const { field, operator, value } = rule;

  switch (field) {
    case "title":
      const title = song.title.toLowerCase();
      const titleValue = String(value).toLowerCase();
      if (operator === "contains") return title.includes(titleValue);
      if (operator === "notContains") return !title.includes(titleValue);
      if (operator === "equals") return title === titleValue;
      if (operator === "notEquals") return title !== titleValue;
      break;

    case "artist":
      const artist = song.artist.toLowerCase();
      const artistValue = String(value).toLowerCase();
      if (operator === "contains") return artist.includes(artistValue);
      if (operator === "notContains") return !artist.includes(artistValue);
      if (operator === "equals") return artist === artistValue;
      if (operator === "notEquals") return artist !== artistValue;
      break;

    case "album":
      const album = (song.album || "").toLowerCase();
      const albumValue = String(value).toLowerCase();
      if (operator === "contains") return album.includes(albumValue);
      if (operator === "notContains") return !album.includes(albumValue);
      if (operator === "equals") return album === albumValue;
      if (operator === "notEquals") return album !== albumValue;
      break;

    case "duration":
      const duration = song.duration;
      const durationValue = Number(value);
      if (operator === "greaterThan") return duration > durationValue;
      if (operator === "lessThan") return duration < durationValue;
      if (operator === "equals") return duration === durationValue;
      if (operator === "notEquals") return duration !== durationValue;
      break;

    case "emotion":
      const emotionMap = useEmotionStore.getState().emotionMap;
      const emotion = emotionMap[song.id];
      if (!emotion) return false;

      if (operator === "inQuadrant") {
        const quadrant = String(value);
        if (quadrant === "Q1") return emotion.x > 0 && emotion.y > 0;
        if (quadrant === "Q2") return emotion.x < 0 && emotion.y > 0;
        if (quadrant === "Q3") return emotion.x < 0 && emotion.y < 0;
        if (quadrant === "Q4") return emotion.x > 0 && emotion.y < 0;
      }
      break;

    default:
      return true;
  }

  return true;
}

function generateM3U(songs: Song[]): string {
  let m3u = "#EXTM3U\n";

  for (const song of songs) {
    m3u += `#EXTINF:${Math.round(song.duration)},${song.artist} - ${song.title}\n`;
    m3u += `${song.id}.mp3\n`;
  }

  return m3u;
}

function generatePLS(songs: Song[]): string {
  let pls = "[playlist]\n";
  pls += `NumberOfEntries=${songs.length}\n\n`;

  songs.forEach((song, i) => {
    const num = i + 1;
    pls += `File${num}=${song.id}.mp3\n`;
    pls += `Title${num}=${song.artist} - ${song.title}\n`;
    pls += `Length${num}=${Math.round(song.duration)}\n\n`;
  });

  pls += "Version=2\n";
  return pls;
}

function generateXSPF(songs: Song[]): string {
  let xspf = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xspf += '<playlist version="1" xmlns="http://xspf.org/ns/0/">\n';
  xspf += "  <trackList>\n";

  for (const song of songs) {
    xspf += "    <track>\n";
    xspf += `      <location>${escapeXml(song.id)}.mp3</location>\n`;
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
  wpl += '  <smil>\n';
  wpl += '    <head>\n';
  wpl += `      <title>Playlist</title>\n`;
  wpl += `      <meta name="PlaylistType" content="audio"/>\n`;
  wpl += `      <meta name="TotalDuration" content="${songs.reduce((s, t) => s + t.duration, 0)}"/>\n`;
  wpl += `      <meta name="ItemCount" content="${songs.length}"/>\n`;
  wpl += '    </head>\n';
  wpl += '    <body>\n';
  wpl += '      <seq>\n';

  for (const song of songs) {
    wpl += `        <media src="${escapeXml(song.id)}.mp3"`;
    wpl += ` title="${escapeXml(song.title)}"`;
    wpl += ` artist="${escapeXml(song.artist)}"`;
    if (song.album) wpl += ` album="${escapeXml(song.album)}"`;
    wpl += ` duration="${Math.round(song.duration * 1000)}"`;
    wpl += '/>\n';
  }

  wpl += '      </seq>\n';
  wpl += '    </body>\n';
  wpl += '  </smil>\n';
  return wpl;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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
          id: Date.now().toString(),
          name,
          type,
          rules,
          isEnabled: true,
          lastUpdated: Date.now(),
          songCount: 0,
        };

        set((state) => ({
          customPlaylists: [...state.customPlaylists, playlist],
        }));

        return playlist;
      },

      updateSmartPlaylist: (id, updates) => {
        set((state) => ({
          smartPlaylists: state.smartPlaylists.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          customPlaylists: state.customPlaylists.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      deleteSmartPlaylist: (id) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.filter((p) => p.id !== id),
        }));
      },

      toggleSmartPlaylist: (id) => {
        set((state) => ({
          smartPlaylists: state.smartPlaylists.map((p) =>
            p.id === id ? { ...p, isEnabled: !p.isEnabled } : p
          ),
          customPlaylists: state.customPlaylists.map((p) =>
            p.id === id ? { ...p, isEnabled: !p.isEnabled } : p
          ),
        }));
      },

      setSelectedPlaylist: (playlist) => {
        set({ selectedPlaylist: playlist });
      },

      addRule: (playlistId, rule) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.map((p) =>
            p.id === playlistId ? { ...p, rules: [...p.rules, rule] } : p
          ),
        }));
      },

      updateRule: (playlistId, ruleId, updates) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  rules: p.rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)),
                }
              : p
          ),
        }));
      },

      deleteRule: (playlistId, ruleId) => {
        set((state) => ({
          customPlaylists: state.customPlaylists.map((p) =>
            p.id === playlistId ? { ...p, rules: p.rules.filter((r) => r.id !== ruleId) } : p
          ),
        }));
      },

      generatePlaylist: (playlist, allSongs) => {
        let results: Song[] = [];

        switch (playlist.type) {
          case "recently-added":
            results = allSongs.filter(
              (song) => song.addedAt && Date.now() - song.addedAt < 30 * 86400000
            );
            if (results.length === 0) results = allSongs.slice(0, 50);
            break;

          case "recently-played":
            const queueStore = useQueueStore.getState();
            const recentlyPlayed = queueStore.history.slice(0, 50);
            const recentlyPlayedIds = new Set(recentlyPlayed.map((s) => s.id));
            results = allSongs.filter((s) => recentlyPlayedIds.has(s.id));
            if (results.length === 0) results = allSongs.slice(0, 50);
            break;

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

          case "favorites":
            const statsStore = useStatsAchievementsStore.getState();
            results =
              statsStore.listeningStats.topSongs
                ?.map((item) => item.song)
                .filter(Boolean)
                .slice(0, 50) || allSongs.slice(0, 50);
            break;

          case "never-played":
            results = allSongs.filter((song) => (song.playCount || 0) === 0);
            if (results.length === 0) results = allSongs.slice(0, 50);
            break;

          case "custom":
            results = allSongs.filter((song) =>
              playlist.rules.every((rule) => evaluateRule(song, rule))
            );
            break;

          default:
            results = allSongs;
        }

        return results;
      },

      generateAllPlaylists: async (allSongs) => {
        set({ isGenerating: true, generateProgress: 0 });

        const { smartPlaylists, customPlaylists } = get();
        const allPlaylists = [...smartPlaylists, ...customPlaylists];

        for (let i = 0; i < allPlaylists.length; i++) {
          const playlist = allPlaylists[i];
          if (playlist.isEnabled) {
            const songs = get().generatePlaylist(playlist, allSongs);
            get().updateSmartPlaylist(playlist.id, {
              songCount: songs.length,
              lastUpdated: Date.now(),
            });
          }

          const progress = Math.round(((i + 1) / allPlaylists.length) * 100);
          set({ generateProgress: progress });

          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        set({ isGenerating: false, generateProgress: 100 });
      },

      exportPlaylist: (songs, format) => {
        switch (format) {
          case "m3u":
          case "m3u8":
            return generateM3U(songs);
          case "pls":
            return generatePLS(songs);
          case "xspf":
            return generateXSPF(songs);
          case "wpl":
            return generateWPL(songs);
          case "txt":
            return songs.map((s) => `${s.artist} - ${s.title}`).join("\n");
          default:
            return generateM3U(songs);
        }
      },

      importPlaylist: (content, format, allSongs) => {
        const lines = content.split("\n").filter((l) => l.trim());
        const matchedSongs: Song[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i].trim();

          // PLS format: File1=..., Title1=...
          if (line.startsWith("File") && line.includes("=")) {
            i++;
            continue;
          }
          if (line.startsWith("Title") && line.includes("=")) {
            const titlePart = line.substring(line.indexOf("=") + 1);
            const song = allSongs.find((s) =>
              titlePart.toLowerCase().includes(s.title.toLowerCase())
            );
            if (song && !matchedSongs.find((m) => m.id === song.id)) {
              matchedSongs.push(song);
            }
            i++;
            continue;
          }
          if (line.startsWith("Length") || line.startsWith("NumberOfEntries") || line === "[playlist]" || line === "Version=2") {
            i++;
            continue;
          }

          // XSPF format: <title>, <creator>, <location> tags
          if (line.includes("<title>") && line.includes("</title>")) {
            const titleMatch = line.match(/<title>(.*?)<\/title>/);
            const creatorMatch = lines.slice(i, i + 5).join(" ").match(/<creator>(.*?)<\/creator>/);
            const searchTerm = titleMatch ? titleMatch[1] : "";
            const song = allSongs.find((s) =>
              searchTerm.toLowerCase().includes(s.title.toLowerCase()) ||
              (creatorMatch && s.artist.toLowerCase().includes(creatorMatch[1].toLowerCase()))
            );
            if (song && !matchedSongs.find((m) => m.id === song.id)) {
              matchedSongs.push(song);
            }
            i++;
            continue;
          }

          // WPL format: media src="..."
          if (line.includes('<media') && line.includes('src=')) {
            const titleMatch = line.match(/title="(.*?)"/);
            const artistMatch = line.match(/artist="(.*?)"/);
            const searchTerm = titleMatch ? titleMatch[1] : "";
            const song = allSongs.find((s) =>
              searchTerm.toLowerCase().includes(s.title.toLowerCase()) ||
              (artistMatch && s.artist.toLowerCase().includes(artistMatch[1].toLowerCase()))
            );
            if (song && !matchedSongs.find((m) => m.id === song.id)) {
              matchedSongs.push(song);
            }
            i++;
            continue;
          }

          // Skip XML/SMIL tags
          if (line.startsWith("<") || line.startsWith("</") || line.startsWith("<?") || line.startsWith("<?")) {
            i++;
            continue;
          }

          // M3U/TXT: skip comments, match by title/artist
          if (line.startsWith("#")) {
            i++;
            continue;
          }

          const songMatch = allSongs.find((song) => {
            const searchTerm = line.toLowerCase();
            return (
              song.title.toLowerCase().includes(searchTerm) ||
              song.artist.toLowerCase().includes(searchTerm)
            );
          });

          if (songMatch && !matchedSongs.find((m) => m.id === songMatch.id)) {
            matchedSongs.push(songMatch);
          }
          i++;
        }

        return matchedSongs;
      },

      getDefaultSmartPlaylists: () => DEFAULT_SMART_PLAYLISTS,

      resetToDefaults: () => {
        set({ smartPlaylists: DEFAULT_SMART_PLAYLISTS, customPlaylists: [] });
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
