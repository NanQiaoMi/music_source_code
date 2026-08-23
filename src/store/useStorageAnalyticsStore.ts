import { create } from "zustand";
import { Song } from "@/types/song";
import { getStorageDetails, StorageDetailResult } from "@/services/localMusicStorage";

export interface QualityStats {
  hiresCount: number;
  flacCount: number;
  high320kCount: number;
  standard128kCount: number;
  total: number;
}

export interface PlatformStats {
  netease: number;
  qq: number;
  kugou: number;
  kuwo: number;
  qishui: number;
  local: number;
  total: number;
}

export interface HealthRadarMetrics {
  losslessRate: number; // 0..100
  coverCoverage: number; // 0..100
  lyricsCoverage: number; // 0..100
  activeSourceRate: number; // 0..100
  dedupHealth: number; // 0..100
  offlineRate: number; // 0..100
  overallScore: number; // 0..100
}

export interface DiagnosticItem {
  id: string;
  type: "warning" | "info" | "success" | "danger";
  title: string;
  message: string;
  actionText?: string;
  actionKey?: string;
}

interface StorageAnalyticsState {
  storageDetails: StorageDetailResult;
  usagePercent: number;
  qualityStats: QualityStats;
  platformStats: PlatformStats;
  healthRadar: HealthRadarMetrics;
  diagnostics: DiagnosticItem[];
  isAnalyzing: boolean;
  lastUpdated: number;

  refreshAnalytics: (allSongs: Song[]) => Promise<void>;
  formatBytes: (bytes: number) => string;
}

export const formatStorageBytes = (bytes: number): string => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
};

