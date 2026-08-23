export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  cover?: string;
  source: "local" | "upload" | "recommendation" | string;
  audioUrl?: string;
  lyrics?: string;
  translationLyrics?: string;
  transliterationLyrics?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  playCount?: number;
  addedAt?: number;
  filePath?: string;
  fileSize?: number;
  sampleRate?: number;
  bitRate?: number;
  format?: string;
  bpm?: number;
  key?: string;
}

export interface Playlist {
  id: string;
  title: string;
  cover?: string;
  songs: Song[];
  description?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type HealthIssueType =
  | "missing_file"
  | "corrupt_file"
  | "missing_metadata"
  | "missing_cover"
  | "missing_lyrics"
  | "duplicate"
  | "low_quality"
  | "unsupported_format"
  | "corrupted_file"
  | "oversized_cover"
  | "missing-metadata"
  | "missing-cover"
  | "missing-lyrics"
  | "corrupted-file"
  | "low-quality"
  | "unknown-format";
