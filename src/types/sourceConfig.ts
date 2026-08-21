export type MusicSourceId =
  | "netease"
  | "qq"
  | "kugou"
  | "kuwo"
  | "qishui"
  | "local"
  | "lx_custom";

export type QualityTier = "auto" | "128k" | "320k" | "flac" | "hires";

export interface SourceHealthStatus {
  status: "normal" | "degraded" | "error" | "untested";
  latencyMs: number;
  lastChecked: number;
  message?: string;
}

export interface SourceCredentials {
  cookie?: string;
  token?: string;
  vipLevel?: string;
  nickname?: string;
  avatarUrl?: string;
  expiresAt?: number;
}

export interface SingleSourceConfig {
  id: MusicSourceId;
  name: string;
  badgeName: string;
  badgeColor: string; // Tailwind class format, e.g. "bg-rose-500/20 text-rose-300 border-rose-500/30"
  dotColor: string;
  enabled: boolean;
  priority: number; // 1 (highest) to 10
  qualityPreference: QualityTier;
  customApiBase: string; // empty string for default
  customHeaders: Record<string, string>;
  credentials: SourceCredentials;
  health: SourceHealthStatus;
  description: string;
  isCustomScript?: boolean;
}

export interface LXCustomScript {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  scriptUrl?: string;
  scriptContent?: string;
  enabled: boolean;
  lastUpdated: number;
  supportedActions: ("search" | "songUrl" | "lyric" | "pic")[];
}

export interface PresetScheme {
  id: string;
  name: string;
  description: string;
  config: Record<MusicSourceId, { enabled: boolean; qualityPreference: QualityTier; priority: number }>;
}
