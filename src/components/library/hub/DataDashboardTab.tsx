"use client";

import React, { useEffect } from "react";
import { useStorageAnalyticsStore, formatStorageBytes } from "@/store/useStorageAnalyticsStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { SettingSection, SettingRow, StatusDot, type StatusKind } from "@/components/ui/settings";
import { LiquidStorageGauge } from "./LiquidStorageGauge";
import { QualityDistributionChart } from "./QualityDistributionChart";
import { PlatformDonutChart } from "./PlatformDonutChart";
import { LibraryHealthRadar } from "./LibraryHealthRadar";
import { HardDrive, Cloud, RefreshCw, Zap } from "lucide-react";

interface DataDashboardTabProps {
  onNavigateTab: (tabKey: string) => void;
  onFilterQuality?: (quality: string | null) => void;
}

/** 覆盖率类指标：越高越好，按阈值落到四种状态位 */
const coverageTone = (score: number): StatusKind => {
  if (score >= 90) return "ok";
  if (score >= 75) return "warn";
  return "error";
};

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

  // 与音源管理、顶栏同源的账号状态：逐字段订阅，避免选择器返回新对象触发重渲染
  const neteaseUser = useUserAccountStore((state) => state.neteaseUser);
  const qqUser = useUserAccountStore((state) => state.qqUser);
  const kugouUser = useUserAccountStore((state) => state.kugouUser);
  const kuwoUser = useUserAccountStore((state) => state.kuwoUser);
  const qishuiUser = useUserAccountStore((state) => state.qishuiUser);

  useEffect(() => {
    if (storageDetails.totalUsageBytes === 0 && songs.length > 0) {
      refreshAnalytics(songs);
    }
  }, [songs, refreshAnalytics, storageDetails.totalUsageBytes]);

  const usedText = formatStorageBytes(storageDetails.totalUsageBytes);
  const quotaText = formatStorageBytes(storageDetails.quotaBytes);
  // 阈值与 useStorageAnalyticsStore 生成的「存储空间」诊断保持一致，避免同屏两种口径
  const usageTone: StatusKind = usagePercent > 80 ? "error" : usagePercent > 60 ? "warn" : "ok";

  const platforms = [
    {
      id: "netease",
      name: "网易云音乐",
      loggedIn: Boolean(neteaseUser?.loggedIn),
      nickname: neteaseUser?.nickname,
    },
    { id: "qq", name: "QQ音乐", loggedIn: Boolean(qqUser?.loggedIn), nickname: qqUser?.nickname },
    {
      id: "kugou",
      name: "酷狗音乐",
      loggedIn: Boolean(kugouUser?.loggedIn),
      nickname: kugouUser?.nickname,
    },
    {
      id: "kuwo",
      name: "酷我音乐",
      loggedIn: Boolean(kuwoUser?.loggedIn),
      nickname: kuwoUser?.nickname,
    },
    {
      id: "qishui",
      name: "汽水音乐",
      loggedIn: Boolean(qishuiUser?.loggedIn),
      nickname: qishuiUser?.nickname,
    },
  ];
  const loggedInCount = platforms.filter((p) => p.loggedIn).length;

  // 曲库健康：数量类指标由健康雷达的覆盖率反推，与雷达展示的百分比口径一致
  const missingCover = Math.max(
    0,
    songs.length - Math.round((healthRadar.coverCoverage / 100) * songs.length)
  );
  const brokenSource = Math.max(
    0,
    songs.length - Math.round((healthRadar.activeSourceRate / 100) * songs.length)
  );
  const healthItems: { label: string; value: string; tone: StatusKind }[] = [
    {
      label: "曲库总资产",
      value: `${songs.length} 首`,
      tone: songs.length > 0 ? "ok" : "idle",
    },
    {
      label: "缺失封面",
      value: `${missingCover} 首`,
      tone: coverageTone(healthRadar.coverCoverage),
    },
    {
      label: "无法解析",
      value: `${brokenSource} 首`,
      tone: coverageTone(healthRadar.activeSourceRate),
    },
  ];

  const storageBreakdown = [
    { label: "本地音频", bytes: storageDetails.localMusicBytes, strong: true },
    { label: "网络离线", bytes: storageDetails.offlineAudioBytes, strong: true },
    { label: "封面缓存", bytes: storageDetails.coversBytes, strong: false },
    { label: "歌词与索引", bytes: storageDetails.lyricsBytes, strong: false },
  ];

  return (
    // pb 是播放条避让高度：播放条固定在底部，内容根容器要留出这段空白
    <div className="animate-fade-in select-none pb-[104px]">
      {/* 顶部标题与一键刷新 */}
      <div className="flex items-center justify-between mb-6">
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

      {/* ① 存储与配额 */}
      <SettingSection
        title="存储与配额"
        description="本地数据卷与配额占用"
        action={
          <span className="text-[11px] text-white/40 tabular-nums">
            {`${usedText} / ${quotaText}`}
          </span>
        }
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-white/70" />
                <span className="text-xs font-medium text-white/60">已用存储空间</span>
                <StatusDot status={usageTone} label={`${usagePercent.toFixed(1)}%`} />
              </div>
              <div className="mt-2 text-3xl font-black text-white font-mono tracking-tight leading-none">
                {usedText}
              </div>
              <div className="mt-1.5 text-[11px] text-white/50 tabular-nums">{`配额 ${quotaText}`}</div>
            </div>
            <span className="shrink-0 text-[10px] font-mono text-white/40">IndexedDB 沙盒</span>
          </div>

          <div className="my-3">
            <LiquidStorageGauge
              usedBytes={storageDetails.totalUsageBytes}
              quotaBytes={storageDetails.quotaBytes}
              usagePercent={usagePercent}
            />
          </div>

          {/* 细分容量 Breakdown 列表 */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.08] text-xs">
            {storageBreakdown.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]"
              >
                <span className="text-white/60 text-[11px]">{item.label}:</span>
                <span
                  className={`font-mono font-semibold text-[11px] ${
                    item.strong ? "text-white" : "text-white/90"
                  }`}
                >
                  {formatStorageBytes(item.bytes)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.05]">
          <SettingRow
            title="离线就绪曲目"
            subtitle={
              activeCount > 0
                ? `下载中 ${activeCount} 首 · 速度 ${totalSpeedFormatted}`
                : "纯离线即开即播已就绪"
            }
            status={storageDetails.offlineAudioCount > 0 ? "ok" : "idle"}
            trailing={
              <span className="text-[12.5px] font-semibold tabular-nums text-white/85">
                {`${storageDetails.offlineAudioCount} 首`}
              </span>
            }
          />
        </div>
      </SettingSection>

      {/* ② 音质与编码 */}
      <SettingSection title="音质与编码" description="按码率分档统计曲目数量">
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-white/80" />
              音质层级分布与码率分析
            </h4>
            <span className="text-[10px] text-white/40">点击柱状条联动筛选</span>
          </div>

          <QualityDistributionChart
            stats={qualityStats}
            onSelectQuality={(q) => {
              if (onFilterQuality) onFilterQuality(q);
            }}
          />

          <div className="flex items-center justify-between text-[11px] text-white/60 mt-3 p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <span>
              ✨ 想寻找更多未收录高解析母带？可使用全新「全网聚搜」探索落雪特供源与六大平台。
            </span>
            <button
              onClick={() => onNavigateTab("lx_search")}
              className="px-3 py-1 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all shrink-0 ml-2 shadow-sm active:scale-95"
            >
              即刻探索 ➔
            </button>
          </div>
        </div>
      </SettingSection>

      {/* ③ 云端账号 */}
      <SettingSection
        title="云端账号"
        description="与音源管理同源的登录状态"
        action={
          <span className="text-[11px] text-white/40 tabular-nums">
            {`${loggedInCount} / ${platforms.length} 已登录`}
          </span>
        }
      >
        {platforms.map((p) => (
          <SettingRow
            key={p.id}
            title={p.name}
            status={p.loggedIn ? "ok" : "idle"}
            trailing={
              <span className="text-[12px] text-white/45">
                {p.loggedIn ? p.nickname || "已登录" : "未登录"}
              </span>
            }
          />
        ))}

        <div className="border-t border-white/[0.05] p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-white/80" />
              多平台音源资产构成
            </h4>
            <span className="text-[10px] font-mono text-white/40">{songs.length} 首总计</span>
          </div>

          <PlatformDonutChart stats={platformStats} />
        </div>
      </SettingSection>

      {/* ④ 曲库健康 */}
      <SettingSection title="曲库健康" description="总数、缺失封面、无法解析">
        {healthItems.map((h) => (
          <SettingRow
            key={h.label}
            title={h.label}
            status={h.tone}
            trailing={
              <span className="text-[12.5px] font-semibold tabular-nums text-white/85">
                {h.value}
              </span>
            }
          />
        ))}

        <div className="border-t border-white/[0.05] p-5">
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
      </SettingSection>
    </div>
  );
};
