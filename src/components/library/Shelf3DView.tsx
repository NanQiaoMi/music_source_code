/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { usePlaylistStore, Song } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaylistGroupStore, PlaylistGroup } from "@/store/playlistGroupStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useIntegratedAudioPipeline } from "@/lib/audio/useIntegratedAudioPipeline";
import { useUIStore } from "@/store/uiStore";
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

// 封面图片内存缓存
const coverImageCache = new Map<string, HTMLImageElement>();
// Three.js 显存级持久化 CanvasTexture 缓存 (按 item.id + active 状态缓存，切歌时 0 耗时纹理指针直连，实现真 120 FPS 满帧流转)
const threeTextureCache = new Map<string, THREE.CanvasTexture>();

function getOrLoadCoverImage(
  url: string | undefined,
  onLoaded: () => void
): HTMLImageElement | null {
  if (!url) return null;
  if (coverImageCache.has(url)) {
    const img = coverImageCache.get(url)!;
    return img.complete ? img : null;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  img.onload = () => {
    coverImageCache.set(url, img);
    onLoaded();
  };
  img.onerror = () => {
    coverImageCache.set(url, img);
  };
  coverImageCache.set(url, img);
  return null;
}

// 获取或创建持久化卡片 CanvasTexture 纹理 (Apple 顶级灰度透明液态玻璃与高光倒角)
function getOrCreateCardTexture(
  item: ShelfItem,
  isActive: boolean,
  indexLabel: number
): THREE.CanvasTexture {
  const cacheKey = `${item.id}_${item.cover || "none"}_${isActive ? "1" : "0"}_${indexLabel}`;
  if (threeTextureCache.has(cacheKey)) {
    return threeTextureCache.get(cacheKey)!;
  }

  const w = 640;
  const h = 800;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

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

  // 2. 双层物理折射高光边缘 (硬件加速矢量双层描边，零 CPU shadowBlur 开销)
  ctx.save();
  drawRoundedRect(ctx, 14, 14, w - 28, h - 28, 36);
  if (isActive) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const topGlint = ctx.createLinearGradient(50, 14, w - 50, 14);
    topGlint.addColorStop(0, "rgba(255, 255, 255, 0)");
    topGlint.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    topGlint.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.strokeStyle = topGlint;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1.8;
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const img = getOrLoadCoverImage(item.cover, () => {
    ctx.save();
    drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 28);
    ctx.clip();
    const loadedImg = getOrLoadCoverImage(item.cover, () => {});
    if (loadedImg) {
      ctx.drawImage(loadedImg, coverX, coverY, coverSize, coverSize);
      const glassSheen = ctx.createLinearGradient(
        coverX,
        coverY,
        coverX + coverSize,
        coverY + coverSize
      );
      glassSheen.addColorStop(0, "rgba(255, 255, 255, 0.22)");
      glassSheen.addColorStop(0.3, "rgba(255, 255, 255, 0.05)");
      glassSheen.addColorStop(0.6, "transparent");
      glassSheen.addColorStop(1, "rgba(0, 0, 0, 0.65)");
      ctx.fillStyle = glassSheen;
      ctx.fillRect(coverX, coverY, coverSize, coverSize);
    }
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
  glassSheen.addColorStop(0, "rgba(255, 255, 255, 0.22)");
  glassSheen.addColorStop(0.3, "rgba(255, 255, 255, 0.05)");
  glassSheen.addColorStop(0.6, "transparent");
  glassSheen.addColorStop(1, "rgba(0, 0, 0, 0.65)");
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
  ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
  ctx.lineWidth = 1.8;
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
  threeTextureCache.set(cacheKey, texture);
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

// 烘焙 128x128 径向高斯柔焦微光贴图 (中心聚光、边缘平滑衰减，彻底消除方块感)
function createBokehTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.2, "rgba(255, 255, 255, 0.85)");
  grad.addColorStop(0.45, "rgba(240, 248, 255, 0.35)");
  grad.addColorStop(0.75, "rgba(210, 230, 255, 0.08)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 烘焙 1024x1024 顶级发光舞台光环地台贴图 (多重同心光环、向心辐射线、外发光虚化)
function createStageHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const cx = 512;
  const cy = 512;

  // 1. 中心聚光大圆台底色
  const baseGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 500);
  baseGrad.addColorStop(0, "rgba(99, 140, 255, 0.42)");
  baseGrad.addColorStop(0.18, "rgba(79, 102, 241, 0.28)");
  baseGrad.addColorStop(0.38, "rgba(30, 58, 138, 0.16)");
  baseGrad.addColorStop(0.65, "rgba(15, 23, 42, 0.06)");
  baseGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. 多重同心科技发光光环 (Concentric Stage Rings)
  const rings = [
    { r: 120, width: 2.2, alpha: 0.7, glow: 0.4 },
    { r: 230, width: 2.5, alpha: 0.55, glow: 0.35 },
    { r: 350, width: 3.2, alpha: 0.5, glow: 0.3 },
    { r: 450, width: 2.0, alpha: 0.28, glow: 0.15 },
  ];

  rings.forEach((ring) => {
    // 宽外发光
    ctx.strokeStyle = `rgba(129, 140, 248, ${ring.glow})`;
    ctx.lineWidth = ring.width * 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();

    // 核心高亮细线
    ctx.strokeStyle = `rgba(224, 231, 255, ${ring.alpha})`;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 3. 舞台向心辐射流光微线 (Radial Compass Rays)
  const rayCount = 32;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const isMajor = i % 4 === 0;
    const innerR = 140;
    const outerR = 440;

    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = cy + Math.sin(angle) * outerR;

    ctx.strokeStyle = isMajor ? "rgba(199, 210, 254, 0.40)" : "rgba(147, 197, 253, 0.14)";
    ctx.lineWidth = isMajor ? 1.8 : 1.0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 4. 环形刻度微点阵 (Concentric Dot Array)
  const dotCount = 64;
  for (let i = 0; i < dotCount; i++) {
    const angle = (i / dotCount) * Math.PI * 2;
    const r = 350;
    const dx = cx + Math.cos(angle) * r;
    const dy = cy + Math.sin(angle) * r;
    ctx.fillStyle = i % 8 === 0 ? "rgba(255, 255, 255, 0.85)" : "rgba(165, 180, 252, 0.45)";
    ctx.beginPath();
    ctx.arc(dx, dy, i % 8 === 0 ? 2.5 : 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 烘焙舞台垂直聚光光锥贴图 (Volumetric Spotlight Beam Texture)
function createSpotlightBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // 纵向从顶到底衰减
  const vGrad = ctx.createLinearGradient(128, 0, 128, 512);
  vGrad.addColorStop(0, "rgba(255, 255, 255, 0.70)");
  vGrad.addColorStop(0.12, "rgba(199, 210, 254, 0.42)");
  vGrad.addColorStop(0.4, "rgba(129, 140, 248, 0.20)");
  vGrad.addColorStop(0.75, "rgba(99, 102, 241, 0.08)");
  vGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 256, 512);

  // 横向双侧柔焦羽化遮罩
  ctx.globalCompositeOperation = "destination-in";
  const hGrad = ctx.createLinearGradient(0, 0, 256, 0);
  hGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
  hGrad.addColorStop(0.28, "rgba(255, 255, 255, 0.65)");
  hGrad.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
  hGrad.addColorStop(0.72, "rgba(255, 255, 255, 0.65)");
  hGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 256, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 烘焙 3D 宏大天幕极光贴图 (Epic Stage Aurora Nebula)
function createStageNebulaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const nGrad = ctx.createRadialGradient(256, 220, 20, 256, 256, 256);
  nGrad.addColorStop(0, "rgba(99, 102, 241, 0.48)");
  nGrad.addColorStop(0.25, "rgba(59, 130, 246, 0.32)");
  nGrad.addColorStop(0.55, "rgba(147, 51, 234, 0.18)");
  nGrad.addColorStop(0.82, "rgba(15, 23, 42, 0.06)");
  nGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = nGrad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 烘焙超大柔焦景深光斑贴图 (Large Bokeh Disc Texture)
function createLargeBokehTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  const bGrad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  bGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  bGrad.addColorStop(0.35, "rgba(199, 210, 254, 0.65)");
  bGrad.addColorStop(0.7, "rgba(147, 197, 253, 0.20)");
  bGrad.addColorStop(0.95, "rgba(129, 140, 248, 0.04)");
  bGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bGrad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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
  }, [rawSongs, favorites, recentPlayedSongs, playlistGroups, browseType]);

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

  // 索引/交互回调里读它，属于渲染之后的时机；渲染期直接写 ref 违反 react-hooks/refs
  useEffect(() => {
    shelfItemsRef.current = activeShelfItems;
  }, [activeShelfItems]);

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

  // Mouse Parallax & 3D Gyroscope Tilt
  const mouseParallaxRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cardsGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const contactShadowMeshRef = useRef<THREE.Mesh | null>(null);
  const stageHaloMeshRef = useRef<THREE.Mesh | null>(null);
  const spotlightConeRef = useRef<THREE.Mesh | null>(null);
  const bokehOrbsRef = useRef<THREE.Points | null>(null);
  const nebulaMeshRef = useRef<THREE.Mesh | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Virtualized Card Meshes
  interface CardSlot {
    mesh: THREE.Mesh;
    currentItemId: string | null;
    isActive: boolean;
    rhythmPhase: number;
    floatPhase: number;
  }
  const cardSlotsRef = useRef<CardSlot[]>([]);

  // 切换展示模式 (Side Shelf ⇋ Stage Shelf)
  const toggleDisplayMode = useCallback(() => {
    playModeSwitchTick();
    setDisplayMode((prev) => {
      const next = prev === "stage" ? "side" : "stage";
      targetModeBlendRef.current = next === "side" ? 1.0 : 0.0;
      return next;
    });
  }, []);

  // 初始化 Three.js 3D 舞台
  useEffect(() => {
    // 关闭面板时必须整块跳过、从而触发上一次的清理函数。
    // 组件 return null 只是卸载了 canvas 元素，而渲染循环跑在闭包捕获的那个画布上，
    // 会继续往已脱离文档的 WebGL 上下文里画，直到下一次 isPlaying 变化才停 —— 这是一条失控循环。
    if (!isOpen) return;
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050711, 0.022);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 0.35, 6.6);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // 4. Lights (纯净白光、柔和环境光与聚光焦点灯)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const mainLight = new THREE.PointLight(0xffffff, 3.6, 25);
    mainLight.position.set(0, 3.2, 5.2);
    scene.add(mainLight);

    const fillLight = new THREE.PointLight(0x93c5fd, 2.2, 22);
    fillLight.position.set(-4.5, -0.4, 3.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe0e7ff, 1.4);
    rimLight.position.set(6, 6, -2);
    scene.add(rimLight);

    // 5. Cards Group
    const cardsGroup = new THREE.Group();
    cardsGroupRef.current = cardsGroup;
    scene.add(cardsGroup);

    // 6. 舞台深邃黑曜石镜面地面与透视全息地网
    const floorGeo = new THREE.PlaneGeometry(60, 60, 24, 24);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050811,
      roughness: 0.15,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.0;
    scene.add(floor);

    // 舞台全息流光透视地网 (0.22 优雅可见)
    const grid = new THREE.GridHelper(44, 36, 0x6366f1, 0x1e293b);
    grid.position.y = -1.99;
    if (grid.material instanceof THREE.Material) {
      grid.material.transparent = true;
      grid.material.opacity = 0.22;
    }
    scene.add(grid);

    // 6.1 舞台光环核心地台 (Stage Halo Luminous Pedestal)
    const stageHaloTexture = createStageHaloTexture();
    const stageHaloGeo = new THREE.PlaneGeometry(32, 26);
    const stageHaloMat = new THREE.MeshBasicMaterial({
      map: stageHaloTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.92,
    });
    const stageHaloMesh = new THREE.Mesh(stageHaloGeo, stageHaloMat);
    stageHaloMesh.rotation.x = -Math.PI / 2;
    stageHaloMesh.position.set(0, -1.97, 0.4);
    stageHaloMeshRef.current = stageHaloMesh;
    scene.add(stageHaloMesh);

    // 6.2 3D 垂直聚光光锥 (Volumetric Stage Spotlight Cone)
    const spotlightTexture = createSpotlightBeamTexture();
    const spotlightGeo = new THREE.CylinderGeometry(0.7, 5.0, 10.0, 32, 1, true);
    const spotlightMat = new THREE.MeshBasicMaterial({
      map: spotlightTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const spotlightMesh = new THREE.Mesh(spotlightGeo, spotlightMat);
    spotlightMesh.position.set(0, 3.0, 0.8);
    spotlightConeRef.current = spotlightMesh;
    scene.add(spotlightMesh);

    // 7. 高斯径向渐变柔和地面微光投影 (Smooth Gaussian Radial Contact Halo)
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 512;
    shadowCanvas.height = 512;
    const sCtx = shadowCanvas.getContext("2d")!;
    const sGrad = sCtx.createRadialGradient(256, 256, 10, 256, 256, 240);
    sGrad.addColorStop(0, "rgba(255, 255, 255, 0.38)");
    sGrad.addColorStop(0.3, "rgba(147, 197, 253, 0.18)");
    sGrad.addColorStop(0.65, "rgba(99, 102, 241, 0.06)");
    sGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 512, 512);

    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const contactShadowGeo = new THREE.PlaneGeometry(5.6, 3.6);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.set(0, -1.96, 0.9);
    contactShadowMeshRef.current = contactShadowMesh;
    scene.add(contactShadowMesh);

    // 8. 空间微光星尘 (220 颗多色微光粒子)
    const particleCount = 220;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const colorChoices = [
      new THREE.Color(0xffffff),
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xc7d2fe),
      new THREE.Color(0xfef08a),
    ];
    for (let p = 0; p < particleCount; p++) {
      const idx = p * 3;
      particlePos[idx] = (Math.random() - 0.5) * 28;
      particlePos[idx + 1] = (Math.random() - 0.5) * 16 + 1.2;
      particlePos[idx + 2] = (Math.random() - 0.5) * 20;

      const c = colorChoices[p % colorChoices.length];
      particleColors[idx] = c.r;
      particleColors[idx + 1] = c.g;
      particleColors[idx + 2] = c.b;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const bokehTexture = createBokehTexture();
    const particleMat = new THREE.PointsMaterial({
      size: 0.22,
      map: bokehTexture,
      transparent: true,
      opacity: 0.6,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // 8.1 空间超大柔焦景深光斑 (18 颗前/中景大型 Bokeh Orbs)
    const largeBokehCount = 18;
    const largeBokehGeo = new THREE.BufferGeometry();
    const largeBokehPos = new Float32Array(largeBokehCount * 3);
    for (let p = 0; p < largeBokehCount; p++) {
      const idx = p * 3;
      largeBokehPos[idx] = (Math.random() - 0.5) * 24;
      largeBokehPos[idx + 1] = (Math.random() - 0.5) * 12 + 0.5;
      largeBokehPos[idx + 2] = (Math.random() - 0.5) * 14 + 1.0;
    }
    largeBokehGeo.setAttribute("position", new THREE.BufferAttribute(largeBokehPos, 3));
    const largeBokehTexture = createLargeBokehTexture();
    const largeBokehMat = new THREE.PointsMaterial({
      size: 1.1,
      map: largeBokehTexture,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xc7d2fe,
    });
    const largeBokehPoints = new THREE.Points(largeBokehGeo, largeBokehMat);
    bokehOrbsRef.current = largeBokehPoints;
    scene.add(largeBokehPoints);

    // 8.2 3D 宏大天幕极光星云背景板 (Z: -9.5)
    const nebulaTexture = createStageNebulaTexture();
    const nebulaGeo = new THREE.PlaneGeometry(54, 34);
    const nebulaMat = new THREE.MeshBasicMaterial({
      map: nebulaTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: new THREE.Color(0x6366f1),
      opacity: 0.65,
    });
    const nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
    nebulaMesh.position.set(0, 2.8, -9.5);
    nebulaMeshRef.current = nebulaMesh;
    scene.add(nebulaMesh);

    // 9. 创建 11 张虚拟化卡片 Mesh (Three.js 显存级持久化纹理直连)
    const cardGeo = new THREE.PlaneGeometry(1.95, 2.45);
    const slots: CardSlot[] = [];

    for (let i = 0; i < SHELF_MAX_RENDER; i++) {
      const cardMat = new THREE.MeshStandardMaterial({
        roughness: 0.14,
        metalness: 0.2,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(cardGeo, cardMat);
      mesh.userData = { slotIndex: i };
      cardsGroup.add(mesh);

      slots.push({
        mesh,
        currentItemId: null,
        isActive: false,
        rhythmPhase: Math.random() * 10,
        floatPhase: i * 0.75,
      });
    }
    cardSlotsRef.current = slots;

    // 10. 渲染动画循环 (融合物理缓动与连续呼吸浮动)
    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // 模式平滑插值 (0 = stage, 1 = side)
      modeBlendRef.current += (targetModeBlendRef.current - modeBlendRef.current) * 0.08;
      const modeBlend = modeBlendRef.current;

      // 滚动位置平滑弹簧衰减 (拖拽时高响应 0.28，释放后丝滑减速 0.16)
      const lerpSpeed = isDraggingRef.current ? 0.28 : 0.16;
      currentScrollRef.current += (targetScrollRef.current - currentScrollRef.current) * lerpSpeed;
      const scrollPos = currentScrollRef.current;
      const centerVirtualIndex = Math.round(scrollPos);
      const scrollVelocity = targetScrollRef.current - currentScrollRef.current;

      // 动态速度倾角与转弯侧倾微动效 (Dynamic Velocity Bank & Yaw)
      const dynamicBankRoll = Math.max(-0.15, Math.min(0.15, scrollVelocity * 0.04));
      const dynamicYawLead = Math.max(-0.12, Math.min(0.12, scrollVelocity * 0.03));

      // 检测是否跨越刻度并发出 PSP 机械齿轮咔哒音效
      if (centerVirtualIndex !== lastDetentStepRef.current) {
        const vel = Math.abs(targetScrollRef.current - currentScrollRef.current);
        playMechanicalGearTick(centerVirtualIndex, 1.0 + Math.min(vel, 1.5));
        lastDetentStepRef.current = centerVirtualIndex;

        const currentItems = shelfItemsRef.current;
        if (currentItems.length > 0) {
          const normIdx =
            ((centerVirtualIndex % currentItems.length) + currentItems.length) %
            currentItems.length;
          activeIndexRef.current = normIdx;

          // 节流 React state 更新，避免高速切歌时每秒触发 30 次 DOM/HUD 重渲染造成 Three.js 掉帧
          if (!reactUpdateTimerRef.current) {
            reactUpdateTimerRef.current = setTimeout(() => {
              reactUpdateTimerRef.current = null;
              setActiveIndex(activeIndexRef.current);
            }, 40);
          }
        }
      }

      // 鼠标视差与模式切换镜头景深推拉 (Camera Dolly Push/Pull on Mode Switch)
      const mp = mouseParallaxRef.current;
      mp.x += (mp.targetX - mp.x) * 0.05;
      mp.y += (mp.targetY - mp.y) * 0.05;

      if (cameraRef.current) {
        const dollyZ = Math.sin(modeBlend * Math.PI) * 0.28;
        cameraRef.current.position.x = mp.x * 0.65;
        cameraRef.current.position.y = 0.35 + mp.y * 0.4;
        cameraRef.current.position.z = 6.6 - dollyZ;
        cameraRef.current.lookAt(0, 0, 0);
      }

      // 空间星尘粒子自转与音律呼吸微动效
      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.0003;
        const pulseScale = 1.0 + Math.sin(time * 0.002) * 0.05;
        particlesRef.current.scale.set(pulseScale, pulseScale, pulseScale);
      }

      // 前景柔焦大光斑轻柔漂移与视差浮动
      if (bokehOrbsRef.current) {
        bokehOrbsRef.current.rotation.y -= 0.00015;
        bokehOrbsRef.current.position.y = Math.sin(time * 0.0008) * 0.12;
      }

      // 舞台光环核心地台微旋呼吸
      if (stageHaloMeshRef.current) {
        stageHaloMeshRef.current.rotation.z = Math.sin(time * 0.0003) * 0.025;
        const mat = stageHaloMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.86 + Math.sin(time * 0.002) * 0.08;
      }

      // 垂直聚光光锥动态呼吸与向心微移
      if (spotlightConeRef.current) {
        spotlightConeRef.current.position.x = THREE.MathUtils.lerp(0, -0.6, modeBlend);
        spotlightConeRef.current.rotation.z = Math.sin(time * 0.0008) * 0.015;
        const mat = spotlightConeRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.16 + Math.sin(time * 0.0025) * 0.04;
      }

      // 宏大天幕星云轻柔呼吸
      if (nebulaMeshRef.current) {
        const nebScale = 1.0 + Math.sin(time * 0.0007) * 0.03;
        nebulaMeshRef.current.scale.set(nebScale, nebScale, 1.0);
      }

      // 地面接触光晕动态跟随
      if (contactShadowMeshRef.current) {
        const shadowX = THREE.MathUtils.lerp(0, -1.25, modeBlend);
        contactShadowMeshRef.current.position.x = shadowX;
        contactShadowMeshRef.current.position.z = THREE.MathUtils.lerp(0.9, 0.8, modeBlend);
      }

      // 虚拟化卡片位置与姿态计算
      const currentItems = shelfItemsRef.current;
      const totalItems = currentItems.length;

      if (totalItems > 0) {
        for (let k = 0; k < SHELF_MAX_RENDER; k++) {
          const slot = cardSlotsRef.current[k];
          if (!slot) continue;

          // 该槽位对应的相对偏移量 (-5 .. +5 连续浮点)
          const slotRelOffset = k - HALF_WINDOW;
          const fractionalOffset = slotRelOffset - (scrollPos - centerVirtualIndex);
          const absOffset = Math.abs(fractionalOffset);

          // 对应的真实项目索引
          const itemIndex =
            (((centerVirtualIndex + slotRelOffset) % totalItems) + totalItems) % totalItems;
          const item = currentItems[itemIndex];

          // 更新节奏与悬浮呼吸相位
          slot.rhythmPhase += dt * 4.5;
          slot.floatPhase += dt * 1.8;

          // 显存级持久化纹理秒级指针对接 (零 CPU Canvas 栅格化，零显存上载阻塞，真 120 FPS 满帧流转)
          const isSlotActive = absOffset < 0.5;
          if (slot.currentItemId !== item.id || slot.isActive !== isSlotActive) {
            const targetTex = getOrCreateCardTexture(item, isSlotActive, itemIndex);
            const mat = slot.mesh.material as THREE.MeshStandardMaterial;
            if (mat.map !== targetTex) {
              mat.map = targetTex;
              mat.needsUpdate = true;
            }
            slot.currentItemId = item.id;
            slot.isActive = isSlotActive;
          }

          // 呼吸浮动位移微动效 (Breathing Float Amplitude)
          const floatY = Math.sin(slot.floatPhase) * (isSlotActive ? 0.045 : 0.02);
          const floatZ = Math.cos(slot.floatPhase * 0.8) * (isSlotActive ? 0.03 : 0.01);
          const tiltRoll = Math.sin(slot.floatPhase * 0.6) * 0.015;

          // === 1. 舞台展开模式 (Stage Shelf) - 经典 Apple Cover Flow 空间对称向心弧面 ===
          const sign = Math.sign(fractionalOffset);
          const u = Math.min(absOffset, 1.0); // 核心中心展开区 (0..1)
          const v = Math.max(0, absOffset - 1.0); // 远端延伸区 (>1)

          // X 轴位移：中心卡片精准固定在 x=0，两侧卡片平滑对称展开，消除任何偏移错位
          const stagePx = sign * (u * 1.9 + v * 1.22);
          // Y 轴微下沉与呼吸浮动
          const stagePy = -u * 0.015 - v * 0.025 + floatY;
          // Z 轴深度：中心突出前置 (Z=1.15)，两侧平滑推入景深
          const stagePz = 1.15 - u * 0.85 - v * 0.65 + floatZ;
          // Y 轴旋转：精准向心偏转 + 动态转向侧倾
          const stageFocalZ = 4.0;
          const stageRotY = -Math.atan2(stagePx, stageFocalZ - stagePz) * 1.25 + dynamicYawLead;
          const stageRotX = mp.y * 0.08 + tiltRoll;
          const stageRotZ = -mp.x * 0.02 + dynamicBankRoll;
          // 缩放：中心 1.22x + 磁吸微突
          const centerOvershoot = Math.max(0, 1.0 - absOffset * 2.0);
          const stageScale = 1.22 - u * 0.26 - v * 0.05 + centerOvershoot * 0.025;

          // === 2. 侧栏透视模式 (Side Shelf) - 经典 Apple 偏左侧向 Cover Flow 尊享立体阵列 ===
          const sideCenterX = -0.32; // 当前激活卡片偏左黄金分割点
          // 左右非对称侧向梯级步进（左侧紧凑收拢，右侧展开深远透视通道）
          const sideStepX =
            sign < 0
              ? u * 1.45 + v * 0.6 // 左侧紧凑向左展开
              : u * 1.65 + v * 0.72; // 右侧开阔向右延伸
          const sidePx = sideCenterX + sign * sideStepX;
          const sidePy = -u * 0.015 - v * 0.025 + floatY;
          const sidePz = 1.2 - u * 0.55 - v * 0.4 + floatZ;

          // Smoothstep S 型翻转过渡：在 [-0.85, 0.85] 范围内平滑旋转，两侧锁定在黄金 55° 侧倾角
          const flipProgress = Math.max(-1.0, Math.min(1.0, fractionalOffset / 0.85));
          const smoothFlip = Math.sign(flipProgress) * Math.pow(Math.abs(flipProgress), 0.75);
          const sideTargetRotY = -smoothFlip * THREE.MathUtils.degToRad(55);
          const sideRotY = sideTargetRotY + dynamicYawLead * 0.6;
          const sideRotX = 0.03 + mp.y * 0.07 + tiltRoll;
          const sideRotZ = -mp.x * 0.015 + dynamicBankRoll * 0.6;
          const sideScale = 1.2 - u * 0.24 - v * 0.05 + centerOvershoot * 0.02;

          // === 3. 模式平滑形变插值 (Stage <-> Side 400ms Morphing) ===
          const finalPx = THREE.MathUtils.lerp(stagePx, sidePx, modeBlend);
          const finalPy = THREE.MathUtils.lerp(stagePy, sidePy, modeBlend);
          const finalPz = THREE.MathUtils.lerp(stagePz, sidePz, modeBlend);
          const finalRotX = THREE.MathUtils.lerp(stageRotX, sideRotX, modeBlend);
          const finalRotY = THREE.MathUtils.lerp(stageRotY, sideRotY, modeBlend);
          const finalRotZ = THREE.MathUtils.lerp(stageRotZ, sideRotZ, modeBlend);
          const finalScale = THREE.MathUtils.lerp(stageScale, sideScale, modeBlend);

          slot.mesh.position.set(finalPx, finalPy, finalPz);
          slot.mesh.rotation.set(finalRotX, finalRotY, finalRotZ);
          slot.mesh.scale.set(finalScale, finalScale, finalScale);

          // 远端平滑景深消隐与雾化衰减
          const opacity = Math.max(0, Math.min(1, 1.0 - Math.max(0, absOffset - 3.2) * 0.35));
          const mat = slot.mesh.material as THREE.MeshStandardMaterial;
          mat.opacity = opacity;
          slot.mesh.visible = opacity > 0.01;
        }
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // 窗口尺寸自适应
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      cameraRef.current.aspect = nw / nh;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(nw, nh);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (reactUpdateTimerRef.current) {
        clearTimeout(reactUpdateTimerRef.current);
        reactUpdateTimerRef.current = null;
      }
      renderer.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      largeBokehGeo.dispose();
      largeBokehMat.dispose();
      largeBokehTexture.dispose();
      stageHaloGeo.dispose();
      stageHaloMat.dispose();
      stageHaloTexture.dispose();
      spotlightGeo.dispose();
      spotlightMat.dispose();
      spotlightTexture.dispose();
      nebulaGeo.dispose();
      nebulaMat.dispose();
      nebulaTexture.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      cardGeo.dispose();
      slots.forEach((s) => {
        (s.mesh.material as THREE.Material).dispose();
      });
      threeTextureCache.forEach((tex) => tex.dispose());
      threeTextureCache.clear();
    };
  }, [isAudioPlaying, isOpen]);

  // 相对刻度滚动 (带音效)
  const scrollToRelative = useCallback((delta: number) => {
    targetScrollRef.current += delta;
  }, []);

  // 鼠标滚轮接管
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if ((e.target as HTMLElement).closest(".shelf-hud-interactive, .custom-scrollbar")) {
      return;
    }
    e.preventDefault();
    const delta = Math.sign(e.deltaY || e.deltaX) * 0.85;
    targetScrollRef.current += delta;
  }, []);

  // 播放当前选中的卡片 (歌单模式下整单播放，单曲模式下单曲播放)
  const handlePlayCurrent = useCallback(async () => {
    const curIdx = activeIndexRef.current ?? activeIndex;
    const cur = activeShelfItems[curIdx] || activeShelfItems[activeIndex];
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
  }, [
    activeShelfItems,
    activeIndex,
    currentPlayingSong,
    playTrackWithPipeline,
    togglePlay,
    setQueue,
  ]);

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

  // 鼠标手势拖拽与 3D 卡片直接点击 (Raycaster Direct Hit)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".shelf-hud-interactive, button, input")) {
      return;
    }
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragVelocityRef.current = 0;
    lastDragTimeRef.current = performance.now();
    prevMouseXRef.current = e.clientX;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMoveParallax = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const now = performance.now();
      const dt = Math.max(1, now - lastDragTimeRef.current);
      const deltaX = e.clientX - prevMouseXRef.current;

      if (Math.abs(e.clientX - mouseDownPosRef.current.x) > 4) {
        hasDraggedRef.current = true;
      }

      // 记录滑动速度 (用于惯性释放)
      const instantVelocity = (-deltaX * 0.007) / (dt / 16.6);
      dragVelocityRef.current = dragVelocityRef.current * 0.6 + instantVelocity * 0.4;
      lastDragTimeRef.current = now;
      prevMouseXRef.current = e.clientX;

      targetScrollRef.current -= deltaX * 0.0075;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      mouseParallaxRef.current.targetX = nx;
      mouseParallaxRef.current.targetY = -ny;
    }
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // 惯性释放衰减
        const fling = Math.max(-2.5, Math.min(2.5, dragVelocityRef.current * 2.2));
        targetScrollRef.current = Math.round(targetScrollRef.current + fling);
        dragVelocityRef.current = 0;
      }

      // 如果未发生明显拖拽，则触发 3D 卡片精准 Raycast 射线拾取
      if (!hasDraggedRef.current && cameraRef.current && cardsGroupRef.current) {
        const mx = (e.clientX / window.innerWidth) * 2 - 1;
        const my = -(e.clientY / window.innerHeight) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mx, my), cameraRef.current);

        const meshes = cardSlotsRef.current.map((s) => s.mesh);
        const intersects = raycaster.intersectObjects(meshes, false);

        if (intersects.length > 0) {
          const hitMesh = intersects[0].object as THREE.Mesh;
          const slotIdx = hitMesh.userData?.slotIndex;
          if (slotIdx != null) {
            const slotRelOffset = slotIdx - HALF_WINDOW;
            const scrollPos = currentScrollRef.current;
            const centerVirtualIndex = Math.round(scrollPos);
            const fractionalOffset = slotRelOffset - (scrollPos - centerVirtualIndex);
            const absOffset = Math.abs(fractionalOffset);

            if (absOffset < 0.5) {
              // 点击的是中心活跃卡片
              const uv = intersects[0].uv;
              if (uv && uv.y < 0.24) {
                // 点击在底部操作按钮区
                handlePlayCurrent();
              } else {
                // 点击在卡片主体：直接展开曲目详情
                handleOpenDetail();
              }
            } else {
              // 点击侧边卡片：平滑滚动到该卡片为中心
              targetScrollRef.current += Math.round(fractionalOffset);
              playCardSelectTick();
            }
          }
        }
      }
    },
    [handlePlayCurrent, handleOpenDetail]
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
  }, [selectedShelfItem, playSong, setQueue]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        scrollToRelative(-1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        scrollToRelative(1);
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
    scrollToRelative,
    handlePlayCurrent,
    toggleDisplayMode,
    handleOpenDetail,
    showDetailPanel,
    onClose,
    closePanel,
  ]);

  if (!isOpen) return null;

  const currentActiveItem = activeShelfItems[activeIndex];

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
      className={`fixed inset-0 z-50 w-full h-full min-h-[520px] ${transparentBg ? "bg-transparent pointer-events-none" : "bg-[#030408]"} overflow-hidden select-none flex flex-col justify-between p-6 ${className}`}
      style={
        transparentBg
          ? undefined
          : {
              background:
                "radial-gradient(ellipse 130% 90% at 50% 28%, #0e172e 0%, #080c18 45%, #030408 85%, #010204 100%)",
            }
      }
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveParallax}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* ── 动态自适应极光与舞台弥散流光背景 (Atmospheric Aurora Mesh) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* 顶部主舞台氛围光穹顶 */}
        <div
          className="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[1350px] h-[850px] rounded-full blur-[130px] opacity-55 transition-all duration-1000"
          style={{
            background:
              browseType === "favorites"
                ? "radial-gradient(circle, rgba(244,63,94,0.55) 0%, rgba(168,85,247,0.30) 45%, transparent 70%)"
                : browseType === "recent"
                  ? "radial-gradient(circle, rgba(245,158,11,0.55) 0%, rgba(239,68,68,0.30) 45%, transparent 70%)"
                  : browseType === "daily"
                    ? "radial-gradient(circle, rgba(16,185,129,0.55) 0%, rgba(6,182,212,0.30) 45%, transparent 70%)"
                    : "radial-gradient(circle, rgba(99,102,241,0.55) 0%, rgba(59,130,246,0.35) 45%, transparent 70%)",
          }}
        />

        {/* 舞台顶棚柔焦聚光光晕 (Concert Theater Ceiling Spotlight Wash) */}
        <div
          className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[720px] h-[460px] rounded-[100%] blur-[90px] opacity-40 transition-all duration-1000 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(199,210,254,0.35) 0%, rgba(129,140,248,0.18) 45%, transparent 75%)",
          }}
        />

        {/* 底部舞台地面反光与舞台光环地面外溢 (Stage Floor Specular Wash) */}
        <div
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[1100px] h-[420px] rounded-[100%] blur-[90px] opacity-55 pointer-events-none transition-all duration-1000"
          style={{
            background:
              browseType === "favorites"
                ? "radial-gradient(ellipse, rgba(244,63,94,0.35) 0%, rgba(168,85,247,0.20) 40%, transparent 75%)"
                : browseType === "recent"
                  ? "radial-gradient(ellipse, rgba(245,158,11,0.35) 0%, rgba(239,68,68,0.20) 40%, transparent 75%)"
                  : browseType === "daily"
                    ? "radial-gradient(ellipse, rgba(16,185,129,0.35) 0%, rgba(6,182,212,0.20) 40%, transparent 75%)"
                    : "radial-gradient(ellipse, rgba(99,102,241,0.35) 0%, rgba(59,130,246,0.20) 40%, transparent 75%)",
          }}
        />

        {/* 舞台顶端与地平流光透视细线 */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
        <div className="absolute bottom-[23%] left-[12%] right-[12%] h-[1px] bg-gradient-to-r from-transparent via-indigo-400/25 to-transparent pointer-events-none blur-[0.5px]" />
      </div>

      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto cursor-grab active:cursor-grabbing z-10"
      />

      {/* ── 顶部控制栏 (Apple Monochrome Liquid Glass Top HUD) ── */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-7xl mx-auto px-3.5 sm:px-5 py-2 bg-white/[0.06] border border-white/[0.18] rounded-3xl backdrop-blur-[56px] backdrop-saturate-[180%] shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_1.5px_rgba(255,255,255,0.3)] shelf-hud-interactive gap-2 sm:gap-3 overflow-hidden select-none">
        <div className="mineradio-glass-specular-glint" />
        {/* 左侧标题与模式 */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
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
        <div className="flex items-center gap-0.5 sm:gap-1 bg-black/40 p-1 rounded-2xl border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("playlists");
              targetScrollRef.current = 0;
            }}
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
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("tracks");
              targetScrollRef.current = 0;
            }}
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
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("favorites");
              targetScrollRef.current = 0;
            }}
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
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("recent");
              targetScrollRef.current = 0;
            }}
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
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("offline");
              targetScrollRef.current = 0;
            }}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 whitespace-nowrap cursor-pointer ${
              browseType === "offline"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Download className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span>离线曲库 {offlineSongs.length > 0 ? `(${offlineSongs.length})` : ""}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("daily");
              targetScrollRef.current = 0;
            }}
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
        <div className="flex items-center gap-2 shrink-0">
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
        <div className="relative z-30 max-w-3xl w-full mx-auto my-auto bg-black/75 border border-white/[0.22] rounded-[36px] p-6 backdrop-blur-[64px] backdrop-saturate-[190%] shadow-[0_32px_90px_rgba(0,0,0,0.95),inset_0_1.5px_2px_rgba(255,255,255,0.35)] animate-in fade-in zoom-in-95 duration-200 shelf-hud-interactive">
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
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
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

      {/* ── 底部当前卡片控制器 (Apple Liquid Glass Floating HUD) ── */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-4xl mx-auto px-6 py-3 bg-white/[0.07] border border-white/[0.20] rounded-full backdrop-blur-[56px] backdrop-saturate-[180%] shadow-[0_24px_60px_rgba(0,0,0,0.9),inset_0_1.5px_2px_rgba(255,255,255,0.35)] shelf-hud-interactive overflow-hidden">
        <div className="mineradio-glass-specular-glint" />
        {/* 左侧上一首按钮 */}
        <button
          type="button"
          onClick={() => scrollToRelative(-1)}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/15 transition-all active:scale-90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
          title="上一张 (Left / Up)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* 中间信息与播放控制 (包含微缩封面、标题与声波) */}
        <div className="flex items-center gap-4 md:gap-5 min-w-0">
          {/* 微缩封面与状态 */}
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/10 border border-white/20 shadow-md flex-shrink-0">
            <img
              src={currentActiveItem?.cover || "/default-cover.svg"}
              alt={currentActiveItem?.title || "Cover"}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="text-left min-w-0 max-w-[240px] md:max-w-[280px]">
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
            className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold text-xs px-4 md:px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(255,255,255,0.35)] transition-all active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
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
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 md:px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0 whitespace-nowrap cursor-pointer"
          >
            <ListMusic className="w-4 h-4 text-white/80 shrink-0" />
            <span className="whitespace-nowrap">曲目列表</span>
          </button>
        </div>

        {/* 右侧下一首按钮 */}
        <button
          type="button"
          onClick={() => scrollToRelative(1)}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/15 transition-all active:scale-90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
          title="下一张 (Right / Down)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Shelf3DView;
