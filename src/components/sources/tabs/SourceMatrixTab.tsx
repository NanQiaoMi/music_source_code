"use client";

import { motion } from "framer-motion";
import { RefreshCw, Zap, Lock } from "lucide-react";
import { useSourceConfigStore, isSourceUsable } from "@/store/sourceConfigStore";
import { useUserAccountStore, isPlatformLoggedIn, PlatformType } from "@/store/userAccountStore";
import { QualityTier, SingleSourceConfig } from "@/types/sourceConfig";

const QUALITY_OPTIONS: { value: QualityTier; label: string; tag: string }[] = [
  { value: "auto", label: "自适应最高 (Auto)", tag: "AUTO" },
  { value: "hires", label: "母带 Hi-Res / DSD", tag: "HI-RES" },
  { value: "flac", label: "无损 FLAC (96k/24bit)", tag: "FLAC" },
  { value: "320k", label: "极高品 320kbps", tag: "320K" },
  { value: "128k", label: "标准 128kbps (省流)", tag: "128K" },
];

interface SourceMatrixTabProps {
  sourceList: SingleSourceConfig[];
  isDiagnosing: boolean;
  onRunDiagnose: () => void;
}

export function SourceMatrixTab({ sourceList, isDiagnosing, onRunDiagnose }: SourceMatrixTabProps) {
  const {
    resolutionMode,
    setResolutionMode,
    toggleSource,
    setSourceQuality,
    setSourcePriority,
    setSourceConfig,
  } = useSourceConfigStore();

  return (
    <>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sourceList.map((src) => {
            const isNetwork = src.id !== "local" && src.id !== "lx_custom";
            const isLogged = isNetwork ? isPlatformLoggedIn(src.id) : true;
            const isUsable = isSourceUsable(src.id);
            const isEnabled = src.enabled && isLogged;

            const handleToggle = () => {
              if (isNetwork && !isLogged) {
                // 未登录时点击开关自动定向打开登录弹窗
                useUserAccountStore.getState().setActivePlatform(src.id as PlatformType);
                useUserAccountStore.getState().setIsAccountModalOpen(true);
                return;
              }
              toggleSource(src.id);
            };

            return (
              <div
                key={src.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isUsable
                    ? "bg-white/[0.04] border-white/20 shadow-md"
                    : "bg-white/[0.01] border-white/5 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${src.dotColor} shadow-sm`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{src.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${src.badgeColor}`}
                        >
                          {src.badgeName}
                        </span>
                        {isNetwork && !isLogged && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Lock className="w-2.5 h-2.5" />
                            <span>需登录解锁</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/45 mt-0.5 line-clamp-1">
                        {src.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isNetwork && !isLogged && (
                      <button
                        type="button"
                        onClick={() => {
                          useUserAccountStore.getState().setActivePlatform(src.id as PlatformType);
                          useUserAccountStore.getState().setIsAccountModalOpen(true);
                        }}
                        className="px-2 py-1 rounded-lg bg-[#0071e3]/20 hover:bg-[#0071e3]/30 text-[#2997ff] text-[11px] font-medium border border-[#0071e3]/40 transition-colors"
                      >
                        去登录
                      </button>
                    )}

                    {/* Switch toggle */}
                    <button
                      type="button"
                      onClick={handleToggle}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                        isEnabled ? "bg-cyan-500" : "bg-white/15"
                      }`}
                    >
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 shadow-md ${
                          isEnabled ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Config Controls */}
                {isEnabled && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                    <div>
                      <label className="text-[10px] text-white/40 block mb-1">音质偏好</label>
                      <select
                        value={src.qualityPreference}
                        onChange={(e) => setSourceQuality(src.id, e.target.value as QualityTier)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none cursor-pointer"
                      >
                        {QUALITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-[#121626]">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-white/40 block mb-1">
                        抢答优先级 (1-10)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={src.priority}
                        onChange={(e) =>
                          setSourcePriority(src.id, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-white/40 block mb-1">
                        自定义镜像 / 反代 API 基址 (可选)
                      </label>
                      <input
                        type="text"
                        placeholder="留空使用默认服务端代理 (如 https://proxy.music.com)"
                        value={src.customApiBase}
                        onChange={(e) => setSourceConfig(src.id, { customApiBase: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-[11px] focus:outline-none placeholder-white/25"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
