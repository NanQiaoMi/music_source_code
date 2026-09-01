"use client";

import React, { useState } from "react";
import { PlatformStats } from "@/store/useStorageAnalyticsStore";

interface PlatformDonutChartProps {
  stats: PlatformStats;
  className?: string;
}

export const PlatformDonutChart: React.FC<PlatformDonutChartProps> = ({
  stats,
  className = "",
}) => {
  const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null);

  const total = Math.max(1, stats.total);

  const segments = [
    { id: "netease", name: "网易云音乐", count: stats.netease, color: "#ef4444", bgClass: "bg-red-500" },
    { id: "qq", name: "QQ音乐", count: stats.qq, color: "#10b981", bgClass: "bg-emerald-500" },
    { id: "kugou", name: "酷狗音乐", count: stats.kugou, color: "#06b6d4", bgClass: "bg-cyan-500" },
    { id: "kuwo", name: "酷我音乐", count: stats.kuwo, color: "#f59e0b", bgClass: "bg-amber-500" },
    { id: "qishui", name: "汽水音乐", count: stats.qishui, color: "#38bdf8", bgClass: "bg-sky-400" },
    { id: "local", name: "本地音乐", count: stats.local, color: "#e2e8f0", bgClass: "bg-slate-200" },
  ].filter((s) => s.count > 0);

  const validSegments = segments.length > 0 ? segments : [
    { id: "local", name: "本地/导入", count: total, color: "#e2e8f0", bgClass: "bg-slate-200" },
  ];

  // SVG circle calculation
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const renderedArcs = validSegments.map((seg) => {
    const fraction = seg.count / total;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += fraction * circumference;

    return {
      ...seg,
      fraction,
      percent: (fraction * 100).toFixed(1),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeSegment = hoveredPlatform
    ? renderedArcs.find((s) => s.id === hoveredPlatform)
    : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-6 ${className}`}>
      {/* SVG Donut */}
      <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={strokeWidth}
          />
          {renderedArcs.map((arc) => (
            <circle
              key={arc.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={arc.color}
              strokeWidth={hoveredPlatform === arc.id ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={arc.strokeDasharray}
              strokeDashoffset={arc.strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 cursor-pointer"
              onMouseEnter={() => setHoveredPlatform(arc.id)}
              onMouseLeave={() => setHoveredPlatform(null)}
              style={{
                filter: hoveredPlatform === arc.id ? `drop-shadow(0 0 8px ${arc.color})` : "none",
              }}
            />
          ))}
        </svg>

        {/* Center Hover Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2">
          {activeSegment ? (
            <>
              <span className="text-xs font-bold text-white truncate max-w-[90px]">
                {activeSegment.name}
              </span>
              <span className="text-[13px] font-black text-white font-mono">
                {activeSegment.count} 首
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                {activeSegment.percent}%
              </span>
            </>
          ) : (
            <>
              <span className="text-lg font-black text-white font-mono">
                {total}
              </span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                全网音源
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend Badges */}
      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        {renderedArcs.map((item) => (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredPlatform(item.id)}
            onMouseLeave={() => setHoveredPlatform(null)}
            className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              hoveredPlatform === item.id
                ? "bg-white/15 shadow-sm ring-1 ring-white/20"
                : "bg-white/[0.03] hover:bg-white/[0.07]"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-white/80 font-medium truncate text-[11px]">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
              <span className="font-bold text-white">{item.count}</span>
              <span className="text-white/40">({item.percent}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
