/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { getAudioAnalyser, getAudioContext } from "@/hooks/useAudioPlayer";
import { usePlaylistStore, Song } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaylistGroupStore, PlaylistGroup } from "@/store/playlistGroupStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useIntegratedAudioPipeline } from "@/lib/audio/useIntegratedAudioPipeline";
import { cancelRaf, requestRaf } from "@/lib/perf/rafScheduler";
import { featureFlags } from "@/lib/perf/featureFlags";
import { visualRuntime, type VisualFrameHandle } from "@/runtime/visualRuntime";
import { useUIStore } from "@/store/uiStore";
import { approachEnvelope, readBandEnergy, stepCriticalSpring } from "./shelf3dMotion";
import Shelf3DStaticFallback from "./Shelf3DStaticFallback";
import {
  playTactileTick,
  playMechanicalGearTick,
  playCardSelectTick,
  playModeSwitchTick,
} from "@/lib/audio/tactileSound";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Layers,
  ListMusic,
  Disc3,
  Shuffle,
  Plus,
  Search,
  X,
  Heart,
  Music2,
  FolderHeart,
  Clock,
  Sparkles,
  Download,
} from "lucide-react";

export type ShelfDisplayMode = "side" | "stage";
export type ShelfBrowseType = "playlists" | "tracks" | "favorites" | "recent" | "daily" | "offline";

interface Shelf3DViewProps {
  isOpen?: boolean;
  className?: string;
  defaultMode?: ShelfDisplayMode;
  transparentBg?: boolean;
  isDrawerMode?: boolean;
  onClose?: () => void;
}

// 统一的 3D 卡片数据项模型 (支持歌单与单曲)
export interface ShelfItem {
  id: string;
  type: "playlist" | "song";
  title: string;
  subtitle: string;
  cover: string;
  tag: string;
  trackCount: number;
  playCount?: number;
  songs: Song[];
  song?: Song;
}

// 虚拟化渲染卡片窗口大小
const SHELF_MAX_RENDER = 11;
const HALF_WINDOW = Math.floor(SHELF_MAX_RENDER / 2); // 5

function getClampedShelfIndex(index: number, count: number): number {
  if (count <= 0 || !Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(index)));
}

// Only successfully loaded covers enter this shared, bounded image cache.
const MAX_COVER_IMAGES = 18;
const MAX_PENDING_COVER_IMAGES = 24;
const PENDING_COVER_TIMEOUT_MS = 15_000;
const FAILED_COVER_RETRY_MS = 60_000;
const coverImageCache = new Map<string, HTMLImageElement>();
interface PendingCoverImageRequest {
  image: HTMLImageElement;
  callbacks: Set<() => void>;
  timeoutId: ReturnType<typeof setTimeout> | null;
}
const pendingCoverImages = new Map<string, PendingCoverImageRequest>();
const failedCoverImages = new Map<string, number>();
const MAX_FAILED_COVER_IMAGES = 32;
const MAX_SCENE_TEXTURES = 16;

function rememberCoverImage(url: string, image: HTMLImageElement) {
  coverImageCache.delete(url);
  coverImageCache.set(url, image);
  while (coverImageCache.size > MAX_COVER_IMAGES) {
    const oldestUrl = coverImageCache.keys().next().value;
    if (oldestUrl === undefined) break;
    coverImageCache.delete(oldestUrl);
  }
}

function rememberFailedCoverImage(url: string) {
  failedCoverImages.delete(url);
  failedCoverImages.set(url, Date.now());
  while (failedCoverImages.size > MAX_FAILED_COVER_IMAGES) {
    const oldestUrl = failedCoverImages.keys().next().value;
    if (oldestUrl === undefined) break;
    failedCoverImages.delete(oldestUrl);
  }
}

function getOrLoadCoverImage(
  url: string | undefined,
  onLoaded: () => void
): HTMLImageElement | null {
  if (!url) return null;
  const cachedImage = coverImageCache.get(url);
  if (cachedImage) {
    if (cachedImage.complete && cachedImage.naturalWidth > 0) {
      coverImageCache.delete(url);
      coverImageCache.set(url, cachedImage);
      return cachedImage;
    }
    coverImageCache.delete(url);
  }

  const failedAt = failedCoverImages.get(url);
  if (failedAt !== undefined) {
    if (Date.now() - failedAt < FAILED_COVER_RETRY_MS) return null;
    failedCoverImages.delete(url);
  }

  const pending = pendingCoverImages.get(url);
  if (pending) {
    pending.callbacks.add(onLoaded);
    return null;
  }
  if (pendingCoverImages.size >= MAX_PENDING_COVER_IMAGES) return null;

  const image = new Image();
  const request: PendingCoverImageRequest = {
    image,
    callbacks: new Set([onLoaded]),
    timeoutId: null,
  };
  pendingCoverImages.set(url, request);
  const releasePendingRequest = () => {
    if (pendingCoverImages.get(url) !== request) return false;
    pendingCoverImages.delete(url);
    if (request.timeoutId !== null) {
      clearTimeout(request.timeoutId);
      request.timeoutId = null;
    }
    image.onload = null;
    image.onerror = null;
    return true;
  };
  request.timeoutId = setTimeout(() => {
    if (!releasePendingRequest()) return;
    request.callbacks.clear();
  }, PENDING_COVER_TIMEOUT_MS);
  image.crossOrigin = "anonymous";
  image.onload = () => {
    if (!releasePendingRequest()) return;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      failedCoverImages.delete(url);
      rememberCoverImage(url, image);
      request.callbacks.forEach((callback) => callback());
      request.callbacks.clear();
      return;
    }
    rememberFailedCoverImage(url);
    request.callbacks.clear();
  };
  image.onerror = () => {
    if (!releasePendingRequest()) return;
    rememberFailedCoverImage(url);
    request.callbacks.clear();
  };
  image.src = url;
  return null;
}

// 获取或创建持久化卡片 CanvasTexture 纹理 (暗色剧场卡片)
function getOrCreateCardTexture(
  item: ShelfItem,
  isActive: boolean,
  indexLabel: number,
  textureCache: Map<string, THREE.CanvasTexture>
): THREE.CanvasTexture {
  const cacheKey = `${item.id}_${item.cover || "none"}_${isActive ? "1" : "0"}_${indexLabel}`;
  const cachedTexture = textureCache.get(cacheKey);
  if (cachedTexture) {
    textureCache.delete(cacheKey);
    textureCache.set(cacheKey, cachedTexture);
    return cachedTexture;
  }

  const w = 640;
  const h = 800;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  if (!ctx) {
    textureCache.set(cacheKey, texture);
    return texture;
  }

  // 1. 卡片主体背景 - 极度通透的深黑灰液态玻璃底板
  drawRoundedRect(ctx, 14, 14, w - 28, h - 28, 36);
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  if (isActive) {
    bgGrad.addColorStop(0, "rgba(34, 34, 42, 0.90)");
    bgGrad.addColorStop(0.35, "rgba(18, 18, 24, 0.94)");
    bgGrad.addColorStop(1, "rgba(6, 6, 8, 0.98)");
  } else {
    bgGrad.addColorStop(0, "rgba(20, 20, 26, 0.68)");
    bgGrad.addColorStop(0.5, "rgba(10, 10, 14, 0.78)");
    bgGrad.addColorStop(1, "rgba(3, 3, 5, 0.90)");
  }
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // 2. 暖中性细边，保持封面成为卡片最强色源
  ctx.save();
  drawRoundedRect(ctx, 14, 14, w - 28, h - 28, 36);
  if (isActive) {
    ctx.strokeStyle = "rgba(238, 226, 208, 0.22)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(220, 210, 194, 0.10)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();

  // 3. 顶部序号徽标胶囊
  ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.06)";
  drawRoundedRect(ctx, 36, 36, 120, 36, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.65)";
  ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`#${String(indexLabel + 1).padStart(2, "0")} · ${item.tag}`, 96, 54);

  // 4. 右上角模式徽章 (PLAYLIST / LOSSLESS)
  ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.05)";
  drawRoundedRect(ctx, w - 156, 36, 120, 36, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.50)";
  ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
  ctx.fillText(item.type === "playlist" ? "PLAYLIST" : "LOSSLESS", w - 96, 54);

  // 5. 封面绘制 (Squircle 圆角图片与倒角高光)
  const coverSize = 400;
  const coverX = (w - coverSize) / 2;
  const coverY = 92;

  const img = getOrLoadCoverImage(item.cover, () => {
    if (textureCache.get(cacheKey) !== texture) return;
    const loadedImg = coverImageCache.get(item.cover);
    if (!loadedImg || loadedImg.naturalWidth <= 0) return;
    ctx.save();
    drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 28);
    ctx.clip();
    ctx.drawImage(loadedImg, coverX, coverY, coverSize, coverSize);
    const glassSheen = ctx.createLinearGradient(
      coverX,
      coverY,
      coverX + coverSize,
      coverY + coverSize
    );
    glassSheen.addColorStop(0, "rgba(255, 255, 255, 0.05)");
    glassSheen.addColorStop(0.3, "rgba(255, 255, 255, 0.015)");
    glassSheen.addColorStop(0.6, "transparent");
    glassSheen.addColorStop(1, "rgba(0, 0, 0, 0.18)");
    ctx.fillStyle = glassSheen;
    ctx.fillRect(coverX, coverY, coverSize, coverSize);
    ctx.restore();
    texture.needsUpdate = true;
  });

  ctx.save();
  drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 28);
  ctx.clip();

  if (img) {
    ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
  } else {
    const vinylGrad = ctx.createRadialGradient(
      w / 2,
      coverY + coverSize / 2,
      12,
      w / 2,
      coverY + coverSize / 2,
      coverSize / 2
    );
    vinylGrad.addColorStop(0, "#222228");
    vinylGrad.addColorStop(0.3, "#141418");
    vinylGrad.addColorStop(0.7, "#0c0c10");
    vinylGrad.addColorStop(1, "#040406");
    ctx.fillStyle = vinylGrad;
    ctx.fillRect(coverX, coverY, coverSize, coverSize);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    for (let r = 35; r < coverSize / 2; r += 18) {
      ctx.beginPath();
      ctx.arc(w / 2, coverY + coverSize / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(w / 2, coverY + coverSize / 2, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  // 封面斜向镜面折射光
  const glassSheen = ctx.createLinearGradient(
    coverX,
    coverY,
    coverX + coverSize,
    coverY + coverSize
  );
  glassSheen.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  glassSheen.addColorStop(0.3, "rgba(255, 255, 255, 0.02)");
  glassSheen.addColorStop(0.6, "transparent");
  glassSheen.addColorStop(1, "rgba(0, 0, 0, 0.25)");
  ctx.fillStyle = glassSheen;
  ctx.fillRect(coverX, coverY, coverSize, coverSize);
  ctx.restore();

  // 6. 卡片大标题 (智能字号自适应，优先 Apple/苹方 高清字体栈)
  ctx.fillStyle = isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.88)";
  if (item.title.length > 24) {
    ctx.font =
      "bold 24px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
  } else if (item.title.length > 16) {
    ctx.font =
      "bold 28px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
  } else {
    ctx.font =
      "bold 32px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const titleText = item.title.length > 28 ? item.title.slice(0, 27) + "…" : item.title;
  ctx.fillText(titleText, w / 2, 545);

  // 7. 副标题与曲目计数
  ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.45)";
  ctx.font =
    "500 18px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
  const subtitleText = item.subtitle.length > 28 ? item.subtitle.slice(0, 27) + "…" : item.subtitle;
  ctx.fillText(subtitleText, w / 2, 586);

  // 8. 底部操作按键 (透明液态玻璃胶囊)
  ctx.save();
  const btnY = 648;
  const btnW = 290;
  const btnH = 58;
  const btnX = (w - btnW) / 2;

  drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 29);
  if (isActive) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.20)";
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(238, 226, 208, 0.16)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font =
    "600 19px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const btnText = item.type === "playlist" ? "▶ 播放歌单 · 点击详情" : "PLAY / 播放";
  ctx.fillText(btnText, w / 2, btnY + btnH / 2);
  ctx.restore();

  texture.needsUpdate = true;
  textureCache.set(cacheKey, texture);
  return texture;
}

