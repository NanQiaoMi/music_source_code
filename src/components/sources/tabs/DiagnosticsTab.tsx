"use client";

import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { SingleSourceConfig } from "@/types/sourceConfig";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { EmptyState, LoadingSkeleton } from "@/components/shared/Glass";

interface DiagnosticsTabProps {
  sourceList: SingleSourceConfig[];
  isDiagnosing: boolean;
  diagnoseMessage: string | null;
  onRunDiagnose: () => void;
  /** 取消入口。外壳尚未接线（诊断循环在 SourceManagementModal 内），未提供时不渲染取消按钮。 */
  onCancel?: () => void;
  /** 0~1 的确定进度。外壳尚未提供逐单元进度，缺省时渲染不确定态进度条。 */
  progress?: number;
  /** 音源列表拉取中。缺省（undefined）时保持原有渲染，由外壳 Task 10 接线。 */
  loading?: boolean;
  /** 拉取失败文案。缺省时不渲染错误态。 */
  error?: string | null;
  /** 错误态「重试」回调。缺省时按钮仍渲染但为空操作。 */
  onRetry?: () => void;
}

export function DiagnosticsTab({
  sourceList,
  isDiagnosing,
  diagnoseMessage,
  onRunDiagnose,
  onCancel,
  progress,
  loading,
  error,
  onRetry,
}: DiagnosticsTabProps) {
  const clampedProgress =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.min(1, Math.max(0, progress))
      : null;
  const percent = clampedProgress === null ? 0 : Math.round(clampedProgress * 100);

  const handleResetDefaults = () => {
    useSourceConfigStore.getState().resetToDefaults();
  };

  // 非阻断错误横幅：仅提示上游故障，不遮挡网格内的实时健康数据。
  const errorBanner = error ? (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-2.5">
      <span className="text-[12.5px] text-rose-200">{error}</span>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onRetry}
          className="h-7 px-3 rounded-full bg-white/10 hover:bg-white/20 text-[12px] text-white transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* TAB 3: 一键健康诊断 */}
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">多音源全链路健康体检仪</h3>
            <p className="text-xs text-white/60 mt-0.5">
              毫秒级测试每个音源的实时网络延迟与可用状态
            </p>
          </div>
          <button
            onClick={onRunDiagnose}
            disabled={isDiagnosing}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${isDiagnosing ? "animate-pulse" : ""}`} />
            <span>{isDiagnosing ? "诊断中..." : "一键全面体检"}</span>
          </button>
        </div>

        {isDiagnosing && (
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <div
              className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden"
              role="progressbar"
              aria-label="体检进度"
              aria-valuemin={0}
              aria-valuemax={100}
              {...(clampedProgress === null ? {} : { "aria-valuenow": percent })}
            >
              <div
                className={`h-full bg-[#2997ff] ${
                  clampedProgress === null
                    ? "w-full animate-pulse"
                    : "transition-[width] duration-200"
                }`}
                style={clampedProgress === null ? undefined : { width: `${percent}%` }}
              />
            </div>
            {clampedProgress !== null && (
              <span className="text-[11px] tabular-nums text-white/55">{percent}%</span>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-[12px] text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                取消
              </button>
            )}
          </div>
        )}

        {diagnoseMessage && <div className="text-xs text-cyan-300/90 px-1">{diagnoseMessage}</div>}

        {/* 三态分派（优先级 loading > 横幅 + （空态 | 网格））。
            顶部标题与进度条保留，仅替换音源网格，保证 Task 7 的进度条逻辑不受影响。
            错误不再阻断：横幅可与空态或正常网格同时出现。 */}
        {loading ? (
          <div data-skeleton="true" className="space-y-3">
            <LoadingSkeleton count={4} variant="card" />
          </div>
        ) : (
          <>
            {errorBanner}
            {sourceList.length === 0 ? (
              <EmptyState
                title="还没有可诊断的音源"
                description="恢复默认配置后即可对 7 大平台通道做全链路健康体检"
                actionLabel="恢复默认"
                onAction={handleResetDefaults}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sourceList.map((src) => {
                  const health = src.health || { status: "untested", latencyMs: 0 };
                  const isNormal = health.status === "normal";
                  const isDegraded = health.status === "degraded";
                  const isError = health.status === "error";

                  return (
                    <div
                      key={src.id}
                      className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${src.dotColor}`} />
                        <div>
                          <div className="text-xs font-semibold text-white">{src.name}</div>
                          <div className="text-[10px] text-white/40">
                            {health.message || "就绪"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {health.latencyMs > 0 && (
                          <span className="font-mono text-xs text-white/80">
                            {health.latencyMs} ms
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            isNormal
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : isDegraded
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : isError
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                  : "bg-white/10 text-white/60 border-white/10"
                          }`}
                        >
                          {isNormal && <CheckCircle2 className="w-3 h-3" />}
                          {isDegraded && <AlertTriangle className="w-3 h-3" />}
                          {isError && <XCircle className="w-3 h-3" />}
                          {isNormal ? "优质" : isDegraded ? "良好" : isError ? "异常" : "未测试"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
