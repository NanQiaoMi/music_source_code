/**
 * Resolver 领域类型（S7-1）。
 *
 * 从 MultiSourceResolver.ts 抽出的公开类型，避免 resolver/** 反向 import 门面
 *（否则插件 <-> 门面形成模块环）。MultiSourceResolver 继续 re-export，
 * 既有 import 路径与类型身份不变。
 */
import type { AudioSourceType } from "@/store/audioSourceStore";

export interface ResolvedAudioSource {
  url: string;
  source: AudioSourceType;
  quality: "standard" | "high" | "lossless" | "hires";
  format: "mp3" | "flac" | "aac" | "m4a";
  bitrate?: number;
  duration?: number;
  isTrial: boolean;
  name?: string;
}

export interface SongMetadataQuery {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  source?: string;
}
