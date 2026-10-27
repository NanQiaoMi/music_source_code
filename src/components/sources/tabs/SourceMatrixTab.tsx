"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw, Zap, Lock } from "lucide-react";
import { useSourceConfigStore, isSourceUsable } from "@/store/sourceConfigStore";
import { useUserAccountStore, isPlatformLoggedIn, PlatformType } from "@/store/userAccountStore";
import { QualityTier, SingleSourceConfig } from "@/types/sourceConfig";
import type { MusicSourceId } from "@/types/sourceConfig";
import {
  ErrorBanner,
  SettingSection,
  SettingRow,
  SourceHealthSummary,
  type HealthRow,
  type StatusKind,
} from "@/components/ui/settings";
import { EmptyState, LoadingSkeleton } from "@/components/shared/Glass";

const QUALITY_OPTIONS: { value: QualityTier; label: string; tag: string }[] = [
  { value: "auto", label: "自适应最高 (Auto)", tag: "AUTO" },
  { value: "hires", label: "母带 Hi-Res / DSD", tag: "HI-RES" },
  { value: "flac", label: "无损 FLAC (96k/24bit)", tag: "FLAC" },
  { value: "320k", label: "极高品 320kbps", tag: "320K" },
  { value: "128k", label: "标准 128kbps (省流)", tag: "128K" },
];

/** 需要登录后才能解码的平台 */
const OFFICIAL_IDS: MusicSourceId[] = ["netease", "qq", "kugou", "kuwo", "qishui"];
/** 本地母带与洛雪自定义脚本，无需平台登录 */
const EXTENDED_IDS: MusicSourceId[] = ["local", "lx_custom"];

interface SourceMatrixTabProps {
  sourceList: SingleSourceConfig[];
  isDiagnosing: boolean;
  onRunDiagnose: () => void;
  /** 上游配置拉取中。缺省（undefined）时保持原有渲染，由外壳 Task 10 接线。 */
  loading?: boolean;
  /** 拉取失败文案。缺省时不渲染错误态。 */
  error?: string | null;
  /** 错误态「重试」回调。缺省时按钮仍渲染但为空操作。 */
  onRetry?: () => void;
}

