"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Musical DNA Radar Chart
 * Visualizes the balance between different musical qualities or genres
 */
export const MusicalDNARadar: React.FC<{
  data: Record<string, number>;
  labels: string[];
}> = ({ data, labels }) => {
  const size = 300;
  const center = size / 2;
  const radius = size * 0.4;

  // Normalize data to 0-1 range (simplified for demo if data is sparse)
  const points = labels.map((label, i) => {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const value = Math.max(0.1, Math.min(1, (data[label] || 0) / 100 + 0.2)); // Mock normalization
    const x = center + radius * value * Math.cos(angle);
    const y = center + radius * value * Math.sin(angle);
    return { x, y, label, angle };
  });

  const pathData = `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")} Z`;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Background Grids */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => (
          <circle
            key={r}
            cx={center}
            cy={center}
            r={radius * r}
            fill="none"
            stroke="white"
            strokeOpacity="0.1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Axes */}
        {points.map((p, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(p.angle)}
            y2={center + radius * Math.sin(p.angle)}
            stroke="white"
            strokeOpacity="0.1"
          />
        ))}

        {/* Data Shape */}
        <motion.path
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          d={pathData}
          fill="url(#radarGradient)"
          fillOpacity="0.3"
          stroke="#f59e0b"
          strokeWidth="2"
        />

        {/* Points */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#f59e0b"
            filter="drop-shadow(0 0 4px rgba(245, 158, 11, 0.8))"
          />
        ))}

        {/* Labels */}
        {points.map((p, i) => {
          const labelX = center + (radius + 20) * Math.cos(p.angle);
          const labelY = center + (radius + 20) * Math.sin(p.angle);
          return (
            <text
              key={i}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fillOpacity="0.6"
              fontSize="10"
              fontWeight="medium"
            >
              {p.label}
            </text>
          );
        })}

        <defs>
          <radialGradient id="radarGradient">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.6" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * Listening Clock (Circular 24h Activity)
 * A circular representation of activity intensity across 24 hours
 */
export const ListeningClock: React.FC<{ hourlyData: Record<number, number> }> = ({
  hourlyData,
}) => {
  const size = 200;
  const center = size / 2;
  const radius = size * 0.4;
  const maxCount = Math.max(...Object.values(hourlyData), 1);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Clock Face */}
        <circle
          cx={center}
          cy={center}
          r={radius + 10}
          fill="none"
          stroke="white"
          strokeOpacity="0.05"
          strokeWidth="2"
        />

        {/* Hour Markers */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (Math.PI * 2 * i) / 12 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center + (radius + 5) * Math.cos(angle)}
              y1={center + (radius + 5) * Math.sin(angle)}
              x2={center + (radius + 10) * Math.cos(angle)}
              y2={center + (radius + 10) * Math.sin(angle)}
              stroke="white"
              strokeOpacity="0.2"
            />
          );
        })}

        {/* Data Bars */}
        {Array.from({ length: 24 }).map((_, hour) => {
          const count = hourlyData[hour] || 0;
          const intensity = count / maxCount;
          const angle = (Math.PI * 2 * hour) / 24 - Math.PI / 2;
          const barLength = 5 + intensity * 25;

          return (
            <motion.line
              key={hour}
              initial={{ x2: center + radius * Math.cos(angle) }}
              animate={{ x2: center + (radius + barLength) * Math.cos(angle) }}
              transition={{ duration: 1, delay: hour * 0.02 }}
              x1={center + radius * Math.cos(angle)}
              y1={center + radius * Math.sin(angle)}
              y2={center + (radius + barLength) * Math.sin(angle)}
              stroke={hour >= 6 && hour < 18 ? "#fbbf24" : "#60a5fa"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeOpacity={0.4 + intensity * 0.6}
            />
          );
        })}

        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="12"
          fontWeight="bold"
        >
          24H
        </text>
      </svg>
    </div>
  );
};

/**
 * Listening Heatmap (24h Activity)
 * Shows intensity of listening across different hours of the day
 */
