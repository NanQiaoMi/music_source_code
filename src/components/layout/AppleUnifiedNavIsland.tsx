/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Type,
  Database,
  Wrench,
  Search,
  Maximize2,
  Minimize2,
  Hand,
  Keyboard,
  ChevronDown,
  Disc3,
  Sparkles,
  Waves,
  Palette,
  Music,
  FileText,
  Edit3,
  Heart,
  ListOrdered,
  Dna,
  TrendingUp,
  Activity,
  Scissors,
  HardDrive,
} from "lucide-react";
import { useUIStore, PanelName } from "@/store/uiStore";
import { useGestureStore } from "@/store/gestureStore";
import { useVisualizationV8Store } from "@/store/visualizationV8Store";

export interface NavHubSubItem {
  id: PanelName | string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  desc?: string;
  badge?: string;
}

export interface NavHubConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  accentColor: string;
  items: NavHubSubItem[];
}

export interface AppleUnifiedNavIslandProps {
  isSearchOpen?: boolean;
  hasActiveToast?: boolean;
}

export function AppleUnifiedNavIsland({
  isSearchOpen: isSearchOpenProp,
  hasActiveToast: hasActiveToastProp,
}: AppleUnifiedNavIslandProps = {}) {
  const openPanel = useUIStore((state) => state.openPanel);
  const isFullscreen = useUIStore((state) => state.isFullscreen);
  const toggleFullscreen = useUIStore((state) => state.toggleFullscreen);
  const panels = useUIStore((state) => state.panels);
  const toasts = useUIStore((state) => state.toasts);

  const storeSearchOpen = panels?.search ?? false;
  const isSearchOpen = isSearchOpenProp ?? storeSearchOpen;
  const storeHasToast = Array.isArray(toasts) && toasts.length > 0;
  const hasActiveToast = hasActiveToastProp ?? storeHasToast;
  const { isEnabled: isGestureEnabled, toggleGestureEnabled } = useGestureStore();

  const [activeHubId, setActiveHubId] = useState<string | null>(null);
  const [hoveredHubId, setHoveredHubId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const islandRef = useRef<HTMLDivElement>(null);

  // 当全局搜索打开时，自动收起展开中的导航子菜单，保持界面整洁下移
  useEffect(() => {
    if (isSearchOpen && activeHubId !== null) {
      setActiveHubId(null);
    }
  }, [isSearchOpen, activeHubId]);

  // 1. 四大核心 Hub 配置
  const hubs: NavHubConfig[] = [
    {
      id: "source-stage",
      label: "音源与舞台",
      accentColor: "rgba(0, 113, 227, 0.7)",
      icon: <Radio className="w-4 h-4 text-[#2997ff]" />,
      items: [
        {
          id: "audioSourceManager",
          label: "多源解析与降级",
          icon: <Radio className="w-4 h-4 text-[#0071e3]" />,
          action: () => openPanel("audioSourceManager"),
          desc: "Hi-Res / 无损母带直通切换",
        },
        {
          id: "shelf3D",
          label: "3D 空间唱片架",
          icon: <Disc3 className="w-4 h-4 text-cyan-400" />,
          action: () => openPanel("shelf3D"),
          desc: "物理惯性 3D 旋转唱片架",
        },
        {
          id: "kineticStage",
          label: "暗场粒子歌词舞台",
          icon: <Sparkles className="w-4 h-4 text-purple-400" />,
          action: () => {
            useVisualizationV8Store.getState().setCurrentEffect("kinetic-particle-stage");
            useUIStore.getState().setCurrentView("visualization");
          },
          desc: "3D 粒子波浪与发光歌词",
        },
        {
          id: "v8Visualizer",
          label: "全屏 V8 渲染引擎",
          icon: <Waves className="w-4 h-4 text-blue-400" />,
          action: () => useUIStore.getState().setCurrentView("visualization"),
          desc: "28+ WebGL/Canvas 引擎",
        },
        {
          id: "auroraBackdrop",
          label: "Apple Fluid 动态流体",
          icon: <Palette className="w-4 h-4 text-emerald-400" />,
          action: () => {
            useVisualizationV8Store.getState().setCurrentEffect("aurora-fluid");
            useUIStore.getState().setCurrentView("visualization");
          },
          desc: "声学色彩弥散渐变",
        },
      ],
    },
    {
      id: "lyrics-typography",
      label: "歌词与排版",
      accentColor: "rgba(41, 151, 255, 0.7)",
      icon: <Type className="w-4 h-4 text-[#2997ff]" />,
      items: [
        {
          id: "lyricsTypography",
          label: "排版与字阶系统",
          icon: <Type className="w-4 h-4 text-cyan-400" />,
          action: () => openPanel("lyricSettings"),
          desc: "Apple 动态卡诺字阶与行高",
        },
        {
          id: "lyricsKaraoke",
          label: "逐字卡拉OK光芒",
          icon: <Music className="w-4 h-4 text-amber-400" />,
          action: () => openPanel("lyricSettings"),
          desc: "流光粒子发光与音节微动",
        },
        {
          id: "lyricsCardExport",
          label: "高定歌词卡片海报",
          icon: <FileText className="w-4 h-4 text-emerald-400" />,
          action: () => openPanel("share"),
          desc: "4K 玻璃质感金句导出",
        },
        {
          id: "lyricsOffsetEditor",
          label: "毫秒级轴偏移微调",
          icon: <Edit3 className="w-4 h-4 text-indigo-400" />,
          action: () => openPanel("lyricSettings"),
          desc: "精准对齐人声起止点",
        },
      ],
    },
    {
      id: "library-discovery",
      label: "曲库与发现",
      accentColor: "rgba(52, 199, 89, 0.7)",
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          id: "accountCenter",
          label: "我的云音乐",
          icon: <Heart className="w-4 h-4 text-rose-400" />,
          action: () => openPanel("accountCenter"),
          desc: "网易云 / QQ / 酷狗个人歌单",
        },
        {
          id: "libraryManager",
          label: "音乐库管理器",
          icon: <Database className="w-4 h-4 text-emerald-400" />,
          action: () => {
            window.location.href = "/data-manager";
          },
          desc: "全库索引与批量管理",
        },
        {
          id: "smartPlaylists",
          label: "智能播放列表",
          icon: <ListOrdered className="w-4 h-4 text-cyan-400" />,
          action: () => openPanel("smartPlaylist"),
          desc: "BPM 与情感流派智能聚类",
        },
        {
          id: "dailyRecommend",
          label: "每日推荐",
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          action: () => openPanel("dailyRecommendation"),
          desc: "AI 每日精选懂你所爱",
        },
        {
          id: "musicTasteRadar",
          label: "听歌基因",
          icon: <Dna className="w-4 h-4 text-purple-400" />,
          action: () => openPanel("dnaJournal"),
          desc: "音乐口味雷达图与日记",
        },
        {
          id: "listeningHistory",
          label: "听歌历史",
          icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
          action: () => openPanel("listeningHistory"),
          desc: "近期播放足迹与统计",
        },
      ],
    },
    {
      id: "pro-tools",
      label: "专业与工具",
      accentColor: "rgba(175, 82, 222, 0.7)",
      icon: <Wrench className="w-4 h-4 text-purple-400" />,
      items: [
        {
          id: "studioEQ",
          label: "10段 专业均衡器",
          icon: <Activity className="w-4 h-4 text-amber-400" />,
          action: () => openPanel("eq"),
          desc: "31Hz ~ 16kHz 录音室调音",
        },
        {
          id: "spatialAudioLab",
          label: "空间音频与混响室",
          icon: <Disc3 className="w-4 h-4 text-purple-400" />,
          action: () => openPanel("formatConverter"),
          desc: "7.1.4 沉浸声场与动态头部追踪",
        },
        {
          id: "ringtoneCutter",
          label: "音频剪辑与高潮截取",
          icon: <Scissors className="w-4 h-4 text-rose-400" />,
          action: () => openPanel("trackCutter"),
          desc: "精准微秒淡入淡出导出",
        },
        {
          id: "offlineStorage",
          label: "本地离线空间与缓存",
          icon: <HardDrive className="w-4 h-4 text-blue-400" />,
          action: () => openPanel("offlineCache"),
          desc: "高保真音频离线包管理",
        },
      ],
    },
  ];

  // 全局 Click-Outside, Esc 与 Wheel 滚动自动收回监听
  useEffect(() => {
    useUIStore.getState().setIsNavMenuOpen(activeHubId !== null);

    const handleClickOutside = (e: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setActiveHubId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveHubId(null);
      }
    };
    const handleWheel = () => {
      if (activeHubId !== null) {
        setActiveHubId(null);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [activeHubId]);

  const handleMouseEnterHub = (hubId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHoveredHubId(hubId);
  };

  const handleMouseLeaveIsland = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setHoveredHubId(null);
    }, 150);
  };

  return (
    <motion.div
      ref={islandRef}
      data-testid="apple-unified-nav-island"
      data-search-avoidance={isSearchOpen ? "shifted" : hasActiveToast ? "toast-avoidance" : "idle"}
      onMouseLeave={handleMouseLeaveIsland}
      animate={{
        y: isSearchOpen ? 56 : hasActiveToast ? 46 : 0,
        scale: isSearchOpen ? 0.99 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 32,
        mass: 0.8,
      }}
      style={{
        transform: "translate3d(0, 0, 0)",
        willChange: "transform",
      }}
      className="relative flex items-center select-none z-50 font-sans"
    >
      {/* 核心玻璃岛胶囊 (Mac Style Monolithic Capsule) */}
      <div
        className={`relative h-[42px] px-2.5 rounded-full bg-[#16161a]/90 border border-white/[0.14] backdrop-blur-[40px] backdrop-saturate-[190%] flex items-center gap-1 transition-all duration-300 ${
          isSearchOpen
            ? "shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.25)]"
            : "shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.22)]"
        }`}
      >
        <div className="mineradio-glass-specular-glint rounded-full" />
        {/* 1. 四大核心 Hub 导航 */}
        {hubs.map((hub, index) => {
          const isActive = activeHubId === hub.id;
          const isHovered = hoveredHubId === hub.id;

          return (
            <div key={hub.id} className="relative">
              <button
                type="button"
                onMouseEnter={() => handleMouseEnterHub(hub.id)}
                onClick={() => setActiveHubId(isActive ? null : hub.id)}
                className="relative h-[32px] px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium tracking-tight whitespace-nowrap flex-shrink-0 transition-colors z-10"
                style={{
                  color: isActive || isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.75)",
                }}
              >
                {/* 流动高光滑块 */}
                {(isActive || isHovered) && (
                  <motion.div
                    layoutId="island-hover-pill"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 32,
                      mass: 0.8,
                    }}
                    className="absolute inset-0 rounded-full bg-white/[0.14] border border-white/[0.12] shadow-sm -z-10"
                  />
                )}

                <span className="shrink-0 flex items-center justify-center">
                  {hub.icon}
                </span>
                <span className="whitespace-nowrap">{hub.label}</span>

                <motion.div
                  animate={{
                    opacity: isActive || isHovered ? 0.85 : 0,
                    rotate: isActive ? 180 : 0,
                    scale: isActive || isHovered ? 1 : 0.6,
                  }}
                  transition={{ duration: 0.2 }}
                  className="w-3 h-3 flex items-center justify-center shrink-0"
                >
                  <ChevronDown className="w-3 h-3 text-white/80" />
                </motion.div>
              </button>

              {/* 紧凑自适应下拉浮窗 (直接相对该按钮锚定，宽度 220px，绝不遮挡中央大时钟) */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 28,
                      mass: 0.6,
                    }}
                    className={`absolute top-full mt-2.5 w-[220px] bg-[#141416]/98 backdrop-blur-3xl rounded-[20px] border border-white/[0.16] shadow-[0_24px_64px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.1)] overflow-hidden z-[9999] ${
                      index > 1 ? "right-0" : "left-0"
                    }`}
                  >
                    <div className="mineradio-glass-specular-glint" />
                    <div className="p-1.5 space-y-0.5">
                      {hub.items.map((item) => (
                        <motion.button
                          key={item.id}
                          type="button"
                          whileHover={{ x: 3, backgroundColor: "rgba(255, 255, 255, 0.08)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            item.action();
                            setActiveHubId(null);
                          }}
                          className="w-full group flex items-start gap-2.5 p-2 rounded-xl transition-all text-left"
                        >
                          <div className="mt-0.5 p-1 rounded-lg bg-white/[0.06] group-hover:bg-white/15 transition-all text-white/80 group-hover:text-white shrink-0">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[12.5px] font-medium text-white tracking-tight truncate group-hover:text-white transition-colors">
                                {item.label}
                              </span>
                              {item.badge && (
                                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-white/10 text-white/70">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.desc && (
                              <p className="text-[10.5px] text-[#86868b] leading-tight mt-0.5 truncate group-hover:text-white/60 transition-colors">
                                {item.desc}
                              </p>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    <div
                      className="h-[1px] w-full opacity-35"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${hub.accentColor}, transparent)`,
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* 2. 微细半透明分割线 */}
        <div className="w-[1px] h-3.5 bg-white/10 mx-1 shrink-0" />

        {/* 3. 快捷微按钮组 (搜索 / 全屏 / 手势 / 快捷键) */}
        <div className="flex items-center gap-0.5 px-0.5">
          <button
            type="button"
            onClick={() => openPanel("search")}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
            title="全局搜索 (⌘K / Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
            title={isFullscreen ? "退出全屏" : "全屏沉浸"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleGestureEnabled}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
              isGestureEnabled
                ? "bg-[#0071e3]/30 text-[#2997ff] border border-[#0071e3]/40"
                : "text-white/60 hover:text-white hover:bg-white/[0.12]"
            }`}
            title="隔空手势控制"
          >
            <Hand className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => openPanel("keyboardShortcuts")}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
            title="键盘快捷键"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
