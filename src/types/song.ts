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

export type HealthIssueType =
  | "missing_file"
  | "corrupt_file"
  | "missing_metadata"
  | "duplicate"
  | "low_quality"
  | "unsupported_format";