export const ListeningHeatmap: React.FC<{ hourlyData: Record<number, number> }> = ({
  hourlyData,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxCount = Math.max(...Object.values(hourlyData), 1);

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-12 gap-2">
        {hours.map((hour) => {
          const count = hourlyData[hour] || 0;
          const intensity = count / maxCount;
          return (
            <div key={hour} className="flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: Math.max(12, intensity * 80) }}
                className="w-full rounded-t-md bg-gradient-to-t from-amber-500/20 to-amber-500 relative group"
                style={{ opacity: 0.3 + intensity * 0.7 }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {hour}:00 - {count} plays
                </div>
              </motion.div>
              <span className="text-[10px] text-white/40">{hour}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-white/40 px-1">
        <span>00:00</span>
        <span>12:00</span>
        <span>23:59</span>
      </div>
    </div>
  );
};

/**
 * Audio Quality Gauge
 * Shows the ratio of high-quality audio in the library
 */
export const AudioQualityGauge: React.FC<{
  qualityData: Record<string, number>;
  total: number;
}> = ({ qualityData, total }) => {
  const hiResCount = (qualityData["hi-res"] || 0) + (qualityData["dsd"] || 0);
  const percentage = total > 0 ? (hiResCount / total) * 100 : 0;

  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="white"
            strokeOpacity="0.05"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 2, ease: "circOut" }}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#qualityGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="qualityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{Math.round(percentage)}%</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Hi-Res Ratio</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="text-center">
          <div className="text-white font-medium">{hiResCount}</div>
          <div className="text-[10px] text-white/40">Hi-Res / DSD</div>
        </div>
        <div className="text-center">
          <div className="text-white font-medium">{total - hiResCount}</div>
          <div className="text-[10px] text-white/40">Standard</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Activity Trend Sparkline
 * Shows simple play count trend over time
 */
export const ActivityTrend: React.FC<{
  data: { date: string; playCount: number }[];
}> = ({ data }) => {
  if (data.length < 2)
    return <div className="text-white/40 text-sm text-center">Need more data for trends</div>;

  const width = 400;
  const height = 100;
  const padding = 10;

  const maxVal = Math.max(...data.map((d) => d.playCount), 1);
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - (d.playCount / maxVal) * (height - padding * 2) - padding;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M ${padding},${height} L ${points} L ${width - padding},${height} Z`}
          fill="url(#trendGradient)"
        />
        <motion.polyline
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

/**
 * Pro-Tool Mastery Radar
 * Visualizes usage of advanced features (EQ, DSD, Recording, etc.)
 */
export const ProToolMasteryRadar: React.FC<{ usage: Record<string, number> }> = ({ usage }) => {
  const categories = [
    { key: "eq", label: "均衡器" },
    { key: "dsd_conv", label: "DSD转换" },
    { key: "save_preset", label: "预设定制" },
    { key: "visualizer_config", label: "视觉调节" },
    { key: "recording", label: "录制" },
  ];

  const size = 220;
  const center = size / 2;
  const radius = size * 0.35;
  const maxUsage = Math.max(...Object.values(usage), 5);

  const points = categories.map((cat, i) => {
    const angle = (i / categories.length) * Math.PI * 2 - Math.PI / 2;
    const val = (usage[cat.key] || 0) / maxUsage;
    const r = radius * (0.2 + val * 0.8);
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  });

  const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Grids */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((rMult, idx) => (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius * rMult}
            fill="none"
            stroke="white"
            strokeOpacity="0.05"
          />
        ))}

        {/* Axes */}
        {categories.map((_, i) => {
          const angle = (i / categories.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="white"
              strokeOpacity="0.1"
            />
          );
        })}

        {/* Shape */}
        <motion.path
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5 }}
          d={pathData}
          fill="url(#radarGrad)"
          stroke="#10b981"
          strokeWidth="2"
        />

        <defs>
          <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Labels */}
        {categories.map((cat, i) => {
          const angle = (i / categories.length) * Math.PI * 2 - Math.PI / 2;
          const x = center + (radius + 20) * Math.cos(angle);
          const y = center + (radius + 20) * Math.sin(angle);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fillOpacity="0.5"
              fontSize="10"
              fontWeight="bold"
            >
              {cat.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * Mood Flow Visualization
 * A gradient stream showing listening moods
 */
export const MoodFlow: React.FC<{ moodHistory: string[] }> = ({ moodHistory }) => {
  const colors: Record<string, string> = {
    energetic: "#ef4444",
    chill: "#3b82f6",
    focus: "#10b981",
    melancholy: "#8b5cf6",
    happy: "#f59e0b",
    standard: "#6b7280",
  };

  return (
    <div className="w-full h-12 rounded-full overflow-hidden flex gap-1 p-1 bg-white/5 border border-white/10">
      {moodHistory.map((mood, i) => (
        <motion.div
          key={i}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "100%", opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="h-full rounded-full"
          style={{ backgroundColor: colors[mood] || colors.standard, flex: 1 }}
          title={mood}
        />
      ))}
      {moodHistory.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-[10px] text-white/20 uppercase tracking-widest font-bold">
          等待数据积累...
        </div>
      )}
    </div>
  );
};