export const useStorageAnalyticsStore = create<StorageAnalyticsState>((set, get) => ({
  storageDetails: {
    localMusicBytes: 0,
    localMusicCount: 0,
    offlineAudioBytes: 0,
    offlineAudioCount: 0,
    coversBytes: 0,
    lyricsBytes: 0,
    indexedDbEstimateBytes: 0,
    totalUsageBytes: 0,
    quotaBytes: 50 * 1024 * 1024 * 1024,
  },
  usagePercent: 0,
  qualityStats: {
    hiresCount: 0,
    flacCount: 0,
    high320kCount: 0,
    standard128kCount: 0,
    total: 0,
  },
  platformStats: {
    netease: 0,
    qq: 0,
    kugou: 0,
    kuwo: 0,
    qishui: 0,
    local: 0,
    total: 0,
  },
  healthRadar: {
    losslessRate: 85,
    coverCoverage: 92,
    lyricsCoverage: 88,
    activeSourceRate: 96,
    dedupHealth: 95,
    offlineRate: 35,
    overallScore: 92,
  },
  diagnostics: [],
  isAnalyzing: false,
  lastUpdated: 0,

  formatBytes: formatStorageBytes,

  refreshAnalytics: async (allSongs: Song[]) => {
    set({ isAnalyzing: true });
    try {
      const storage = await getStorageDetails();
      const quota = storage.quotaBytes || 50 * 1024 * 1024 * 1024;
      const usagePercent = Math.min(100, (storage.totalUsageBytes / quota) * 100);

      // Quality stats
      let hires = 0;
      let flac = 0;
      let high320 = 0;
      let standard128 = 0;

      // Platform stats
      let netease = 0;
      let qq = 0;
      let kugou = 0;
      let kuwo = 0;
      let qishui = 0;
      let local = 0;

      let withCover = 0;
      let withLyrics = 0;
      let validSources = 0;

      const titleArtistMap: Record<string, number> = {};
      let duplicatesCount = 0;

      allSongs.forEach((song) => {
        // Platform
        const src = (song.source || "").toLowerCase();
        if (src.includes("netease") || src.includes("163")) netease++;
        else if (src.includes("qq") || src.includes("tencent")) qq++;
        else if (src.includes("kugou")) kugou++;
        else if (src.includes("kuwo")) kuwo++;
        else if (src.includes("qishui")) qishui++;
        else if (src.includes("local") || song.audioUrl?.startsWith("stored://") || song.audioUrl?.startsWith("blob:")) local++;
        else netease++;

        // Quality detection
        const title = (song.title || "").toLowerCase();
        const album = (song.album || "").toLowerCase();
        if (title.includes("hi-res") || album.includes("hi-res") || (song as any).quality === "hires") {
          hires++;
        } else if (title.includes("flac") || (song as any).quality === "lossless" || (song as any).isLossless) {
          flac++;
        } else if (title.includes("320k") || (song as any).quality === "320k") {
          high320++;
        } else {
          // Default estimation
          if (src.includes("local")) flac++;
          else high320++;
        }

        // Cover & Lyrics
        if (song.cover && song.cover !== "/default-cover.svg" && !song.cover.includes("default")) {
          withCover++;
        }
        if (song.lyrics && song.lyrics.length > 20) {
          withLyrics++;
        }
        if (song.audioUrl && !song.audioUrl.includes("placeholder")) {
          validSources++;
        }

        // Deduplication Check
        const normKey = `${(song.title || "").trim().toLowerCase()} - ${(song.artist || "").trim().toLowerCase()}`;
        if (titleArtistMap[normKey]) {
          duplicatesCount++;
        } else {
          titleArtistMap[normKey] = 1;
        }
      });

      const total = allSongs.length || 1;
      const losslessRate = Math.round(((hires + flac) / total) * 100);
      const coverCoverage = Math.round((withCover / total) * 100);
      const lyricsCoverage = Math.round((withLyrics / total) * 100);
      const activeSourceRate = Math.round((validSources / total) * 100);
      const dedupHealth = Math.max(0, 100 - Math.round((duplicatesCount / total) * 100));
      const offlineRate = Math.round(((storage.localMusicCount + storage.offlineAudioCount) / total) * 100);

      const overallScore = Math.round(
        losslessRate * 0.2 +
        coverCoverage * 0.15 +
        lyricsCoverage * 0.15 +
        activeSourceRate * 0.25 +
        dedupHealth * 0.15 +
        Math.min(100, offlineRate * 2) * 0.10
      );

      // Generate diagnostics
      const diagnostics: DiagnosticItem[] = [];
      if (duplicatesCount > 0) {
        diagnostics.push({
          id: "dedup-diag",
          type: "warning",
          title: `检测到 ${duplicatesCount} 首重复曲目`,
          message: "建议使用曲库去重工具一键保留最高音质版本，释放存储并保持曲库整洁。",
          actionText: "立即去重",
          actionKey: "tab-health-dedup",
        });
      }

      if (usagePercent > 80) {
        diagnostics.push({
          id: "storage-warning",
          type: "danger",
          title: "IndexedDB 存储空间占用超过 80%",
          message: "浏览器本地存储空间即将达到上限，建议清理部分失效临时缓存。",
          actionText: "清理缓存",
          actionKey: "tab-health-clean",
        });
      } else {
        diagnostics.push({
          id: "storage-healthy",
          type: "success",
          title: "存储空间健康充裕",
          message: `当前已占用 ${formatStorageBytes(storage.totalUsageBytes)} / ${formatStorageBytes(quota)} (${usagePercent.toFixed(1)}%)，运行平稳。`,
        });
      }

      if (coverCoverage < 80) {
        diagnostics.push({
          id: "cover-diag",
          type: "info",
          title: "部分歌曲缺少高清封面",
          message: `有 ${total - withCover} 首歌曲使用默认占位封面，支持一键全网 AI 反查补全。`,
          actionText: "一键补全",
          actionKey: "tab-health-autocover",
        });
      }

      set({
        storageDetails: storage,
        usagePercent,
        qualityStats: {
          hiresCount: hires,
          flacCount: flac,
          high320kCount: high320,
          standard128kCount: standard128,
          total,
        },
        platformStats: {
          netease,
          qq,
          kugou,
          kuwo,
          qishui,
          local,
          total,
        },
        healthRadar: {
          losslessRate,
          coverCoverage,
          lyricsCoverage,
          activeSourceRate,
          dedupHealth,
          offlineRate,
          overallScore,
        },
        diagnostics,
        isAnalyzing: false,
        lastUpdated: Date.now(),
      });
    } catch (e) {
      console.error("Failed to analyze storage & health:", e);
      set({ isAnalyzing: false });
    }
  },
}));
