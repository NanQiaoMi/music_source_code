"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useStorageAnalyticsStore, formatStorageBytes } from "@/store/useStorageAnalyticsStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { usePlaylistStore } from "@/store/playlistStore";
import {
  LayoutDashboard,
  Cloud,
  Download,
  FolderHeart,
  HardDriveDownload,
  ShieldCheck,
  Home,
  X,
  Music2,
  HardDrive,
} from "lucide-react";

import { DataDashboardTab } from "./hub/DataDashboardTab";
import { LxMusicSearchTab } from "./hub/LxMusicSearchTab";
import { CloudAssetsTab } from "./hub/CloudAssetsTab";
import { OfflineDownloadsTab } from "./hub/OfflineDownloadsTab";
import { PlaylistHubTab } from "./hub/PlaylistHubTab";
import { HealthStorageTab } from "./hub/HealthStorageTab";
import { LocalMusicManager } from "./LocalMusicManager";
import { SourceManagementModal } from "@/components/sources/SourceManagementModal";
import { Sparkles } from "lucide-react";

export type HubTabKey =
  | "dashboard"
  | "lx_search"
  | "cloud"
  | "downloads"
  | "playlists"
  | "local"
  | "health_storage";

interface UnifiedDataManagerHubProps {
  initialTab?: HubTabKey;
  isStandalonePage?: boolean;
  onClose?: () => void;
}

