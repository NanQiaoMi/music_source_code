"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Radio, Sliders, Code2, Activity, Download, HardDrive } from "lucide-react";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { SourceMatrixTab } from "./tabs/SourceMatrixTab";
import { LxScriptsTab } from "./tabs/LxScriptsTab";
import { DiagnosticsTab } from "./tabs/DiagnosticsTab";
import { BackupTab } from "./tabs/BackupTab";
import { OfflineCacheTab } from "./tabs/OfflineCacheTab";

export function SourceManagementModal() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const sources = useSourceConfigStore((state) => state.sources);
  const isManagementModalOpen = useSourceConfigStore((state) => state.isManagementModalOpen);
  const activeManagementTab = useSourceConfigStore((state) => state.activeManagementTab);
  const updateAllHealth = useSourceConfigStore((state) => state.updateAllHealth);
  const syncBuiltinDesktopSources = useSourceConfigStore(
    (state) => state.syncBuiltinDesktopSources
  );
  const closeManagementModal = useSourceConfigStore((state) => state.closeManagementModal);
  const setActiveManagementTab = useSourceConfigStore((state) => state.setActiveManagementTab);
  const _setSourceCredentials = useSourceConfigStore((state) => state.setSourceCredentials);
  const _updateLXScript = useSourceConfigStore((state) => state.updateLXScript);

  // Local states
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseMessage, setDiagnoseMessage] = useState<string | null>(null);

  // 三态接线：把「即发即忘」的同步包成带 loading/error 的可重试任务，再传给 5 个 Tab。
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const runSourceSync = useCallback(async () => {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      await syncBuiltinDesktopSources();
    } catch (e) {
      setSourcesError(e instanceof Error ? e.message : "音源配置同步失败");
    } finally {
      setSourcesLoading(false);
    }
  }, [syncBuiltinDesktopSources]);

  useEffect(() => {
    // 挂载时拉取上游配置：runSourceSync 会在开始/结束时切换 loading，属预期的同步状态更新。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSourceSync();
  }, [runSourceSync]);

  // Run full health check
  const handleRunDiagnose = useCallback(async () => {
    setIsDiagnosing(true);
    setDiagnoseMessage("正在向 7 大音源端点发起并发测速与连通性诊断...");
    try {
      const res = await fetch("/api/sources/diagnose");
      const data = await res.json();
      if (data.health) {
        updateAllHealth(data.health);
        setDiagnoseMessage("体检完成！所有音源连通性已更新至最新状态。");
      } else {
        setDiagnoseMessage("诊断返回异常，请重试。");
      }
    } catch {
      setDiagnoseMessage("诊断请求失败，请检查网络环境。");
    } finally {
      setIsDiagnosing(false);
    }
  }, [updateAllHealth]);

  const sourceList = useMemo(() => Object.values(sources), [sources]);

  if (!isManagementModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="source-management-motion-scope fixed inset-0 z-[99999] flex items-center justify-center p-2.5 sm:p-4 lg:p-6 select-none">
        {/* Backdrop */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : undefined}
          onClick={closeManagementModal}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={
            shouldReduceMotion ? { scale: 1, opacity: 0, y: 0 } : { scale: 0.95, opacity: 0, y: 20 }
          }
          transition={
            shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 30 }
          }
          className="relative w-full max-w-4xl max-h-[90dvh] min-h-0 bg-[#090b13]/95 border border-cyan-200/15 rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-start sm:items-center justify-between gap-3 px-3.5 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 shrink-0 bg-gradient-to-r from-cyan-400/[0.04] via-transparent to-blue-500/[0.05]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 flex items-center justify-center shadow-inner">
                <Radio className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                    全网多音源矩阵与扩展中心
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Matrix v2.0
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  精细管理 7 大官方音源、洛雪自定义 JS 脚本与并行抢答策略
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeManagementModal}
              aria-label="关闭音源管理"
              title="关闭音源管理"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b13] shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            role="group"
            aria-label="音源管理功能"
            className="flex items-center gap-2 px-3.5 sm:px-6 py-2.5 bg-white/[0.01] border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar scrollbar-hide select-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            {[
              { id: "matrix", label: "音源矩阵控制台", icon: Sliders },
              { id: "lx_scripts", label: "洛雪 / 自定义脚本", icon: Code2 },
              { id: "diagnostics", label: "一键健康诊断", icon: Activity },
              { id: "offline_cache", label: "离线缓存管理", icon: Download },
              { id: "backup", label: "预设方案与备份", icon: HardDrive },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeManagementTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    setActiveManagementTab(tab.id as Parameters<typeof setActiveManagementTab>[0])
                  }
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b13] ${
                    isSelected
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/20 border-cyan-200/40"
                      : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white border-white/[0.08]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : "text-white/60"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3 sm:p-6 space-y-5 sm:space-y-6">
            {activeManagementTab === "matrix" && (
              <SourceMatrixTab
                sourceList={sourceList}
                isDiagnosing={isDiagnosing}
                onRunDiagnose={handleRunDiagnose}
                loading={sourcesLoading}
                error={sourcesError}
                onRetry={runSourceSync}
              />
            )}

            {activeManagementTab === "lx_scripts" && (
              <LxScriptsTab loading={sourcesLoading} error={sourcesError} onRetry={runSourceSync} />
            )}

            {activeManagementTab === "diagnostics" && (
              <DiagnosticsTab
                sourceList={sourceList}
                isDiagnosing={isDiagnosing}
                diagnoseMessage={diagnoseMessage}
                onRunDiagnose={handleRunDiagnose}
                loading={sourcesLoading}
                error={sourcesError}
                onRetry={runSourceSync}
              />
            )}

            {activeManagementTab === "backup" && (
              <BackupTab loading={sourcesLoading} error={sourcesError} onRetry={runSourceSync} />
            )}

            {activeManagementTab === "offline_cache" && <OfflineCacheTab />}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
