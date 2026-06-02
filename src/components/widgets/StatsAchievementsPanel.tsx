"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Disc,
  Sparkles,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import {
  type Achievement,
  type ListeningStats,
  useStatsAchievementsStore,
} from "@/store/statsAchievementsStore";
import {
  ActivityTrend,
  AudioQualityGauge,
  ListeningClock,
  ListeningHeatmap,
  MoodFlow,
  MusicalDNARadar,
  ProToolMasteryRadar,
} from "@/components/stats/StatsVisuals";
import {
  getAchievementSpotlights,
  getListeningNextAction,
  getTopTimeWindow,
  summarizeListeningStats,
} from "@/utils/listeningInsights";
import {
  buildDailyHistory,
  buildListeningStreak,
  buildOverviewMetrics,
  buildWeeklyMomentum,
  type MetricCardModel,
  type MetricTone,
  type WeeklyMomentumDay,
} from "@/lib/stats/viewModels";

interface StatsAchievementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "overview", name: "概览", icon: BarChart3 },
  { id: "insights", name: "洞察", icon: Sparkles },
  { id: "achievements", name: "成就", icon: Trophy },
  { id: "history", name: "历史", icon: Calendar },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

const metricToneClass: Record<MetricTone, { card: string; icon: string }> = {
  amber: { card: "from-amber-500/20 to-orange-500/20 border-amber-500/30", icon: "text-amber-200" },
  emerald: {
    card: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
    icon: "text-emerald-200",
  },
  violet: {
    card: "from-violet-500/20 to-purple-500/20 border-violet-500/30",
    icon: "text-violet-200",
  },
  blue: { card: "from-blue-500/20 to-cyan-500/20 border-blue-500/30", icon: "text-blue-200" },
  pink: { card: "from-pink-500/20 to-rose-500/20 border-pink-500/30", icon: "text-pink-200" },
  indigo: {
    card: "from-indigo-500/20 to-blue-500/20 border-indigo-500/30",
    icon: "text-indigo-200",
  },
};

const metricIcons: Record<string, React.ReactNode> = {
  plays: <Activity className="h-4 w-4" />,
  time: <Clock className="h-4 w-4" />,
  artists: <Zap className="h-4 w-4" />,
  albums: <Disc className="h-4 w-4" />,
  songs: <BarChart3 className="h-4 w-4" />,
  completion: <CheckCircle2 className="h-4 w-4" />,
};

const categoryLabels: Record<Achievement["category"], string> = {
  listening: "听歌",
  exploration: "探索",
  collection: "收藏",
  milestone: "里程碑",
  technical: "工具",
  temporal: "时间",
};

export const StatsAchievementsPanel: React.FC<StatsAchievementsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { listeningStats, achievements, unlockAchievement } = useStatsAchievementsStore();

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">统计与成就</h2>
              <p className="text-sm text-white/60">
                听歌概览、洞察、进度和每日历史。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="关闭统计与成就"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "border-b-2 border-amber-500 bg-white/5 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && <OverviewTab stats={listeningStats} />}
          {activeTab === "insights" && <InsightsTab stats={listeningStats} />}
          {activeTab === "achievements" && (
            <AchievementsTab achievements={achievements} onUnlockAchievement={unlockAchievement} />
          )}
          {activeTab === "history" && <DailyHistoryTab stats={listeningStats} />}
        </div>
      </motion.div>
    </motion.div>
  );
};