export const UnifiedDataManagerHub: React.FC<UnifiedDataManagerHubProps> = ({
  initialTab = "dashboard",
  isStandalonePage = false,
  onClose,
}) => {
  const { setCurrentView, closePanel } = useUIStore();
  const { storageDetails, usagePercent, refreshAnalytics } = useStorageAnalyticsStore();
  const { activeCount, totalSpeedFormatted, offlineRecords } = useOfflineDownloadStore();
  const { songs } = usePlaylistStore();

  const [activeTab, setActiveTab] = useState<HubTabKey>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<HubTabKey>>(new Set([initialTab]));

  const handleSelectTab = (tab: HubTabKey) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

  useEffect(() => {
    refreshAnalytics(songs);
  }, [songs, refreshAnalytics]);

  // Keyboard shortcut ESC to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onClose) onClose();
        else if (isStandalonePage) setCurrentView("home");
        else closePanel("dataManager");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isStandalonePage, setCurrentView, closePanel]);

  const navTabs = [
    { id: "dashboard", label: "全景看板", icon: LayoutDashboard, badge: null },
    { id: "lx_search", label: "全网聚搜", icon: Sparkles, badge: "✦" },
    { id: "cloud", label: "云端曲库", icon: Cloud, badge: "☁" },
    { id: "downloads", label: "离线下载", icon: Download, badge: activeCount > 0 ? `${activeCount}` : null },
    { id: "playlists", label: "歌单编排", icon: FolderHeart, badge: null },
    { id: "local", label: "本地导入", icon: HardDriveDownload, badge: `${storageDetails.localMusicCount}` },
    { id: "health_storage", label: "存储体检", icon: ShieldCheck, badge: null },
  ];

  const handleClose = () => {
    if (onClose) onClose();
    else if (isStandalonePage) setCurrentView("home");
    else closePanel("dataManager");
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#050508] text-white flex flex-col overflow-hidden font-sans select-none">
      {/* 顶部环境流光渐变背景 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[130px]" />
        <div className="absolute top-[30%] right-[10%] w-[450px] h-[450px] rounded-full bg-purple-600/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[40%] w-[600px] h-[600px] rounded-full bg-cyan-600/08 blur-[160px]" />
      </div>

      {/* ── 顶部 Apple Liquid Glass 悬浮主导航栏 ── */}
      <header className="relative z-30 flex items-center justify-between px-4 md:px-8 py-3.5 bg-white/[0.04] border-b border-white/[0.12] backdrop-blur-[56px] backdrop-saturate-[180%] shadow-lg shrink-0">
        {/* 左侧：返回主页 & 标题 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/15 transition-all active:scale-90 cursor-pointer shadow-sm"
            title="返回主播放器 (ESC)"
          >
            {isStandalonePage ? <Home className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-sm shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 leading-tight">
                资料库资产管理中枢
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-cyan-300 border border-white/15 font-medium">
                  ✦ 全景中枢
                </span>
              </h2>
              <p className="text-[10px] text-white/40 leading-none mt-0.5">
                全景数据看板 · 云端曲库 · 多任务离线下载 · 歌单编排 · 存储体检
              </p>
            </div>
          </div>
        </div>

        {/* 中间：6 大分类 Tab Pills (带 Apple 弹簧物理滑动胶囊) */}
        <div className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-black/50 border border-white/10 shadow-inner backdrop-blur-md">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id as HubTabKey)}
                className={`relative flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap z-10 select-none ${
                  isActive ? "text-white font-bold" : "text-white/60 hover:text-white/90"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeHubTabPill"
                    className="absolute inset-0 bg-white/20 border border-white/25 rounded-xl shadow-[0_4px_16px_rgba(255,255,255,0.18),inset_0_1px_1px_rgba(255,255,255,0.45)] backdrop-blur-lg -z-10"
                    transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                  />
                )}
                <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? "text-cyan-300 scale-105" : "text-white/60"}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9px] font-mono px-1 rounded-full border font-bold transition-all ${
                    isActive ? "bg-cyan-400 text-black border-cyan-300" : "bg-white/10 text-cyan-200 border-cyan-400/30"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 右侧：实时微型状态指示器 */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/[0.05] border border-white/10 text-xs font-mono">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white/80">{formatStorageBytes(storageDetails.totalUsageBytes)}</span>
            <span className="text-white/30">/</span>
            <span className="text-white/50">{usagePercent.toFixed(0)}%</span>
          </div>

          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono animate-pulse">
              <Download className="w-3.5 h-3.5" />
              <span>{totalSpeedFormatted}</span>
            </div>
          )}
        </div>
      </header>

      {/* 移动端小屏二级分类 Tab */}
      <div className="flex lg:hidden overflow-x-auto px-4 py-2 bg-black/40 border-b border-white/10 gap-1.5 shrink-0 custom-scrollbar z-20">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectTab(tab.id as HubTabKey)}
              className={`relative flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer z-10 transition-colors ${
                isActive ? "text-white font-bold" : "bg-white/5 text-white/60"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeMobileHubTabPill"
                  className="absolute inset-0 bg-white/20 border border-white/25 rounded-xl shadow-sm -z-10"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-300" : ""}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 核心工作区主视口 (Keep-Alive 瞬态热切换与 120fps 满帧性能) ── */}
      <main
        className={`relative z-10 flex-1 overflow-y-auto p-4 md:p-6 w-full custom-scrollbar ${
          activeTab === "lx_search" || activeTab === "cloud" || activeTab === "downloads"
            ? "max-w-[1720px] mx-auto"
            : "max-w-7xl mx-auto"
        }`}
      >
        {visitedTabs.has("dashboard") && (
          <div
            className={`w-full transition-opacity duration-150 transform-gpu ${
              activeTab === "dashboard" ? "block opacity-100" : "hidden opacity-0 pointer-events-none"
            }`}
          >
            <DataDashboardTab onNavigateTab={(tab) => handleSelectTab(tab as HubTabKey)} />
          </div>
        )}

        {visitedTabs.has("lx_search") && (
          <div
            className={`w-full transition-opacity duration-150 transform-gpu ${
              activeTab === "lx_search" ? "block opacity-100" : "hidden opacity-0 pointer-events-none"
            }`}
          >
            <LxMusicSearchTab />
          </div>
        )}

        {visitedTabs.has("cloud") && (
          <div
            className={`w-full transition-opacity duration-150 transform-gpu ${
              activeTab === "cloud" ? "block opacity-100" : "hidden opacity-0 pointer-events-none"
            }`}
          >
            <CloudAssetsTab />
          </div>
        )}

        {visitedTabs.has("downloads") && (
          <div
            className={`w-full transition-opacity duration-150 transform-gpu ${
              activeTab === "downloads" ? "block opacity-100" : "hidden opacity-0 pointer-events-none"
            }`}
          >
            <OfflineDownloadsTab />
          </div>
        )}

        {visitedTabs.has("playlists") && (
          <div
            className={`w-full transition-opacity duration-150 transform-gpu ${
              activeTab === "playlists" ? "block opacity-100" : "hidden opacity-0 pointer-events-none"
            }`}
          >
            <PlaylistHubTab />
          </div>
        )}

        {visitedTabs.has("local") && (
          <div
            className={`w-full transition-opacity duration-150 transform-gpu ${
              activeTab === "local" ? "block opacity-100" : "hidden opacity-0 pointer-events-none"
            }`}
          >
            <div className="space-y-4">
              <LocalMusicManager />
            </div>
          </div>
        )}

        {visitedTabs.has("health_storage") && (
          <div
            className={`w-full transition-opacity duration-150 transform-gpu ${
              activeTab === "health_storage" ? "block opacity-100" : "hidden opacity-0 pointer-events-none"
            }`}
          >
            <HealthStorageTab />
          </div>
        )}
      </main>

      {/* 音源矩阵与脚本配置全局模态框 */}
      <SourceManagementModal />
    </div>
  );
};
export default UnifiedDataManagerHub;
