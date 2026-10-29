// S6-12c: non-store library-manager logic (types, defaults, pure helpers) lives here so
// libraryManagerStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports every type below, so its public surface is unchanged.

import type { Song } from "@/types/song";

export interface DuplicateSong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  fileSize: number;
  bitrate?: number;
  format?: string;
  qualityScore: number;
  isRecommended: boolean;
}

export interface DuplicateGroup {
  groupId: string;
  songs: DuplicateSong[];
  recommendedSongId: string;
}

export interface RenameRule {
  id: string;
  name: string;
  pattern: string;
  example: string;
}

export interface ScanFilter {
  minDuration?: number;
  maxDuration?: number;
  minFileSize?: number;
  maxFileSize?: number;
  formats?: string[];
  excludeDamaged?: boolean;
}

export interface FolderMonitor {
  id: string;
  path: string;
  name: string;
  isEnabled: boolean;
  lastScanTime: number;
}

export interface LibraryStats {
  totalSongs: number;
  totalDuration: number;
  totalFileSize: number;
  artistsCount: number;
  albumsCount: number;
  duplicatesCount: number;
}

export const DEFAULT_RENAME_RULES: RenameRule[] = [
  {
    id: "artist-title",
    name: "歌手 - 歌曲名",
    pattern: "{artist} - {title}",
    example: "周杰伦 - 晴天",
  },
  {
    id: "album-track-title",
    name: "专辑 - 曲目号 - 歌曲名",
    pattern: "{album} - {track} - {title}",
    example: "Jay Chou - 01 - 晴天",
  },
  {
    id: "title-artist",
    name: "歌曲名 - 歌手",
    pattern: "{title} - {artist}",
    example: "晴天 - 周杰伦",
  },
];

export const DEFAULT_SCAN_FILTERS: ScanFilter = {
  minDuration: 10,
  maxDuration: undefined,
  minFileSize: 1024 * 100,
  maxFileSize: undefined,
  formats: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"],
  excludeDamaged: true,
};

export const DEFAULT_LIBRARY_STATS: LibraryStats = {
  totalSongs: 0,
  totalDuration: 0,
  totalFileSize: 0,
  artistsCount: 0,
  albumsCount: 0,
  duplicatesCount: 0,
};

export function calculateQualityScore(song: DuplicateSong): number {
  let score = 0;

  const formatScores: { [key: string]: number } = {
    ".flac": 100,
    ".wav": 100,
    ".aiff": 95,
    ".alac": 90,
    ".m4a": 70,
    ".aac": 65,
    ".ogg": 60,
    ".mp3": 50,
    ".wma": 40,
  };

  if (song.format) {
    score += formatScores[song.format.toLowerCase()] || 30;
  }

  if (song.bitrate) {
    if (song.bitrate >= 320) score += 30;
    else if (song.bitrate >= 256) score += 25;
    else if (song.bitrate >= 192) score += 20;
    else if (song.bitrate >= 128) score += 10;
  }

  if (song.fileSize > 5 * 1024 * 1024) score += 10;

  return score;
}

export function generateDuplicateKey(song: Song): string {
  const normalizedTitle = song.title.toLowerCase().trim().replace(/\s+/g, "");
  const normalizedArtist = song.artist.toLowerCase().trim().replace(/\s+/g, "");
  return `${normalizedArtist}|${normalizedTitle}`;
}
