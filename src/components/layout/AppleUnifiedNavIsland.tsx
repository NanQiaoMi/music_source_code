/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect } from "react";
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

export function AppleUnifiedNavIsland() {
  const { openPanel, isFullscreen, toggleFullscreen } = useUIStore();
  const { isEnabled: isGestureEnabled, toggleGestureEnabled } = useGestureStore();

  const [activeHubId, setActiveHubId] = useState<string | null>(null);
  const [hoveredHubId, setHoveredHubId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const islandRef = useRef<HTMLDivElement>(null);

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
          id: "visualSettings",
          label: "视觉参数调优",
          icon: <Palette className="w-4 h-4 text-pink-400" />,
          action: () => openPanel("visualSettings"),
          desc: "粒子密度与相机调优",
        },
      ],
    },
    {
      id: "lyrics",
      label: "歌词与排版",
      accentColor: "rgba(59, 130, 246, 0.7)",
      icon: <Type className="w-4 h-4 text-sky-400" />,
      items: [
        {
          id: "lyricSettings",
          label: "歌词样式调优",
          icon: <Type className="w-4 h-4 text-sky-400" />,
          action: () => openPanel("lyricSettings"),
          desc: "字体大小 / 间距 / 双语排版",
        },
        {
          id: "lyricsSearch",
          label: "在线歌词检索",
          icon: <Music className="w-4 h-4 text-emerald-400" />,
          action: () => openPanel("lyricsSearch"),
          desc: "全网精准逐行 LRC 歌词抓取",
        },
        {
          id: "lyricsImport",
          label: "导入本地歌词",
          icon: <FileText className="w-4 h-4 text-amber-400" />,
          action: () => openPanel("lyricsImport"),
          desc: "支持 LRC / TXT 格式导入",
        },
        {
          id: "lyricsCoverEditor",
          label: "封面编辑器",
          icon: <Edit3 className="w-4 h-4 text-rose-400" />,
          action: () => openPanel("lyricsCoverEditor"),
          desc: "高清封面裁剪与元数据注入",
        },
      ],
    },
    {
      id: "library",
      label: "曲库与发现",
      accentColor: "rgba(16, 185, 129, 0.7)",
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          id: "cloudMusic",
          label: "我的云音乐",
          icon: <Heart className="w-4 h-4 text-rose-400" />,
          action: () => openPanel("cloudMusic"),
          desc: "网易云 / QQ / 酷狗个人歌单",
        },
        {
          id: "libraryManager",
          label: "音乐库管理器",
          icon: <Database className="w-4 h-4 text-emerald-400" />,
          action: () => openPanel("libraryManager"),
          desc: "全库索引与批量管理",
        },
        {
          id: "smartPlaylist",
          label: "智能播放列表",
          icon: <ListOrdered className="w-4 h-4 text-cyan-400" />,
          action: () => openPanel("smartPlaylist"),
          desc: "BPM 与情感流派智能聚类",
        },
        {
          id: "dailyRecommendation",
          label: "每日推荐",
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          action: () => openPanel("dailyRecommendation"),
          desc: "AI 每日精选懂你所爱",
        },
        {
          id: "dnaJournal",
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
      id: "tools",
      label: "专业与工具",
      accentColor: "rgba(139, 92, 246, 0.7)",
      icon: <Wrench className="w-4 h-4 text-purple-400" />,
      items: [
        {
          id: "eq",
          label: "10段专业均衡器",
          icon: <Waves className="w-4 h-4 text-purple-400" />,
          action: () => openPanel("eq"),
          desc: "精准频段调节与杜比音效",
        },
        {
          id: "formatConverter",
          label: "无损格式转换",
          icon: <Radio className="w-4 h-4 text-blue-400" />,
          action: () => openPanel("formatConverter"),
          desc: "FLAC / WAV / MP3 快速转换",
        },
        {
          id: "trackCutter",
          label: "音频剪辑与混音",
          icon: <Scissors className="w-4 h-4 text-amber-400" />,
          action: () => openPanel("trackCutter"),
          desc: "精准剪切与淡入淡出",
        },
        {
          id: "libraryHealth",
          label: "歌曲巡检与健康",
          icon: <Activity className="w-4 h-4 text-emerald-400" />,
          action: () => openPanel("libraryHealth"),
          desc: "死链清理与元数据修复",
        },
        {
          id: "backupRestore",
          label: "备份与恢复",
          icon: <HardDrive className="w-4 h-4 text-pink-400" />,
          action: () => openPanel("backupRestore"),
          desc: "本地曲库数据快照",
        },
      ],
    },
  ];

  const handleMouseEnterHub = (hubId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveHubId(hubId);
    setHoveredHubId(hubId);
  };

  const handleMouseLeaveIsland = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveHubId(null);
      setHoveredHubId(null);
    }, 180);
  };

  const activeHub = hubs.find((h) => h.id === activeHubId);

  return (
    <div
      ref={islandRef}
      className="relative flex items-center select-none font-sans"
      onMouseLeave={handleMouseLeaveIsland}
    >
      {/* 悬浮主玻璃胶囊 (Apple Unified Island) */}
      <div className="relative h-[38px] px-1 rounded-full bg-white/[0.06] hover:bg-white/[0.08] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_32px_rgba(0,0,0,0.3)] flex items-center gap-0.5 transition-all duration-300">
        {/* 1. 四大核心 Hub */}
        {hubs.map((hub) => {
          const isActive = activeHubId === hub.id;
          const isHovered = hoveredHubId === hub.id;

          return (
            <button
              key={hub.id}
              type="button"
              onMouseEnter={() => handleMouseEnterHub(hub.id)}
              onClick={() => setActiveHubId(isActive ? null : hub.id)}
              className="relative h-[32px] px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium tracking-tight whitespace-nowrap flex-shrink-0 transition-colors z-10"
              style={{
                color: isActive || isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.75)",
              }}
            >
              {/* 流动高光滑块 (Framer Motion Fluid Pill) */}
              {(isActive || isHovered) && (
                <motion.div
                  layoutId="island-hover-pill"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 32,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 rounded-full bg-white/[0.12] border border-white/[0.1] shadow-sm -z-10"
                />
              )}

              <span className="shrink-0 flex items-center justify-center">
                {hub.icon}
              </span>
              <span className="whitespace-nowrap">{hub.label}</span>

              {/* 仅在悬停或展开时显现的微型指示箭头 */}
              <motion.div
                animate={{
                  opacity: isActive || isHovered ? 0.7 : 0,
                  rotate: isActive ? 180 : 0,
                  scale: isActive || isHovered ? 1 : 0.6,
                }}
                transition={{ duration: 0.2 }}
                className="w-3 h-3 flex items-center justify-center shrink-0"
              >
                <ChevronDown className="w-3 h-3 text-white/80" />
              </motion.div>
            </button>
          );
        })}

        {/* 2. 微细半透明分割线 */}
        <div className="w-[1px] h-3.5 bg-white/10 mx-1 shrink-0" />

        {/* 3. 快捷微按钮组 (搜索 / 全屏 / 手势 / 快捷键) */}
        <div className="flex items-center gap-0.5 px-0.5">
          <button
            type="button"
            onClick={() => openPanel("search")}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setActiveHubId(null);
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
            title="全局搜索 (⌘K / Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setActiveHubId(null);
            }}
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
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setActiveHubId(null);
            }}
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
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setActiveHubId(null);
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
            title="键盘快捷键"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 连贯形态变换下拉视窗 (Shared Morphing Dropdown) */}
      <AnimatePresence mode="wait">
        {activeHub && (
          <motion.div
            key={activeHub.id}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 26,
              mass: 0.75,
            }}
            className="absolute top-full mt-2.5 left-1/2 -translate-x-1/2 w-[280px] bg-[#141416]/98 backdrop-blur-3xl rounded-[22px] border border-white/[0.14] shadow-[0_32px_84px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden z-[9999]"
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleMouseLeaveIsland}
          >
            <div className="p-2 space-y-0.5">
              {activeHub.items.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  whileHover={{ x: 4, backgroundColor: "rgba(255, 255, 255, 0.08)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    item.action();
                    setActiveHubId(null);
                  }}
                  className="w-full group flex items-start gap-3 p-2.5 rounded-2xl transition-all text-left"
                >
                  <div className="mt-0.5 p-1.5 rounded-xl bg-white/[0.06] group-hover:bg-white/15 transition-all text-white/80 group-hover:text-white shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-medium text-white tracking-tight truncate group-hover:text-white transition-colors">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/10 text-white/70">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.desc && (
                      <p className="text-[11px] text-[#86868b] leading-tight mt-0.5 truncate group-hover:text-white/60 transition-colors">
                        {item.desc}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            {/* 底部装饰高光条 */}
            <div
              className="h-[1px] w-full opacity-35"
              style={{
                background: `linear-gradient(90deg, transparent, ${activeHub.accentColor}, transparent)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
