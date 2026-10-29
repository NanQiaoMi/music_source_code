// S6-12r: store 本体只保留状态与 action 编排。
// 类型在 ./statsAchievements/types.ts，默认值/成就目录在 ./statsAchievements/defaults.ts，
// 成就目录与进度评估在 ./statsAchievements/achievements.ts，
// 统计聚合/看板/持久化候选在 ./statsAchievements/statsHelpers.ts。
// 公共类型仍从此处 re-export；persist 的 name/version/partialize 与拆前一致。
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { writeWithPolicy } from "@/lib/storage/quotaPolicy";
import { reportStorageDegraded } from "@/lib/storage/degradedNotifier";
import { useToastStore } from "@/store/toastStore";
import type { Achievement, StatsAchievementsState } from "./statsAchievements/types";
import {
  ACHIEVEMENT_TOAST_DURATION,
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_PERIOD,
  DEFAULT_STATS,
} from "./statsAchievements/defaults";
import { computeAchievementProgress } from "./statsAchievements/achievements";
import {
  aggregateListeningStats,
  buildStatsCandidates,
  computePlayTimeStats,
  getTodayString,
  toHourlyDistribution,
} from "./statsAchievements/statsHelpers";

export type {
  Achievement,
  ListeningStats,
  StatsPeriod,
  TimeRange,
} from "./statsAchievements/types";

