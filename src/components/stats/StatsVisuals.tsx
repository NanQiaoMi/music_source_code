"use client";

import React, { useMemo } from "react";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { GlassCard } from "@/components/shared/Glass/GlassCard";

// ─── Musical DNA Radar ───────────────────────────────────────────
interface RadarProps {
  data: Record<string, number>;
  labels: string[];
}

export const MusicalDNARadar: React.FC<RadarProps> = ({ data, labels }) => {
  const max = Math.max(...Object.values(data), 1);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const angles = labels.map((_, i) => (Math.PI * 2 * i) / labels.length - Math.PI / 2);
  const points = labels.map((label, i) => {
    const value = (data[label] || 0) / max;
    const x = cx + r * value * Math.cos(angles[i]);
    const y = cy + r * value * Math.sin(angles[i]);
    return `${x},${y}`;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon
          key={level}
          points={labels
            .map((_, i) => {
              const x = cx + r * level * Math.cos(angles[i]);
              const y = cy + r * level * Math.sin(angles[i]);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      <polygon points={points.join(" ")} fill="rgba(120,80,255,0.2)" stroke="rgba(120,80,255,0.6)" strokeWidth={2} />
      {labels.map((label, i) => (
        <text
          key={label}
          x={cx + (r + 20) * Math.cos(angles[i])}
          y={cy + (r + 20) * Math.sin(angles[i])}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.5)"
          fontSize={10}
        >
          {label}
        </text>
      ))}
    </svg>
  );
};

// ─── Listening Heatmap ───────────────────────────────────────────
interface HeatmapProps {
  hourlyData: Record<string, number>;
}

export const ListeningHeatmap: React.FC<HeatmapProps> = ({ hourlyData }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const max = Math.max(...hours.map((h) => hourlyData[h] || 0), 1);
  const cellSize = 16;
  const gap = 2;
  const width = hours.length * (cellSize + gap);

  return (
    <div className="flex flex-wrap gap-1">
      {hours.map((hour) => {
        const value = hourlyData[hour] || 0;
        const intensity = value / max;
        const alpha = 0.1 + intensity * 0.7;
        return (
          <div
            key={hour}
            className="rounded-sm"
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: `rgba(120,80,255,${alpha})`,
            }}
            title={`${hour}:00 - ${value}次`}
          />
        );
      })}
      <div className="w-full text-[10px] text-white/30 text-center mt-1">0时 - 24时</div>
    </div>
  );
};

// ─── Audio Quality Gauge ─────────────────────────────────────────
interface GaugeProps {
  qualityData: Record<string, number>;
  total: number;
}

export const AudioQualityGauge: React.FC<GaugeProps> = ({ qualityData, total }) => {
  const segments = Object.entries(qualityData);
  if (segments.length === 0) {
    return <div className="text-white/40 text-sm">暂无数据</div>;
  }
  return (
    <div className="w-full space-y-2">
      {segments.map(([label, count]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-white/60 w-16">{label}</span>
          <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all"
              style={{ width: `${(count / Math.max(total, 1)) * 100}%` }}
            />
          </div>
          <span className="text-xs text-white/40 w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Activity Trend ──────────────────────────────────────────────
interface TrendProps {
  data: number[];
}

export const ActivityTrend: React.FC<TrendProps> = ({ data }) => {
  const max = Math.max(...data, 1);
  const h = 100;
  const w = data.length * 8;
  const points = data.map((v, i) => `${i * 8},${h - (v / max) * h}`).join(" ");

  if (data.length === 0) {
    return <div className="text-white/40 text-sm">暂无数据</div>;
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke="rgba(120,80,255,0.6)" strokeWidth={2} />
      {data.map((v, i) => (
        <circle
          key={i}
          cx={i * 8}
          cy={h - (v / max) * h}
          r={2}
          fill="rgba(120,80,255,0.8)"
        />
      ))}
    </svg>
  );
};

// ─── Listening Clock ─────────────────────────────────────────────
interface ClockProps {
  hourlyData: Record<string, number>;
}

export const ListeningClock: React.FC<ClockProps> = ({ hourlyData }) => {
  const max = Math.max(...Object.values(hourlyData), 1);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      {Array.from({ length: 24 }, (_, hour) => {
        const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
        const value = hourlyData[hour] || 0;
        const intensity = value / max;
        const barR = 40 + intensity * 30;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        const x2 = cx + barR * Math.cos(angle);
        const y2 = cy + barR * Math.sin(angle);
        return (
          <line
            key={hour}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={`rgba(120,80,255,${0.2 + intensity * 0.6})`}
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
        return (
          <text
            key={h}
            x={cx + (r + 15) * Math.cos(angle)}
            y={cy + (r + 15) * Math.sin(angle)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.3)"
            fontSize={9}
          >
            {h}
          </text>
        );
      })}
    </svg>
  );
};

// ─── Pro Tool Mastery Radar ──────────────────────────────────────
interface MasteryProps {
  usage: Record<string, number>;
}

export const ProToolMasteryRadar: React.FC<MasteryProps> = ({ usage }) => {
  const entries = Object.entries(usage);
  if (entries.length === 0) {
    return <div className="text-white/40 text-sm">暂无数据</div>;
  }
  return (
    <div className="w-full space-y-2">
      {entries.map(([tool, count]) => (
        <div key={tool} className="flex items-center gap-2">
          <span className="text-xs text-white/60 w-20 truncate">{tool}</span>
          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all"
              style={{ width: `${Math.min(count, 100)}%` }}
            />
          </div>
          <span className="text-xs text-white/40 w-6 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Mood Flow ───────────────────────────────────────────────────
interface MoodProps {
  moodHistory: Array<{ mood: string; timestamp: number }>;
}

export const MoodFlow: React.FC<MoodProps> = ({ moodHistory }) => {
  if (moodHistory.length === 0) {
    return <div className="text-white/40 text-sm">暂无数据</div>;
  }
  const moods = [...new Set(moodHistory.map((m) => m.mood))];
  return (
    <div className="flex flex-wrap gap-2">
      {moodHistory.slice(-20).map((entry, i) => (
        <div
          key={i}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
          style={{
            backgroundColor: `hsla(${((moods.indexOf(entry.mood) + 1) / Math.max(moods.length, 1)) * 280}, 70%, 60%, 0.3)`,
          }}
          title={entry.mood}
        >
          {entry.mood.charAt(0)}
        </div>
      ))}
    </div>
  );
};

// ─── Default export (existing StatsVisuals) ──────────────────────

const StatsVisuals = () => {
  const stats = useStatsAchievementsStore();

  const playTimeStats = useMemo(
    () =>
      stats.getPlayTimeStats?.() ?? {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        allTime: 0,
      },
    [stats]
  );

  const topSongs = useMemo(() => stats.getTopPlayedSongs?.(10) ?? [], [stats]);
  const topArtists = useMemo(() => stats.getTopArtists?.(10) ?? [], [stats]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6 p-4">
      <GlassCard className="p-4">
        <h3 className="text-lg font-semibold mb-3">播放时长统计</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm opacity-60">今日</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.today)}</p>
          </div>
          <div>
            <p className="text-sm opacity-60">本周</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.thisWeek)}</p>
          </div>
          <div>
            <p className="text-sm opacity-60">本月</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.thisMonth)}</p>
          </div>
          <div>
            <p className="text-sm opacity-60">总计</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.allTime)}</p>
          </div>
        </div>
      </GlassCard>

      {topSongs.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-lg font-semibold mb-3">最常播放歌曲 Top 10</h3>
          <div className="space-y-2">
            {topSongs.map((song, i) => (
              <div key={song.songId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-40 w-6">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">{song.title}</p>
                    <p className="text-xs opacity-50">{song.artist}</p>
                  </div>
                </div>
                <span className="text-xs opacity-40">{song.playCount}次</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {topArtists.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-lg font-semibold mb-3">最常播放歌手 Top 10</h3>
          <div className="space-y-2">
            {topArtists.map((artist, i) => (
              <div key={artist.artist} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-40 w-6">{i + 1}</span>
                  <span className="text-sm">{artist.artist}</span>
                </div>
                <span className="text-xs opacity-40">{artist.playCount}次</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default StatsVisuals;
