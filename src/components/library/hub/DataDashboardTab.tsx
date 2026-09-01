"use client";

import React, { useEffect } from "react";
import { useStorageAnalyticsStore, formatStorageBytes } from "@/store/useStorageAnalyticsStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { LiquidStorageGauge } from "./LiquidStorageGauge";
import { QualityDistributionChart } from "./QualityDistributionChart";
import { PlatformDonutChart } from "./PlatformDonutChart";
import { LibraryHealthRadar } from "./LibraryHealthRadar";
import { HardDrive, Music, Cloud, Download, RefreshCw, Zap } from "lucide-react";

interface DataDashboardTabProps {
  onNavigateTab: (tabKey: string) => void;
  onFilterQuality?: (quality: string | null) => void;
}

export const DataDashboardTab: React.FC<DataDashboardTabProps> = ({
  onNavigateTab,
  onFilterQuality,
}) => {
  const { songs } = usePlaylistStore();
  const {
    storageDetails,
    usagePercent,
    qualityStats,
    platformStats,
    healthRadar,
    diagnostics,
    isAnalyzing,
    refreshAnalytics,
  } = useStorageAnalyticsStore();
  const { activeCount, totalSpeedFormatted } = useOfflineDownloadStore();

  useEffect(() => {
    if (storageDetails.totalUsageBytes === 0 && songs.length > 0) {
      refreshAnalytics(songs);
    }
  }, [songs, refreshAnalytics, storageDetails.totalUsageBytes]);

  const summaryCards = [
    {
      title: "已用存储空间",
      value: formatStorageBytes(storageDetails.totalUsageBytes),
      sub: `配额 ${formatStorageBytes(storageDetails.quotaBytes)} (${usagePercent.toFixed(1)}%)`,
      icon: HardDrive,
      color: "from-white/[0.06] to-white/[0.02]",
      border: "border-white/[0.08]",
      iconColor: "text-white/80",
      actionKey: "health_storage",
    },
    {
      title: "曲库总资产",
      value: `${songs.length} 首`,
      sub: `包含本地 ${storageDetails.localMusicCount} 首 · 云端 ${Math.max(0, songs.length - storageDetails.localMusicCount)} 首`,
      icon: Music,
      color: "from-white/[0.06] to-white/[0.02]",
      border: "border-white/[0.08]",
      iconColor: "text-white/80",
      actionKey: "playlists",
    },
    {
      title: "多平台云源",
      value: `${platformStats.netease + platformStats.qq + platformStats.kugou + platformStats.kuwo + platformStats.qishui > 0 ? "5 大平台" : "全网直连"}`,
      sub: "网易云 · QQ音乐 · 酷狗 · 酷我 · 汽水",
      icon: Cloud,
      color: "from-white/[0.06] to-white/[0.02]",
      border: "border-white/[0.08]",
      iconColor: "text-white/80",
      actionKey: "cloud",
    },
    {
      title: "离线就绪曲目",
      value: `${storageDetails.offlineAudioCount} 首`,
      sub: activeCount > 0 ? `下载中 ${activeCount} 首 · 速度 ${totalSpeedFormatted}` : "纯离线即开即播已就绪",
      icon: Download,
      color: "from-white/[0.06] to-white/[0.02]",
      border: "border-white/[0.08]",
      iconColor: "text-white/80",
      actionKey: "downloads",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* 顶部标题与一键刷新 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            全景数据资产与存储看板
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-white/80 border border-white/[0.15]">
              LIVE METRICS
            </span>
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            实时监测 IndexedDB 空间占用、多平台音源分布、音质比率与曲库健康度
          </p>
        </div>

        <button
          type="button"
          onClick={() => refreshAnalytics(songs)}
          disabled={isAnalyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.16] text-white text-xs font-semibold border border-white/[0.12] transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin text-white/90" : ""}`} />
          <span>{isAnalyzing ? "正在诊断..." : "重新体检"}</span>
        </button>
      </div>

      {/* 4 核心指标 Bento 卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={() => onNavigateTab(card.actionKey)}
              className={`p-4 rounded-3xl bg-gradient-to-br ${card.color} border ${card.border} backdrop-blur-2xl transition-all hover:scale-[1.02] hover:border-white/30 cursor-pointer group shadow-[0_10px_30px_rgba(0,0,0,0.4)]`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/60">
                  {card.title}
                </span>
                <div className={`p-2 rounded-2xl bg-white/10 ${card.iconColor} group-hover:scale-110 transition-transform shadow-inner`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white font-mono tracking-tight leading-none mb-1.5">
                {card.value}
              </div>
              <div className="text-[11px] text-white/50 truncate font-sans">
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* 主数据可视化 Grid (2 列大图表) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：存储水波球 + 细分容量占比 (5 栅格) */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-white/80" />
              存储容量与细分配额
            </h4>
            <span className="text-[10px] font-mono text-white/40">
              IndexedDB 沙盒
            </span>
          </div>

          <div className="my-auto py-2">
            <LiquidStorageGauge
              usedBytes={storageDetails.totalUsageBytes}
              quotaBytes={storageDetails.quotaBytes}
              usagePercent={usagePercent}
            />
          </div>

          {/* 细分容量 Breakdown 列表 */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.08] text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]">
              <span className="text-white/60 text-[11px]">本地音频:</span>
              <span className="font-mono text-white font-semibold text-[11px]">
                {formatStorageBytes(storageDetails.localMusicBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]">
              <span className="text-white/60 text-[11px]">网络离线:</span>
              <span className="font-mono text-white font-semibold text-[11px]">
                {formatStorageBytes(storageDetails.offlineAudioBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]">
              <span className="text-white/60 text-[11px]">封面缓存:</span>
              <span className="font-mono text-white/90 font-semibold text-[11px]">
                {formatStorageBytes(storageDetails.coversBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]">
              <span className="text-white/60 text-[11px]">歌词与索引:</span>
              <span className="font-mono text-white/90 font-semibold text-[11px]">
                {formatStorageBytes(storageDetails.lyricsBytes)}
              </span>
            </div>
          </div>
        </div>

        {/* 右侧：音质层级分布与联动筛选 (7 栅格) */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-white/80" />
              音质层级分布与码率分析
            </h4>
            <span className="text-[10px] text-white/40">
              点击柱状条联动筛选
            </span>
          </div>

          <QualityDistributionChart
            stats={qualityStats}
            onSelectQuality={(q) => {
              if (onFilterQuality) onFilterQuality(q);
            }}
          />

          <div className="flex items-center justify-between text-[11px] text-white/60 mt-3 p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <span>✨ 想寻找更多未收录高解析母带？可使用全新「全网聚搜」探索落雪特供源与六大平台。</span>
            <button
              onClick={() => onNavigateTab("lx_search")}
              className="px-3 py-1 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all shrink-0 ml-2 shadow-sm active:scale-95"
            >
              即刻探索 ➔
            </button>
          </div>
        </div>
      </div>

      {/* 底部数据可视化 Grid (平台甜甜圈 + 六维健康雷达) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 多源平台甜甜圈图 (5 栅格) */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-white/80" />
              多平台音源资产构成
            </h4>
            <span className="text-[10px] font-mono text-white/40">
              {songs.length} 首总计
            </span>
          </div>

          <PlatformDonutChart stats={platformStats} />
        </div>

        {/* 曲库健康雷达与自愈建议 (7 栅格) */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <LibraryHealthRadar
            metrics={healthRadar}
            diagnostics={diagnostics}
            onActionClick={(actionKey) => {
              if (actionKey.startsWith("tab-")) {
                const target = actionKey.replace("tab-", "").split("-")[0];
                onNavigateTab(target === "health" ? "health_storage" : target);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