export const useStatsAchievementsStore = create<StatsAchievementsState>()(
  persist(
    (set, get) => ({
      listeningStats: DEFAULT_STATS,
      achievements: DEFAULT_ACHIEVEMENTS,
      currentPeriod: DEFAULT_PERIOD,
      isCalculating: false,
      lastCalculated: 0,

      recordPlay: (song, duration, completed, skipped, quality = "standard") => {
        const today = getTodayString();
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        set((state) => {
          const stats = state.listeningStats;

          const existingDailyData = stats.dailyPlayData.find((d) => d.date === today);

          const newDailyData = existingDailyData
            ? stats.dailyPlayData.map((d) =>
                d.date === today
                  ? {
                      ...d,
                      playCount: d.playCount + 1,
                      listenTime: d.listenTime + duration,
                    }
                  : d
              )
            : [
                ...stats.dailyPlayData,
                {
                  date: today,
                  playCount: 1,
                  listenTime: duration,
                },
              ];

          // Keep only the last 90 days of daily data
          const prunedDailyData = newDailyData.slice(-90);

          const newHourlyDist = { ...stats.hourlyDistribution };
          newHourlyDist[hour] = (newHourlyDist[hour] || 0) + 1;

          const newDayOfWeekDist = { ...stats.dayOfWeekDistribution };
          newDayOfWeekDist[day] = (newDayOfWeekDist[day] || 0) + 1;

          const newQualityDist = { ...stats.audioQualityDistribution };
          newQualityDist[quality] = (newQualityDist[quality] || 0) + 1;

          return {
            listeningStats: {
              ...stats,
              totalPlayCount: stats.totalPlayCount + 1,
              totalListenTime: stats.totalListenTime + duration,
              dailyPlayData: prunedDailyData,
              hourlyDistribution: newHourlyDist,
              dayOfWeekDistribution: newDayOfWeekDist,
              audioQualityDistribution: newQualityDist,
              completedSongsCount: stats.completedSongsCount + (completed ? 1 : 0),
              skippedSongsCount: stats.skippedSongsCount + (skipped ? 1 : 0),
            },
          };
        });

        get().checkAchievements(get().listeningStats);
      },

      reportProToolsUsage: (toolId) => {
        set((state) => {
          const newUsage = { ...state.listeningStats.proToolsUsage };
          newUsage[toolId] = (newUsage[toolId] || 0) + 1;
          return {
            listeningStats: {
              ...state.listeningStats,
              proToolsUsage: newUsage,
            },
          };
        });
        get().checkAchievements(get().listeningStats);
      },

      calculateStats: async (songs, _timeRange = "all") => {
        set({ isCalculating: true });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const summary = aggregateListeningStats(songs);

        set((state) => ({
          listeningStats: {
            ...state.listeningStats,
            ...summary,
          },
          isCalculating: false,
          lastCalculated: Date.now(),
        }));

        get().checkAchievements(get().listeningStats);
      },

      getStatsForPeriod: (_period) => {
        return get().listeningStats;
      },

      unlockAchievement: (achievementId) => {
        // S6-8b：成就 toast 的唯一 owner 是 toastStore（variant="achievement"）；
        // 本 store 只负责解锁事实，不再维护 activeToasts/自动消失定时器。
        const unlocked: Achievement[] = [];
        set((state) => {
          const achievement = state.achievements.find((a) => a.id === achievementId);
          const alreadyUnlocked = achievement?.unlocked;
          if (achievement && !alreadyUnlocked) unlocked.push(achievement);

          return {
            achievements: state.achievements.map((a) =>
              a.id === achievementId
                ? {
                    ...a,
                    unlocked: true,
                    unlockedAt: Date.now(),
                    progress: a.total,
                  }
                : a
            ),
          };
        });

        const toast = unlocked[0];
        if (toast) {
          useToastStore.getState().showToast(toast.name, "success", ACHIEVEMENT_TOAST_DURATION, {
            variant: "achievement",
            achievement: {
              id: toast.id,
              name: toast.name,
              description: toast.description,
              icon: toast.icon,
            },
          });
        }
      },

      checkAchievements: (stats) => {
        const { achievements, unlockAchievement } = get();

        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();

        achievements.forEach((achievement) => {
          if (achievement.unlocked) return;

          const progress = computeAchievementProgress(achievement, stats, currentHour, currentDay);

          const shouldUnlock = progress >= achievement.total;

          if (shouldUnlock && !achievement.unlocked) {
            unlockAchievement(achievement.id);
          } else if (progress !== achievement.progress) {
            set((state) => ({
              achievements: state.achievements.map((a) =>
                a.id === achievement.id ? { ...a, progress } : a
              ),
            }));
          }
        });
      },

      getAchievementsByCategory: (category) => {
        return get().achievements.filter((a) => a.category === category);
      },

      getAchievementsByDifficulty: (difficulty) => {
        return get().achievements.filter((a) => a.difficulty === difficulty);
      },

      getProgress: (achievementId) => {
        const achievement = get().achievements.find((a) => a.id === achievementId);
        return {
          current: achievement?.progress || 0,
          total: achievement?.total || 0,
        };
      },

      setCurrentPeriod: (period) => set({ currentPeriod: period }),
      setIsCalculating: (calculating) => set({ isCalculating: calculating }),

      resetStats: () => set({ listeningStats: DEFAULT_STATS, lastCalculated: 0 }),
      resetAchievements: () =>
        set({
          achievements: DEFAULT_ACHIEVEMENTS.map((a) => ({
            ...a,
            unlocked: false,
            unlockedAt: undefined,
            progress: 0,
          })),
        }),

      getPlayTimeStats: () => {
        return computePlayTimeStats(get().listeningStats);
      },

      getTopPlayedSongs: (limit) => {
        const songs = get().listeningStats.topSongs;
        return songs.slice(0, limit).map((s) => ({
          songId: s.song.id,
          title: s.song.title,
          artist: s.song.artist,
          playCount: s.playCount,
        }));
      },

      getTopArtists: (limit) => {
        return get().listeningStats.topArtists.slice(0, limit);
      },

      getHourlyDistribution: () => {
        return toHourlyDistribution(get().listeningStats.hourlyDistribution);
      },
    }),
    {
      skipHydration: true,
      name: "stats-achievements-store-v4",
      partialize: (state) => ({
        listeningStats: state.listeningStats,
        achievements: state.achievements,
        currentPeriod: state.currentPeriod,
        lastCalculated: state.lastCalculated,
      }),
      storage: {
        getItem: (name) => {
          try {
            const value = localStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          const outcome = writeWithPolicy(buildStatsCandidates(value), (serialized) => {
            localStorage.setItem(name, serialized);
          });
          if (!outcome.ok) {
            reportStorageDegraded({ key: name, reason: outcome.reason });
            return;
          }
          if (outcome.degradedTo) {
            reportStorageDegraded({ key: name, reason: "quota", degradedTo: outcome.degradedTo });
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
