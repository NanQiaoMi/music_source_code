// S6-12l: pure smart-playlist types, defaults, export/import helpers live here so
// smartPlaylistStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports the public types, so its public surface is unchanged.

import type { Song } from "@/types/song";
import type { RuleEmotionMap } from "@/lib/smart-playlist/ruleEngine";

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

export interface SmartPlaylistState {
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

export const DEFAULT_SMART_PLAYLISTS: SmartPlaylist[] = [
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

export function withSongCount(playlist: SmartPlaylist, songCount: number): SmartPlaylist {
  return { ...playlist, songCount, lastUpdated: Date.now() };
}

export function generateM3U(songs: Song[]): string {
  let m3u = "#EXTM3U\n";

  for (const song of songs) {
    m3u += `#EXTINF:${Math.round(song.duration)},${song.artist} - ${song.title}\n`;
    m3u += `${song.filePath || song.audioUrl || `${song.id}.mp3`}\n`;
  }

  return m3u;
}

export function generatePLS(songs: Song[]): string {
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

export function generateXSPF(songs: Song[]): string {
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

export function generateWPL(songs: Song[]): string {
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

export function findMatchingSong(line: string, allSongs: Song[]): Song | undefined {
  const searchTerm = normalizePlaylistMatchValue(line);
  if (!searchTerm) return undefined;

  return allSongs.find((song) =>
    songMatchCandidates(song).some(
      (candidate) =>
        searchTerm === candidate || searchTerm.includes(candidate) || candidate.includes(searchTerm)
    )
  );
}

export function parseXmlValue(line: string, tag: string): string | null {
  const match = line.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return match?.[1] ? decodeXml(match[1]) : null;
}

export function parseXmlAttribute(line: string, attribute: string): string | null {
  const match = line.match(new RegExp(`${attribute}=["'](.*?)["']`));
  return match?.[1] ? decodeXml(match[1]) : null;
}

export function parseM3UExtInfo(line: string): string | null {
  if (!line.toUpperCase().startsWith("#EXTINF")) return null;
  const commaIndex = line.indexOf(",");
  return commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : null;
}
