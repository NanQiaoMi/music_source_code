/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { usePlaylistStore, Song } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaylistGroupStore, PlaylistGroup } from "@/store/playlistGroupStore";
import { useFavoritesStore } from "@/store/favoritesStore";
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
} from "lucide-react";

export type ShelfDisplayMode = "side" | "stage"; // 侧栏弧形透视 (Side Shelf) | 舞台水平展开 (Stage Shelf)
export type ShelfBrowseType = "playlists" | "tracks" | "favorites" | "recent" | "daily";

interface Shelf3DViewProps {
  isOpen?: boolean;
  className?: string;
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
  const favorites = useFavoritesStore((state) => state.favorites);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const closePanel = useUIStore((state) => state.closePanel);

  // Local state
  const [displayMode, setDisplayMode] = useState<ShelfDisplayMode>("stage");
  const [browseType, setBrowseType] = useState<ShelfBrowseType>("playlists");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDetailPanel, setShowDetailPanel] = useState<boolean>(false);
  const [selectedShelfItem, setSelectedShelfItem] = useState<ShelfItem | null>(null);
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>("");

  // 构建歌单列表 (Playlists Mode，智能补全并确保不展示空 0 首)
  const playlistItems = useMemo<ShelfItem[]>(() => {
    const defaultCover = "/default-cover.svg";
    const items: ShelfItem[] = [];

    // 基础有效曲库
    const validSongs = rawSongs.length > 0 ? rawSongs : [
      { id: "demo-1", title: "后来你好吗", artist: "A-Lin", album: "原声大碟", cover: "/default-cover.svg", duration: 245, source: "local" },
      { id: "demo-2", title: "星河游戈 (Star River)", artist: "Vibe Master", album: "Cyber Sound", cover: "/default-cover.svg", duration: 198, source: "local" },
      { id: "demo-3", title: "Midnight Pulse", artist: "Synthwave Echo", album: "Dark Horizon", cover: "/default-cover.svg", duration: 220, source: "local" },
      { id: "demo-4", title: "Neon City", artist: "Electric Dream", album: "Vapor Trails", cover: "/default-cover.svg", duration: 210, source: "local" },
      { id: "demo-5", title: "Deep Resonance", artist: "Sub Bass Lab", album: "Frequency Matrix", cover: "/default-cover.svg", duration: 260, source: "local" },
    ] as Song[];

    // 1. 全部歌曲库
    items.push({
      id: "pl-all",
      type: "playlist",
      title: "全部歌曲库 (All Songs)",
      subtitle: `${validSongs.length} 首曲目 · 完整音乐曲库`,
      cover: validSongs[0]?.cover || defaultCover,
      tag: "曲库总览",
      trackCount: validSongs.length,
      songs: validSongs,
    });

    // 2. 我喜欢的音乐 (若收藏为空，则智能推荐曲库前列)
    const effectiveFavs = favorites.length > 0 ? favorites : validSongs.slice(0, Math.min(12, validSongs.length));
    items.push({
      id: "pl-favorites",
      type: "playlist",
      title: "我喜欢的音乐 (Favorites)",
      subtitle: `${effectiveFavs.length} 首曲目 · 专属红心收藏`,
      cover: effectiveFavs[0]?.cover || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop",
      tag: "红心收藏",
      trackCount: effectiveFavs.length,
      songs: effectiveFavs,
    });

    // 3. 最近播放记录
    const effectiveRecent = recentPlayedSongs.length > 0 ? recentPlayedSongs : validSongs.slice(0, Math.min(8, validSongs.length));
    items.push({
      id: "pl-recent",
      type: "playlist",
      title: "最近播放记录 (Recent)",
      subtitle: `${effectiveRecent.length} 首曲目 · 时光印记`,
      cover: effectiveRecent[0]?.cover || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
      tag: "历史记录",
      trackCount: effectiveRecent.length,
      songs: effectiveRecent,
    });

    // 4. 自定义与系统歌单组
    playlistGroups.forEach((group: PlaylistGroup, idx) => {
      const gSongs = (group.songs && group.songs.length > 0 ? group.songs : validSongs.slice(idx * 3, idx * 3 + 10)) as Song[];
      items.push({
        id: `pl-group-${group.id}`,
        type: "playlist",
        title: group.name,
        subtitle: `${gSongs.length} 首曲目 · ${group.type === "daily" ? "AI 每日推荐" : "精选歌单"}`,
        cover: group.cover || gSongs[0]?.cover || defaultCover,
        tag: group.type === "daily" ? "每日推荐" : "精选歌单",
        trackCount: gSongs.length,
        songs: gSongs.length > 0 ? gSongs : validSongs,
      });
    });

    return items;
  }, [rawSongs, favorites, recentPlayedSongs, playlistGroups]);

  // 构建单曲列表 (Tracks Mode)
  const trackItems = useMemo<ShelfItem[]>(() => {
    let sourceSongs: Song[] = rawSongs;
    if (browseType === "favorites") {
      sourceSongs = favorites.length > 0 ? favorites : rawSongs;
    } else if (browseType === "recent") {
      sourceSongs = recentPlayedSongs.length > 0 ? recentPlayedSongs : rawSongs;
    } else if (browseType === "daily") {
      const dailyGroup = playlistGroups.find((g) => g.type === "daily");
      sourceSongs = (dailyGroup?.songs as Song[]) || rawSongs;
    }

    if (sourceSongs.length === 0) {
      sourceSongs = [
        { id: "demo-1", title: "后来你好吗", artist: "A-Lin", album: "原声大碟", cover: "/default-cover.svg", duration: 245, source: "local" },
        { id: "demo-2", title: "星河游戈 (Star River)", artist: "Vibe Master", album: "Cyber Sound", cover: "/default-cover.svg", duration: 198, source: "local" },
        { id: "demo-3", title: "Midnight Pulse", artist: "Synthwave Echo", album: "Dark Horizon", cover: "/default-cover.svg", duration: 220, source: "local" },
        { id: "demo-4", title: "Neon City", artist: "Electric Dream", album: "Vapor Trails", cover: "/default-cover.svg", duration: 210, source: "local" },
        { id: "demo-5", title: "Deep Resonance", artist: "Sub Bass Lab", album: "Frequency Matrix", cover: "/default-cover.svg", duration: 260, source: "local" },
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
  shelfItemsRef.current = activeShelfItems;

  // Interaction & Physics refs
  const isDraggingRef = useRef(false);
  const prevMouseXRef = useRef(0);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const lastDetentStepRef = useRef(0);
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
  const animFrameRef = useRef<number | null>(null);

  // Virtualized Card Meshes & Canvases
  interface CardSlot {
    mesh: THREE.Mesh;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
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

  // 烘焙单个卡片 CanvasTexture 纹理 (Apple 顶级灰度透明液态玻璃与高光倒角)
  const renderCardCanvas = useCallback(
    (
      slot: CardSlot,
      item: ShelfItem,
      isActive: boolean,
      isPlaying: boolean,
      indexLabel: number
    ) => {
      const { ctx, canvas, texture } = slot;
      const w = canvas.width; // 1024
      const h = canvas.height; // 1280

      ctx.clearRect(0, 0, w, h);

      // 1. 卡片主体背景 - 极度通透的深黑灰液态玻璃底板
      drawRoundedRect(ctx, 20, 20, w - 40, h - 40, 52);
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      if (isActive) {
        bgGrad.addColorStop(0, "rgba(34, 34, 42, 0.88)");
        bgGrad.addColorStop(0.35, "rgba(18, 18, 24, 0.92)");
        bgGrad.addColorStop(1, "rgba(6, 6, 8, 0.97)");
      } else {
        bgGrad.addColorStop(0, "rgba(20, 20, 26, 0.65)");
        bgGrad.addColorStop(0.5, "rgba(10, 10, 14, 0.75)");
        bgGrad.addColorStop(1, "rgba(3, 3, 5, 0.88)");
      }
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // 2. 双层物理折射高光边缘 (Inner Caustics & Specular Edge)
      ctx.save();
      drawRoundedRect(ctx, 20, 20, w - 40, h - 40, 52);
      if (isActive) {
        // 主外边框高光
        ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
        ctx.lineWidth = 6;
        ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
        ctx.shadowBlur = 28;
        ctx.stroke();

        // 顶边物理切光高光 (Top Rim Glint)
        const topGlint = ctx.createLinearGradient(80, 20, w - 80, 20);
        topGlint.addColorStop(0, "rgba(255, 255, 255, 0)");
        topGlint.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
        topGlint.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.strokeStyle = topGlint;
        ctx.lineWidth = 5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "transparent";
        ctx.stroke();
      }
      ctx.restore();

      // 3. 顶部序号徽标胶囊
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.06)";
      drawRoundedRect(ctx, 60, 58, 176, 56, 28);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.65)";
      ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`#${String(indexLabel + 1).padStart(2, "0")} · ${item.tag}`, 148, 86);

      // 4. 右上角模式徽章 (PLAYLIST / LOSSLESS)
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.05)";
      drawRoundedRect(ctx, w - 240, 58, 180, 56, 28);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.50)";
      ctx.font = "bold 20px -apple-system, sans-serif";
      ctx.fillText(item.type === "playlist" ? "PLAYLIST" : "LOSSLESS", w - 150, 86);

      // 5. 封面绘制 (Squircle 圆角图片与倒角高光)
      const coverSize = 640;
      const coverX = (w - coverSize) / 2;
      const coverY = 146;

      ctx.save();
      drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 44);
      ctx.clip();

      const img = getOrLoadCoverImage(item.cover, () => {
        renderCardCanvas(slot, item, isActive, isPlaying, indexLabel);
      });

      if (img) {
        ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
      } else {
        // 质感同心黑胶底图
        const vinylGrad = ctx.createRadialGradient(
          w / 2,
          coverY + coverSize / 2,
          20,
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
        ctx.lineWidth = 2.5;
        for (let r = 50; r < coverSize / 2; r += 26) {
          ctx.beginPath();
          ctx.arc(w / 2, coverY + coverSize / 2, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(w / 2, coverY + coverSize / 2, 54, 0, Math.PI * 2);
        ctx.fill();
      }

      // 封面斜向镜面折射光
      const glassSheen = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
      glassSheen.addColorStop(0, "rgba(255, 255, 255, 0.22)");
      glassSheen.addColorStop(0.3, "rgba(255, 255, 255, 0.05)");
      glassSheen.addColorStop(0.6, "transparent");
      glassSheen.addColorStop(1, "rgba(0, 0, 0, 0.65)");
      ctx.fillStyle = glassSheen;
      ctx.fillRect(coverX, coverY, coverSize, coverSize);
      ctx.restore();

      // 6. 律动音频跳动频谱柱 (纯白透明度律动)
      if (isActive) {
        const barCount = 9;
        const barWidth = 8;
        const barGap = 6;
        const totalBarW = barCount * barWidth + (barCount - 1) * barGap;
        const startX = (w - totalBarW) / 2;
        const barBaseY = coverY + coverSize - 28;

        for (let b = 0; b < barCount; b++) {
          const speed = isPlaying ? 1.0 : 0.2;
          const hVal = Math.sin(slot.rhythmPhase * speed + b * 0.85) * 22 + 26;
          ctx.fillStyle = isPlaying ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.4)";
          drawRoundedRect(
            ctx,
            startX + b * (barWidth + barGap),
            barBaseY - hVal,
            barWidth,
            hVal,
            4
          );
          ctx.fill();
        }
      }

      // 7. 卡片大标题 (智能字号自适应，避免生硬截断)
      ctx.fillStyle = isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.88)";
      if (item.title.length > 24) {
        ctx.font = "bold 38px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
      } else if (item.title.length > 16) {
        ctx.font = "bold 44px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
      } else {
        ctx.font = "bold 52px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      const titleText =
        item.title.length > 28 ? item.title.slice(0, 27) + "…" : item.title;
      ctx.fillText(titleText, w / 2, 875);

      // 8. 副标题与曲目计数
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.45)";
      ctx.font = "500 30px -apple-system, sans-serif";
      const subtitleText =
        item.subtitle.length > 28 ? item.subtitle.slice(0, 27) + "…" : item.subtitle;
      ctx.fillText(subtitleText, w / 2, 938);

      // 9. 底部操作按键 (透明液态玻璃胶囊)
      ctx.save();
      const btnY = 1035;
      const btnW = 460;
      const btnH = 92;
      const btnX = (w - btnW) / 2;

      drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 46);
      if (isActive) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.20)";
        ctx.shadowColor = "rgba(255, 255, 255, 0.40)";
        ctx.shadowBlur = 22;
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 播放文字
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const btnText =
        item.type === "playlist"
          ? "▶ 播放歌单 · 点击详情"
          : isActive && isPlaying
          ? "PAUSE / 暂停"
          : "PLAY / 播放";
      ctx.fillText(btnText, w / 2, btnY + btnH / 2);
      ctx.restore();

      slot.currentItemId = item.id;
      slot.isActive = isActive;
      texture.needsUpdate = true;
    },
    []
  );

  // 初始化 Three.js 3D 舞台
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050507, 0.045);
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

    // 4. Lights (纯净白光与柔和环境光)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const mainLight = new THREE.PointLight(0xffffff, 3.4, 25);
    mainLight.position.set(0, 3.0, 5.0);
    scene.add(mainLight);

    const fillLight = new THREE.PointLight(0xe5e7eb, 1.8, 20);
    fillLight.position.set(-4.0, -0.6, 3.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(6, 6, -2);
    scene.add(rimLight);

    // 5. Cards Group
    const cardsGroup = new THREE.Group();
    cardsGroupRef.current = cardsGroup;
    scene.add(cardsGroup);

    // 6. 暗调黑曜石反光镜面地面
    const floorGeo = new THREE.PlaneGeometry(42, 42, 24, 24);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x040406,
      roughness: 0.06,
      metalness: 0.94,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.0;
    scene.add(floor);

    // 7. 高斯径向渐变柔和地面微光投影 (Smooth Gaussian Radial Contact Halo)
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 512;
    shadowCanvas.height = 512;
    const sCtx = shadowCanvas.getContext("2d")!;
    const sGrad = sCtx.createRadialGradient(256, 256, 10, 256, 256, 240);
    sGrad.addColorStop(0, "rgba(255, 255, 255, 0.20)");
    sGrad.addColorStop(0.3, "rgba(255, 255, 255, 0.08)");
    sGrad.addColorStop(0.65, "rgba(255, 255, 255, 0.02)");
    sGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 512, 512);

    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const contactShadowGeo = new THREE.PlaneGeometry(4.8, 3.0);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.set(0, -1.98, 0.9);
    contactShadowMeshRef.current = contactShadowMesh;
    scene.add(contactShadowMesh);

    // 8. 空间银白微光粒子星尘 (350 颗微光星尘)
    const particleCount = 350;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePos[p] = (Math.random() - 0.5) * 24;
      particlePos[p + 1] = (Math.random() - 0.5) * 14;
      particlePos[p + 2] = (Math.random() - 0.5) * 18;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.045,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // 9. 创建 11 张虚拟化卡片 Mesh (1024×1280 高清分辨率)
    const cardGeo = new THREE.PlaneGeometry(1.95, 2.45);
    const slots: CardSlot[] = [];

    for (let i = 0; i < SHELF_MAX_RENDER; i++) {
      const cardCanvas = document.createElement("canvas");
      cardCanvas.width = 1024;
      cardCanvas.height = 1280;
      const ctx = cardCanvas.getContext("2d")!;

      const texture = new THREE.CanvasTexture(cardCanvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const cardMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.14,
        metalness: 0.20,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(cardGeo, cardMat);
      mesh.userData = { slotIndex: i };
      cardsGroup.add(mesh);

      slots.push({
        mesh,
        canvas: cardCanvas,
        ctx,
        texture,
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

      // 滚动位置平滑弹簧衰减
      currentScrollRef.current += (targetScrollRef.current - currentScrollRef.current) * 0.12;
      const scrollPos = currentScrollRef.current;
      const centerVirtualIndex = Math.round(scrollPos);

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
          setActiveIndex(normIdx);
          activeIndexRef.current = normIdx;
        }
      }

      // 鼠标视差平滑
      const mp = mouseParallaxRef.current;
      mp.x += (mp.targetX - mp.x) * 0.05;
      mp.y += (mp.targetY - mp.y) * 0.05;

      if (cameraRef.current) {
        cameraRef.current.position.x = mp.x * 0.65;
        cameraRef.current.position.y = 0.35 + mp.y * 0.4;
        cameraRef.current.lookAt(0, 0, 0);
      }

      // 空间星尘粒子自转与浮动
      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.0006;
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
            (((centerVirtualIndex + slotRelOffset) % totalItems) + totalItems) %
            totalItems;
          const item = currentItems[itemIndex];

          // 更新节奏与悬浮呼吸相位
          slot.rhythmPhase += dt * 4.5;
          slot.floatPhase += dt * 1.8;

          // 重新烘焙 Canvas
          const isSlotActive = absOffset < 0.5;
          renderCardCanvas(slot, item, isSlotActive, isAudioPlaying, itemIndex);

          // 呼吸浮动位移微动效 (Breathing Float Amplitude)
          const floatY = Math.sin(slot.floatPhase) * (isSlotActive ? 0.045 : 0.02);
          const floatZ = Math.cos(slot.floatPhase * 0.8) * (isSlotActive ? 0.03 : 0.01);
          const tiltRoll = Math.sin(slot.floatPhase * 0.6) * 0.015;

          // === 1. 舞台展开模式 (Stage Shelf) 姿态参数 ===
          const sign = Math.sign(fractionalOffset);
          const stagePx =
            absOffset < 0.01 ? 0 : sign * (1.75 + (absOffset - 1) * 1.38);
          const stagePy = -absOffset * 0.06 + floatY;
          const stagePz =
            (absOffset < 0.5 ? 0.95 - absOffset * 0.6 : -0.28 - absOffset * 0.88) + floatZ;
          const stageRotY =
            absOffset < 0.01 ? 0 : -sign * (0.64 + Math.min(0.3, absOffset * 0.06));
          const stageRotX = mp.y * 0.12 + tiltRoll;
          const stageRotZ = -mp.x * 0.04;
          const stageScale =
            absOffset < 0.5
              ? 1.24 - absOffset * 0.35
              : Math.max(0.66, 0.95 - absOffset * 0.065);

          // === 2. 侧栏弧形透视模式 (Side Shelf) 姿态参数 ===
          const sideRotY = -0.68 + fractionalOffset * 0.06;
          const sideRotX = 0.14 - fractionalOffset * 0.02 + mp.y * 0.1 + tiltRoll;
          const sideRotZ = -0.04;
          const sidePx = -1.15 + fractionalOffset * 0.94;
          const sidePy = -fractionalOffset * 0.44 + floatY;
          const sidePz =
            (absOffset < 0.5 ? 0.75 - absOffset * 0.4 : -absOffset * 0.96) + floatZ;
          const sideScale =
            absOffset < 0.5
              ? 1.20 - absOffset * 0.28
              : Math.max(0.64, 0.92 - absOffset * 0.06);

          // === 3. 混合插值 ===
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

          // 远端淡出与透明度衰减
          const opacity = Math.max(0, Math.min(1, 1.0 - (absOffset - 2.8) * 0.4));
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
      renderer.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      cardGeo.dispose();
      slots.forEach((s) => {
        s.texture.dispose();
        (s.mesh.material as THREE.Material).dispose();
      });
    };
  }, [isAudioPlaying, renderCardCanvas]);

  // 相对刻度滚动 (带音效)
  const scrollToRelative = useCallback((delta: number) => {
    targetScrollRef.current += delta;
  }, []);

  // 鼠标滚轮接管
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if ((e.target as HTMLElement).closest(".shelf-hud-interactive, .custom-scrollbar")) {
        return;
      }
      e.preventDefault();
      const delta = Math.sign(e.deltaY || e.deltaX) * 0.85;
      targetScrollRef.current += delta;
    },
    []
  );

  // 播放当前选中的卡片 (歌单模式下整单播放，单曲模式下单曲播放)
  const handlePlayCurrent = useCallback(() => {
    const cur = activeShelfItems[activeIndex];
    if (!cur) return;
    playCardSelectTick();

    if (cur.type === "playlist") {
      if (cur.songs && cur.songs.length > 0) {
        setQueue(cur.songs);
        playSong(cur.songs[0]);
      }
    } else if (cur.song) {
      if (currentPlayingSong?.id === cur.song.id) {
        if (togglePlay) togglePlay();
      } else {
        playSong(cur.song);
        setQueue(activeShelfItems.map((item) => item.song || item.songs[0]).filter(Boolean));
      }
    }
  }, [activeShelfItems, activeIndex, currentPlayingSong, playSong, togglePlay, setQueue]);

  // 打开曲目二级详情瀑布流面板
  const handleOpenDetail = useCallback(() => {
    playCardSelectTick();
    const cur = activeShelfItems[activeIndex];
    if (cur) {
      setSelectedShelfItem(cur);
      setShowDetailPanel(true);
      setTrackSearchQuery("");
    }
  }, [activeShelfItems, activeIndex]);

  // 鼠标手势拖拽与 3D 卡片直接点击 (Raycaster Direct Hit)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".shelf-hud-interactive, button, input")) {
      return;
    }
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    prevMouseXRef.current = e.clientX;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMoveParallax = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const deltaX = e.clientX - prevMouseXRef.current;
      if (Math.abs(e.clientX - mouseDownPosRef.current.x) > 4) {
        hasDraggedRef.current = true;
      }
      prevMouseXRef.current = e.clientX;
      targetScrollRef.current -= deltaX * 0.012;
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
        targetScrollRef.current = Math.round(targetScrollRef.current);
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
      playSong(shuffled[0]);
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
  const filteredDetailSongs = selectedShelfItem?.songs?.filter((song) => {
    if (!trackSearchQuery.trim()) return true;
    const q = trackSearchQuery.toLowerCase();
    return song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q);
  }) || [];

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 w-full h-full min-h-[520px] bg-[#050507] overflow-hidden select-none flex flex-col justify-between p-6 ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveParallax}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto cursor-grab active:cursor-grabbing"
      />

      {/* ── 顶部控制栏 (Apple Monochrome Liquid Glass Top HUD) ── */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-7xl mx-auto px-5 py-2.5 bg-white/[0.06] border border-white/[0.18] rounded-3xl backdrop-blur-[56px] backdrop-saturate-[180%] shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_1.5px_rgba(255,255,255,0.3)] shelf-hud-interactive">
        {/* 左侧标题与模式 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
              <Disc3 className="w-4.5 h-4.5 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5 text-white">
                Mineradio 3D 空间唱片架
                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/15 text-white/90 border border-white/20 font-semibold">
                  v0.2 SPATIAL
                </span>
              </h2>
              <p className="text-[11px] text-white/45">
                透明液态玻璃 · 歌单/单曲双模 · PSP 机械齿轮触感
              </p>
            </div>
          </div>

          {/* 模式切换按钮 */}
          <button
            type="button"
            onClick={toggleDisplayMode}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]"
            title="按 M 键快速切换展示模式"
          >
            <Layers className="w-3.5 h-3.5 text-white/90" />
            <span>
              {displayMode === "stage"
                ? "舞台水平展开 (Stage)"
                : "侧栏弧形透视 (Side Shelf)"}
            </span>
          </button>
        </div>

        {/* 中间主分类与歌单切换器 (Playlists vs Tracks vs Favorites vs Recent) */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("playlists");
              targetScrollRef.current = 0;
            }}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl transition-all ${
              browseType === "playlists"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <FolderHeart className="w-3.5 h-3.5" />
            <span>全部歌单</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("tracks");
              targetScrollRef.current = 0;
            }}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl transition-all ${
              browseType === "tracks"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>全部单曲</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("favorites");
              targetScrollRef.current = 0;
            }}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl transition-all ${
              browseType === "favorites"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>我的收藏</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("recent");
              targetScrollRef.current = 0;
            }}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl transition-all ${
              browseType === "recent"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>最近播放</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setBrowseType("daily");
              targetScrollRef.current = 0;
            }}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl transition-all ${
              browseType === "daily"
                ? "bg-white/25 text-white font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.45)] border border-white/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>每日推荐</span>
          </button>
        </div>

        {/* 右侧搜索与退出 */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5" />
            <input
              type="text"
              placeholder="搜索歌单或曲目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 focus:w-56 transition-all bg-white/10 border border-white/15 rounded-2xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
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
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl border border-white/20 backdrop-blur-md transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
          >
            <X className="w-3.5 h-3.5" />
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
                <p className="text-xs text-white/50 mt-1">
                  {selectedShelfItem.subtitle}
                </p>
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
                onClick={() => {
                  if (selectedShelfItem.songs && selectedShelfItem.songs.length > 0) {
                    setQueue(selectedShelfItem.songs);
                    playSong(selectedShelfItem.songs[0]);
                  }
                }}
                className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold text-xs px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.35)] transition-all active:scale-95"
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
                      playSong(song);
                      if (selectedShelfItem.songs) {
                        setQueue(selectedShelfItem.songs);
                      }
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
                        <p className="text-xs font-semibold leading-tight truncate">
                          {song.title}
                        </p>
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
              <div className="py-12 text-center text-white/40 text-xs">
                暂未找到匹配曲目
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 底部当前卡片控制器 (Apple Liquid Glass Floating HUD) ── */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-4xl mx-auto px-6 py-3 bg-white/[0.07] border border-white/[0.20] rounded-full backdrop-blur-[56px] backdrop-saturate-[180%] shadow-[0_24px_60px_rgba(0,0,0,0.9),inset_0_1.5px_2px_rgba(255,255,255,0.35)] shelf-hud-interactive">
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
        <div className="flex items-center gap-5">
          {/* 微缩封面与状态 */}
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/10 border border-white/20 shadow-md flex-shrink-0">
            <img
              src={currentActiveItem?.cover || "/default-cover.svg"}
              alt={currentActiveItem?.title || "Cover"}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="text-left min-w-[200px] max-w-[280px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/60">
                {displayMode === "stage" ? "STAGE FOCUS" : "SIDE FOCUS"}
              </span>
              <span className="text-[10px] text-white/35">·</span>
              <span className="text-[10px] text-white/50 truncate">
                {currentActiveItem?.tag}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white leading-tight truncate">
              {currentActiveItem?.title || "未知项目"}
            </h4>
            <p className="text-[11px] text-white/45 truncate">
              {currentActiveItem?.subtitle || "Mineradio Spatial Audio"}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePlayCurrent}
            className="flex items-center gap-2 bg-white text-black hover:bg-white/90 font-bold text-xs px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(255,255,255,0.35)] transition-all active:scale-95"
          >
            {currentActiveItem?.type === "song" &&
            currentPlayingSong?.id === currentActiveItem.song?.id &&
            isAudioPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-black" />
                <span>暂停播放</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>{currentActiveItem?.type === "playlist" ? "播放歌单" : "立即播放"}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenDetail}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
          >
            <ListMusic className="w-4 h-4 text-white/80" />
            <span>曲目列表</span>
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
