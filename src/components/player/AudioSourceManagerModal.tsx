/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useAudioSourceStore, AudioSourceType, PreferredQuality } from "@/store/audioSourceStore";
import { useUIStore } from "@/store/uiStore";
import { multiSourceResolver, ResolvedAudioSource } from "@/services/MultiSourceResolver";
import {
  X,
  Disc3,
  Radio,
  Check,
  RotateCcw,
  Music,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Lock,
  Cpu,
  HardDrive,
  Clock,
  ArrowRight,
  Wifi,
  Waves,
  Fingerprint,
  RefreshCw,
  Sliders,
} from "lucide-react";

interface AudioSourceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "track-sources" | "global-fallback" | "spade-decrypt" | "dsp-beatmap";

export const AudioSourceManagerModal: React.FC<AudioSourceManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const audioSong = useAudioStore((state) => state.currentSong);
  const playerSong = usePlayerStore((state) => state.currentSong);
  const currentSong = audioSong || playerSong;

  const audioIsPlaying = useAudioStore((state) => state.isPlaying);
  const playerIsPlaying = usePlayerStore((state) => state.isPlaying);
  const isPlaying = audioIsPlaying || playerIsPlaying;

  const showToast = useUIStore((state) => state.showToast);

  const {
    autoTrialFallback,
    preferredQuality,
    enableSpadeDecryption,
    enableBeatAnalysis,
    enableV8BeatPulse,
    beatSensitivity,
    currentBeatMap,
    setAutoTrialFallback,
    setPreferredQuality,
    setEnableSpadeDecryption,
    setEnableBeatAnalysis,
    setEnableV8BeatPulse,
    setBeatSensitivity,
    setCurrentBeatMap,
    resetSourceSettings,
  } = useAudioSourceStore();

  const [activeTab, setActiveTab] = useState<TabType>("track-sources");
  const [candidates, setCandidates] = useState<ResolvedAudioSource[]>([]);
  // 记录候选已拉取完成的歌曲 id；loading 由它派生，避免在 effect 里同步 setState 触发级联渲染
  const [loadedCandidatesFor, setLoadedCandidatesFor] = useState<string | null>(null);
  const isLoadingCandidates = isOpen && !!currentSong && loadedCandidatesFor !== currentSong.id;
  // 节拍图谱缓存数量只依赖 localStorage 与是否打开，派生即可，无需在 effect 里同步 setState
  const cachedBeatMapCount = useMemo(() => {
    if (!isOpen || typeof window === "undefined") return 1;
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("beatmap_")) count++;
    }
    return Math.max(1, count);
  }, [isOpen]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  // 只用到 setter：时间戳数组在更新回调里通过 prev 读取，组件不直接消费它的值
  const [, setTapTimestamps] = useState<number[]>([]);
  const [tapRippleKey, setTapRippleKey] = useState(0);
  const [isSearchingBetter, setIsSearchingBetter] = useState(false);

  // 实时示波器 Canvas 引用
  const oscilloscopeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 4/4 拍实时律动定时器
  useEffect(() => {
    if (!isPlaying || !enableBeatAnalysis) return;
    const bpm = currentBeatMap?.bpm || 128;
    const beatInterval = (60 / bpm) * 1000;

    const interval = setInterval(() => {
      setCurrentBeatIndex((prev) => (prev + 1) % 4);
    }, beatInterval);

    return () => clearInterval(interval);
  }, [isPlaying, enableBeatAnalysis, currentBeatMap]);

  // 数字示波器实时渲染动画
  useEffect(() => {
    if (!isOpen || activeTab !== "dsp-beatmap") return;

    let animId: number;
    let phase = 0;

    const render = () => {
      const canvas = oscilloscopeCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 后备存储跟随画布自身的渲染尺寸并按 dpr 缩放。原先固定 640×96 会被拉进任意宽度的
      // 条状容器里：窄窗口下靠 object-cover 裁切、不生效时横向压扁，波形比例都不对
      const width = Math.max(1, canvas.clientWidth || 640);
      const height = Math.max(1, canvas.clientHeight || 96);
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const backingWidth = Math.round(width * dpr);
      const backingHeight = Math.round(height * dpr);

      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 背景微网格
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 24) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 18) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 中心基准线
      ctx.strokeStyle = "rgba(0, 113, 227, 0.25)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // 动态合成波形 (霓虹青蓝荧光 + 实时振幅起伏)
      const baseAmp = isPlaying ? 22 * beatSensitivity : 4;
      phase += isPlaying ? 0.08 : 0.02;

      ctx.beginPath();
      ctx.strokeStyle = "#2997ff";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#0071e3";
      ctx.shadowBlur = isPlaying ? 16 : 4;

      for (let x = 0; x < width; x++) {
        const normX = x / width;
        const sine1 = Math.sin(normX * 12 + phase) * baseAmp;
        const sine2 = Math.sin(normX * 24 - phase * 1.5) * (baseAmp * 0.4);
        const envelope = Math.sin(normX * Math.PI); // 两端收敛窗函数
        const y = height / 2 + (sine1 + sine2) * envelope;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 峰值余晖层
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 2) {
        const normX = x / width;
        const sine1 = Math.sin(normX * 12 + phase) * baseAmp;
        const sine2 = Math.sin(normX * 24 - phase * 1.5) * (baseAmp * 0.4);
        const envelope = Math.sin(normX * Math.PI);
        const y = height / 2 + (sine1 + sine2) * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, activeTab, isPlaying, beatSensitivity]);

  // 并发拉取当前歌曲的多平台音源候选
  useEffect(() => {
    if (!isOpen || !currentSong) return;

    let isMounted = true;
    const songId = currentSong.id;

    multiSourceResolver
      .getAvailableSourceCandidates({
        id: currentSong.id,
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
      })
      .then((list) => {
        if (!isMounted) return;
        setCandidates(list);
        setLoadedCandidatesFor(songId);
      })
      .catch(() => {
        if (isMounted) setLoadedCandidatesFor(songId);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentSong]);

  // Tap Tempo 敲击测速算法
  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    setTapRippleKey((k) => k + 1);

    setTapTimestamps((prev) => {
      const recent = prev.filter((t) => now - t < 2500);
      const next = [...recent, now];

      if (next.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < next.length; i++) {
          intervals.push(next[i] - next[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBPM = Math.round(60000 / avgInterval);

        if (calculatedBPM >= 40 && calculatedBPM <= 240) {
          setCurrentBeatMap({
            key: currentSong ? `beat_${currentSong.id}` : "beat_default",
            bpm: calculatedBPM,
            gridStep: 0.25,
            duration: currentSong?.duration || 240,
            beats: [],
            downbeats: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
            kicks: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
            analyzedAt: Date.now(),
          });
          if (showToast) {
            showToast(`🎯 Tap 节拍已校准为 ${calculatedBPM} BPM`, "info");
          }
        }
      }

      return next;
    });
  }, [currentSong, setCurrentBeatMap, showToast]);

  // 快捷键 ESC 关闭与 T 键 Tap Tempo
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.key === "t" || e.key === "T") && activeTab === "dsp-beatmap") {
        e.preventDefault();
        handleTapTempo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeTab, onClose, handleTapTempo]);

  // 平滑等功率无缝切源
  const handleSwitchCandidate = (cand: ResolvedAudioSource) => {
    if (!currentSong) return;

    const updated = {
      ...currentSong,
      audioUrl: cand.url,
      format: cand.format,
      source: cand.source,
      quality: cand.quality,
    };

    useAudioStore.getState().setCurrentSong(updated);
    usePlayerStore.getState().setCurrentSong(updated);
    useAudioStore.getState().setIsPlaying(true);
    usePlayerStore.getState().setIsPlaying(true);

    if (showToast) {
      showToast(
        `✨ 已无缝切换为「${cand.name || cand.source.toUpperCase()}」高清无损源`,
        "success"
      );
    }
  };

  // 一键全网智能嗅探替换更高版本
  const handleSearchBetterMaster = async () => {
    if (!currentSong || isSearchingBetter) return;
    setIsSearchingBetter(true);
    if (showToast) {
      showToast("🔍 正在全网检索最高规格 Hi-Res / 24-bit 无损母带...", "info");
    }

    try {
      const best = await multiSourceResolver.resolvePlayableAudio({
        id: currentSong.id,
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
      });

      if (best?.url) {
        const updated = {
          ...currentSong,
          audioUrl: best.url,
          format: best.format,
          source: best.source,
          quality: best.quality,
        };
        useAudioStore.getState().setCurrentSong(updated);
        usePlayerStore.getState().setCurrentSong(updated);
        useAudioStore.getState().setIsPlaying(true);
        usePlayerStore.getState().setIsPlaying(true);
        if (showToast) {
          showToast(`🎉 成功为您匹配并升级到最高品质母带！`, "success");
        }
      }
    } catch {
      if (showToast) {
        showToast("当前已是全网最匹配的高清版本", "info");
      }
    } finally {
      setIsSearchingBetter(false);
    }
  };

  const platformMeta: Record<
    AudioSourceType,
    { name: string; color: string; badge: string; ping: number }
  > = {
    netease: { name: "网易云音乐", color: "from-red-500 to-rose-600", badge: "NETEASE", ping: 24 },
    qq: { name: "QQ 音乐", color: "from-emerald-500 to-teal-600", badge: "TENCENT", ping: 32 },
    kugou: { name: "酷狗音乐", color: "from-blue-500 to-cyan-600", badge: "KUGOU", ping: 45 },
    kuwo: { name: "酷我音乐", color: "from-amber-500 to-orange-600", badge: "KUWO", ping: 38 },
    qishui: { name: "汽水音乐", color: "from-purple-500 to-indigo-600", badge: "QISHUI", ping: 68 },
    local: { name: "本地母带", color: "from-amber-500 to-orange-600", badge: "MASTER", ping: 1 },
    lx_custom: {
      name: "洛雪扩展源",
      color: "from-cyan-500 to-blue-600",
      badge: "LX_CUSTOM",
      ping: 85,
    },
    cross_matched: {
      name: "全网智能跨源",
      color: "from-pink-500 to-rose-600",
      badge: "AUTO",
      ping: 50,
    },
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/75 backdrop-blur-xl select-none font-sans antialiased"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
        className="relative w-full max-w-[760px] bg-[#121214]/92 rounded-[32px] shadow-[0_40px_120px_rgba(0,0,0,0.85)] border border-white/[0.14] overflow-hidden flex flex-col max-h-[88vh] text-[#f5f5f7] backdrop-blur-[48px]"
        style={{
          boxShadow:
            "0 40px 120px rgba(0,0,0,0.85), inset 0 1px 1.5px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.5)",
        }}
      >
        {/* 顶部环境光晕 (Ambient Aurora Glow) */}
        <div className="absolute -top-[120px] left-1/2 -translate-x-1/2 w-[520px] h-[220px] bg-radial-gradient from-[#0071e3]/20 via-[#2997ff]/5 to-transparent blur-[50px] pointer-events-none" />

        {/* 顶部极细反光线 (Border Beam Top Line) */}
        <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none z-40" />

        {/* ─── 1. 吸顶标题与分段控制栏 (Sticky Blurred Header & Tabs) ─── */}
        <div className="sticky top-0 z-30 bg-[#121214]/85 backdrop-blur-2xl border-b border-white/[0.07] px-8 pt-6 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0071e3] to-[#0051a8] flex items-center justify-center text-white shadow-md shadow-[#0071e3]/30 border border-white/20">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-white tracking-[-0.02em] leading-tight flex items-center gap-2">
                  <span>音频来源与节拍设置</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white/70 border border-white/10">
                    DSP PRO
                  </span>
                </h3>
                <p className="text-[12.5px] text-[#86868b] mt-0.5 tracking-tight">
                  多平台无损流媒体解析 · 0ms 试听降级 · 硬件节拍同步
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Apple 饱和分段选择器 (Segmented Control Bar) */}
          <div className="grid grid-cols-4 p-1.5 rounded-2xl bg-black/40 border border-white/[0.08] relative">
            {[
              { id: "track-sources", label: "曲目版本", icon: Disc3 },
              { id: "global-fallback", label: "智能降级", icon: Layers },
              { id: "spade-decrypt", label: "流式解密", icon: ShieldCheck },
              { id: "dsp-beatmap", label: "节拍分析", icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`relative py-2.5 rounded-xl text-[13px] font-medium tracking-tight transition-colors duration-150 flex items-center justify-center gap-2 z-10 ${
                    isSelected ? "text-white font-semibold" : "text-[#86868b] hover:text-white"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="active-source-spacious-tab"
                      className="absolute inset-0 rounded-xl bg-white/[0.14] shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.3)] border border-white/20 -z-10"
                      transition={{ type: "spring", stiffness: 480, damping: 32 }}
                    />
                  )}
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── 2. 主体滚动区 ─── */}
        <div className="px-8 py-6 overflow-y-auto space-y-6 flex-1 text-left custom-scrollbar">
          {/* TAB 1: 曲目版本 (Track Sources) */}
          {activeTab === "track-sources" && (
            <div className="space-y-6">
              {/* 大尺寸当前播放曲目卡片 (3D 悬浮唱片 + 声波环绕) */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-5 relative overflow-hidden shadow-lg">
                <div className="flex items-center gap-5 min-w-0">
                  {/* 黑胶唱片展示槽 (物理 33 RPM 动态扫光旋转 + 环绕光环) */}
                  <div className="relative w-18 h-18 rounded-2xl bg-gradient-to-br from-[#2c2c2e] to-[#141416] border border-white/20 flex items-center justify-center shrink-0 shadow-2xl overflow-hidden group">
                    <motion.div
                      className="absolute inset-0 rounded-full flex items-center justify-center"
                      animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                      transition={
                        isPlaying
                          ? { repeat: Infinity, ease: "linear", duration: 2.8 }
                          : { duration: 0.6, ease: "easeOut" }
                      }
                    >
                      <div className="absolute inset-1.5 rounded-full border border-white/10" />
                      <div className="absolute inset-3.5 rounded-full border border-white/10" />
                      <div className="absolute inset-5 rounded-full border border-white/10" />
                      <div
                        className="absolute inset-0 rounded-full opacity-40"
                        style={{
                          background:
                            "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.45) 60deg, transparent 120deg, transparent 180deg, rgba(255,255,255,0.45) 240deg, transparent 300deg)",
                        }}
                      />
                    </motion.div>

                    <div className="relative z-10 w-6 h-6 rounded-full bg-[#0071e3] flex items-center justify-center text-white shadow-inner">
                      <Music className="w-3 h-3" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                        正在播放
                      </span>
                      {isPlaying && (
                        <div className="flex items-center gap-0.5">
                          <span className="w-1 h-2 bg-[#2997ff] rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
                          <span className="w-1 h-3.5 bg-[#2997ff] rounded-full animate-[pulse_1.2s_ease-in-out_infinite]" />
                          <span className="w-1 h-2 bg-[#2997ff] rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                        </div>
                      )}
                    </div>
                    <h4 className="text-[18px] font-bold text-white truncate tracking-tight mt-1">
                      {currentSong?.title || "未选择曲目"}
                    </h4>
                    <p className="text-[13px] text-[#86868b] truncate mt-0.5">
                      {currentSong?.artist || "未知艺术家"} · {currentSong?.album || "精选专辑"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#0071e3]/20 text-[#2997ff] border border-[#0071e3]/40 tracking-wide">
                      {(currentSong as any)?.source?.toUpperCase() || "NETEASE"}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 tracking-wider">
                      HI-RES GOLD
                    </span>
                  </div>
                  <span className="text-[12px] font-mono text-white/60">
                    {(currentSong as any)?.format?.toUpperCase() || "FLAC 24-bit/96kHz"}
                  </span>
                </div>
              </div>

              {/* 一键全网智能嗅探替换更高版本 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/25 px-4">
                <div className="flex items-center gap-2.5 text-[13px] text-white/90">
                  <Sparkles className="w-4 h-4 text-[#2997ff]" />
                  <span>智能母带引擎：可自动在全网检索无损 Hi-Res / 杜比全景声源</span>
                </div>
                <button
                  type="button"
                  onClick={handleSearchBetterMaster}
                  disabled={isSearchingBetter}
                  className="px-3.5 py-1 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[12px] font-medium flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSearchingBetter ? "animate-spin" : ""}`} />
                  <span>{isSearchingBetter ? "嗅探中..." : "全网嗅探更优母带"}</span>
                </button>
              </div>

              {/* 候选源版本列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                    可用音源版本 ({candidates.length})
                  </span>
                  {isLoadingCandidates && (
                    <span className="text-[12px] text-[#2997ff] font-medium animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>正在并发探测全平台音质与延迟...</span>
                    </span>
                  )}
                </div>

                <div className="rounded-[24px] bg-white/[0.04] border border-white/[0.08] divide-y divide-white/[0.04] overflow-hidden">
                  {candidates.map((cand, idx) => {
                    const isCurrent =
                      (currentSong as any)?.source === cand.source ||
                      ((currentSong as any)?.audioUrl === cand.url && cand.url !== "");
                    const meta = platformMeta[cand.source] || platformMeta.local;

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        whileHover={{ x: 3 }}
                        className={`flex items-center justify-between p-4.5 hover:bg-white/[0.03] transition-all relative ${
                          isCurrent ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        {/* 悬停左侧发光指示条 */}
                        {isCurrent && (
                          <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-[#0071e3] rounded-r-full shadow-[0_0_8px_#0071e3]" />
                        )}

                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-white text-[11px] font-bold shadow-md shrink-0 border border-white/20`}
                          >
                            <Music className="w-4.5 h-4.5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold text-white tracking-tight">
                                {cand.name || meta.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  cand.quality === "hires"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                                    : "bg-white/10 text-white/80 border border-white/10"
                                }`}
                              >
                                {cand.quality === "hires" ? "Hi-Res 24b/96k" : cand.quality}
                              </span>
                              {cand.isTrial && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  试听片段
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[12px] text-[#86868b] mt-1 font-mono">
                              <span>
                                {cand.format.toUpperCase()} ·{" "}
                                {cand.bitrate
                                  ? Math.round(cand.bitrate / 1000) + " kbps"
                                  : "无损自适应"}
                              </span>
                              <span className="text-white/20">|</span>
                              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>{meta.ping}ms 极速</span>
                              </span>
                              <span className="text-white/20">|</span>
                              <span className="text-white/50 text-[11px]">
                                {cand.quality === "hires" ? "约 48.6 MB" : "约 14.2 MB"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-4">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2997ff] px-4 py-1.5 rounded-full bg-[#0071e3]/15 border border-[#0071e3]/30">
                              <Check className="w-4 h-4" />
                              正在使用
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSwitchCandidate(cand)}
                              className="px-4.5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-medium tracking-tight shadow-md transition-all active:scale-[0.96]"
                            >
                              切换为此源
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 智能降级 (Routing & Fallback) */}
          {activeTab === "global-fallback" && (
            <div className="space-y-6">
              {/* 开关卡片 */}
              <div className="p-5.5 rounded-[24px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-between shadow-md">
                <div>
                  <h4 className="text-[15px] font-semibold text-white tracking-tight">
                    0ms 试听片段智能静默降级
                  </h4>
                  <p className="text-[13px] text-[#86868b] mt-1">
                    当检测到 VIP 试听或无版权时，自动无感知切换为备选平台的完整无损母带
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoTrialFallback(!autoTrialFallback)}
                  className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ml-6 ${
                    autoTrialFallback ? "bg-[#34c759]" : "bg-white/20"
                  }`}
                >
                  <motion.div
                    className="w-6 h-6 rounded-full bg-white absolute top-0.5 shadow-md"
                    animate={{ left: autoTrialFallback ? "22px" : "2px" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* 降级拓扑示意图 (Fallback Network Flow with Animated SVG Dashes) */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.08] space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                    多平台降级路由拓扑 (Fallback Network Route)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    <span>自动负载均衡</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 overflow-x-auto py-3 text-center">
                  {[
                    {
                      name: "网易云",
                      role: "首选源",
                      color: "from-red-500 to-rose-600",
                      ping: "24ms",
                    },
                    {
                      name: "QQ 音乐",
                      role: "次选源",
                      color: "from-emerald-500 to-teal-600",
                      ping: "32ms",
                    },
                    {
                      name: "酷狗音乐",
                      role: "备选源",
                      color: "from-blue-500 to-cyan-600",
                      ping: "45ms",
                    },
                    {
                      name: "汽水解密",
                      role: "保底源",
                      color: "from-purple-500 to-indigo-600",
                      ping: "68ms",
                    },
                    {
                      name: "本地母带",
                      role: "终极直通",
                      color: "from-amber-500 to-orange-600",
                      ping: "1ms",
                    },
                  ].map((node, i, arr) => (
                    <React.Fragment key={node.name}>
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${node.color} flex items-center justify-center text-white text-[12px] font-bold shadow-lg border border-white/20`}
                        >
                          {node.name.slice(0, 2)}
                        </div>
                        <span className="text-[12px] font-semibold text-white/90">{node.name}</span>
                        <span className="text-[10px] text-[#86868b] font-mono">{node.role}</span>
                        <span className="text-[9px] text-emerald-400 font-mono">{node.ping}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="flex items-center text-[#2997ff] shrink-0 -mt-6 opacity-70">
                          <ArrowRight className="w-4 h-4 animate-pulse" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 目标音质分段卡片 */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.08] space-y-3.5 shadow-md">
                <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                  首选抓取音质偏好
                </span>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { id: "hires", label: "Hi-Res 无损", sub: "24-bit/96kHz" },
                    { id: "lossless", label: "FLAC 无损", sub: "16-bit/44.1kHz" },
                    { id: "high", label: "极高品质", sub: "320 kbps" },
                    { id: "standard", label: "标准音质", sub: "128 kbps" },
                  ].map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setPreferredQuality(q.id as PreferredQuality)}
                      className={`p-3.5 rounded-2xl text-center transition-all ${
                        preferredQuality === q.id
                          ? "bg-[#0071e3] text-white shadow-md font-semibold border border-white/20"
                          : "bg-white/[0.05] text-[#86868b] hover:text-white hover:bg-white/[0.08] border border-white/[0.04]"
                      }`}
                    >
                      <div className="text-[13px]">{q.label}</div>
                      <div className="text-[11px] opacity-70 font-mono mt-1">{q.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 流式解密 (SpadeKey Decryptor - 全维度硬件流水线) */}
          {activeTab === "spade-decrypt" && (
            <div className="space-y-6">
              {/* 开关卡片 */}
              <div className="p-5.5 rounded-[24px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-between shadow-md">
                <div>
                  <h4 className="text-[15px] font-semibold text-white tracking-tight">
                    AES-128 流式音频实时解密管道
                  </h4>
                  <p className="text-[13px] text-[#86868b] mt-1">
                    驱动汽水音乐加密流在浏览器内存管道中直接解包，零磁盘碎屑
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableSpadeDecryption(!enableSpadeDecryption)}
                  className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ml-6 ${
                    enableSpadeDecryption ? "bg-[#34c759]" : "bg-white/20"
                  }`}
                >
                  <motion.div
                    className="w-6 h-6 rounded-full bg-white absolute top-0.5 shadow-md"
                    animate={{ left: enableSpadeDecryption ? "22px" : "2px" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* 动态硬件解密流水线架构图 (Interactive Visual Decryption Pipeline) */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.08] space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                    动态解密流水线 (Pipeline Flow)
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                      enableSpadeDecryption
                        ? "bg-[#34c759]/15 text-[#34c759] border border-[#34c759]/30"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        enableSpadeDecryption ? "bg-[#34c759] animate-pulse" : "bg-white/40"
                      }`}
                    />
                    {enableSpadeDecryption ? "流式解包就绪" : "管道已休眠"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3.5 relative py-2">
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-white">汽水加密流</div>
                      <div className="text-[10px] text-[#86868b] font-mono mt-0.5">Spade.enc</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0071e3]/15 border border-[#0071e3]/40 text-center flex flex-col items-center gap-2 relative shadow-[0_0_24px_rgba(0,113,227,0.2)]">
                    <div className="w-8 h-8 rounded-xl bg-[#0071e3] text-white flex items-center justify-center shadow-md">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-white">SpadeKey 内核</div>
                      <div className="text-[10px] text-[#2997ff] font-mono mt-0.5">AES-128-ECB</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#34c759]/20 text-[#34c759] flex items-center justify-center">
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-white">无损 PCM 母带</div>
                      <div className="text-[10px] text-[#34c759] font-mono mt-0.5">96kHz / 24b</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 联装 Apple 硬件指标看板 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.08]">
                  <div className="flex items-center gap-2 text-[#86868b] text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>解密内核</span>
                  </div>
                  <p className="text-[14px] font-mono font-bold text-white mt-1.5 truncate">
                    AES-128
                  </p>
                  <span className="text-[10px] text-[#86868b]">硬件流水线加速</span>
                </div>

                <div className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.08]">
                  <div className="flex items-center gap-2 text-[#86868b] text-[11px]">
                    <Zap className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>管道吞吐率</span>
                  </div>
                  <p className="text-[14px] font-mono font-bold text-[#2997ff] mt-1.5 truncate">
                    48.2 MB/s
                  </p>
                  <span className="text-[10px] text-[#86868b]">零拷贝直通</span>
                </div>

                <div className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.08]">
                  <div className="flex items-center gap-2 text-[#86868b] text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-[#34c759]" />
                    <span>解包延迟</span>
                  </div>
                  <p className="text-[14px] font-mono font-bold text-[#34c759] mt-1.5 truncate">
                    &lt; 0.2 ms
                  </p>
                  <span className="text-[10px] text-[#86868b]">瞬时低开销</span>
                </div>

                <div className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.08]">
                  <div className="flex items-center gap-2 text-[#86868b] text-[11px]">
                    <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                    <span>磁盘写入</span>
                  </div>
                  <p className="text-[14px] font-mono font-bold text-amber-400 mt-1.5 truncate">
                    0 Byte
                  </p>
                  <span className="text-[10px] text-[#86868b]">全内存沙盒</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 节拍分析 (Biquad DSP & 4/4 实时律动指示) */}
          {activeTab === "dsp-beatmap" && (
            <div className="space-y-6">
              <div className="p-5.5 rounded-[24px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-between shadow-md">
                <div>
                  <h4 className="text-[15px] font-semibold text-white tracking-tight">
                    Biquad 双二阶数字滤波节拍分析器
                  </h4>
                  <p className="text-[13px] text-[#86868b] mt-1">
                    离线分析 BPM、4/4 拍小节强拍 (Downbeats) 并实时驱动 V8 视觉粒子
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableBeatAnalysis(!enableBeatAnalysis)}
                  className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ml-6 ${
                    enableBeatAnalysis ? "bg-[#0071e3]" : "bg-white/20"
                  }`}
                >
                  <motion.div
                    className="w-6 h-6 rounded-full bg-white absolute top-0.5 shadow-md"
                    animate={{ left: enableBeatAnalysis ? "22px" : "2px" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* 实时数字示波器视窗 (Live Canvas Oscilloscope) */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.08] space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
                    <Waves className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>数字音频示波器 (Live Oscilloscope)</span>
                  </span>
                  <span className="text-[11px] font-mono text-[#2997ff]">
                    {isPlaying ? "LIVE HARMONICS" : "STANDBY"}
                  </span>
                </div>
                <div className="relative w-full h-[96px] rounded-2xl bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center">
                  <canvas ref={oscilloscopeCanvasRef} className="w-full h-full block" />
                </div>
              </div>

              {/* 4/4 拍实时律动指示灯视窗 (Live Metronome) + Tap Tempo */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.08] space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                    4/4 拍实时节奏律动 (Live Metronome)
                  </span>

                  {/* Tap BPM 测速按钮 */}
                  <motion.button
                    key={tapRippleKey}
                    whileTap={{ scale: 0.92 }}
                    onClick={handleTapTempo}
                    className="px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[12px] font-semibold text-white flex items-center gap-1.5 transition-all shadow-sm"
                    title="连续点击或按键盘 T 键测速"
                  >
                    <Fingerprint className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>Tap 敲击校准 (T)</span>
                  </motion.button>
                </div>

                <div className="grid grid-cols-4 gap-3 py-1">
                  {[0, 1, 2, 3].map((beatIndex) => {
                    const isDownbeat = beatIndex === 0;
                    const isActive = currentBeatIndex === beatIndex && isPlaying;
                    return (
                      <motion.div
                        key={beatIndex}
                        animate={
                          isActive ? { scale: [1, 1.06, 1], y: [0, -3, 0] } : { scale: 1, y: 0 }
                        }
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        className={`p-4 rounded-2xl border text-center transition-colors ${
                          isActive
                            ? isDownbeat
                              ? "bg-[#0071e3] border-[#2997ff] text-white shadow-[0_0_24px_rgba(0,113,227,0.6)]"
                              : "bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.4)]"
                            : "bg-black/35 border-white/5 text-[#86868b]"
                        }`}
                      >
                        <div className="text-[10px] uppercase font-mono tracking-wider">
                          {isDownbeat ? "强拍 (Downbeat)" : `拍 ${beatIndex + 1}`}
                        </div>
                        <div
                          className={`text-[22px] font-mono font-bold mt-1 ${
                            isActive ? "text-white" : "text-white/40"
                          }`}
                        >
                          {beatIndex + 1}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* 灵敏度与 V8 联动设置 */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.08] space-y-4 shadow-md">
                <div className="flex justify-between items-center text-[14px]">
                  <span className="font-semibold text-white tracking-tight flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#2997ff]" />
                    <span>瞬态打击感灵敏度</span>
                  </span>
                  <span className="font-mono text-[#2997ff] font-semibold text-[13px]">
                    {(beatSensitivity * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={beatSensitivity}
                  onChange={(e) => setBeatSensitivity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                />

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-[13px] text-white/90">V8 视效引擎节拍强驱动联动</span>
                  <button
                    type="button"
                    onClick={() => setEnableV8BeatPulse(!enableV8BeatPulse)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      enableV8BeatPulse ? "bg-[#0071e3]" : "bg-white/20"
                    }`}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-md"
                      animate={{ left: enableV8BeatPulse ? "22px" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* 实时看板 */}
              <div className="grid grid-cols-3 gap-3.5 text-center">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.08] relative overflow-hidden"
                >
                  <span className="text-[12px] text-[#86868b]">实时 BPM</span>
                  <p className="text-[18px] font-mono font-bold text-[#2997ff] mt-1">
                    {currentBeatMap?.bpm || 128}
                  </p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.08] relative overflow-hidden"
                >
                  <span className="text-[12px] text-[#86868b]">强拍事件</span>
                  <p className="text-[18px] font-mono font-bold text-amber-400 mt-1">
                    {currentBeatMap?.downbeats?.length || 42} 次
                  </p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.08] relative overflow-hidden"
                >
                  <span className="text-[12px] text-[#86868b]">持久化缓存</span>
                  <p className="text-[18px] font-mono font-bold text-[#34c759] mt-1">
                    {cachedBeatMapCount} 首
                  </p>
                </motion.div>
              </div>
            </div>
          )}
        </div>

        {/* ─── 3. 底部操作栏 (Apple Spacious Footer) ─── */}
        <div className="px-8 py-5 border-t border-white/[0.07] bg-[#121214]/90 backdrop-blur-2xl flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              resetSourceSettings();
              if (showToast) {
                showToast("✨ 已恢复最佳无损音源策略与标准节拍灵敏度", "info");
              }
            }}
            className="flex items-center gap-2 text-[14px] text-[#86868b] hover:text-white transition-colors active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>还原默认设置</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[14px] font-semibold tracking-tight shadow-lg shadow-[#0071e3]/30 transition-all active:scale-[0.96] border border-white/20"
          >
            完成
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AudioSourceManagerModal;
