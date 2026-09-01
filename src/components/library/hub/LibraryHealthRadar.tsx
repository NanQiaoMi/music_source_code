"use client";

import React from "react";
import { HealthRadarMetrics, DiagnosticItem } from "@/store/useStorageAnalyticsStore";
import { Activity, ShieldCheck, AlertTriangle, Sparkles, CheckCircle2 } from "lucide-react";

interface LibraryHealthRadarProps {
  metrics: HealthRadarMetrics;
  diagnostics: DiagnosticItem[];
  onActionClick?: (actionKey: string) => void;
  className?: string;
}

export const LibraryHealthRadar: React.FC<LibraryHealthRadarProps> = ({
  metrics,
  diagnostics,
  onActionClick,
  className = "",
}) => {
  // 6 dimensions: 无损率、封面率、歌词率、有效源、去重度、离线率
  const dimensions = [
    { label: "无损覆盖", value: metrics.losslessRate },
    { label: "封面完整", value: metrics.coverCoverage },
    { label: "歌词匹配", value: metrics.lyricsCoverage },
    { label: "音源可用", value: metrics.activeSourceRate },
    { label: "去重健康", value: metrics.dedupHealth },
    { label: "离线就绪", value: metrics.offlineRate },
  ];

  const size = 200;
  const center = size / 2;
  const maxRadius = 75;
  const sides = dimensions.length;
  const angleStep = (Math.PI * 2) / sides;

  // Compute radar polygon points
  const points = dimensions.map((dim, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (Math.max(10, Math.min(100, dim.value)) / 100) * maxRadius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  // Grid level webs
  const levels = [0.33, 0.66, 1.0];

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 75) return "text-white border-white/20 bg-white/10";
    if (score >= 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <div className={`flex flex-col xl:flex-row items-center gap-6 ${className}`}>
      {/* Radar Graphic */}
      <div className="relative w-52 h-52 shrink-0 flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background web rings */}
          {levels.map((lvl, lIdx) => {
            const levelPoints = dimensions.map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = lvl * maxRadius;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ");

            return (
              <polygon
                key={lIdx}
                points={levelPoints}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* Axis lines */}
          {dimensions.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + maxRadius * Math.cos(angle);
            const y = center + maxRadius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* Data Filled Polygon */}
          <polygon
            points={points}
            fill="rgba(255, 255, 255, 0.18)"
            stroke="#ffffff"
            strokeWidth="1.5"
            style={{ filter: "drop-shadow(0 0 10px rgba(255, 255, 255, 0.35))" }}
          />

          {/* Point Dots */}
          {dimensions.map((dim, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const r = (Math.max(10, Math.min(100, dim.value)) / 100) * maxRadius;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);

            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill="#ffffff"
                stroke="#666666"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>

        {/* Center Score Badge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-xl font-black text-white font-mono drop-shadow">
            {metrics.overallScore}
          </span>
          <span className="text-[9px] uppercase font-bold text-white/40 tracking-wider">
            体检总分
          </span>
        </div>
      </div>

      {/* Diagnostics List & Optimization Cards */}
      <div className="flex flex-col gap-2.5 w-full flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/80" />
            <h4 className="text-xs font-bold text-white tracking-tight">
              曲库健康诊断与优化
            </h4>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getScoreColor(metrics.overallScore)} font-mono`}>
            {metrics.overallScore >= 90 ? "状态极佳" : metrics.overallScore >= 75 ? "运行良好" : "建议体检"}
          </span>
        </div>

        {diagnostics.length > 0 ? (
          diagnostics.map((item) => (
            <div
              key={item.id}
              className={`flex items-start justify-between p-2.5 rounded-2xl border backdrop-blur-xl transition-all ${
                item.type === "danger"
                  ? "bg-rose-500/[0.06] border-rose-500/25"
                  : item.type === "warning"
                  ? "bg-amber-500/[0.06] border-amber-500/25"
                  : "bg-white/[0.04] border-white/[0.08] hover:border-white/[0.16]"
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 pr-2">
                {item.type === "danger" || item.type === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white tracking-tight leading-tight">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-white/50 leading-normal mt-0.5 line-clamp-2">
                    {item.message}
                  </p>
                </div>
              </div>

              {item.actionText && item.actionKey ? (
                <button
                  type="button"
                  onClick={() => onActionClick?.(item.actionKey!)}
                  className="px-3 py-1 rounded-xl bg-white/[0.12] hover:bg-white/[0.22] text-white font-medium text-[11px] border border-white/[0.15] transition-all active:scale-95 shrink-0 whitespace-nowrap cursor-pointer shadow-sm"
                >
                  {item.actionText}
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>全量曲库指标健康，无损坏或冗余文件。</span>
          </div>
        )}
      </div>
    </div>
  );
};
