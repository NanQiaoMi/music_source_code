/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { usePlaylistStore, Song } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaylistGroupStore } from "@/store/playlistGroupStore";
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
} from "lucide-react";

export type ShelfDisplayMode = "side" | "stage"; // 侧栏弧形透视 (Side Shelf) | 舞台水平展开 (Stage Shelf)

interface Shelf3DViewProps {
  isOpen?: boolean;
  className?: string;
  onClose?: () => void;
}

// 虚拟化渲染卡片窗口大小
const SHELF_MAX_RENDER = 11;
const HALF_WINDOW = Math.floor(SHELF_MAX_RENDER / 2); // 5

// 封面图片内存缓存，避免重复渲染 Canvas 时重新加载图片
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
    coverImageCache.set(url, img); // 缓存失败对象避免无限重试
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
  const currentPlayingSong = useAudioStore((state) => state.currentSong);
  const isAudioPlaying = useAudioStore((state) => state.isPlaying);
  const playSong = useAudioStore((state) => state.playSong);
  const togglePlay = useAudioStore((state) => (state as any).togglePlay || (state as any).toggle);
  const setQueue = useQueueStore((state) => state.setQueue);
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const playlistGroups = usePlaylistGroupStore((state) => state.groups);
  const closePanel = useUIStore((state) => state.closePanel);

  // Local state
  const [displayMode, setDisplayMode] = useState<ShelfDisplayMode>("stage");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDetailPanel, setShowDetailPanel] = useState<boolean>(false);
  const [detailSong, setDetailSong] = useState<Song | null>(null);

  // Filtered song list
  const activeSongs = useMemo<Song[]>(() => {
    let list: Song[] = [];
    if (selectedCategory === "all") {
      list = rawSongs;
    } else if (selectedCategory === "recent") {
      list = (usePlaylistStore.getState().recentPlayed as Song[]) || rawSongs;
    } else {
      const group = playlistGroups.find((g) => g.id === selectedCategory);
      if (group && group.songs && group.songs.length > 0) {
        list = group.songs as unknown as Song[];
      } else {
        list = rawSongs;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
      );
    }

    if (list.length === 0) {
      return [
        {
          id: "demo-1",
          title: "后来你好吗",
          artist: "A-Lin",
          album: "原声大碟",
          cover: "/default-cover.svg",
          audioUrl: "",
          duration: 245,
          source: "local",
        },
        {
          id: "demo-2",
          title: "星河游戈 (Star River)",
          artist: "Vibe Master",
          album: "Cyber Sound",
          cover: "/default-cover.svg",
          audioUrl: "",
          duration: 198,
          source: "local",
        },
        {
          id: "demo-3",
          title: "Midnight Pulse",
          artist: "Synthwave Echo",
          album: "Dark Horizon",
          cover: "/default-cover.svg",
          audioUrl: "",
          duration: 220,
          source: "local",
        },
        {
          id: "demo-4",
          title: "Neon City Lights",
          artist: "Electric Dream",
          album: "Vapor Trails",
          cover: "/default-cover.svg",
          audioUrl: "",
          duration: 210,
          source: "local",
        },
        {
          id: "demo-5",
          title: "Deep Resonance",
          artist: "Sub Bass Lab",
          album: "Frequency Matrix",
          cover: "/default-cover.svg",
          audioUrl: "",
          duration: 260,
          source: "local",
        },
        {
          id: "demo-6",
          title: "Cosmic Odyssey",
          artist: "Astral Voyager",
          album: "Starlight Echoes",
          cover: "/default-cover.svg",
          audioUrl: "",
          duration: 312,
          source: "local",
        },
      ];
    }
    return list;
  }, [rawSongs, selectedCategory, playlistGroups, searchQuery]);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const activeIndexRef = useRef<number>(0);
  const songsListRef = useRef<Song[]>(activeSongs);
  songsListRef.current = activeSongs;

  // Interaction & Physics refs
  const isDraggingRef = useRef(false);
  const prevMouseXRef = useRef(0);
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const lastDetentStepRef = useRef(0);
  const modeBlendRef = useRef(displayMode === "side" ? 1.0 : 0.0);
  const targetModeBlendRef = useRef(displayMode === "side" ? 1.0 : 0.0);

  // Mouse Parallax
  const mouseParallaxRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cardsGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Virtualized Card Meshes & Canvases
  interface CardSlot {
    mesh: THREE.Mesh;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
    currentSongId: string | null;
    isActive: boolean;
    rhythmPhase: number;
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

  // 烘焙单个卡片 CanvasTexture 纹理
  const renderCardCanvas = useCallback(
    (slot: CardSlot, song: Song, isActive: boolean, isPlaying: boolean, indexLabel: number) => {
      const { ctx, canvas, texture } = slot;
      const w = canvas.width; // 512
      const h = canvas.height; // 640

      ctx.clearRect(0, 0, w, h);

      // 1. 卡片主体背景 - 极深玻璃拟态渐变
      drawRoundedRect(ctx, 16, 16, w - 32, h - 32, 28);
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      if (isActive) {
        bgGrad.addColorStop(0, "rgba(28, 14, 48, 0.95)");
        bgGrad.addColorStop(0.5, "rgba(12, 6, 26, 0.98)");
        bgGrad.addColorStop(1, "rgba(4, 2, 10, 0.99)");
      } else {
        bgGrad.addColorStop(0, "rgba(18, 10, 32, 0.85)");
        bgGrad.addColorStop(0.6, "rgba(8, 4, 16, 0.90)");
        bgGrad.addColorStop(1, "rgba(2, 1, 6, 0.95)");
      }
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // 2. 边框与发光描边
      ctx.save();
      drawRoundedRect(ctx, 16, 16, w - 32, h - 32, 28);
      if (isActive) {
        ctx.strokeStyle = "#00f5ff";
        ctx.lineWidth = 4.5;
        ctx.shadowColor = "rgba(0, 245, 255, 0.8)";
        ctx.shadowBlur = 22;
        ctx.stroke();

        // 内部叠加微紫光
        ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(168, 85, 247, 0.6)";
        ctx.shadowBlur = 12;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "transparent";
        ctx.stroke();
      }
      ctx.restore();

      // 3. 顶部序号胶囊徽标
      ctx.fillStyle = isActive ? "rgba(0, 245, 255, 0.18)" : "rgba(255, 255, 255, 0.08)";
      drawRoundedRect(ctx, 40, 38, 86, 32, 16);
      ctx.fill();
      ctx.fillStyle = isActive ? "#00f5ff" : "rgba(255, 255, 255, 0.5)";
      ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `#${String(indexLabel + 1).padStart(2, "0")}`,
        83,
        54
      );

      // 4. 音质/模式角标 (Hi-Res / DSD / Spatial)
      ctx.fillStyle = isActive ? "rgba(168, 85, 247, 0.25)" : "rgba(255, 255, 255, 0.06)";
      drawRoundedRect(ctx, w - 146, 38, 106, 32, 16);
      ctx.fill();
      ctx.fillStyle = isActive ? "#d8b4fe" : "rgba(255, 255, 255, 0.45)";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText("LOSSLESS", w - 93, 54);

      // 5. 封面绘制 (支持图片或黑胶唱片质感占位)
      const coverSize = 310;
      const coverX = (w - coverSize) / 2;
      const coverY = 92;

      ctx.save();
      drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 22);
      ctx.clip();

      const img = getOrLoadCoverImage(song.cover, () => {
        // 图片加载完毕后触发重绘
        renderCardCanvas(slot, song, isActive, isPlaying, indexLabel);
      });

      if (img) {
        ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
      } else {
        // 黑胶唱片复古质感备用底图
        const vinylGrad = ctx.createRadialGradient(
          w / 2,
          coverY + coverSize / 2,
          10,
          w / 2,
          coverY + coverSize / 2,
          coverSize / 2
        );
        vinylGrad.addColorStop(0, "#2c1e4a");
        vinylGrad.addColorStop(0.3, "#160f28");
        vinylGrad.addColorStop(0.7, "#0c0818");
        vinylGrad.addColorStop(1, "#05030a");
        ctx.fillStyle = vinylGrad;
        ctx.fillRect(coverX, coverY, coverSize, coverSize);

        // 黑胶同心环纹理
        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = 1.5;
        for (let r = 30; r < coverSize / 2; r += 14) {
          ctx.beginPath();
          ctx.arc(w / 2, coverY + coverSize / 2, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 中心圆标
        ctx.fillStyle = isActive ? "#00f5ff" : "#a855f7";
        ctx.beginPath();
        ctx.arc(w / 2, coverY + coverSize / 2, 28, 0, Math.PI * 2);
        ctx.fill();
      }

      // 封面内阴影高光
      const coverInnerGrad = ctx.createLinearGradient(coverX, coverY, coverX, coverY + coverSize);
      coverInnerGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      coverInnerGrad.addColorStop(0.6, "transparent");
      coverInnerGrad.addColorStop(1, "rgba(0, 0, 0, 0.65)");
      ctx.fillStyle = coverInnerGrad;
      ctx.fillRect(coverX, coverY, coverSize, coverSize);
      ctx.restore();

      // 6. 律动音频跳动频谱柱 (若当前卡片处于播放态)
      if (isActive) {
        const barCount = 7;
        const barWidth = 5;
        const barGap = 4;
        const totalBarW = barCount * barWidth + (barCount - 1) * barGap;
        const startX = (w - totalBarW) / 2;
        const barBaseY = coverY + coverSize - 18;

        for (let b = 0; b < barCount; b++) {
          const speed = isPlaying ? 1.0 : 0.2;
          const hVal = Math.sin(slot.rhythmPhase * speed + b * 0.9) * 12 + 14;
          ctx.fillStyle = isPlaying ? "#00f5ff" : "rgba(255, 255, 255, 0.4)";
          drawRoundedRect(
            ctx,
            startX + b * (barWidth + barGap),
            barBaseY - hVal,
            barWidth,
            hVal,
            2.5
          );
          ctx.fill();
        }
      }

      // 7. 歌曲标题 (加粗大字)
      ctx.fillStyle = isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.85)";
      ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      const titleText =
        song.title.length > 14 ? song.title.slice(0, 13) + "…" : song.title;
      ctx.fillText(titleText, w / 2, 455);

      // 8. 艺术家与专辑信息
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.45)";
      ctx.font = "500 21px -apple-system, sans-serif";
      const artistText =
        song.artist.length > 20 ? song.artist.slice(0, 19) + "…" : song.artist;
      ctx.fillText(artistText, w / 2, 492);

      // 9. 底部快捷播放/详情提示按键
      ctx.save();
      const btnY = 560;
      const btnW = 220;
      const btnH = 48;
      const btnX = (w - btnW) / 2;

      drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 24);
      if (isActive) {
        const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
        btnGrad.addColorStop(0, "#06b6d4");
        btnGrad.addColorStop(1, "#9333ea");
        ctx.fillStyle = btnGrad;
        ctx.shadowColor = "rgba(6, 182, 212, 0.5)";
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      }
      ctx.fill();

      // 播放文字与图标
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        isActive && isPlaying ? "PAUSE / 暂停" : "PLAY / 播放",
        w / 2,
        btnY + btnH / 2
      );
      ctx.restore();

      slot.currentSongId = song.id;
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
    scene.fog = new THREE.FogExp2(0x06020f, 0.065);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0.3, 6.4);
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

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00f5ff, 3.2, 22);
    pointLight.position.set(0, 2.5, 4.5);
    scene.add(pointLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 2.6, 20);
    purpleLight.position.set(-3.5, -0.5, 3.0);
    scene.add(purpleLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.2);
    rimLight.position.set(5, 5, -2);
    scene.add(rimLight);

    // 5. Cards Group
    const cardsGroup = new THREE.Group();
    cardsGroupRef.current = cardsGroup;
    scene.add(cardsGroup);

    // 6. 反光镜面地面
    const floorGeo = new THREE.PlaneGeometry(36, 36, 16, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05020c,
      roughness: 0.15,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.85;
    scene.add(floor);

    // 7. 空间粒子星尘
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePos[p] = (Math.random() - 0.5) * 20;
      particlePos[p + 1] = (Math.random() - 0.5) * 12;
      particlePos[p + 2] = (Math.random() - 0.5) * 16;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f5ff,
      size: 0.05,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // 8. 创建 11 张虚拟化卡片 Mesh (SHELF_MAX_RENDER = 11)
    const cardGeo = new THREE.PlaneGeometry(1.85, 2.35);
    const slots: CardSlot[] = [];

    for (let i = 0; i < SHELF_MAX_RENDER; i++) {
      const cardCanvas = document.createElement("canvas");
      cardCanvas.width = 512;
      cardCanvas.height = 640;
      const ctx = cardCanvas.getContext("2d")!;

      const texture = new THREE.CanvasTexture(cardCanvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const cardMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.18,
        metalness: 0.25,
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
        currentSongId: null,
        isActive: false,
        rhythmPhase: Math.random() * 10,
      });
    }
    cardSlotsRef.current = slots;

    // 9. 渲染动画循环
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

      // 检测是否跨越刻度并发出机械音效
      if (centerVirtualIndex !== lastDetentStepRef.current) {
        const vel = Math.abs(targetScrollRef.current - currentScrollRef.current);
        playMechanicalGearTick(centerVirtualIndex, 1.0 + Math.min(vel, 1.5));
        lastDetentStepRef.current = centerVirtualIndex;

        const currentSongs = songsListRef.current;
        if (currentSongs.length > 0) {
          const normIdx =
            ((centerVirtualIndex % currentSongs.length) + currentSongs.length) %
            currentSongs.length;
          setActiveIndex(normIdx);
          activeIndexRef.current = normIdx;
        }
      }

      // 鼠标视差平滑
      const mp = mouseParallaxRef.current;
      mp.x += (mp.targetX - mp.x) * 0.05;
      mp.y += (mp.targetY - mp.y) * 0.05;

      if (cameraRef.current) {
        cameraRef.current.position.x = mp.x * 0.6;
        cameraRef.current.position.y = 0.3 + mp.y * 0.35;
        cameraRef.current.lookAt(0, 0, 0);
      }

      // 粒子自转
      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.0008;
      }

      // 虚拟化卡片位置与姿态计算
      const currentSongs = songsListRef.current;
      const totalSongs = currentSongs.length;

      if (totalSongs > 0) {
        for (let k = 0; k < SHELF_MAX_RENDER; k++) {
          const slot = cardSlotsRef.current[k];
          if (!slot) continue;

          // 该槽位对应的相对偏移量 (-5 .. +5 连续浮点)
          const slotRelOffset = k - HALF_WINDOW;
          const fractionalOffset = slotRelOffset - (scrollPos - centerVirtualIndex);
          const absOffset = Math.abs(fractionalOffset);

          // 对应的真实歌曲索引
          const songIndex =
            (((centerVirtualIndex + slotRelOffset) % totalSongs) + totalSongs) %
            totalSongs;
          const song = currentSongs[songIndex];

          // 更新节奏相位
          slot.rhythmPhase += dt * 4.5;

          // 重新烘焙 Canvas
          const isSlotActive = absOffset < 0.5;
          renderCardCanvas(slot, song, isSlotActive, isAudioPlaying, songIndex);

          // === 1. 舞台展开模式 (Stage Shelf) 姿态参数 ===
          const sign = Math.sign(fractionalOffset);
          const stagePx =
            absOffset < 0.01
              ? 0
              : sign * (1.65 + (absOffset - 1) * 1.32);
          const stagePy = -absOffset * 0.06;
          const stagePz =
            absOffset < 0.5
              ? 0.9 - absOffset * 0.6
              : -0.25 - absOffset * 0.85;
          const stageRotY =
            absOffset < 0.01
              ? 0
              : -sign * (0.62 + Math.min(0.3, absOffset * 0.06));
          const stageRotX = 0;
          const stageRotZ = 0;
          const stageScale =
            absOffset < 0.5
              ? 1.22 - absOffset * 0.35
              : Math.max(0.68, 0.95 - absOffset * 0.065);

          // === 2. 侧栏弧形透视模式 (Side Shelf) 姿态参数 ===
          const sideRotY = -0.65 + fractionalOffset * 0.06;
          const sideRotX = 0.12 - fractionalOffset * 0.02;
          const sideRotZ = -0.04;
          const sidePx = -1.1 + fractionalOffset * 0.92;
          const sidePy = -fractionalOffset * 0.42;
          const sidePz =
            absOffset < 0.5
              ? 0.7 - absOffset * 0.4
              : -absOffset * 0.95;
          const sideScale =
            absOffset < 0.5
              ? 1.18 - absOffset * 0.28
              : Math.max(0.65, 0.92 - absOffset * 0.06);

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
      cardGeo.dispose();
      slots.forEach((s) => {
        s.texture.dispose();
        (s.mesh.material as THREE.Material).dispose();
      });
    };
  }, [isAudioPlaying, renderCardCanvas]);

  // 鼠标移动视差响应
  const handleMouseMoveParallax = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseParallaxRef.current.targetX = nx * 2;
    mouseParallaxRef.current.targetY = -ny * 2;

    if (isDraggingRef.current) {
      const deltaX = e.clientX - prevMouseXRef.current;
      prevMouseXRef.current = e.clientX;
      targetScrollRef.current -= deltaX * 0.006;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 若点击在控制浮层上则不响应 3D 拖拽
    if ((e.target as HTMLElement).closest(".shelf-hud-interactive")) return;
    isDraggingRef.current = true;
    prevMouseXRef.current = e.clientX;
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    // 吸附到最近的整数卡片索引
    targetScrollRef.current = Math.round(targetScrollRef.current);
  };

  // 滚轮切换卡片
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    targetScrollRef.current += dir;
    targetScrollRef.current = Math.round(targetScrollRef.current);
  };

  // 旋转到指定卡片
  const scrollToRelative = useCallback((delta: number) => {
    targetScrollRef.current = Math.round(targetScrollRef.current) + delta;
  }, []);

  // 播放当前中心选中的卡片
  const handlePlayCurrent = useCallback(() => {
    playCardSelectTick();
    const cur = activeSongs[activeIndex];
    if (!cur) return;

    if (currentPlayingSong?.id === cur.id) {
      if (togglePlay) togglePlay();
    } else {
      playSong(cur);
      // 同时把当前列表写入播放队列
      setQueue(activeSongs);
    }
  }, [activeSongs, activeIndex, currentPlayingSong, playSong, togglePlay, setQueue]);

  // 查看曲目二级详情面板
  const handleOpenDetail = useCallback(() => {
    playCardSelectTick();
    const cur = activeSongs[activeIndex];
    if (cur) {
      setDetailSong(cur);
      setShowDetailPanel(true);
    }
  }, [activeSongs, activeIndex]);

  // 整单入队
  const handleEnqueueAll = useCallback(() => {
    playCardSelectTick();
    activeSongs.forEach((s) => addToQueue(s));
  }, [activeSongs, addToQueue]);

  // 随机播放
  const handleShufflePlay = useCallback(() => {
    playCardSelectTick();
    const shuffled = [...activeSongs].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) {
      setQueue(shuffled);
      playSong(shuffled[0]);
    }
  }, [activeSongs, playSong, setQueue]);

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

  const currentActiveSong = activeSongs[activeIndex];

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 w-full h-full min-h-[520px] bg-[#05020c] overflow-hidden select-none flex flex-col justify-between p-6 ${className}`}
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

      {/* ── 顶部控制栏 (Top Glass HUD) ── */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-7xl mx-auto px-4 py-2 bg-white/[0.04] border border-white/10 rounded-2xl backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] shelf-hud-interactive">
        {/* 左侧标题与模式 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.6)]">
              <Disc3 className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                Mineradio 3D 空间唱片架
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  v0.2 Spatial
                </span>
              </h2>
              <p className="text-[11px] text-white/50">
                双模式空间透视 · 虚拟滑动窗口 · PSP 机械齿轮触感
              </p>
            </div>
          </div>

          {/* 模式切换按钮 */}
          <button
            type="button"
            onClick={toggleDisplayMode}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 hover:text-white transition-all active:scale-95"
            title="按 M 键快速切换展示模式"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {displayMode === "stage"
                ? "舞台水平展开 (Stage)"
                : "侧栏弧形透视 (Side Shelf)"}
            </span>
          </button>
        </div>

        {/* 中间分类选择器 */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setSelectedCategory("all");
            }}
            className={`text-xs px-3 py-1 rounded-lg transition-all ${
              selectedCategory === "all"
                ? "bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            全部曲目
          </button>
          <button
            type="button"
            onClick={() => {
              playTactileTick({ type: "snap" });
              setSelectedCategory("recent");
            }}
            className={`text-xs px-3 py-1 rounded-lg transition-all ${
              selectedCategory === "recent"
                ? "bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            最近播放
          </button>
          {playlistGroups.slice(0, 3).map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                playTactileTick({ type: "snap" });
                setSelectedCategory(group.id);
              }}
              className={`text-xs px-3 py-1 rounded-lg transition-all ${
                selectedCategory === group.id
                  ? "bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>

        {/* 右侧搜索与退出 */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5" />
            <input
              type="text"
              placeholder="搜索唱片..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 focus:w-48 transition-all bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
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
            className="flex items-center gap-1 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-xl border border-white/15 backdrop-blur-md transition-all active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
            <span>退出</span>
          </button>
        </div>
      </div>

      {/* ── 3D 二级曲目详情面板 (Floating Track Detail Billboard) ── */}
      {showDetailPanel && detailSong && (
        <div className="relative z-30 max-w-2xl w-full mx-auto my-auto bg-black/85 border border-white/20 rounded-3xl p-6 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-200 shelf-hud-interactive">
          {/* 面板头部 */}
          <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-purple-900/40 border border-white/20 shadow-lg">
                <img
                  src={detailSong.cover || "/default-cover.svg"}
                  alt={detailSong.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {detailSong.title}
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  {detailSong.artist} · {detailSong.album || "Spatial Audio"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    24-Bit / 96kHz DSD
                  </span>
                  <span className="text-[10px] text-white/40">
                    共 {activeSongs.length} 首曲目
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playTactileTick({ type: "snap" });
                setShowDetailPanel(false);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 快捷操作条 */}
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => {
                playSong(detailSong);
                setQueue(activeSongs);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>播放整单</span>
            </button>

            <button
              type="button"
              onClick={handleEnqueueAll}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white/90 font-medium text-xs px-3.5 py-2 rounded-xl border border-white/15 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>整单入队</span>
            </button>

            <button
              type="button"
              onClick={handleShufflePlay}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white/90 font-medium text-xs px-3.5 py-2 rounded-xl border border-white/15 transition-all active:scale-95"
            >
              <Shuffle className="w-3.5 h-3.5 text-purple-400" />
              <span>随机播放</span>
            </button>
          </div>

          {/* 曲目瀑布流列表 */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
            {activeSongs.map((song, idx) => {
              const isCurrent = currentPlayingSong?.id === song.id;
              return (
                <div
                  key={song.id || idx}
                  onClick={() => {
                    playCardSelectTick();
                    playSong(song);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                      : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] text-white/80 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono opacity-50 w-5 text-right">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{song.title}</p>
                      <p className="text-[11px] opacity-60">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isCurrent && isAudioPlaying ? (
                      <span className="text-[10px] text-cyan-400 animate-pulse font-medium">
                        PLAYING
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-cyan-500 hover:text-black transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 底部当前卡片控制器 (Bottom Player HUD) ── */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-4xl mx-auto px-8 py-3.5 bg-black/60 border border-white/15 rounded-3xl backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] shelf-hud-interactive">
        {/* 左侧上一首按钮 */}
        <button
          type="button"
          onClick={() => scrollToRelative(-1)}
          className="p-3 rounded-full bg-white/10 hover:bg-cyan-500/20 text-white/80 hover:text-cyan-400 border border-white/10 transition-all active:scale-90"
          title="上一张 (Left / Up)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* 中间信息与播放控制 */}
        <div className="flex items-center gap-6">
          <div className="text-center min-w-[240px]">
            <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
              {displayMode === "stage" ? "STAGE CENTER" : "SIDE SHELF FOCUS"}
            </span>
            <h4 className="text-base font-bold text-white leading-tight mt-0.5 truncate max-w-xs">
              {currentActiveSong?.title || "未知曲目"}
            </h4>
            <p className="text-xs text-white/50 mt-0.5 truncate max-w-xs">
              {currentActiveSong?.artist || "未知艺术家"}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePlayCurrent}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs px-6 py-3 rounded-full shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all active:scale-95"
          >
            {currentPlayingSong?.id === currentActiveSong?.id && isAudioPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" />
                <span>暂停播放</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>立即播放</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenDetail}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/15 transition-all active:scale-95"
          >
            <ListMusic className="w-4 h-4 text-purple-400" />
            <span>曲目列表</span>
          </button>
        </div>

        {/* 右侧下一首按钮 */}
        <button
          type="button"
          onClick={() => scrollToRelative(1)}
          className="p-3 rounded-full bg-white/10 hover:bg-cyan-500/20 text-white/80 hover:text-cyan-400 border border-white/10 transition-all active:scale-90"
          title="下一张 (Right / Down)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Shelf3DView;