export function SourceMatrixTab({
  sourceList,
  isDiagnosing,
  onRunDiagnose,
  loading,
  error,
  onRetry,
}: SourceMatrixTabProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const resolutionMode = useSourceConfigStore((state) => state.resolutionMode);
  const setResolutionMode = useSourceConfigStore((state) => state.setResolutionMode);
  const toggleSource = useSourceConfigStore((state) => state.toggleSource);
  const setSourceQuality = useSourceConfigStore((state) => state.setSourceQuality);
  const setSourcePriority = useSourceConfigStore((state) => state.setSourcePriority);
  const setSourceConfig = useSourceConfigStore((state) => state.setSourceConfig);
  const resetToDefaults = useSourceConfigStore((state) => state.resetToDefaults);

  /** 同一时刻只展开一行：描述、登录入口与配置表单都收在这里面 */
  const [expandedId, setExpandedId] = useState<MusicSourceId | null>(null);

  // 非阻断错误横幅：同步失败时挂在正常内容上方，不再整块替换列表
  // （本地 store 里本就有的音源数据应当照常显示，仅额外提示上游故障）。
  const errorBanner = error ? (
    <ErrorBanner message={error} onRetry={onRetry}>
      <button
        type="button"
        onClick={resetToDefaults}
        className="h-7 px-3 rounded-full bg-white/[0.06] hover:bg-white/10 text-[12px] text-white/70 transition-colors"
      >
        恢复默认
      </button>
    </ErrorBanner>
  ) : null;

  // 三态分派（优先级 loading > 横幅 + （空态 | 正常内容））。
  // 错误不再阻断：横幅可与空态或正常矩阵同时出现。
  if (loading) {
    return (
      <div data-skeleton="true" className="space-y-3">
        <LoadingSkeleton count={4} variant="card" />
      </div>
    );
  }

  if (sourceList.length === 0) {
    return (
      <>
        {errorBanner}
        <EmptyState
          title="还没有可用音源"
          description="导入或恢复默认配置后即可管理 7 大平台通道"
          actionLabel="恢复默认"
          onAction={resetToDefaults}
        />
      </>
    );
  }

  const sourceById = new Map(sourceList.map((src) => [src.id, src]));

  const statusOf = (src: SingleSourceConfig): StatusKind => {
    if (!isSourceUsable(src.id)) return "idle";
    switch (src.health?.status) {
      case "normal":
        return "ok";
      case "degraded":
        return "warn";
      case "error":
        return "error";
      default:
        return "idle";
    }
  };

  const renderRow = (id: MusicSourceId) => {
    const src = sourceById.get(id);
    if (!src) return null;

    const isNetwork = id !== "local" && id !== "lx_custom";
    const isLogged = isNetwork ? isPlatformLoggedIn(id) : true;
    const isEnabled = src.enabled && isLogged;
    const expanded = expandedId === id;
    const latencyMs = src.health && src.health.latencyMs > 0 ? src.health.latencyMs : undefined;

    const openLogin = () => {
      // 未登录时点击开关 / 登录入口自动定向打开登录弹窗
      useUserAccountStore.getState().setActivePlatform(id as PlatformType);
      useUserAccountStore.getState().setIsAccountModalOpen(true);
    };

    const handleToggle = () => {
      if (isNetwork && !isLogged) {
        openLogin();
        return;
      }
      toggleSource(id);
    };

    return (
      <SettingRow
        key={id}
        title={src.name}
        badge={!isLogged ? "需登录" : undefined}
        status={statusOf(src)}
        latencyMs={latencyMs}
        description={src.description}
        control={
          <button
            type="button"
            onClick={handleToggle}
            aria-label={`${src.name} 开关`}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
              isEnabled ? "bg-cyan-500" : "bg-white/15"
            }`}
          >
            <motion.div
              layout={!shouldReduceMotion}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 500, damping: 30 }
              }
              className={`w-4 h-4 rounded-full bg-white absolute top-1 shadow-md ${
                isEnabled ? "right-1" : "left-1"
              }`}
            />
          </button>
        }
        expandable
        expanded={expanded}
        onToggle={() => setExpandedId((prev) => (prev === id ? null : id))}
      >
        {/* 以下全部只在展开态渲染，保证默认态每行等高 */}
        <p className="text-[12px] leading-relaxed text-white/50 mb-3">{src.description}</p>

        {!isLogged && (
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={openLogin}
              className="px-2 py-1 rounded-lg bg-[#0071e3]/20 hover:bg-[#0071e3]/30 text-[#2997ff] text-[11px] font-medium border border-[#0071e3]/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>去登录</span>
            </button>
          </div>
        )}

        {isEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">音质偏好</label>
              <select
                value={src.qualityPreference}
                onChange={(e) => setSourceQuality(src.id, e.target.value as QualityTier)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:border-cyan-300/50 cursor-pointer"
              >
                {QUALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#121626]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-white/40 block mb-1">抢答优先级 (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={src.priority}
                onChange={(e) => setSourcePriority(src.id, parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:border-cyan-300/50"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="text-[10px] text-white/40 block mb-1">
                自定义镜像 / 反代 API 基址 (可选)
              </label>
              <input
                type="text"
                placeholder="留空使用默认服务端代理 (如 https://proxy.music.com)"
                value={src.customApiBase}
                onChange={(e) => setSourceConfig(src.id, { customApiBase: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:border-cyan-300/50 placeholder-white/25"
              />
            </div>
          </div>
        )}
      </SettingRow>
    );
  };
  /** 顶部健康摘要的数据源：与卡片行共用 statusOf，避免两套状态映射口径不一致 */
  const healthRows: HealthRow[] = sourceList.map((src) => ({
    id: src.id,
    name: src.name,
    status: statusOf(src),
    latencyMs:
      src.health.status === "untested" || !src.health.lastChecked ? null : src.health.latencyMs,
  }));

  return (
    <>
      {errorBanner}
      <SourceHealthSummary
        sources={healthRows}
        isDiagnosing={isDiagnosing}
        onRunDiagnose={onRunDiagnose}
      />

      {/* TAB 1: 音源矩阵控制台 */}
      <div className="space-y-5">
        {/* 🚀 解析链路通道选择器 */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/30 to-purple-950/30 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-inner">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">核心播放链路模式</span>
            </div>
            <p className="text-xs text-white/50 mt-1">选择歌曲播放时的底层音源嗅探与解析策略</p>
          </div>

          <div className="flex items-center bg-black/50 border border-white/10 p-1 rounded-2xl shrink-0">
            <button
              type="button"
              onClick={() => setResolutionMode("hybrid_racing")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                resolutionMode === "hybrid_racing"
                  ? "bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white shadow-md shadow-cyan-500/25 border border-cyan-400/40"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span>⚡</span>
              <span>通道一：全网智能聚合竞速</span>
            </button>
            <button
              type="button"
              onClick={() => setResolutionMode("lx_only")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                resolutionMode === "lx_only"
                  ? "bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white shadow-md shadow-purple-500/25 border border-purple-400/40"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span>📜</span>
              <span>通道二：纯粹落雪音源专属</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50 font-medium">
            已启用 {sourceList.filter((s) => s.enabled).length} / {sourceList.length} 个音源通道
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onRunDiagnose}
              disabled={isDiagnosing}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isDiagnosing ? "animate-spin" : ""}`} />
              <span>实时测速</span>
            </button>
          </div>
        </div>

        <SettingSection title="官方音源" description="需要登录后才能解码的平台">
          {OFFICIAL_IDS.map(renderRow)}
        </SettingSection>

        <SettingSection title="扩展" description="本地母带与洛雪自定义脚本">
          {EXTENDED_IDS.map(renderRow)}
        </SettingSection>
      </div>
    </>
  );
}
