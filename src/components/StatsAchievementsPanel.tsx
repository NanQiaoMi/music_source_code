"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, BarChart3, Calendar, Zap, Clock, Disc, Activity } from "lucide-react";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { MusicalDNARadar, ListeningHeatmap, AudioQualityGauge, ActivityTrend, ListeningClock, ProToolMasteryRadar, MoodFlow } from "./stats/StatsVisuals";

interface StatsAchievementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "overview", name: "概览", icon: "📊" },
  { id: "insights", name: "洞察", icon: "🧠" },
  { id: "achievements", name: "成就", icon: "🏆" },
  { id: "history", name: "日志", icon: "📅" },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white text-2xl font-semibold">数据统计与成就</h2>
              <p className="text-white/60 text-sm">概览、成就、每日数据</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-amber-500 bg-white/5"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar min-h-0">
          {activeTab === "overview" && <OverviewTab stats={listeningStats} />}

          {activeTab === "insights" && <InsightsTab stats={listeningStats} />}

          {activeTab === "achievements" && (
            <AchievementsTab achievements={achievements} onUnlockAchievement={() => {}} />
          )}

          {activeTab === "history" && <DailyHistoryTab stats={listeningStats} />}
        </div>
      </motion.div>
    </motion.div>
  );
};

function OverviewTab({ stats }: { stats: any }) {
  const metrics = [
    { label: "总播放次数", value: stats.totalPlayCount || 0, icon: <Activity className="w-4 h-4" />, color: "from-amber-500/20 to-orange-500/20", borderColor: "border-amber-500/30" },
    { label: "总收听时长", value: `${Math.floor((stats.totalListenTime || 0) / 3600)}小时`, icon: <Clock className="w-4 h-4" />, color: "from-emerald-500/20 to-teal-500/20", borderColor: "border-emerald-500/30" },
    { label: "歌手数量", value: stats.uniqueArtists || 0, icon: <Zap className="w-4 h-4" />, color: "from-violet-500/20 to-purple-500/20", borderColor: "border-violet-500/30" },
    { label: "专辑数量", value: stats.uniqueAlbums || 0, icon: <Disc className="w-4 h-4" />, color: "from-blue-500/20 to-cyan-500/20", borderColor: "border-blue-500/30" },
    { label: "歌曲数量", value: stats.uniqueSongs || 0, icon: <BarChart3 className="w-4 h-4" />, color: "from-pink-500/20 to-rose-500/20", borderColor: "border-pink-500/30" },
    { label: "完成率", value: `${Math.round((stats.completedSongsCount / (stats.totalPlayCount || 1)) * 100)}%`, icon: <Zap className="w-4 h-4" />, color: "from-indigo-500/20 to-blue-500/20", borderColor: "border-indigo-500/30" },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-white text-xl font-semibold">核心数据指标</h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((metric, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-6 rounded-2xl bg-gradient-to-br ${metric.color} border ${metric.borderColor} relative overflow-hidden group`}
          >
            <div className="absolute top-4 right-4 opacity-20 group-hover:scale-110 transition-transform">
              {metric.icon}
            </div>
            <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-white/60 text-xs uppercase tracking-wider">{metric.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.favoriteArtist && (
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2">最喜爱的艺术家</div>
            <div className="text-white font-semibold text-xl">{stats.favoriteArtist}</div>
          </div>
        )}
        {stats.favoriteSong && (
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2">最喜爱的单曲</div>
            <div className="text-white font-semibold text-xl">{stats.favoriteSong}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsTab({ stats }: { stats: any }) {
  const genreLabels = stats.genreDistribution?.length > 0 
    ? stats.genreDistribution.map((g: any) => g.genre)
    : ["Pop", "Rock", "Jazz", "Classical", "Electronic", "Lofi"];
    
  const genreData = stats.genreDistribution?.length > 0
    ? stats.genreDistribution.reduce((acc: any, g: any) => ({ ...acc, [g.genre]: g.count }), {})
    : { "Pop": 85, "Rock": 65, "Jazz": 40, "Classical": 30, "Electronic": 90, "Lofi": 55 };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Radar Chart Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">音乐 DNA</h4>
            <span className="text-xs text-white/40">基于风格偏好</span>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center min-h-[340px]">
            <MusicalDNARadar data={genreData} labels={genreLabels} />
          </div>
        </section>

        {/* Audio Quality Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">音频质量分布</h4>
            <span className="text-xs text-white/40">音质倾向</span>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center min-h-[340px]">
            <AudioQualityGauge 
              qualityData={stats.audioQualityDistribution || {}} 
              total={stats.totalPlayCount || 0} 
            />
          </div>
        </section>
      </div>

      {/* Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Clock Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">24小时收听时钟</h4>
            <span className="text-xs text-white/40">全天活跃周期</span>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center min-h-[300px]">
            <ListeningClock hourlyData={stats.hourlyDistribution || {}} />
          </div>
        </section>

        {/* Heatmap Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">活跃度趋势</h4>
            <span className="text-xs text-white/40">最近30天动态</span>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col justify-center min-h-[300px]">
            <ActivityTrend data={stats.dailyPlayData?.slice(-30) || []} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pro-Tool Mastery Radar Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">专业工具掌握度</h4>
            <span className="text-xs text-white/40">技术功能使用频率</span>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center min-h-[340px]">
            <ProToolMasteryRadar usage={stats.proToolsUsage || {}} />
          </div>
        </section>

        {/* Mood Flow Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">心境流转</h4>
            <span className="text-xs text-white/40">收听情绪序列</span>
          </div>
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col justify-center gap-6 min-h-[340px]">
            <MoodFlow moodHistory={stats.moodHistory || []} />
            <div className="text-[10px] text-white/30 text-center leading-relaxed">
              基于音频特征和收听习惯的自动心情建模。
            </div>
          </div>
        </section>
      </div>

      {/* Full Width Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-white font-medium">分时段活跃强度</h4>
          <span className="text-xs text-white/40">每小时详细分布</span>
        </div>
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
          <ListeningHeatmap hourlyData={stats.hourlyDistribution || {}} />
        </div>
      </section>
    </div>
  );
}

function AchievementsTab({
  achievements,
  onUnlockAchievement,
}: {
  achievements: any[];
  onUnlockAchievement: (achievementId: string) => void;
}) {
  const categories = [
    { id: "listening", name: "聆听", icon: "🎵" },
    { id: "exploration", name: "探索", icon: "🔍" },
    { id: "collection", name: "收藏", icon: "💎" },
    { id: "temporal", name: "时间", icon: "⏰" },
    { id: "technical", name: "技术", icon: "🛠️" },
    { id: "milestone", name: "里程碑", icon: "🏆" },
  ];

  const [selectedCategory, setSelectedCategory] = useState<string>("listening");

  const filteredAchievements = achievements.filter((a) => a.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-xl font-semibold">成就系统</h3>
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                selectedCategory === cat.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAchievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-5 rounded-2xl transition-all duration-200 ${
              achievement.unlocked
                ? "bg-amber-500/20 border border-amber-500/40 shadow-lg shadow-amber-500/5 scale-[1.02]"
                : "bg-white/5 border border-white/10 opacity-60"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  achievement.unlocked ? "bg-amber-500/20" : "bg-white/5"
                }`}
              >
                {achievement.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-white font-semibold">{achievement.name}</div>
                  {achievement.unlocked && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs">
                      已解锁
                    </span>
                  )}
                </div>
                <div className="text-white/60 text-sm mt-1">{achievement.description}</div>

                {!achievement.unlocked && (
                  <div className="mt-3">
                    <div className="text-white/40 text-xs mb-1">
                      进度: {achievement.progress} / {achievement.total}
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{
                          width: `${Math.min(100, (achievement.progress / achievement.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyHistoryTab({ stats }: { stats: any }) {
  const dailyData = stats.dailyPlayData || [];

  return (
    <div className="space-y-6">
      <h3 className="text-white text-xl font-semibold">每日数据</h3>

      {dailyData.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-white/5 flex items-center justify-center">
            <Calendar className="w-10 h-10 text-white/40" />
          </div>
          <h3 className="text-white font-semibold mb-2">暂无数据</h3>
          <p className="text-white/60">开始听歌后数据会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dailyData
            .slice(-10)
            .reverse()
            .map((data: any, index: number) => (
              <div key={index} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{data.date}</div>
                    <div className="text-white/60 text-sm">
                      播放 {data.playCount} 次 · {Math.floor(data.listenTime / 60)}分钟
                    </div>
                  </div>
                  <BarChart3 className="w-5 h-5 text-white/40" />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
