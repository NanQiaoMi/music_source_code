"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ListMusic,
  History,
  Settings,
  Moon,
  Hand,
  Type,
  Sparkles,
  TrendingUp,
  FileText,
  Cloud,
  Share2,
  Palette,
  Music,
  Database,
  Edit3,
  ListOrdered,
  HardDrive,
  Award,
  Disc3,
  Scissors,
  Waves,
  ChevronDown,
  Wrench,
  Dice1,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useGestureStore } from "@/store/gestureStore";
import { InstantMixButton } from "@/components/widgets/InstantMix";

import { Logo } from "@/components/layout/Logo";

/**
 * HeaderToolbar - The primary navigation and tool selection bar.
 * 
 * Extracted from page.tsx to improve modularity and reduce main component size.
 * Uses centralized panel management from uiStore.
 */
export function HeaderToolbar() {
    const { currentView, openPanel, togglePanel, panels, isFullscreen, toggleFullscreen } = useUIStore();
  const { songs } = usePlaylistStore();
  const { isEnabled: isGestureEnabled, toggleGestureEnabled } = useGestureStore();
  
  const [showProfessionalTools, setShowProfessionalTools] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["模式与设置", "音频处理工具", "智能分析工具"]));
  const professionalToolsRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Close professional tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (professionalToolsRef.current && !professionalToolsRef.current.contains(event.target as Node)) {
        setShowProfessionalTools(false);
      }
    };

    if (showProfessionalTools) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfessionalTools]);

  return (
    <header
      className="absolute top-0 left-0 right-0 z-20 pt-14 pb-4 px-4 backdrop-blur-xl"
      style={{
        opacity: currentView === "home" ? 1 : 0,
        transform: currentView === "home" ? "translateY(0)" : "translateY(-20px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        transitionDelay: currentView === "home" ? "0.05s" : "0s",
        background: "rgba(0,0,0,0.5)",
        borderBottom: "1px solid var(--theme-border)",
      }}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div
          style={{
            opacity: currentView === "home" ? 1 : 0,
            transform: currentView === "home" ? "translateX(0)" : "translateX(-15px)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            transitionDelay: currentView === "home" ? "0.08s" : "0s",
          }}
          className="flex items-center gap-2 min-w-0 flex-shrink-0"
        >
          <Logo size={46} className="drop-shadow-2xl flex-shrink-0" />
          <div className="flex flex-col justify-center min-w-0">
            <h1
              className="text-[26px] font-bold tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ color: "var(--theme-text-primary)" }}
            >
              资料库
            </h1>
            <p 
              className="text-[13px] font-medium opacity-60 whitespace-nowrap overflow-hidden text-ellipsis" 
              style={{ color: "var(--theme-text-secondary)" }}
            >
              {songs.length > 0 ? `${songs.length} 首歌曲` : "导入音乐开始聆听"}
            </p>
          </div>
        </div>

        <nav
          className="flex items-center gap-2"
          style={{
            opacity: currentView === "home" ? 1 : 0,
            transform: currentView === "home" ? "translateX(0)" : "translateX(15px)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            transitionDelay: currentView === "home" ? "0.08s" : "0s",
          }}
        >
          {/* Apple Music Style Toolbar Buttons */}
          <button
            onClick={toggleGestureEnabled}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{
              background: isGestureEnabled ? "rgba(255, 255, 255, 0.2)" : "transparent",
              color: isGestureEnabled ? "#fff" : "var(--theme-text-secondary)",
              boxShadow: isGestureEnabled ? "0 0 15px rgba(255, 255, 255, 0.2)" : "none",
            }}
            title={isGestureEnabled ? "手势控制已开启" : "手势控制已关闭"}
          >
            <Hand className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("search")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="搜索"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("queue")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="播放队列"
          >
            <ListMusic className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("history")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="历史记录"
          >
            <History className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("listeningHistory")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="听歌排行"
          >
            <TrendingUp className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("dailyRecommendation")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="每日推荐"
          >
            <Sparkles className="w-[18px] h-[18px]" />
          </button>

          <InstantMixButton onClick={() => openPanel("instantMix")} />

          <button
            onClick={() => togglePanel("emotionMatrix")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10 group"
            style={{ 
              color: panels.emotionMatrix ? "#fff" : "var(--theme-text-secondary)",
              background: panels.emotionMatrix ? "rgba(255, 255, 255, 0.15)" : "transparent",
              boxShadow: panels.emotionMatrix ? "0 0 15px rgba(255, 255, 255, 0.2)" : "none",
            }}
            title="情绪资料库 (Emotion Matrix)"
          >
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Dice1 className="w-[18px] h-[18px]" />
            </motion.div>
          </button>

          <button
            onClick={() => openPanel("sleepTimer")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="睡眠定时"
          >
            <Moon className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("settings")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="设置"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("lyricSettings")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="歌词设置"
          >
            <Type className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("lyricsSearch")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="歌词搜索"
          >
            <Music className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("lyricsImport")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="导入歌词"
          >
            <FileText className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("offlineCache")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="离线缓存"
          >
            <Cloud className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("keyboardShortcuts")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="快捷键帮助"
          >
            <span className="text-xs font-bold">?</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ 
              color: isFullscreen ? "#fff" : "var(--theme-text-secondary)",
              background: isFullscreen ? "rgba(255, 255, 255, 0.1)" : "transparent"
            }}
            title={isFullscreen ? "退出全屏" : "全屏"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-[18px] h-[18px]" />
            ) : (
              <Maximize2 className="w-[18px] h-[18px]" />
            )}
          </button>

          <button
            onClick={() => openPanel("share")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="分享"
          >
            <Share2 className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("playerSkins")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="播放器皮肤"
          >
            <Palette className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("libraryManager")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="音乐库管理"
          >
            <Database className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("lyricsCoverEditor")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="歌词与封面"
          >
            <Edit3 className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("smartPlaylist")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="智能歌单"
          >
            <ListOrdered className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("backupRestore")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="数据备份"
          >
            <HardDrive className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => openPanel("statsAchievements")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="统计与成就"
          >
            <Award className="w-[18px] h-[18px]" />
          </button>

          {/* Professional Tools Dropdown */}
          <div className="relative" ref={professionalToolsRef}>
            <button
              onClick={() => setShowProfessionalTools(!showProfessionalTools)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
              style={{
                background: showProfessionalTools ? "rgba(255, 255, 255, 0.2)" : "transparent",
                color: showProfessionalTools ? "#fff" : "var(--theme-text-secondary)",
                boxShadow: showProfessionalTools ? "0 0 15px rgba(255, 255, 255, 0.2)" : "none",
              }}
              title="专业工具箱"
            >
              <Wrench className="w-[18px] h-[18px]" />
              <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${showProfessionalTools ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {showProfessionalTools && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-2 space-y-1">
                    <div className="text-xs font-semibold text-white/50 px-3 py-2 uppercase tracking-wider">
                      专业功能
                    </div>

                    {/* 模式与设置 */}
                    <div>
                      <button
                        onClick={() => toggleGroup("模式与设置")}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/90">模式与设置</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("模式与设置") ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {expandedGroups.has("模式与设置") && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 pr-2 pb-1 space-y-1">
                              <button
                                onClick={() => {
                                  openPanel("professionalMode");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">专业模式</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 音频处理工具 */}
                    <div>
                      <button
                        onClick={() => toggleGroup("音频处理工具")}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Disc3 className="w-4 h-4 text-pink-400" />
                          <span className="text-sm font-medium text-white/90">音频处理工具</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("音频处理工具") ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {expandedGroups.has("音频处理工具") && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 pr-2 pb-1 space-y-1">
                              <button
                                onClick={() => {
                                  openPanel("formatConverter");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">格式转换</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("dsdConverter");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">DSD 转换</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("trackCutter");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <Scissors className="w-4 h-4 text-purple-400" />
                                <span className="text-sm text-white/80">整轨切割</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 智能分析工具 */}
                    <div>
                      <button
                        onClick={() => toggleGroup("智能分析工具")}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Waves className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-white/90">智能分析工具</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("智能分析工具") ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {expandedGroups.has("智能分析工具") && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 pr-2 pb-1 space-y-1">
                              <button
                                onClick={() => {
                                  openPanel("crossfadeMixer");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">交叉淡入淡出</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("fingerprintScanner");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">音频指纹</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("libraryHealth");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">健康检查</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Data Manager Link */}
          <motion.a
            href="/data-manager"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="ml-2 px-3.5 py-3.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all whitespace-nowrap"
            style={{
              background: "#fff",
              color: "#000",
              boxShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
            }}
          >
            <svg className="w-3.5 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            管理音乐
          </motion.a>
        </nav>
      </div>
    </header>
  );
}
