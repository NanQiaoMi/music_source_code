"use client";

import React from "react";
import { QualityStats } from "@/store/useStorageAnalyticsStore";
import { Sparkles, Disc, Radio, Music } from "lucide-react";

interface QualityDistributionChartProps {
  stats: QualityStats;
  selectedQuality?: string | null;
  onSelectQuality?: (quality: string | null) => void;
  className?: string;
}

export const QualityDistributionChart: React.FC<QualityDistributionChartProps> = ({
  stats,
  selectedQuality,
  onSelectQuality,
  className = "",
}) => {
  const total = stats.total || 1;

  const items = [
    {
      id: "hires",
      label: "Hi-Res 母带",
      sub: "96kHz / 24bit",
      count: stats.hiresCount,
      percent: ((stats.hiresCount / total) * 100).toFixed(1),
      icon: Sparkles,
      color: "from-white to-white/80",
      glowColor: "rgba(255, 255, 255, 0.25)",
      borderColor: "border-white/40",
      textColor: "text-white",
    },
    {
      id: "lossless",
      label: "无损 FLAC",
      sub: "44.1kHz / 16bit",
      count: stats.flacCount,
      percent: ((stats.flacCount / total) * 100).toFixed(1),
      icon: Disc,
      color: "from-white/85 to-white/50",
      glowColor: "rgba(255, 255, 255, 0.18)",
      borderColor: "border-white/30",
      textColor: "text-white/90",
    },
    {
      id: "320k",
      label: "极高品质",
      sub: "320 kbps MP3",
      count: stats.high320kCount,
      percent: ((stats.high320kCount / total) * 100).toFixed(1),
      icon: Radio,
      color: "from-white/55 to-white/30",
      glowColor: "rgba(255, 255, 255, 0.12)",
      borderColor: "border-white/20",
      textColor: "text-white/75",
    },
    {
      id: "128k",
      label: "标准码率",
      sub: "128 kbps",
      count: stats.standard128kCount,
      percent: ((stats.standard128kCount / total) * 100).toFixed(1),
      icon: Music,
      color: "from-white/30 to-white/10",
      glowColor: "rgba(255, 255, 255, 0.06)",
      borderColor: "border-white/15",
      textColor: "text-white/50",
    },
  ];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = selectedQuality === item.id;
        const widthPct = Math.max(4, Math.min(100, (item.count / total) * 100));

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (onSelectQuality) {
                onSelectQuality(isSelected ? null : item.id);
              }
            }}
            className={`w-full text-left p-2.5 rounded-2xl border transition-all relative overflow-hidden group cursor-pointer ${
              isSelected
                ? `bg-white/[0.12] ${item.borderColor} shadow-[0_0_20px_${item.glowColor}] ring-1 ring-white/30`
                : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.18]"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1.5 relative z-10">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg bg-white/[0.08] ${item.textColor}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-white tracking-tight">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-white/40 ml-1.5 font-mono">
                    {item.sub}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white font-mono">
                  {item.count} 首
                </span>
                <span className="text-[11px] font-mono text-white/50 w-11 text-right">
                  {item.percent}%
                </span>
              </div>
            </div>

            {/* Visual Bar Track */}
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5 relative z-10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700 shadow-sm`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
};
