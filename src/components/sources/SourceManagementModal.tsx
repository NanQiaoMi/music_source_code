"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Radio, Sliders, Code2, Activity, Download, HardDrive } from "lucide-react";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { SourceMatrixTab } from "./tabs/SourceMatrixTab";
import { LxScriptsTab } from "./tabs/LxScriptsTab";
import { DiagnosticsTab } from "./tabs/DiagnosticsTab";
import { BackupTab } from "./tabs/BackupTab";
import { OfflineCacheTab } from "./tabs/OfflineCacheTab";

export function SourceManagementModal() {
  const {
    sources,
    isManagementModalOpen,
    activeManagementTab,
    updateAllHealth,
    syncBuiltinDesktopSources,
    closeManagementModal,
    setActiveManagementTab,
    setSourceCredentials: _setSourceCredentials,
    updateLXScript: _updateLXScript,
  } = useSourceConfigStore();

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
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeManagementModal}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0f1d]/95 border border-white/15 rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 flex items-center justify-center shadow-inner">
                <Radio className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">
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
              onClick={closeManagementModal}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            className="flex items-center gap-2 px-6 py-2.5 bg-white/[0.01] border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar scrollbar-hide select-none"
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
                  onClick={() =>
                    setActiveManagementTab(tab.id as Parameters<typeof setActiveManagementTab>[0])
                  }
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-white text-black font-semibold shadow-lg shadow-white/10"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : "text-white/60"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
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

            {activeManagementTab === "offline_cache" && (
              <OfflineCacheTab
                loading={sourcesLoading}
                error={sourcesError}
                onRetry={runSourceSync}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