// 辅助绘制圆角矩形
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export const Shelf3DView: React.FC<Shelf3DViewProps> = ({
  isOpen = true,
  className = "",
  defaultMode = "stage",
  transparentBg = false,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Store states
  const rawSongs = usePlaylistStore((state) => state.songs);
  const recentPlayedSongs = usePlaylistStore((state) => state.recentPlayed);
  const currentPlayingSong = useAudioStore((state) => state.currentSong);
  const isAudioPlaying = useAudioStore((state) => state.isPlaying);
  const playSong = useAudioStore((state) => state.playSong);
  const togglePlay = useAudioStore((state) => (state as any).togglePlay || (state as any).toggle);
  const setQueue = useQueueStore((state) => state.setQueue);
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const playlistGroups = usePlaylistGroupStore((state) => state.groups);
  const userPlaylists = useUserAccountStore((state) => state.userPlaylists);
  const favorites = useFavoritesStore((state) => state.favorites);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const closePanel = useUIStore((state) => state.closePanel);
  const { playTrackWithPipeline } = useIntegratedAudioPipeline();

  // 离线曲库数据
  const offlineRecords = useOfflineDownloadStore((state) => state.offlineRecords);
  const loadOfflineRecords = useOfflineDownloadStore((state) => state.loadOfflineRecords);

  useEffect(() => {
    if (isOpen) {
      loadOfflineRecords();
    }
  }, [isOpen, loadOfflineRecords]);

  const offlineSongs = useMemo<Song[]>(() => {
    return (offlineRecords || []).map((r) => ({
      id: r.songId,
      title: r.title || "离线曲目",
      artist: r.artist || "未知歌手",
      album: r.album || "离线母带",
      duration: r.duration || 240,
      cover: r.cover || "/default-cover.svg",
      lyrics: r.lyrics,
      translationLyrics: r.translationLyrics,
      source: (r.source as any) || "offline",
      audioUrl: `offline://${r.songId}`,
      format: (r as any).format || "mp3",
    }));
  }, [offlineRecords]);

  // Local state
  const [displayMode, setDisplayMode] = useState<ShelfDisplayMode>(defaultMode);
  const [browseType, setBrowseType] = useState<ShelfBrowseType>("playlists");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDetailPanel, setShowDetailPanel] = useState<boolean>(false);
  const [selectedShelfItem, setSelectedShelfItem] = useState<ShelfItem | null>(null);
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>("");
  const isAudioPlayingRef = useRef(isAudioPlaying);
  const currentPlayingSongRef = useRef(currentPlayingSong);
  const displayModeRef = useRef(displayMode);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    isAudioPlayingRef.current = isAudioPlaying;
    currentPlayingSongRef.current = currentPlayingSong;
  }, [isAudioPlaying, currentPlayingSong]);

  useEffect(() => {
    displayModeRef.current = displayMode;
  }, [displayMode]);

  // 构建歌单列表 (Playlists Mode，智能补全并确保不展示空 0 首)
  const playlistItems = useMemo<ShelfItem[]>(() => {
    const defaultCover = "/default-cover.svg";
    const items: ShelfItem[] = [];

    // 基础有效曲库 (采用真实全网多源热门高音质曲目)
    const validSongs =
      rawSongs.length > 0
        ? rawSongs
        : ([
            {
              id: "186016",
              title: "晴天",
              artist: "周杰伦",
              album: "叶惠美",
              cover:
                "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop",
              duration: 269,
              source: "netease",
            },
            {
              id: "185706",
              title: "七里香",
              artist: "周杰伦",
              album: "七里香",
              cover:
                "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
              duration: 299,
              source: "netease",
            },
            {
              id: "1330348068",
              title: "起风了",
              artist: "买辣椒也用券",
              album: "起风了",
              cover:
                "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=600&fit=crop",
              duration: 325,
              source: "netease",
            },
            {
              id: "186015",
              title: "三年二班",
              artist: "周杰伦",
              album: "叶惠美",
              cover:
                "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=600&fit=crop",
              duration: 280,
              source: "netease",
            },
            {
              id: "185827",
              title: "稻香",
              artist: "周杰伦",
              album: "魔杰座",
              cover:
                "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=600&fit=crop",
              duration: 223,
              source: "netease",
            },
          ] as Song[]);

    // 1. 全部歌曲库
    items.push({
      id: "pl-all",
      type: "playlist",
      title: "全部歌曲库 (All Songs)",
      subtitle: `${validSongs.length} 首曲目 · 完整音乐曲库`,
      cover:
        validSongs[0]?.cover && validSongs[0]?.cover !== defaultCover
          ? validSongs[0].cover
          : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=800&fit=crop",
      tag: "曲库总览",
      trackCount: validSongs.length,
      songs: validSongs,
    });

    // 2. 离线下载专属 3D 唱片架 (当有离线曲目时自动呈现专属离线唱片卡)
    if (offlineSongs.length > 0) {
      items.push({
        id: "pl-offline-vault",
        type: "playlist",
        title: "离线下载曲库 (Offline Vault)",
        subtitle: `${offlineSongs.length} 首母带 · 本地沙盒 0 流量秒播`,
        cover:
          offlineSongs[0]?.cover && offlineSongs[0]?.cover !== defaultCover
            ? offlineSongs[0].cover
            : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=800&fit=crop",
        tag: "离线母带",
        trackCount: offlineSongs.length,
        songs: offlineSongs,
      });
    }

    // 2.5 我喜欢的音乐 (专属红心浪漫光晕艺术封面)
    const effectiveFavs =
      favorites.length > 0 ? favorites : validSongs.slice(0, Math.min(12, validSongs.length));
    items.push({
      id: "pl-favorites",
      type: "playlist",
      title: "我喜欢的音乐 (Favorites)",
      subtitle: `${effectiveFavs.length} 首曲目 · 专属红心收藏`,
      cover:
        favorites[0]?.cover && favorites[0]?.cover !== defaultCover
          ? favorites[0].cover
          : "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&h=800&fit=crop",
      tag: "红心收藏",
      trackCount: effectiveFavs.length,
      songs: effectiveFavs,
    });

    // 3. 最近播放记录 (时光唱片金色光影封面)
    const effectiveRecent =
      recentPlayedSongs.length > 0
        ? recentPlayedSongs
        : validSongs.slice(0, Math.min(8, validSongs.length));
    items.push({
      id: "pl-recent",
      type: "playlist",
      title: "最近播放记录 (Recent)",
      subtitle: `${effectiveRecent.length} 首曲目 · 时光印记`,
      cover:
        recentPlayedSongs[0]?.cover && recentPlayedSongs[0]?.cover !== defaultCover
          ? recentPlayedSongs[0].cover
          : "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop",
      tag: "历史记录",
      trackCount: effectiveRecent.length,
      songs: effectiveRecent,
    });

    // 3.5 多平台个人云歌单 (网易云/QQ/酷狗等)
    userPlaylists.forEach((up) => {
      const platformName =
        up.source === "netease"
          ? "网易云"
          : up.source === "qq"
            ? "QQ音乐"
            : up.source === "kugou"
              ? "酷狗"
              : "汽水音乐";
      items.push({
        id: `cloud-pl-${up.id}`,
        type: "playlist",
        title: up.name,
        subtitle: `${up.trackCount || 0} 首曲目 · ${platformName}云端`,
        cover:
          up.coverImgUrl ||
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=800&fit=crop",
        tag: platformName,
        trackCount: up.trackCount || 0,
        songs: [],
      });
    });

    // 3.8 本地创建与下载的离线歌单
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("vibe_custom_playlists_v1");
        if (saved) {
          const customLists = JSON.parse(saved);
          if (Array.isArray(customLists)) {
            customLists.forEach((cp: any) => {
              if (cp.id !== "default-favorites" && cp.songs && cp.songs.length > 0) {
                items.push({
                  id: cp.id,
                  type: "playlist",
                  title: cp.title,
                  subtitle: `${cp.songs.length} 首曲目 · 本地自建`,
                  cover: cp.cover || cp.songs[0]?.cover || defaultCover,
                  tag: cp.title.startsWith("[离线]") ? "离线歌单" : "本地歌单",
                  trackCount: cp.songs.length,
                  songs: cp.songs,
                });
              }
            });
          }
        }
      } catch {
        /* 忽略：失败时保持当前状态 */
      }
    }

    // 4. 自定义与系统歌单组 (每日推荐与精选)
    playlistGroups.forEach((group: PlaylistGroup, idx) => {
      const gSongs = (
        group.songs && group.songs.length > 0
          ? group.songs
          : validSongs.slice(idx * 3, idx * 3 + 10)
      ) as Song[];
      const defaultGroupCover =
        group.type === "daily"
          ? "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=800&fit=crop"
          : "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=800&fit=crop";
      items.push({
        id: `pl-group-${group.id}`,
        type: "playlist",
        title: group.name,
        subtitle: `${gSongs.length} 首曲目 · ${group.type === "daily" ? "AI 每日推荐" : "精选歌单"}`,
        cover: group.cover || defaultGroupCover,
        tag: group.type === "daily" ? "每日推荐" : "精选歌单",
        trackCount: gSongs.length,
        songs: gSongs.length > 0 ? gSongs : validSongs,
      });
    });

    return items;
  }, [rawSongs, favorites, recentPlayedSongs, playlistGroups, userPlaylists, offlineSongs]);

  // 构建单曲列表 (Tracks Mode)
  const trackItems = useMemo<ShelfItem[]>(() => {
    let sourceSongs: Song[] = rawSongs;
    if (browseType === "favorites") {
      sourceSongs = favorites.length > 0 ? favorites : rawSongs;
    } else if (browseType === "offline") {
      sourceSongs = offlineSongs.length > 0 ? offlineSongs : rawSongs;
    } else if (browseType === "recent") {
      sourceSongs = recentPlayedSongs.length > 0 ? recentPlayedSongs : rawSongs;
    } else if (browseType === "daily") {
      const dailyGroup = playlistGroups.find((g) => g.type === "daily");
      sourceSongs = (dailyGroup?.songs as Song[]) || rawSongs;
    }

    if (sourceSongs.length === 0) {
      sourceSongs = [
        {
          id: "186016",
          title: "晴天",
          artist: "周杰伦",
          album: "叶惠美",
          cover:
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop",
          duration: 269,
          source: "netease",
        },
        {
          id: "185706",
          title: "七里香",
          artist: "周杰伦",
          album: "七里香",
          cover:
            "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
          duration: 299,
          source: "netease",
        },
        {
          id: "1330348068",
          title: "起风了",
          artist: "买辣椒也用券",
          album: "起风了",
          cover:
            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=600&fit=crop",
          duration: 325,
          source: "netease",
        },
        {
          id: "186015",
          title: "三年二班",
          artist: "周杰伦",
          album: "叶惠美",
          cover:
            "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=600&fit=crop",
          duration: 280,
          source: "netease",
        },
        {
          id: "185827",
          title: "稻香",
          artist: "周杰伦",
          album: "魔杰座",
          cover:
            "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=600&fit=crop",
          duration: 223,
          source: "netease",
        },
      ];
    }

    return sourceSongs.map((song, idx) => ({
      id: `song-${song.id || idx}`,
      type: "song",
      title: song.title,
      subtitle: `${song.artist} · ${song.album || "Spatial Audio"}`,
      cover: song.cover || "/default-cover.svg",
      tag: `单曲 #${idx + 1}`,
      trackCount: 1,
      songs: [song],
      song,
    }));
  }, [rawSongs, favorites, recentPlayedSongs, playlistGroups, browseType, offlineSongs]);

  // 当前活跃的 3D 卡片数据源
  const activeShelfItems = useMemo<ShelfItem[]>(() => {
    let list = browseType === "playlists" ? playlistItems : trackItems;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q)
      );
    }

    return list.length > 0 ? list : playlistItems;
  }, [browseType, playlistItems, trackItems, searchQuery]);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const activeIndexRef = useRef<number>(0);
  const shelfItemsRef = useRef<ShelfItem[]>(activeShelfItems);

  // Interaction & Physics refs
  const isDraggingRef = useRef(false);
  const dragVelocityRef = useRef(0);
  const lastDragTimeRef = useRef(0);
  const prevMouseXRef = useRef(0);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const lastDetentStepRef = useRef(0);
  const reactUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const modeBlendRef = useRef(displayMode === "side" ? 1.0 : 0.0);
  const targetModeBlendRef = useRef(displayMode === "side" ? 1.0 : 0.0);
  const scrollVelocityRef = useRef(0);
  const modeBlendVelocityRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);

  // Mouse Parallax & 3D Gyroscope Tilt
  const mouseParallaxRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cardsGroupRef = useRef<THREE.Group | null>(null);
  const contactShadowMeshRef = useRef<THREE.Mesh | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [webglStatus, setWebglStatus] = useState<"ready" | "unavailable" | "lost">("ready");
  const [rendererGeneration, setRendererGeneration] = useState(0);

  // Virtualized Card Meshes
  interface CardSlot {
    mesh: THREE.Mesh;
    currentItemId: string | null;
    isActive: boolean;
    edgeMaterial: THREE.MeshBasicMaterial;
  }
  const cardSlotsRef = useRef<CardSlot[]>([]);

  useLayoutEffect(() => {
    if (shelfItemsRef.current === activeShelfItems) return;
    shelfItemsRef.current = activeShelfItems;
    const nextIndex = getClampedShelfIndex(activeIndex, activeShelfItems.length);
    activeIndexRef.current = nextIndex;
    targetScrollRef.current = nextIndex;
    currentScrollRef.current = nextIndex;
    lastDetentStepRef.current = nextIndex;
    scrollVelocityRef.current = 0;
  }, [activeShelfItems, activeIndex]);

  // 切换展示模式 (Side Shelf ⇋ Stage Shelf)
  const toggleDisplayMode = useCallback(() => {
    playModeSwitchTick();
    setDisplayMode((prev) => {
      const next = prev === "stage" ? "side" : "stage";
      targetModeBlendRef.current = next === "side" ? 1.0 : 0.0;
      return next;
    });
  }, []);

  const handleBrowseTypeChange = useCallback((nextBrowseType: ShelfBrowseType) => {
    playTactileTick({ type: "snap" });
    setBrowseType(nextBrowseType);
    setActiveIndex(0);
    activeIndexRef.current = 0;
    targetScrollRef.current = 0;
    currentScrollRef.current = 0;
    lastDetentStepRef.current = 0;
    scrollVelocityRef.current = 0;
    dragVelocityRef.current = 0;
  }, []);

  // The renderer lifetime follows panel/renderer lifecycle only. Playback and mode state
  // are sampled from refs so play/pause never rebuilds WebGL resources.
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let floorGeo: THREE.PlaneGeometry | null = null;
    let floorMat: THREE.MeshStandardMaterial | null = null;
    let floorSeamGeo: THREE.PlaneGeometry | null = null;
    let floorSeamMat: THREE.MeshBasicMaterial | null = null;
    let shadowTexture: THREE.Texture | null = null;
    let contactShadowGeo: THREE.PlaneGeometry | null = null;
    let contactShadowMat: THREE.MeshBasicMaterial | null = null;
    let particleGeo: THREE.BufferGeometry | null = null;
    let particleMat: THREE.PointsMaterial | null = null;
    let cardGeo: THREE.PlaneGeometry | null = null;
    let edgeGeo: THREE.ShapeGeometry | null = null;
    let slots: CardSlot[] = [];
    const sceneTextureCache = new Map<string, THREE.CanvasTexture>();
    let frameRequestId: number | null = null;
    let animationRunning = false;
    let effectActive = true;
    let contextLost = false;
    let lastFrameTime: number | null = null;
    let analyser: AnalyserNode | null = null;
    let frequencyData = new Uint8Array(0);
    let lowEnvelope = 0;
    let highEnvelope = 0;
    let audioWasValid = false;
    let qualityTier = 0;
    let pixelRatio = 0;
    let adaptiveQualityActive = false;
    let slowFpsDurationMs = 0;
    let fastFpsDurationMs = 0;
    let nextQualityCheckAt = 0;
    let frameTimes: number[] = [];
    let frameTimeHead = 0;
    let disposed = false;
    let rendererLifecycleDisposed = false;
    let teardownRendererLifecycle: (() => void) | null = null;
    let frameSubscription: VisualFrameHandle | null = null;

    const stopAnimation = () => {
      // S5-3：flag on 时排帧权在 visualRuntime，停止循环就是退订。
      frameSubscription?.stop();
      frameSubscription = null;
      if (frameRequestId !== null) {
        cancelRaf(frameRequestId);
        frameRequestId = null;
      }
      animFrameRef.current = null;
      animationRunning = false;
      lastFrameTime = null;
    };

    const disposeScene = () => {
      if (disposed) return;
      disposed = true;
      stopAnimation();
      if (reactUpdateTimerRef.current) {
        clearTimeout(reactUpdateTimerRef.current);
        reactUpdateTimerRef.current = null;
      }
      slots.forEach(({ mesh, edgeMaterial }) => {
        scene?.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        edgeMaterial.dispose();
      });
      sceneTextureCache.forEach((texture) => texture.dispose());
      sceneTextureCache.clear();
      cardGeo?.dispose();
      edgeGeo?.dispose();
      particleGeo?.dispose();
      particleMat?.dispose();
      floorGeo?.dispose();
      floorMat?.dispose();
      floorSeamGeo?.dispose();
      floorSeamMat?.dispose();
      contactShadowGeo?.dispose();
      contactShadowMat?.dispose();
      shadowTexture?.dispose();
      renderer?.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      if (cameraRef.current === camera) cameraRef.current = null;
      if (rendererRef.current === renderer) rendererRef.current = null;
      if (cardsGroupRef.current && scene?.children.includes(cardsGroupRef.current)) {
        cardsGroupRef.current = null;
      }
      contactShadowMeshRef.current = null;
      cardSlotsRef.current = [];
    };

    const qualityForWidth = (width: number) => (width < 768 ? 2 : width < 1280 ? 1 : 0);
    const pixelRatioCaps = [1.75, 1.35, 1.0];
    const particleCounts = [42, 22, 8];
    const applyQuality = (nextTier: number) => {
      qualityTier = Math.max(0, Math.min(2, nextTier));
      if (particleGeo) particleGeo.setDrawRange(0, particleCounts[qualityTier]);
      const desiredPixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCaps[qualityTier]);
      if (renderer && Math.abs(desiredPixelRatio - pixelRatio) > 0.01) {
        renderer.setPixelRatio(desiredPixelRatio);
        pixelRatio = desiredPixelRatio;
      }
      if (renderer) {
        renderer.setSize(
          Math.max(1, container.clientWidth),
          Math.max(1, container.clientHeight),
          false
        );
      }
    };

    const trimSceneTextureCache = () => {
      if (sceneTextureCache.size <= MAX_SCENE_TEXTURES) return;
      const activeTextures = new Set(
        slots
          .map((slot) => (slot.mesh.material as THREE.MeshStandardMaterial).map)
          .filter((texture): texture is THREE.Texture => texture !== null)
      );
      for (const [key, texture] of sceneTextureCache) {
        if (sceneTextureCache.size <= MAX_SCENE_TEXTURES) break;
        if (activeTextures.has(texture)) continue;
        sceneTextureCache.delete(key);
        texture.dispose();
      }
    };

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotionQuery.matches;

    try {
      const width = Math.max(1, container.clientWidth || window.innerWidth);
      const height = Math.max(1, container.clientHeight || window.innerHeight);
      qualityTier = qualityForWidth(width);

      const sceneInstance = new THREE.Scene();
      scene = sceneInstance;
      sceneInstance.fog = new THREE.FogExp2(0x080706, 0.022);
      sceneRef.current = sceneInstance;

      const cameraInstance = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
      camera = cameraInstance;
      cameraInstance.position.set(0, 0.35, 6.6);
      cameraRef.current = cameraInstance;

      const rendererInstance = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer = rendererInstance;
      rendererInstance.toneMapping = THREE.ACESFilmicToneMapping;
      rendererInstance.toneMappingExposure = 1.0;
      rendererRef.current = rendererInstance;

      const ambientLight = new THREE.AmbientLight(0xe8e2d8, 0.72);
      sceneInstance.add(ambientLight);
      const mainLight = new THREE.PointLight(0xf3e7d5, 2.5, 24);
      mainLight.position.set(0, 3.6, 4.8);
      sceneInstance.add(mainLight);
      const fillLight = new THREE.PointLight(0xd8d5cf, 0.95, 20);
      fillLight.position.set(-4.5, -0.4, 3.5);
      sceneInstance.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xe4ddd2, 0.8);
      rimLight.position.set(6, 6, -2);
      sceneInstance.add(rimLight);

      const cardsGroup = new THREE.Group();
      cardsGroupRef.current = cardsGroup;
      sceneInstance.add(cardsGroup);

      floorGeo = new THREE.PlaneGeometry(60, 60, 24, 24);
      floorMat = new THREE.MeshStandardMaterial({
        color: 0x11100e,
        roughness: 0.9,
        metalness: 0.04,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -2.0;
      sceneInstance.add(floor);

      floorSeamGeo = new THREE.PlaneGeometry(60, 0.012);
      floorSeamMat = new THREE.MeshBasicMaterial({
        color: 0x62584b,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
      });
      [-3.8, -6.2].forEach((z) => {
        const seam = new THREE.Mesh(floorSeamGeo!, floorSeamMat!);
        seam.rotation.x = -Math.PI / 2;
        seam.position.set(0, -1.988, z);
        sceneInstance.add(seam);
      });

      const shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = 512;
      shadowCanvas.height = 512;
      const shadowContext = shadowCanvas.getContext("2d");
      if (shadowContext) {
        const gradient = shadowContext.createRadialGradient(256, 256, 10, 256, 256, 240);
        gradient.addColorStop(0, "rgba(224, 208, 183, 0.24)");
        gradient.addColorStop(0.32, "rgba(204, 185, 156, 0.12)");
        gradient.addColorStop(0.68, "rgba(166, 148, 122, 0.035)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        shadowContext.fillStyle = gradient;
        shadowContext.fillRect(0, 0, 512, 512);
        shadowTexture = new THREE.CanvasTexture(shadowCanvas);
      } else {
        shadowTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
        shadowTexture.needsUpdate = true;
      }
      contactShadowGeo = new THREE.PlaneGeometry(5.2, 3.2);
      const contactShadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      contactShadowMat = contactShadowMaterial;
      const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMaterial);
      contactShadowMesh.rotation.x = -Math.PI / 2;
      contactShadowMesh.position.set(0, -1.985, 0.9);
      contactShadowMeshRef.current = contactShadowMesh;
      sceneInstance.add(contactShadowMesh);

      const particleCount = particleCounts[qualityTier];
      particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(42 * 3);
      for (let p = 0; p < 42; p += 1) {
        const offset = p * 3;
        particlePositions[offset] = (Math.random() - 0.5) * 26;
        particlePositions[offset + 1] = Math.random() * 5 + 2.0;
        particlePositions[offset + 2] = -Math.random() * 13 - 1.5;
      }
      particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
      particleGeo.setDrawRange(0, particleCount);
      particleMat = new THREE.PointsMaterial({
        size: 0.055,
        color: 0xa99c89,
        transparent: true,
        opacity: 0.14,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      particles.visible = !reducedMotionRef.current;
      sceneInstance.add(particles);

      cardGeo = new THREE.PlaneGeometry(1.95, 2.45);
      const edgeShape = new THREE.Shape();
      edgeShape.moveTo(-0.955, -1.205);
      edgeShape.lineTo(0.955, -1.205);
      edgeShape.lineTo(0.955, 1.205);
      edgeShape.lineTo(-0.955, 1.205);
      edgeShape.closePath();
      const edgeHole = new THREE.Path();
      edgeHole.moveTo(-0.935, -1.185);
      edgeHole.lineTo(-0.935, 1.185);
      edgeHole.lineTo(0.935, 1.185);
      edgeHole.lineTo(0.935, -1.185);
      edgeHole.closePath();
      edgeShape.holes.push(edgeHole);
      edgeGeo = new THREE.ShapeGeometry(edgeShape);
      slots = [];
      for (let i = 0; i < SHELF_MAX_RENDER; i += 1) {
        const cardMat = new THREE.MeshStandardMaterial({
          roughness: 0.56,
          metalness: 0.08,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(cardGeo, cardMat);
        mesh.userData = { slotIndex: i };
        const edgeMaterial = new THREE.MeshBasicMaterial({
          color: 0xe8d4b8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const edgeLight = new THREE.Mesh(edgeGeo, edgeMaterial);
        edgeLight.position.z = 0.012;
        edgeLight.renderOrder = 2;
        mesh.add(edgeLight);
        cardsGroup.add(mesh);
        slots.push({ mesh, currentItemId: null, isActive: false, edgeMaterial });
      }
      cardSlotsRef.current = slots;
      targetModeBlendRef.current = displayModeRef.current === "side" ? 1 : 0;
      applyQuality(qualityTier);

      lastDetentStepRef.current = Math.round(currentScrollRef.current);
      let afterglowPhase = 0;
      let revealRendererStatus = true;
      const onAnimationFrame = (time: number, runtimeDeltaMs?: number) => {
        frameRequestId = null;
        animFrameRef.current = null;
        // 隐藏门控由 visualRuntime 统一负责；旧路径仍自查 visibilityState。
        if (
          !effectActive ||
          contextLost ||
          (!featureFlags.visualRuntime && document.visibilityState === "hidden")
        ) {
          stopAnimation();
          return;
        }

        // flag on 用 runtime 下发的 delta（首帧 16.67ms、上限 50ms），保持旧 32ms 上限。
        const dt =
          runtimeDeltaMs !== undefined
            ? Math.max(0, Math.min(0.032, runtimeDeltaMs / 1000))
            : lastFrameTime === null
              ? 1 / 60
              : Math.max(0, Math.min(0.032, (time - lastFrameTime) / 1000));
        lastFrameTime = time;
        const dtMs = dt * 1000;

        frameTimes.push(time);
        while (frameTimeHead < frameTimes.length && frameTimes[frameTimeHead] < time - 5000) {
          frameTimeHead += 1;
        }
        if (time >= nextQualityCheckAt) {
          const elapsed = Math.max(1, time - (nextQualityCheckAt - 1000));
          if (time - (frameTimes[frameTimeHead] ?? time) >= 4500) {
            const sampleSpan = Math.min(5000, time - frameTimes[frameTimeHead]);
            const averageFps =
              ((frameTimes.length - frameTimeHead) * 1000) / Math.max(1, sampleSpan);
            if (averageFps < 45) {
              slowFpsDurationMs += elapsed;
              fastFpsDurationMs = 0;
            } else if (averageFps > 55) {
              fastFpsDurationMs += elapsed;
              slowFpsDurationMs = 0;
            } else {
              slowFpsDurationMs = 0;
              fastFpsDurationMs = 0;
            }
            if (slowFpsDurationMs >= 3000 && qualityTier < 2) {
              adaptiveQualityActive = true;
              slowFpsDurationMs = 0;
              applyQuality(qualityTier + 1);
            } else if (fastFpsDurationMs >= 10_000 && qualityTier > 0) {
              adaptiveQualityActive = true;
              fastFpsDurationMs = 0;
              applyQuality(qualityTier - 1);
            }
          }
          nextQualityCheckAt = time + 1000;
          if (frameTimeHead > 240) {
            frameTimes = frameTimes.slice(frameTimeHead);
            frameTimeHead = 0;
          }
        }

        const scrollState = stepCriticalSpring(
          { position: currentScrollRef.current, velocity: scrollVelocityRef.current },
          targetScrollRef.current,
          dt,
          isDraggingRef.current ? 24 : 18
        );
        currentScrollRef.current = scrollState.position;
        scrollVelocityRef.current = scrollState.velocity;
        const scrollPos = scrollState.position;
        const centerVirtualIndex = Math.round(scrollPos);

        const modeState = reducedMotionRef.current
          ? { position: targetModeBlendRef.current, velocity: 0 }
          : stepCriticalSpring(
              { position: modeBlendRef.current, velocity: modeBlendVelocityRef.current },
              targetModeBlendRef.current,
              dt,
              16
            );
        modeBlendRef.current = modeState.position;
        modeBlendVelocityRef.current = modeState.velocity;
        const modeBlend = modeState.position;
        const scrollVelocity = scrollState.velocity;
        const dynamicBankRoll = Math.max(-0.15, Math.min(0.15, scrollVelocity * 0.012));
        const dynamicYawLead = Math.max(-0.12, Math.min(0.12, scrollVelocity * 0.01));

        if (centerVirtualIndex !== lastDetentStepRef.current) {
          const detentVelocity = Math.abs(scrollVelocity);
          playMechanicalGearTick(centerVirtualIndex, 1.0 + Math.min(detentVelocity, 1.5));
          lastDetentStepRef.current = centerVirtualIndex;
          const currentItems = shelfItemsRef.current;
          if (currentItems.length > 0) {
            const normalizedIndex =
              ((centerVirtualIndex % currentItems.length) + currentItems.length) %
              currentItems.length;
            activeIndexRef.current = normalizedIndex;
            if (!reactUpdateTimerRef.current) {
              reactUpdateTimerRef.current = setTimeout(() => {
                reactUpdateTimerRef.current = null;
                setActiveIndex(activeIndexRef.current);
              }, 40);
            }
          }
        }

        const parallax = mouseParallaxRef.current;
        const parallaxAlpha = 1 - Math.exp(-dt * 12);
        parallax.x += (parallax.targetX - parallax.x) * parallaxAlpha;
        parallax.y += (parallax.targetY - parallax.y) * parallaxAlpha;
        const dollyZ = Math.sin(modeBlend * Math.PI) * 0.28;
        cameraInstance.position.x = parallax.x * 0.65;
        cameraInstance.position.y = 0.35 + parallax.y * 0.4;
        cameraInstance.position.z = 6.6 - dollyZ;
        cameraInstance.lookAt(0, 0, 0);

        const shadowX = THREE.MathUtils.lerp(0, -0.32, modeBlend);
        contactShadowMeshRef.current?.position.set(
          shadowX,
          -1.985,
          THREE.MathUtils.lerp(0.9, 0.8, modeBlend)
        );

        let audioIsValid = false;
        let lowTarget = 0;
        let highTarget = 0;
        if (
          !reducedMotionRef.current &&
          isAudioPlayingRef.current &&
          currentPlayingSongRef.current
        ) {
          try {
            const audioContext = getAudioContext();
            const sharedAnalyser = getAudioAnalyser();
            if (audioContext?.state === "running" && sharedAnalyser) {
              analyser = sharedAnalyser;
              if (frequencyData.length !== analyser.frequencyBinCount) {
                frequencyData = new Uint8Array(analyser.frequencyBinCount);
              }
              analyser.getByteFrequencyData(frequencyData);
              lowTarget = readBandEnergy(
                frequencyData,
                audioContext.sampleRate,
                analyser.fftSize,
                35,
                180
              );
              highTarget = readBandEnergy(
                frequencyData,
                audioContext.sampleRate,
                analyser.fftSize,
                3200,
                12000
              );
              audioIsValid = true;
            }
          } catch {
            audioIsValid = false;
          }
        }
        if (!audioIsValid) {
          frequencyData.fill(0);
          lowTarget = 0;
          highTarget = 0;
          lowEnvelope = approachEnvelope(lowEnvelope, 0, dtMs, 80, 300);
          highEnvelope = approachEnvelope(highEnvelope, 0, dtMs, 80, 300);
          audioWasValid = false;
          analyser = null;
        } else {
          const attackMs = audioWasValid ? 80 : 400;
          lowEnvelope = approachEnvelope(lowEnvelope, lowTarget, dtMs, attackMs, 300);
          highEnvelope = approachEnvelope(highEnvelope, highTarget, dtMs, attackMs, 300);
          audioWasValid = true;
        }

        afterglowPhase += dt;
        const slowAfterglow = reducedMotionRef.current
          ? 0
          : 0.012 * (0.5 + 0.5 * Math.sin(afterglowPhase * 0.28));
        contactShadowMaterial.opacity = 0.22 + slowAfterglow + lowEnvelope * 0.12;

        const currentItems = shelfItemsRef.current;
        const totalItems = currentItems.length;
        let textureCacheNeedsTrim = false;
        if (totalItems > 0) {
          for (let k = 0; k < SHELF_MAX_RENDER; k += 1) {
            const slot = slots[k];
            if (!slot) continue;
            const slotRelOffset = k - HALF_WINDOW;
            const fractionalOffset = slotRelOffset - (scrollPos - centerVirtualIndex);
            const absOffset = Math.abs(fractionalOffset);
            const itemIndex =
              (((centerVirtualIndex + slotRelOffset) % totalItems) + totalItems) % totalItems;
            const item = currentItems[itemIndex];
            const isSlotActive = absOffset < 0.5;
            const stableItemKey = `${item.id}_${item.cover}`;
            if (slot.currentItemId !== stableItemKey || slot.isActive !== isSlotActive) {
              const targetTexture = getOrCreateCardTexture(
                item,
                isSlotActive,
                itemIndex,
                sceneTextureCache
              );
              const material = slot.mesh.material as THREE.MeshStandardMaterial;
              if (material.map !== targetTexture) {
                material.map = targetTexture;
                material.needsUpdate = true;
              }
              slot.currentItemId = stableItemKey;
              slot.isActive = isSlotActive;
              textureCacheNeedsTrim = true;
            }

            const sign = Math.sign(fractionalOffset);
            const nearOffset = Math.min(absOffset, 1.0);
            const farOffset = Math.max(0, absOffset - 1.0);
            const stageX = sign * (nearOffset * 1.9 + farOffset * 1.22);
            const stageY = -nearOffset * 0.015 - farOffset * 0.025;
            const stageZ = 1.15 - nearOffset * 0.85 - farOffset * 0.65;
            const stageRotY = -Math.atan2(stageX, 4.0 - stageZ) * 1.25 + dynamicYawLead;
            const stageRotX = parallax.y * 0.08;
            const stageRotZ = -parallax.x * 0.02 + dynamicBankRoll;
            const centerOvershoot = Math.max(0, 1.0 - absOffset * 2.0);
            const stageScale =
              1.22 - nearOffset * 0.26 - farOffset * 0.05 + centerOvershoot * 0.025;

            const sideCenterX = -0.32;
            const sideStepX =
              sign < 0 ? nearOffset * 1.45 + farOffset * 0.6 : nearOffset * 1.65 + farOffset * 0.72;
            const sideX = sideCenterX + sign * sideStepX;
            const sideY = -nearOffset * 0.015 - farOffset * 0.025;
            const sideZ = 1.2 - nearOffset * 0.55 - farOffset * 0.4;
            const flipProgress = Math.max(-1.0, Math.min(1.0, fractionalOffset / 0.85));
            const smoothFlip = Math.sign(flipProgress) * Math.pow(Math.abs(flipProgress), 0.75);
            const sideRotY = -smoothFlip * THREE.MathUtils.degToRad(55) + dynamicYawLead * 0.6;
            const sideRotX = 0.03 + parallax.y * 0.07;
            const sideRotZ = -parallax.x * 0.015 + dynamicBankRoll * 0.6;
            const sideScale = 1.2 - nearOffset * 0.24 - farOffset * 0.05 + centerOvershoot * 0.02;

            slot.mesh.position.set(
              THREE.MathUtils.lerp(stageX, sideX, modeBlend),
              THREE.MathUtils.lerp(stageY, sideY, modeBlend),
              THREE.MathUtils.lerp(stageZ, sideZ, modeBlend)
            );
            slot.mesh.rotation.set(
              THREE.MathUtils.lerp(stageRotX, sideRotX, modeBlend),
              THREE.MathUtils.lerp(stageRotY, sideRotY, modeBlend),
              THREE.MathUtils.lerp(stageRotZ, sideRotZ, modeBlend)
            );
            const scale = THREE.MathUtils.lerp(stageScale, sideScale, modeBlend);
            slot.mesh.scale.set(scale, scale, scale);

            const farFade = THREE.MathUtils.smoothstep(absOffset, 2, 5.5);
            const material = slot.mesh.material as THREE.MeshStandardMaterial;
            material.opacity = 1 - farFade * 0.7;
            slot.edgeMaterial.opacity = isSlotActive ? highEnvelope * 0.65 : 0;
            slot.mesh.visible = material.opacity > 0.01;
          }
          if (textureCacheNeedsTrim) trimSceneTextureCache();
        } else {
          slots.forEach((slot) => {
            slot.mesh.visible = false;
          });
        }

        try {
          rendererInstance.render(sceneInstance, cameraInstance);
        } catch {
          teardownRendererLifecycle?.();
          setWebglStatus("unavailable");
          return;
        }
        if (revealRendererStatus) {
          revealRendererStatus = false;
          setWebglStatus("ready");
        }
        // flag on 时 runtime 自己续排下一帧，这里只留旧路径。
        if (!featureFlags.visualRuntime) {
          frameRequestId = requestRaf(onAnimationFrame);
          animFrameRef.current = frameRequestId;
        }
      };

      const startAnimation = () => {
        if (
          !effectActive ||
          animationRunning ||
          contextLost ||
          (!featureFlags.visualRuntime && document.visibilityState === "hidden")
        )
          return;
        animationRunning = true;
        lastFrameTime = null;
        if (featureFlags.visualRuntime) {
          // 单一订阅：hidden 由 runtime 停表，恢复可见后自动续帧。
          frameSubscription = visualRuntime.subscribe("shelf3d", onAnimationFrame);
        } else {
          frameRequestId = requestRaf(onAnimationFrame);
          animFrameRef.current = frameRequestId;
        }
      };

      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") stopAnimation();
        else startAnimation();
      };
      const onReducedMotionChange = (event: MediaQueryListEvent) => {
        reducedMotionRef.current = event.matches;
        if (event.matches) {
          lowEnvelope = 0;
          highEnvelope = 0;
          audioWasValid = false;
          frequencyData.fill(0);
        }
        if (particleGeo) particles.visible = !event.matches;
      };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        stopAnimation();
        setActiveIndex(activeIndexRef.current);
        setWebglStatus("lost");
      };
      const onContextRestored = () => {
        if (!effectActive || !contextLost) return;
        contextLost = false;
        setRendererGeneration((generation) => generation + 1);
      };
      const releasePointerOnResize = () => {
        const pointerId = activePointerIdRef.current;
        if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
          try {
            canvas.releasePointerCapture(pointerId);
          } catch {
            // Resize can race with a browser-driven pointer cancellation.
          }
        }
        activePointerIdRef.current = null;
        isDraggingRef.current = false;
        hasDraggedRef.current = false;
        dragVelocityRef.current = 0;
      };
      const resizeRenderer = () => {
        const nextWidth = Math.max(1, container.clientWidth);
        const nextHeight = Math.max(1, container.clientHeight);
        releasePointerOnResize();
        cameraInstance.aspect = nextWidth / nextHeight;
        cameraInstance.updateProjectionMatrix();
        rendererInstance.setSize(nextWidth, nextHeight, false);
        if (!adaptiveQualityActive) applyQuality(qualityForWidth(nextWidth));
        else applyQuality(qualityTier);
      };

      const resizeObserver =
        typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeRenderer) : null;
      const teardownRenderer = () => {
        if (rendererLifecycleDisposed) return;
        rendererLifecycleDisposed = true;
        effectActive = false;
        stopAnimation();
        canvas.removeEventListener("webglcontextlost", onContextLost, false);
        canvas.removeEventListener("webglcontextrestored", onContextRestored, false);
        if (!featureFlags.visualRuntime) {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        }
        if (typeof reducedMotionQuery.removeEventListener === "function") {
          reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
        } else {
          reducedMotionQuery.removeListener(onReducedMotionChange);
        }
        resizeObserver?.disconnect();
        if (!resizeObserver) window.removeEventListener("resize", resizeRenderer);
        releasePointerOnResize();
        disposeScene();
      };
      teardownRendererLifecycle = teardownRenderer;

      canvas.addEventListener("webglcontextlost", onContextLost, false);
      canvas.addEventListener("webglcontextrestored", onContextRestored, false);
      // flag on 时元素/视口隐藏由 runtime 单点处理，组件不再自挂监听。
      if (!featureFlags.visualRuntime) {
        document.addEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", onReducedMotionChange);
      } else {
        reducedMotionQuery.addListener(onReducedMotionChange);
      }
      resizeObserver?.observe(container);
      if (!resizeObserver) window.addEventListener("resize", resizeRenderer);

      if (frameTimeHead === 0) {
        nextQualityCheckAt = performance.now() + 1000;
      }
      startAnimation();

      return teardownRenderer;
    } catch {
      teardownRendererLifecycle?.();
      effectActive = false;
      disposeScene();
      const failureStatusTimer = setTimeout(() => setWebglStatus("unavailable"), 0);
      return () => {
        clearTimeout(failureStatusTimer);
        teardownRendererLifecycle?.();
        disposeScene();
      };
    }
  }, [isOpen, rendererGeneration]);

  // 相对刻度滚动 (带音效)
  const scrollToRelative = useCallback((delta: number) => {
    targetScrollRef.current += delta;
  }, []);

  // 播放指定卡片 (歌单模式下整单播放，单曲模式下单曲播放)
  const handlePlayShelfItem = useCallback(
    async (index: number) => {
      const cur = activeShelfItems[index];
      if (!cur) return;
      playCardSelectTick();

      if (cur.type === "playlist") {
        if (cur.id.startsWith("cloud-pl-")) {
          const realId = cur.id.replace("cloud-pl-", "");
          try {
            const res = await fetch(
              `/api/playlist/tracks?id=${encodeURIComponent(realId)}&limit=500`
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.songs) && data.songs.length > 0) {
                setQueue(data.songs);
                playTrackWithPipeline(data.songs[0]);
                return;
              }
            }
          } catch {
            /* 忽略：失败时保持当前状态 */
          }
        }

        if (cur.songs && cur.songs.length > 0) {
          setQueue(cur.songs);
          playTrackWithPipeline(cur.songs[0]);
        }
      } else if (cur.song) {
        if (currentPlayingSong?.id === cur.song.id) {
          if (togglePlay) togglePlay();
        } else {
          setQueue(activeShelfItems.map((item) => item.song || item.songs[0]).filter(Boolean));
          playTrackWithPipeline(cur.song);
        }
      }
    },
    [activeShelfItems, currentPlayingSong, playTrackWithPipeline, togglePlay, setQueue]
  );

  const handlePlayCurrent = useCallback(() => {
    const currentIndex = activeIndexRef.current ?? activeIndex;
    return handlePlayShelfItem(currentIndex);
  }, [activeIndex, handlePlayShelfItem]);

  // 打开曲目二级详情瀑布流面板
  const handleOpenDetail = useCallback(() => {
    playCardSelectTick();
    const curIdx = activeIndexRef.current ?? activeIndex;
    const cur = activeShelfItems[curIdx] || activeShelfItems[activeIndex];
    if (cur) {
      setSelectedShelfItem(cur);
      setShowDetailPanel(true);
      setTrackSearchQuery("");

      if (cur.id.startsWith("cloud-pl-")) {
        const realId = cur.id.replace("cloud-pl-", "");
        fetch(`/api/playlist/tracks?id=${encodeURIComponent(realId)}&limit=500`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data.songs) && data.songs.length > 0) {
              setSelectedShelfItem((prev) =>
                prev && prev.id === cur.id
                  ? { ...prev, songs: data.songs, trackCount: data.songs.length }
                  : prev
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [activeShelfItems, activeIndex]);

  const selectFallbackIndex = useCallback((index: number) => {
    const count = shelfItemsRef.current.length;
    if (count <= 0) return;
    const normalizedIndex = ((Math.trunc(index) % count) + count) % count;
    activeIndexRef.current = normalizedIndex;
    setActiveIndex(normalizedIndex);
    targetScrollRef.current = normalizedIndex;
    currentScrollRef.current = normalizedIndex;
    scrollVelocityRef.current = 0;
  }, []);

  const handleFallbackPrevious = useCallback(() => {
    selectFallbackIndex(activeIndexRef.current - 1);
  }, [selectFallbackIndex]);

  const handleFallbackNext = useCallback(() => {
    selectFallbackIndex(activeIndexRef.current + 1);
  }, [selectFallbackIndex]);

  const handleFallbackPlay = useCallback(
    (index: number) => {
      selectFallbackIndex(index);
      void handlePlayShelfItem(index);
    },
    [handlePlayShelfItem, selectFallbackIndex]
  );

  // WebGL Pointer Events: capture keeps drags coherent outside the canvas; HUD is a sibling
  // above the canvas and is also explicitly excluded if event routing changes in the future.
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const target = event.target as HTMLElement;
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      target.closest(".shelf-hud-interactive, button, input, textarea, select, [contenteditable]")
    )
      return;

    activePointerIdRef.current = event.pointerId;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragVelocityRef.current = 0;
    lastDragTimeRef.current = performance.now();
    prevMouseXRef.current = event.clientX;
    mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      activePointerIdRef.current = null;
      isDraggingRef.current = false;
    }
    if (event.pointerType === "touch") event.preventDefault();
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current && activePointerIdRef.current === event.pointerId) {
      const now = performance.now();
      const dtMs = Math.max(1, now - lastDragTimeRef.current);
      const deltaX = event.clientX - prevMouseXRef.current;
      const totalDistance = Math.hypot(
        event.clientX - mouseDownPosRef.current.x,
        event.clientY - mouseDownPosRef.current.y
      );
      if (totalDistance > 6) hasDraggedRef.current = true;
      const deltaScroll = -deltaX * 0.0075;
      const instantVelocity = (deltaScroll * 1000) / dtMs;
      dragVelocityRef.current = dragVelocityRef.current * 0.6 + instantVelocity * 0.4;
      lastDragTimeRef.current = now;
      prevMouseXRef.current = event.clientX;
      targetScrollRef.current += deltaScroll;
      if (hasDraggedRef.current && event.pointerType === "touch") event.preventDefault();
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      mouseParallaxRef.current.targetX = nx;
      mouseParallaxRef.current.targetY = -ny;
    }
  }, []);

  const finishPointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      const canvas = event.currentTarget;
      const wasDragged = hasDraggedRef.current;
      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer cancellation may release capture before this handler runs.
        }
      }

      if (wasDragged) {
        if (cancelled) {
          targetScrollRef.current = Math.round(targetScrollRef.current);
        } else {
          const fling = Math.max(-2.5, Math.min(2.5, dragVelocityRef.current * 0.12));
          targetScrollRef.current = Math.round(targetScrollRef.current + fling);
        }
        dragVelocityRef.current = 0;
        hasDraggedRef.current = false;
        return;
      }
      if (cancelled || !cameraRef.current || !cardsGroupRef.current) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mx, my), cameraRef.current);
      const meshes = cardSlotsRef.current.map((slot) => slot.mesh);
      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length === 0) return;

      const hitMesh = intersects[0].object as THREE.Mesh;
      const slotIndex = hitMesh.userData?.slotIndex;
      if (slotIndex == null) return;
      const slotRelOffset = slotIndex - HALF_WINDOW;
      const scrollPos = currentScrollRef.current;
      const centerVirtualIndex = Math.round(scrollPos);
      const fractionalOffset = slotRelOffset - (scrollPos - centerVirtualIndex);
      if (Math.abs(fractionalOffset) < 0.5) {
        const uv = intersects[0].uv;
        if (uv && uv.y < 0.24) void handlePlayCurrent();
        else handleOpenDetail();
      } else {
        targetScrollRef.current += Math.round(fractionalOffset);
        playCardSelectTick();
      }
    },
    [handlePlayCurrent, handleOpenDetail]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      finishPointer(event, false);
    },
    [finishPointer]
  );

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      finishPointer(event, true);
    },
    [finishPointer]
  );

  const fallbackSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startIndex: number;
    moved: boolean;
    captured: boolean;
  } | null>(null);
  const suppressFallbackClickRef = useRef(false);
  const fallbackClickResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFallbackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    const buttonLabel = button?.getAttribute("aria-label") || "";
    if (
      target.closest(".shelf-hud-interactive") ||
      buttonLabel === "上一首" ||
      buttonLabel === "下一首" ||
      button?.textContent?.includes("播放当前曲目")
    )
      return;

    fallbackSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startIndex: activeIndexRef.current,
      moved: false,
      captured: false,
    };
  }, []);

  const handleFallbackPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const swipe = fallbackSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      swipe.moved = true;
      event.preventDefault();
      if (!swipe.captured) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          swipe.captured = true;
        } catch {
          // Keep tracking while events remain inside the fallback stage.
        }
      }
    }
  }, []);

  const finishFallbackPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const swipe = fallbackSwipeRef.current;
      if (!swipe || swipe.pointerId !== event.pointerId) return;
      fallbackSwipeRef.current = null;
      if (swipe.captured && event.currentTarget.hasPointerCapture(event.pointerId)) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // The browser may have already released capture after pointercancel.
        }
      }
      const distance = event.clientX - swipe.startX;
      if (cancelled || !swipe.moved || Math.abs(distance) < 24) return;
      suppressFallbackClickRef.current = true;
      if (fallbackClickResetTimerRef.current) clearTimeout(fallbackClickResetTimerRef.current);
      fallbackClickResetTimerRef.current = setTimeout(() => {
        suppressFallbackClickRef.current = false;
        fallbackClickResetTimerRef.current = null;
      }, 500);
      const width = Math.max(1, event.currentTarget.clientWidth);
      const steps = Math.max(1, Math.round(Math.abs(distance) / Math.max(48, width * 0.12)));
      selectFallbackIndex(swipe.startIndex + (distance < 0 ? steps : -steps));
    },
    [selectFallbackIndex]
  );

  const handleFallbackPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      finishFallbackPointer(event, false);
    },
    [finishFallbackPointer]
  );

  const handleFallbackPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      finishFallbackPointer(event, true);
    },
    [finishFallbackPointer]
  );

  const handleFallbackClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressFallbackClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressFallbackClickRef.current = false;
    if (fallbackClickResetTimerRef.current) {
      clearTimeout(fallbackClickResetTimerRef.current);
      fallbackClickResetTimerRef.current = null;
    }
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".shelf-hud-interactive, .custom-scrollbar")) return;
      event.preventDefault();
      const direction = Math.sign(event.deltaY || event.deltaX);
      if (webglStatus === "ready") {
        targetScrollRef.current += direction * 0.85;
      } else if (direction !== 0) {
        selectFallbackIndex(activeIndexRef.current + (direction > 0 ? 1 : -1));
      }
    },
    [webglStatus, selectFallbackIndex]
  );

  useEffect(
    () => () => {
      if (fallbackClickResetTimerRef.current) {
        clearTimeout(fallbackClickResetTimerRef.current);
        fallbackClickResetTimerRef.current = null;
      }
    },
    []
  );

  // 详情面板内整单入队
  const handleEnqueueAll = useCallback(() => {
    playCardSelectTick();
    if (selectedShelfItem?.songs) {
      selectedShelfItem.songs.forEach((s) => addToQueue(s));
    }
  }, [selectedShelfItem, addToQueue]);

  // 详情面板内随机播放
  const handleShufflePlay = useCallback(() => {
    playCardSelectTick();
    if (selectedShelfItem?.songs && selectedShelfItem.songs.length > 0) {
      const shuffled = [...selectedShelfItem.songs].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      playTrackWithPipeline(shuffled[0]);
    }
  }, [selectedShelfItem, playTrackWithPipeline, setQueue]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (
        target?.isContentEditable ||
        target?.closest(
          "input, textarea, select, button, a, [role='button'], [role='combobox'], [tabindex]:not([tabindex='-1'])"
        )
      )
        return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (webglStatus === "ready") scrollToRelative(-1);
        else handleFallbackPrevious();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (webglStatus === "ready") scrollToRelative(1);
        else handleFallbackNext();
      } else if (e.code === "Space") {
        e.preventDefault();
        handlePlayCurrent();
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleDisplayMode();
      } else if (e.key.toLowerCase() === "d" || e.key === "Enter") {
        e.preventDefault();
        handleOpenDetail();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (showDetailPanel) {
          setShowDetailPanel(false);
        } else if (onClose) {
          onClose();
        } else {
          closePanel("shelf3D");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    webglStatus,
    scrollToRelative,
    handleFallbackPrevious,
    handleFallbackNext,
    handlePlayCurrent,
    toggleDisplayMode,
    handleOpenDetail,
    showDetailPanel,
    onClose,
    closePanel,
  ]);

  if (!isOpen) return null;

  const displayedActiveIndex = getClampedShelfIndex(activeIndex, activeShelfItems.length);
  const currentActiveItem = activeShelfItems[displayedActiveIndex];

  // 详情面板过滤后的曲目列表
  const filteredDetailSongs =
    selectedShelfItem?.songs?.filter((song) => {
      if (!trackSearchQuery.trim()) return true;
      const q = trackSearchQuery.toLowerCase();
      return song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q);
    }) || [];

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 h-[100dvh] min-h-0 w-full ${transparentBg ? "bg-transparent pointer-events-none" : "bg-[#050505]"} flex flex-col justify-between gap-2 overflow-hidden px-2 py-2 select-none sm:gap-3 sm:px-4 ${className}`}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 8px)",
        paddingRight: "max(env(safe-area-inset-right), 8px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        paddingLeft: "max(env(safe-area-inset-left), 8px)",
        ...(transparentBg
          ? {}
          : {
              background:
                "radial-gradient(ellipse 74% 65% at 50% 42%, #181511 0%, #0c0b09 58%, #050505 100%)",
            }),
      }}
      onWheel={handleWheel}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 h-full w-full touch-none ${webglStatus === "ready" ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none opacity-0"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {webglStatus !== "ready" && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto px-2 pt-16 pb-20 sm:px-6"
          onPointerDown={handleFallbackPointerDown}
          onPointerMove={handleFallbackPointerMove}
          onPointerUp={handleFallbackPointerUp}
          onPointerCancel={handleFallbackPointerCancel}
          onClickCapture={handleFallbackClickCapture}
          style={{ touchAction: "pan-y" }}
        >
          <div className="w-full max-w-6xl">
            <Shelf3DStaticFallback
              items={activeShelfItems.map(({ id, title, subtitle, cover }) => ({
                id,
                title,
                subtitle,
                cover,
              }))}
              activeIndex={displayedActiveIndex}
              onSelect={selectFallbackIndex}
              onPlay={handleFallbackPlay}
              onPrevious={handleFallbackPrevious}
              onNext={handleFallbackNext}
            />
          </div>
        </div>
      )}

      {/* ── 顶部暗色剧场控制栏 ── */}
      <div className="relative z-30 mx-auto flex max-h-[32dvh] w-full max-w-7xl flex-wrap items-center justify-between gap-2 overflow-y-auto rounded-3xl border border-white/[0.11] bg-black/50 px-2 py-2 shadow-[0_16px_42px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl shelf-hud-interactive select-none sm:gap-3 sm:px-4 xl:flex-nowrap">
        {/* 左侧标题与模式 */}
        <div className="flex max-w-full shrink-0 items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 text-white shrink-0">
            <div className="w-8 h-8 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] shrink-0">
              <Disc3 className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <div className="shrink-0">
              <h2 className="text-[13px] font-bold tracking-tight flex items-center gap-1.5 text-white whitespace-nowrap">
                Mineradio 3D 空间唱片架
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/15 text-white/90 border border-white/20 font-semibold font-mono">
                  v0.2 SPATIAL
                </span>
              </h2>
              <p className="text-[11px] text-white/45 tracking-tight whitespace-nowrap hidden 2xl:block">
                透明液态玻璃 · 歌单/单曲双模 · PSP 机械齿轮触感
              </p>
            </div>
          </div>

          {/* 模式切换按钮 */}
          <button
            type="button"
            onClick={toggleDisplayMode}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] shrink-0 whitespace-nowrap cursor-pointer"
            title="按 M 键快速切换展示模式"
          >
            <Layers className="w-3.5 h-3.5 text-white/90 shrink-0" />
            <span>{displayMode === "stage" ? "舞台展开" : "侧栏透视"}</span>
            <span className="text-[10px] text-white/40 font-mono hidden xl:inline">
              ({displayMode === "stage" ? "Stage" : "Side"})
            </span>
          </button>
        </div>

        {/* 中间主分类与歌单切换器 (Playlists vs Tracks vs Favorites vs Recent vs Daily) */}
        <div className="order-3 flex w-full min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-1 sm:gap-1 xl:order-none xl:w-auto">
          <button
            type="button"
            onClick={() => handleBrowseTypeChange("playlists")}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              browseType === "playlists"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <FolderHeart className="w-3.5 h-3.5 shrink-0" />
            <span>全部歌单</span>
          </button>

          <button
            type="button"
            onClick={() => handleBrowseTypeChange("tracks")}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              browseType === "tracks"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Music2 className="w-3.5 h-3.5 shrink-0" />
            <span>全部单曲</span>
          </button>

          <button
            type="button"
            onClick={() => handleBrowseTypeChange("favorites")}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              browseType === "favorites"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Heart className="w-3.5 h-3.5 shrink-0" />
            <span>我的收藏</span>
          </button>

          <button
            type="button"
            onClick={() => handleBrowseTypeChange("recent")}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              browseType === "recent"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>最近播放</span>
          </button>

          <button
            type="button"
            onClick={() => handleBrowseTypeChange("offline")}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              browseType === "offline"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Download className="w-3.5 h-3.5 shrink-0 text-white/65" />
            <span>离线曲库 {offlineSongs.length > 0 ? `(${offlineSongs.length})` : ""}</span>
          </button>

          <button
            type="button"
            onClick={() => handleBrowseTypeChange("daily")}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              browseType === "daily"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>每日推荐</span>
          </button>
        </div>

        {/* 右侧搜索与退出 */}
        <div className="order-2 flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto xl:order-none">
          <div className="relative flex items-center shrink-0">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="搜索歌单或曲目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-28 sm:w-36 md:w-44 focus:w-52 transition-all bg-white/10 border border-white/15 rounded-2xl pl-7 pr-7 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40 shrink-0 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-white/40 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              if (onClose) {
                onClose();
              } else {
                closePanel("shelf3D");
              }
            }}
            className="flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-2xl border border-white/20 backdrop-blur-md transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0 whitespace-nowrap cursor-pointer"
          >
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>退出</span>
          </button>
        </div>
      </div>

      {/* ── 3D 二级曲目详情瀑布流面板 (Mineradio 3D Tracklist Billboard) ── */}
      {showDetailPanel && selectedShelfItem && (
        <div className="relative z-40 my-auto max-h-[78dvh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/[0.22] bg-black/75 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.95),inset_0_1.5px_2px_rgba(255,255,255,0.35)] backdrop-blur-[64px] backdrop-saturate-[190%] animate-in fade-in zoom-in-95 duration-200 shelf-hud-interactive sm:rounded-[36px] sm:p-6">
          {/* 面板头部 */}
          <div className="flex items-start justify-between border-b border-white/10 pb-5 mb-4">
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/20 shadow-xl flex-shrink-0">
                <img
                  src={selectedShelfItem.cover || "/default-cover.svg"}
                  alt={selectedShelfItem.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/15 text-white/90 border border-white/20 font-semibold uppercase">
                    {selectedShelfItem.tag}
                  </span>
                  <span className="text-[10px] text-white/40">
                    共 {selectedShelfItem.songs?.length || 0} 首曲目
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white leading-tight mt-1">
                  {selectedShelfItem.title}
                </h3>
                <p className="text-xs text-white/50 mt-1">{selectedShelfItem.subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playTactileTick({ type: "snap" });
                setShowDetailPanel(false);
              }}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all active:scale-90 border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 快捷操作条与曲目搜索 */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  if (selectedShelfItem.id.startsWith("cloud-pl-")) {
                    const realId = selectedShelfItem.id.replace("cloud-pl-", "");
                    try {
                      const res = await fetch(
                        `/api/playlist/tracks?id=${encodeURIComponent(realId)}&limit=500`
                      );
                      if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data.songs) && data.songs.length > 0) {
                          setQueue(data.songs);
                          playSong(data.songs[0]);
                          return;
                        }
                      }
                    } catch {
                      /* 忽略：失败时保持当前状态 */
                    }
                  }

                  if (selectedShelfItem.songs && selectedShelfItem.songs.length > 0) {
                    setQueue(selectedShelfItem.songs);
                    playSong(selectedShelfItem.songs[0]);
                  }
                }}
                className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold text-xs px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.35)] transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>播放整单</span>
              </button>

              <button
                type="button"
                onClick={handleEnqueueAll}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white/90 font-medium text-xs px-3.5 py-2 rounded-xl border border-white/15 transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>整单入队</span>
              </button>

              <button
                type="button"
                onClick={handleShufflePlay}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white/90 font-medium text-xs px-3.5 py-2 rounded-xl border border-white/15 transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
              >
                <Shuffle className="w-3.5 h-3.5 text-white/80" />
                <span>随机播放</span>
              </button>
            </div>

            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-white/40 absolute left-2.5" />
              <input
                type="text"
                placeholder="搜索歌单内歌曲..."
                value={trackSearchQuery}
                onChange={(e) => setTrackSearchQuery(e.target.value)}
                className="w-44 focus:w-56 transition-all bg-white/10 border border-white/15 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
              />
            </div>
          </div>

          {/* 曲目瀑布流列表 */}
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
            {filteredDetailSongs.length > 0 ? (
              filteredDetailSongs.map((song, idx) => {
                const isCurrent = currentPlayingSong?.id === song.id;
                const isFav = isFavorite(song.id);

                return (
                  <div
                    key={song.id || idx}
                    onClick={() => {
                      playCardSelectTick();
                      if (selectedShelfItem.songs) {
                        setQueue(selectedShelfItem.songs);
                      }
                      playTrackWithPipeline(song);
                    }}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-2xl border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-white/20 border-white/40 text-white shadow-[0_0_18px_rgba(255,255,255,0.2),inset_0_1px_1px_rgba(255,255,255,0.35)]"
                        : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-white/80 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="text-xs font-mono opacity-40 w-5 text-right flex-shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                        <img
                          src={song.cover || "/default-cover.svg"}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate">{song.title}</p>
                        <p className="text-[11px] opacity-50 truncate">
                          {song.artist} · {song.album || "Spatial"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isFav ? "text-white" : "text-white/40 hover:text-white"
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-white" : ""}`} />
                      </button>

                      {isCurrent && isAudioPlaying ? (
                        <span className="text-[10px] text-white animate-pulse font-bold tracking-wider">
                          PLAYING
                        </span>
                      ) : null}

                      <button
                        type="button"
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white hover:text-black transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-white/40 text-xs">暂未找到匹配曲目</div>
            )}
          </div>
        </div>
      )}

      {/* ── 底部暗色剧场控制器 ── */}
      <div className="relative z-30 mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-1.5 rounded-3xl border border-white/[0.12] bg-black/55 px-2 py-2 shadow-[0_20px_48px_rgba(0,0,0,0.62),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl shelf-hud-interactive sm:gap-3 sm:rounded-full sm:px-4 sm:py-2.5">
        {/* 左侧上一首按钮 */}
        <button
          type="button"
          onClick={() => {
            if (webglStatus === "ready") scrollToRelative(-1);
            else handleFallbackPrevious();
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all hover:bg-white/20 hover:text-white active:scale-90"
          title="上一张 (Left / Up)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* 中间信息与播放控制 (包含微缩封面、标题与声波) */}
        <div className="order-2 flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-5">
          {/* 微缩封面与状态 */}
          <div className="relative hidden h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-white/10 shadow-md sm:block">
            <img
              src={currentActiveItem?.cover || "/default-cover.svg"}
              alt={currentActiveItem?.title || "Cover"}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0 max-w-[132px] text-left sm:max-w-[200px] md:max-w-[280px]">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 whitespace-nowrap">
                {displayMode === "stage" ? "STAGE FOCUS" : "SIDE FOCUS"}
              </span>
              <span className="text-[10px] text-white/35">·</span>
              <span className="text-[10px] text-white/50 truncate whitespace-nowrap">
                {currentActiveItem?.tag}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white leading-tight truncate whitespace-nowrap">
              {currentActiveItem?.title || "未知项目"}
            </h4>
            <p className="text-[11px] text-white/45 truncate whitespace-nowrap">
              {currentActiveItem?.subtitle || "Mineradio Spatial Audio"}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePlayCurrent}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2.5 text-xs font-bold text-black shadow-[0_0_25px_rgba(255,255,255,0.35)] transition-all hover:bg-white/90 active:scale-95 sm:px-4 md:px-5"
          >
            {currentActiveItem?.type === "song" &&
            currentPlayingSong?.id === currentActiveItem.song?.id &&
            isAudioPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-black shrink-0" />
                <span className="whitespace-nowrap">暂停播放</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-black shrink-0" />
                <span className="whitespace-nowrap">
                  {currentActiveItem?.type === "playlist" ? "播放歌单" : "立即播放"}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenDetail}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 text-xs font-semibold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all hover:bg-white/20 active:scale-95 sm:px-3.5 md:px-4"
          >
            <ListMusic className="w-4 h-4 text-white/80 shrink-0" />
            <span className="whitespace-nowrap">曲目列表</span>
          </button>
        </div>

        {/* 右侧下一首按钮 */}
        <button
          type="button"
          onClick={() => {
            if (webglStatus === "ready") scrollToRelative(1);
            else handleFallbackNext();
          }}
          className="order-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all hover:bg-white/20 hover:text-white active:scale-90"
          title="下一张 (Right / Down)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Shelf3DView;
