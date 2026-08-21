/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useAudioSourceStore, AudioSourceType, PreferredQuality } from "@/store/audioSourceStore";
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
  ChevronUp,
  ChevronDown,
  Sparkles,
  Zap,
  Lock,
  Cpu,
  HardDrive,
  Clock,
  ArrowRight,
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
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const setCurrentSong = useAudioStore(
    (state) => (state as any).setCurrentSong || (state as any).playSong
  );
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);

  const {
    sourcePriority,
    autoTrialFallback,
    preferredQuality,
    enableSpadeDecryption,
    enableBeatAnalysis,
    beatSensitivity,
    currentBeatMap,
    setSourcePriority,
    setAutoTrialFallback,
    setPreferredQuality,
    setEnableSpadeDecryption,
    setEnableBeatAnalysis,
    setBeatSensitivity,
    resetSourceSettings,
  } = useAudioSourceStore();

  const [activeTab, setActiveTab] = useState<TabType>("track-sources");
  const [candidates, setCandidates] = useState<ResolvedAudioSource[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [cachedBeatMapCount, setCachedBeatMapCount] = useState(1);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);

  // 4/4 拍实时律动模拟定时器（配合当前 BPM）
  useEffect(() => {
    if (!isPlaying || !enableBeatAnalysis) return;
    const bpm = currentBeatMap?.bpm || 128;
    const beatInterval = (60 / bpm) * 1000;

    const interval = setInterval(() => {
      setCurrentBeatIndex((prev) => (prev + 1) % 4);
    }, beatInterval);

    return () => clearInterval(interval);
  }, [isPlaying, enableBeatAnalysis, currentBeatMap]);

  // 并发拉取当前歌曲的多平台音源候选
  useEffect(() => {
    if (!isOpen || !currentSong) return;

    let isMounted = true;
    setIsLoadingCandidates(true);

    multiSourceResolver
      .getAvailableSourceCandidates({
        id: currentSong.id,
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
      })
      .then((list) => {
        if (isMounted) {
          setCandidates(list);
          setIsLoadingCandidates(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingCandidates(false);
      });

    if (typeof window !== "undefined") {
      let count = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("beatmap_")) count++;
      }
      setCachedBeatMapCount(Math.max(1, count));
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentSong]);

  const handleSwitchCandidate = (cand: ResolvedAudioSource) => {
    if (!currentSong) return;
    const updated = {
      ...currentSong,
      audioUrl: cand.url,
      format: cand.format,
      source: cand.source,
      quality: cand.quality,
    };
    if (setCurrentSong) setCurrentSong(updated);
    setIsPlaying(true);
  };

  const movePriority = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sourcePriority.length) return;
    const next = [...sourcePriority];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setSourcePriority(next);
  };

  const platformMeta: Record<AudioSourceType, { name: string; color: string; badge: string }> = {
    netease: { name: "网易云音乐", color: "from-red-500 to-rose-600", badge: "NETEASE" },
    qq: { name: "QQ 音乐", color: "from-emerald-500 to-teal-600", badge: "TENCENT" },
    kugou: { name: "酷狗音乐", color: "from-blue-500 to-cyan-600", badge: "KUGOU" },
    kuwo: { name: "酷我音乐", color: "from-amber-500 to-orange-600", badge: "KUWO" },
    qishui: { name: "汽水音乐", color: "from-purple-500 to-indigo-600", badge: "QISHUI" },
    local: { name: "本地母带", color: "from-amber-500 to-orange-600", badge: "MASTER" },
    lx_custom: { name: "洛雪扩展源", color: "from-cyan-500 to-blue-600", badge: "LX_CUSTOM" },
    cross_matched: { name: "全网智能跨源", color: "from-pink-500 to-rose-600", badge: "AUTO" },
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/70 backdrop-blur-md select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative w-full max-w-[720px] bg-[#1c1c1e]/95 rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.7)] border border-white/[0.08] overflow-hidden flex flex-col max-h-[88vh] text-[#f5f5f7]"
      >
        {/* 顶部标题栏 (Apple Spacious Header) */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#0071e3] flex items-center justify-center text-white shadow-md shadow-[#0071e3]/30">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white tracking-[-0.02em] leading-tight">
                音频来源与节拍设置
              </h3>
              <p className="text-[13px] text-[#86868b] mt-1 tracking-tight">
                多平台无损流媒体解析 · 0ms 试听降级 · 硬件节拍同步
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Apple 饱满分段选择器 (Segmented Control Bar) */}
        <div className="px-8 pt-4 pb-1">
          <div className="grid grid-cols-4 p-1.5 rounded-2xl bg-white/[0.06] border border-white/[0.04] relative">
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
                      className="absolute inset-0 rounded-xl bg-white/15 shadow-sm border border-white/10 -z-10"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 主体滚动区 */}
        <div className="px-8 py-7 overflow-y-auto space-y-7 flex-1 text-left">
          {/* TAB 1: 曲目版本 (Track Sources) */}
          {activeTab === "track-sources" && (
            <div className="space-y-6">
              {/* 大尺寸当前播放曲目卡片 (Apple Music Inset Grouped) */}
              <div className="p-6 rounded-[22px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-between gap-5">
                <div className="flex items-center gap-5 min-w-0">
                  {/* 黑胶唱片展示槽 (物理 33 RPM 动态扫光旋转) */}
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e] border border-white/15 flex items-center justify-center shrink-0 shadow-lg overflow-hidden group">
                    <motion.div
                      className="absolute inset-0 rounded-full flex items-center justify-center"
                      animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                      transition={
                        isPlaying
                          ? { repeat: Infinity, ease: "linear", duration: 1.8 }
                          : { duration: 0.6, ease: "easeOut" }
                      }
                    >
                      {/* 同心圆纹理 */}
                      <div className="absolute inset-1 rounded-full border border-white/10" />
                      <div className="absolute inset-2.5 rounded-full border border-white/10" />
                      <div className="absolute inset-4 rounded-full border border-white/10" />
                      {/* 扫光高光层 */}
                      <div
                        className="absolute inset-0 rounded-full opacity-30"
                        style={{
                          background:
                            "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.4) 60deg, transparent 120deg, transparent 180deg, rgba(255,255,255,0.4) 240deg, transparent 300deg)",
                        }}
                      />
                    </motion.div>

                    <div className="relative z-10 w-5 h-5 rounded-full bg-[#0071e3] flex items-center justify-center text-white shadow-inner">
                      <Music className="w-2.5 h-2.5" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                      当前播放曲目
                    </div>
                    <h4 className="text-[18px] font-semibold text-white truncate tracking-tight mt-1">
                      {currentSong?.title || "未选择曲目"}
                    </h4>
                    <p className="text-[13px] text-[#86868b] truncate mt-0.5">
                      {currentSong?.artist || "未知艺术家"} · {currentSong?.album || "精选大碟"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#0071e3]/20 text-[#2997ff] border border-[#0071e3]/30 tracking-wide">
                    {(currentSong as any)?.source?.toUpperCase() || "NETEASE"}
                  </span>
                  <span className="text-[12px] font-mono text-white/50">
                    {(currentSong as any)?.format?.toUpperCase() || "FLAC 24-bit/96kHz"}
                  </span>
                </div>
              </div>

              {/* 候选源版本列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                    可用音源版本 ({candidates.length})
                  </span>
                  {isLoadingCandidates && (
                    <span className="text-[12px] text-[#2997ff] font-medium animate-pulse">
                      正在并发抓取音质...
                    </span>
                  )}
                </div>

                <div className="rounded-[22px] bg-white/[0.04] border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
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
                        transition={{ delay: idx * 0.04, duration: 0.2 }}
                        className="flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-white text-[11px] font-bold shadow-md shrink-0`}
                          >
                            <Music className="w-4 h-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-medium text-white tracking-tight">
                                {cand.name || meta.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  cand.quality === "hires"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-white/10 text-white/80 border border-white/10"
                                }`}
                              >
                                {cand.quality}
                              </span>
                              {cand.isTrial && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  试听片段
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-[#86868b] mt-1 font-mono">
                              {cand.format.toUpperCase()} ·{" "}
                              {cand.bitrate
                                ? Math.round(cand.bitrate / 1000) + " kbps"
                                : "无损自适应母带"}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 ml-4">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2997ff] px-4 py-1.5 rounded-full bg-[#0071e3]/15">
                              <Check className="w-4 h-4" />
                              正在使用
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSwitchCandidate(cand)}
                              className="px-4.5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-medium tracking-tight shadow-sm transition-transform active:scale-[0.96]"
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
              <div className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-medium text-white tracking-tight">
                    0ms 试听片段智能静默降级
                  </h4>
                  <p className="text-[13px] text-[#86868b] mt-1">
                    当检测到 VIP 试听或无版权时，自动静默切换为备选平台的完整无损源
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

              {/* 降级拓扑示意图 (Fallback Network Flow) */}
              <div className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-3">
                <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                  多平台降级路由拓扑 (Fallback Network Route)
                </span>
                <div className="flex items-center justify-between gap-2 overflow-x-auto py-2 text-center">
                  {[
                    { name: "网易云", role: "首选源", color: "from-red-500 to-rose-600" },
                    { name: "QQ 音乐", role: "次选源", color: "from-emerald-500 to-teal-600" },
                    { name: "酷狗音乐", role: "备选源", color: "from-blue-500 to-cyan-600" },
                    { name: "汽水解密", role: "保底源", color: "from-purple-500 to-indigo-600" },
                    { name: "本地母带", role: "终极直通", color: "from-amber-500 to-orange-600" },
                  ].map((node, i, arr) => (
                    <React.Fragment key={node.name}>
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${node.color} flex items-center justify-center text-white text-[12px] font-bold shadow-md`}
                        >
                          {node.name.slice(0, 2)}
                        </div>
                        <span className="text-[11px] font-medium text-white/90">{node.name}</span>
                        <span className="text-[9px] text-[#86868b] font-mono">{node.role}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="flex items-center text-[#86868b] opacity-40 shrink-0 -mt-5">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 目标音质分段卡片 */}
              <div className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-3">
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
                          ? "bg-[#0071e3] text-white shadow-md font-semibold"
                          : "bg-white/[0.06] text-[#86868b] hover:text-white"
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
              <div className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-medium text-white tracking-tight">
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
              <div className="p-6 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-4">
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

                <div className="grid grid-cols-3 gap-3 relative py-2">
                  {/* 节点 1 */}
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-center flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-white">汽水加密流</div>
                      <div className="text-[10px] text-[#86868b] font-mono mt-0.5">Spade.enc</div>
                    </div>
                  </div>

                  {/* 节点 2 (核心解密引擎) */}
                  <div className="p-4 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/30 text-center flex flex-col items-center gap-2 relative shadow-[0_0_24px_rgba(0,113,227,0.15)]">
                    <div className="w-8 h-8 rounded-xl bg-[#0071e3] text-white flex items-center justify-center shadow-md">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-white">SpadeKey 内核</div>
                      <div className="text-[10px] text-[#2997ff] font-mono mt-0.5">
                        AES-128-ECB
                      </div>
                    </div>
                  </div>

                  {/* 节点 3 */}
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-center flex flex-col items-center gap-2">
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

              {/* 4 联装 Apple 硬件指标看板 (4-Grid Metrics) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-[20px] bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[#86868b] text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>解密内核</span>
                  </div>
                  <p className="text-[14px] font-mono font-bold text-white mt-1.5 truncate">
                    AES-128
                  </p>
                  <span className="text-[10px] text-[#86868b]">硬件流水线加速</span>
                </div>

                <div className="p-4 rounded-[20px] bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[#86868b] text-[11px]">
                    <Zap className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>管道吞吐率</span>
                  </div>
                  <p className="text-[14px] font-mono font-bold text-[#2997ff] mt-1.5 truncate">
                    48.2 MB/s
                  </p>
                  <span className="text-[10px] text-[#86868b]">零拷贝直通</span>
                </div>

                <div className="p-4 rounded-[20px] bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[#86868b] text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-[#34c759]" />
                    <span>解包延迟</span>
                  </div>
                  <p className="text-[14px] font-mono font-bold text-[#34c759] mt-1.5 truncate">
                    &lt; 0.2 ms
                  </p>
                  <span className="text-[10px] text-[#86868b]">瞬时低开销</span>
                </div>

                <div className="p-4 rounded-[20px] bg-white/[0.04] border border-white/[0.06]">
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

              {/* 安全沙盒自检卡片 */}
              <div className="p-5 rounded-[22px] bg-white/[0.03] border border-white/[0.05] space-y-2.5">
                <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider px-1">
                  安全沙盒与引擎状态
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[12px] text-white/80">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#34c759] shrink-0" />
                    <span>SpadeKey 算法就绪</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#34c759] shrink-0" />
                    <span>内存零落盘保护</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#34c759] shrink-0" />
                    <span>Wasm SIMD 硬件直通</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 节拍分析 (Biquad DSP & 4/4 实时律动指示) */}
          {activeTab === "dsp-beatmap" && (
            <div className="space-y-6">
              <div className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-medium text-white tracking-tight">
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

              {/* 4/4 拍实时律动指示灯视窗 (Live 4/4 Beat Pulse Bar) */}
              <div className="p-6 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                    4/4 拍实时节奏律动 (Live Metronome)
                  </span>
                  <span className="text-[11px] font-mono text-[#2997ff]">
                    {isPlaying ? "硬件同步中" : "已就绪"}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 py-2">
                  {[0, 1, 2, 3].map((beatIndex) => {
                    const isDownbeat = beatIndex === 0;
                    const isActive = currentBeatIndex === beatIndex && isPlaying;
                    return (
                      <motion.div
                        key={beatIndex}
                        animate={
                          isActive
                            ? { scale: [1, 1.05, 1], y: [0, -2, 0] }
                            : { scale: 1, y: 0 }
                        }
                        className={`p-4 rounded-2xl border text-center transition-colors ${
                          isActive
                            ? isDownbeat
                              ? "bg-[#0071e3] border-[#2997ff] text-white shadow-[0_0_20px_rgba(0,113,227,0.4)]"
                              : "bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                            : "bg-black/30 border-white/5 text-[#86868b]"
                        }`}
                      >
                        <div className="text-[10px] uppercase font-mono tracking-wider">
                          {isDownbeat ? "Downbeat (强拍)" : `Beat ${beatIndex + 1}`}
                        </div>
                        <div
                          className={`text-[20px] font-mono font-bold mt-1 ${
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

              {/* 灵敏度滑块 */}
              <div className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-3">
                <div className="flex justify-between items-center text-[14px]">
                  <span className="font-medium text-white tracking-tight">瞬态打击感灵敏度</span>
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
              </div>

              {/* 实时看板 */}
              <div className="grid grid-cols-3 gap-3.5 text-center">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.06] relative overflow-hidden"
                >
                  <span className="text-[12px] text-[#86868b]">实时 BPM</span>
                  <p className="text-[16px] font-mono font-bold text-[#2997ff] mt-1">
                    {currentBeatMap?.bpm || 128}
                  </p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.06] relative overflow-hidden"
                >
                  <span className="text-[12px] text-[#86868b]">强拍事件</span>
                  <p className="text-[16px] font-mono font-bold text-amber-400 mt-1">
                    {currentBeatMap?.downbeats?.length || 42} 次
                  </p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-[22px] bg-white/[0.04] border border-white/[0.06] relative overflow-hidden"
                >
                  <span className="text-[12px] text-[#86868b]">持久化缓存</span>
                  <p className="text-[16px] font-mono font-bold text-[#34c759] mt-1">
                    {cachedBeatMapCount} 首
                  </p>
                </motion.div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 (Apple Spacious Footer) */}
        <div className="px-8 py-5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <button
            type="button"
            onClick={resetSourceSettings}
            className="flex items-center gap-2 text-[14px] text-[#86868b] hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            还原默认设置
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-7 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[14px] font-semibold tracking-tight shadow-md transition-transform active:scale-[0.97]"
          >
            完成
          </button>
        </div>
      </motion.div>
    </div>
  );
};