function OverviewTab({ stats }: { stats: ListeningStats }) {
  const summary = summarizeListeningStats(stats);
  const topWindow = getTopTimeWindow(stats.hourlyDistribution || {});
  const nextAction = getListeningNextAction(summary);
  const metrics = buildOverviewMetrics(stats);
  const weeklyMomentum = buildWeeklyMomentum(stats);
  const streak = buildListeningStreak(stats);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white">核心指标</h3>
        <p className="mt-1 text-sm text-white/50">
          听歌深度、多样性和完成度的简要概览。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.id} metric={metric} index={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_1fr]">
        <WeeklyMomentumCard
          days={weeklyMomentum.days}
          totalPlays={weeklyMomentum.totalPlays}
          totalMinutes={weeklyMomentum.totalMinutes}
        />
        <StreakCard
          label={streak.label}
          currentDays={streak.currentDays}
          bestDays={streak.bestDays}
          lastActiveDate={streak.lastActiveDate}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FavoriteCard
          label="最爱歌手"
          value={stats.favoriteArtist}
          fallback="暂无最爱歌手"
        />
        <FavoriteCard
          label="最爱歌曲"
          value={stats.favoriteSong}
          fallback="暂无最爱歌曲"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InsightTile
          label="听歌趋势"
          value={trendLabel(summary.trend)}
          detail={`最近7天对比上期：${summary.trendDelta > 0 ? "+" : ""}${summary.trendDelta} 次播放/天`}
        />
        <InsightTile
          label="探索度"
          value={`${summary.explorationScore}%`}
          detail={summary.metrics[1]?.hint || "听歌历史不足。"}
        />
        <InsightTile
          label="重播偏好"
          value={`${summary.replayScore}%`}
          detail={summary.metrics[2]?.hint || "更多播放后将显示重播行为。"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-5">
          <div className="mb-2 text-xs uppercase tracking-wider text-amber-200/60">
            建议下一步
          </div>
          <div className="text-2xl font-semibold text-white">{nextAction}</div>
          <div className="mt-2 text-sm text-white/55">
            基于完成率、跳过率、探索度、重播和当前趋势生成。
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/40">
            最活跃时段
          </div>
          <div className="text-2xl font-semibold text-white">{topWindow.label}</div>
          <div className="mt-2 text-sm text-white/50">
            {topWindow.count} 次播放在此时段。可用于推荐和默认
            播放列表时间安排。
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyMomentumCard({
  days,
  totalPlays,
  totalMinutes,
}: {
  days: WeeklyMomentumDay[];
  totalPlays: number;
  totalMinutes: number;
}) {
  const visibleDays =
    days.length > 0
      ? days
      : Array.from({ length: 7 }, (_, index) => ({
          date: `day-${index}`,
          playCount: 0,
          listenMinutes: 0,
          heightPercent: 0,
        }));

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/40">每周势头</div>
          <div className="mt-2 text-2xl font-semibold text-white">{totalPlays} 次播放</div>
          <div className="mt-1 text-sm text-white/50">{totalMinutes} 分钟 本周</div>
        </div>
        <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
          7 天
        </div>
      </div>
      <div className="mt-5 flex h-24 items-end gap-2">
        {visibleDays.map((day) => (
          <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-16 w-full items-end rounded-full bg-white/[0.04] px-1">
              <div
                className="w-full rounded-full bg-gradient-to-t from-amber-500 to-orange-300"
                style={{ height: `${Math.max(day.heightPercent, day.playCount > 0 ? 12 : 4)}%` }}
                aria-label={`${day.date}: ${day.playCount} plays`}
              />
            </div>
            <span className="max-w-full truncate text-[10px] text-white/35">
              {day.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StreakCard({
  label,
  currentDays,
  bestDays,
  lastActiveDate,
}: {
  label: string;
  currentDays: number;
  bestDays: number;
  lastActiveDate: string | null;
}) {
  const percent = bestDays > 0 ? Math.min(100, Math.round((currentDays / bestDays) * 100)) : 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wider text-white/40">连续听歌</div>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(rgb(251 191 36) ${percent}%, rgba(255,255,255,0.08) 0)`,
          }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950/90 text-xl font-semibold text-white">
            {currentDays}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-white">{label}</div>
          <div className="mt-1 text-sm text-white/50">最佳连续：{bestDays} 天</div>
          <div className="mt-1 text-xs text-white/35">
            最近活跃：{lastActiveDate || "暂无听歌记录"}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ metric, index }: { metric: MetricCardModel; index: number }) {
  const tone = metricToneClass[metric.tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 ${tone.card}`}
    >
      <div
        className={`absolute right-4 top-4 opacity-40 transition-transform group-hover:scale-110 ${tone.icon}`}
      >
        {metricIcons[metric.id] || <BarChart3 className="h-4 w-4" />}
      </div>
      <div className="mb-1 text-3xl font-bold text-white">{metric.value}</div>
      <div className="text-xs uppercase tracking-wider text-white/60">{metric.label}</div>
    </motion.div>
  );
}

function FavoriteCard({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10">
      <div className="mb-2 text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-xl font-semibold text-white">{value || fallback}</div>
    </div>
  );
}

function InsightTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-2 text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-white/50">{detail}</div>
    </div>
  );
}

function InsightsTab({ stats }: { stats: ListeningStats }) {
  const genreLabels =
    stats.genreDistribution.length > 0
      ? stats.genreDistribution.map((genre) => genre.genre)
      : ["Pop", "Rock", "Jazz", "Classical", "Electronic", "Lofi"];
  const genreData =
    stats.genreDistribution.length > 0
      ? stats.genreDistribution.reduce<Record<string, number>>((acc, genre) => {
          acc[genre.genre] = genre.count;
          return acc;
        }, {})
      : { Pop: 85, Rock: 65, Jazz: 40, Classical: 30, Electronic: 90, Lofi: 55 };
  const dailyTrend = buildDailyHistory(stats)
    .slice()
    .reverse()
    .map((day) => day.playCount);
  const moodHistory = Object.entries(stats.moodDistribution || {}).flatMap(([mood, count]) =>
    Array.from({ length: Math.min(count, 20) }, (_, index) => ({ mood, timestamp: index }))
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <StatsSection title="音乐DNA" caption="基于流派偏好">
          <MusicalDNARadar data={genreData} labels={genreLabels} />
        </StatsSection>
        <StatsSection title="音频质量" caption="播放质量分布">
          <AudioQualityGauge
            qualityData={stats.audioQualityDistribution || {}}
            total={stats.totalPlayCount || 0}
          />
        </StatsSection>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <StatsSection title="24小时听歌时钟" caption="每日活动周期" compact>
          <ListeningClock hourlyData={toStringRecord(stats.hourlyDistribution)} />
        </StatsSection>
        <StatsSection title="活动趋势" caption="最近30天记录" compact>
          <ActivityTrend data={dailyTrend} />
        </StatsSection>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <StatsSection title="专业工具掌握" caption="高级功能使用">
          <ProToolMasteryRadar usage={stats.proToolsUsage || {}} />
        </StatsSection>
        <StatsSection title="情绪流动" caption="来自听歌标签的情绪序列">
          <div className="flex min-h-[220px] flex-col justify-center gap-6">
            <MoodFlow moodHistory={moodHistory} />
            <div className="text-center text-[10px] leading-relaxed text-white/30">
              基于已记录的情绪分布生成。更多情绪标签可使此视图更精确。
            </div>
          </div>
        </StatsSection>
      </div>

      <section className="space-y-4">
        <SectionHeader title="每小时活动强度" caption="按小时详细分布" />
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <ListeningHeatmap hourlyData={toStringRecord(stats.hourlyDistribution)} />
        </div>
      </section>
    </div>
  );
}

function StatsSection({
  title,
  caption,
  compact = false,
  children,
}: {
  title: string;
  caption: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} caption={caption} />
      <div
        className={`flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-8 ${
          compact ? "min-h-[300px]" : "min-h-[340px]"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function SectionHeader({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-medium text-white">{title}</h4>
      <span className="text-xs text-white/40">{caption}</span>
    </div>
  );
}

function AchievementsTab({
  achievements,
  onUnlockAchievement,
}: {
  achievements: Achievement[];
  onUnlockAchievement: (achievementId: string) => void;
}) {
  const spotlight = getAchievementSpotlights(achievements);
  const categories = Object.entries(categoryLabels) as Array<[Achievement["category"], string]>;
  const [selectedCategory, setSelectedCategory] = useState<Achievement["category"]>("listening");
  const filteredAchievements = achievements.filter(
    (achievement) => achievement.category === selectedCategory
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SpotlightCard
          title="最近解锁"
          empty="暂无最近解锁。"
          achievements={spotlight.unlockedRecently}
        />
        <SpotlightCard
          title="即将达成"
          empty="继续播放更多曲目以解锁下一个目标。"
          achievements={spotlight.nearlyUnlocked}
          showProgress
        />
        <SpotlightCard
          title="推荐推送"
          empty="暂无推荐。"
          achievements={spotlight.recommended}
        />
      </div>

      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <h3 className="text-xl font-semibold text-white">成就系统</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setSelectedCategory(id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${
                selectedCategory === id
                  ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredAchievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            onUnlockAchievement={onUnlockAchievement}
          />
        ))}
      </div>
    </div>
  );
}

function SpotlightCard({
  title,
  empty,
  achievements,
  showProgress = false,
}: {
  title: string;
  empty: string;
  achievements: Achievement[];
  showProgress?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-white/40">{title}</div>
      <div className="space-y-2">
        {achievements.length === 0 ? (
          <div className="text-sm text-white/40">{empty}</div>
        ) : (
          achievements.map((achievement) => (
            <div key={achievement.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm font-medium text-white">
                <span className="truncate">{achievement.nameEn || achievement.name}</span>
                <span className="shrink-0 text-xs text-white/45">
                  {achievement.progress}/{achievement.total}
                </span>
              </div>
              <div className="mt-1 text-xs text-white/45">
                {achievement.descriptionEn || achievement.description}
              </div>
              {showProgress && (
                <ProgressBar current={achievement.progress} total={achievement.total} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AchievementCard({
  achievement,
  onUnlockAchievement,
}: {
  achievement: Achievement;
  onUnlockAchievement: (achievementId: string) => void;
}) {
  const title = achievement.nameEn || achievement.name;
  const description = achievement.descriptionEn || achievement.description;

  return (
    <div
      className={`rounded-2xl p-5 transition-all duration-200 ${
        achievement.unlocked
          ? "scale-[1.02] border border-amber-500/40 bg-amber-500/20 shadow-lg shadow-amber-500/5"
          : "border border-white/10 bg-white/5 opacity-75"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            achievement.unlocked ? "bg-amber-500/20 text-amber-200" : "bg-white/5 text-white/55"
          }`}
        >
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-white">{title}</div>
            {achievement.unlocked && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                已解锁
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-white/60">{description}</div>
          <ProgressBar current={achievement.progress} total={achievement.total} />
          {!achievement.unlocked && process.env.NODE_ENV === "development" && (
            <button
              onClick={() => onUnlockAchievement(achievement.id)}
              className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/15 hover:text-white"
            >
              开发中解锁
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const percent = Math.min(100, total > 0 ? (current / total) * 100 : 0);
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs text-white/40">
        进度：{current} / {total}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function DailyHistoryTab({ stats }: { stats: ListeningStats }) {
  const dailyData = buildDailyHistory(stats);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white">每日历史</h3>
        <p className="mt-1 text-sm text-white/50">
          最近听歌活动，按最新排序。
        </p>
      </div>

      {dailyData.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
            <Calendar className="h-10 w-10 text-white/40" />
          </div>
          <h3 className="mb-2 font-semibold text-white">暂无每日数据</h3>
          <p className="text-white/60">开始听歌后，每日统计将显示在此。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dailyData.slice(0, 10).map((data) => (
            <div key={data.date} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{data.date}</div>
                  <div className="text-sm text-white/60">
                    {data.playCount} 次播放 - {data.listenMinutes} 分钟
                  </div>
                </div>
                <BarChart3 className="h-5 w-5 text-white/40" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function trendLabel(trend: "rising" | "steady" | "cooling"): string {
  if (trend === "rising") return "上升";
  if (trend === "cooling") return "降温";
  return "平稳";
}

function toStringRecord(record: Record<number, number>): Record<string, number> {
  return Object.entries(record || {}).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = Number(value) || 0;
    return acc;
  }, {});
}
