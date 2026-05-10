import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "@/types/song";

export interface AchievementToast {
  id: string;
  achievement: Achievement;
  timestamp: number;
}

export type TimeRange = "day" | "week" | "month" | "year" | "all";

export interface ListeningStats {
  totalPlayCount: number;
  totalListenTime: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  uniqueSongs: number;
  favoriteArtist: string | null;
  favoriteAlbum: string | null;
  favoriteSong: string | null;
  topArtists: { artist: string; playCount: number }[];
  topAlbums: { album: string; playCount: number }[];
  topSongs: { song: Song; playCount: number }[];
  genreDistribution: { genre: string; count: number }[];
  dailyPlayData: { date: string; playCount: number; listenTime: number }[];

  // New detailed stats
  hourlyDistribution: Record<number, number>; // 0-23
  dayOfWeekDistribution: Record<number, number>; // 0-6
  audioQualityDistribution: Record<string, number>; // "standard", "hi-res", "dsd", "lossless"
  moodDistribution: Record<string, number>; // "energetic", "calm", "happy", "melancholy", etc.
  completedSongsCount: number;
  skippedSongsCount: number;
  proToolsUsage: Record<string, number>; // "eq", "dsd_conv", "visualizer_config", "ab_loop"
}

export interface Achievement {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  category: "listening" | "exploration" | "collection" | "milestone" | "technical" | "temporal";
  difficulty: "bronze" | "silver" | "gold" | "platinum" | "legendary";
  unlocked: boolean;
  unlockedAt?: number;
  progress: number;
  total: number;
  conditionType?:
    | "plays"
    | "songs"
    | "artists"
    | "albums"
    | "time"
    | "streak"
    | "special"
    | "quality"
    | "pro-tools"
    | "completion";
}

export interface StatsPeriod {
  startDate: number;
  endDate: number;
  timeRange: TimeRange;
}

interface StatsAchievementsState {
  listeningStats: ListeningStats;
  achievements: Achievement[];
  currentPeriod: StatsPeriod;
  isCalculating: boolean;
  lastCalculated: number;
  activeToasts: AchievementToast[];

  recordPlay: (
    song: Song,
    duration: number,
    completed: boolean,
    skipped: boolean,
    quality?: string
  ) => void;
  reportProToolsUsage: (toolId: string) => void;
  calculateStats: (songs: Song[], timeRange?: TimeRange) => Promise<void>;
  getStatsForPeriod: (period: StatsPeriod) => ListeningStats;

  unlockAchievement: (achievementId: string) => void;
  checkAchievements: (stats: ListeningStats) => void;
  getAchievementsByCategory: (category: Achievement["category"]) => Achievement[];
  getAchievementsByDifficulty: (difficulty: Achievement["difficulty"]) => Achievement[];
  getProgress: (achievementId: string) => { current: number; total: number };

  setCurrentPeriod: (period: StatsPeriod) => void;
  setIsCalculating: (calculating: boolean) => void;
  resetStats: () => void;
  resetAchievements: () => void;

  removeToast: (toastId: string) => void;

  // Query methods for stats dashboard
  getPlayTimeStats(): {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
  getTopPlayedSongs(
    limit: number
  ): { songId: string; title: string; artist: string; playCount: number }[];
  getTopArtists(limit: number): { artist: string; playCount: number }[];
  getHourlyDistribution(): { hour: number; count: number }[];
}

function generateAchievements(): Achievement[] {
  const achievements: Achievement[] = [];

  const playTiers = [1, 5, 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const playNames = [
    "初次见面",
    "渐入佳境",
    "常驻听客",
    "五十已达",
    "百次循环",
    "两百漫游",
    "音乐不休",
    "千次感动",
    "两千盛宴",
    "播放狂魔",
    "万籁俱寂",
    "两万里程",
    "五万巅峰",
    "十万神迹",
  ];
  const playIcons = [
    "🎵",
    "🎧",
    "📻",
    "💿",
    "🔁",
    "🔥",
    "🌟",
    "🎸",
    "🎹",
    "👑",
    "🚀",
    "🌌",
    "🌠",
    "💎",
  ];

  playTiers.forEach((total, i) => {
    achievements.push({
      id: `plays-${total}`,
      name: playNames[i] || `播放 ${total} 首`,
      nameEn: `Plays ${total}`,
      description: `累计播放 ${total} 首歌曲`,
      descriptionEn: `Play ${total} songs in total`,
      icon: playIcons[i] || "🎵",
      category: "listening",
      difficulty: i < 4 ? "bronze" : i < 8 ? "silver" : i < 11 ? "gold" : "platinum",
      unlocked: false,
      progress: 0,
      total: total,
      conditionType: "plays",
    });
  });

  const songTiers = [1, 5, 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const songNames = [
    "单曲循环",
    "五音不全",
    "十首入库",
    "五十精选",
    "百首珍藏",
    "两百曲库",
    "五百大关",
    "千首大赏",
    "两千漫游",
    "五千海量",
    "万首之王",
  ];
  const songIcons = ["🎼", "🎶", "🎵", "🎹", "🎻", "🎺", "🎷", "🎤", "🎧", "🎸", "👑"];

  songTiers.forEach((total, i) => {
    achievements.push({
      id: `songs-${total}`,
      name: songNames[i] || `解锁 ${total} 首`,
      nameEn: `Songs ${total}`,
      description: `播放 ${total} 首不同的歌曲`,
      descriptionEn: `Play ${total} different songs`,
      icon: songIcons[i] || "🎼",
      category: "exploration",
      difficulty: i < 3 ? "bronze" : i < 7 ? "silver" : i < 9 ? "gold" : "platinum",
      unlocked: false,
      progress: 0,
      total: total,
      conditionType: "songs",
    });
  });

  const artistTiers = [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2000];
  const artistNames = [
    "初识歌手",
    "追星小径",
    "十面埋伏",
    "群星荟萃",
    "五十知音",
    "百家争鸣",
    "二百大将",
    "五百罗汉",
    "千人一面",
    "万人迷",
  ];
  const artistIcons = ["👤", "👥", "🗣️", "🎭", "🎨", "🌟", "💫", "✨", "👑", "🏆"];

  artistTiers.forEach((total, i) => {
    achievements.push({
      id: `artists-${total}`,
      name: artistNames[i] || `歌手 ${total}`,
      nameEn: `Artists ${total}`,
      description: `聆听 ${total} 位不同的歌手`,
      descriptionEn: `Listen to ${total} different artists`,
      icon: artistIcons[i] || "👤",
      category: "exploration",
      difficulty: i < 3 ? "bronze" : i < 6 ? "silver" : i < 8 ? "gold" : "platinum",
      unlocked: false,
      progress: 0,
      total: total,
      conditionType: "artists",
    });
  });

  const albumTiers = [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2000];
  const albumNames = [
    "第一张专",
    "五张黑胶",
    "十张CD",
    "廿五卡带",
    "五十磁带",
    "百大专辑",
    "二百佳作",
    "五百神专",
    "千张收藏",
    "万碟之主",
  ];
  const albumIcons = ["💽", "📀", "💿", "📼", "📦", "📚", "🗄️", "🏛️", "🏰", "🌌"];

  albumTiers.forEach((total, i) => {
    achievements.push({
      id: `albums-${total}`,
      name: albumNames[i] || `专辑 ${total}`,
      nameEn: `Albums ${total}`,
      description: `聆听 ${total} 张不同的专辑`,
      descriptionEn: `Listen to ${total} different albums`,
      icon: albumIcons[i] || "💿",
      category: "collection",
      difficulty: i < 3 ? "bronze" : i < 6 ? "silver" : i < 8 ? "gold" : "platinum",
      unlocked: false,
      progress: 0,
      total: total,
      conditionType: "albums",
    });
  });

  const timeTiers = [1, 5, 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const timeNames = [
    "一小时",
    "五小时",
    "十小时",
    "五十时",
    "百小时",
    "两百时",
    "五百时",
    "千小时",
    "两千时",
    "五千时",
    "万小时定律",
  ];
  const timeIcons = ["⏳", "⌛", "⏰", "🕰️", "⏱️", "⏲️", "📅", "📆", "🗓️", "🌌", "♾️"];

  timeTiers.forEach((total, i) => {
    achievements.push({
      id: `time-${total * 3600}`,
      name: timeNames[i] || `时长 ${total}H`,
      nameEn: `Time ${total}H`,
      description: `累计听歌 ${total} 小时`,
      descriptionEn: `Listen for ${total} hours total`,
      icon: timeIcons[i] || "⏳",
      category: "listening",
      difficulty: i < 3 ? "bronze" : i < 6 ? "silver" : i < 8 ? "gold" : "platinum",
      unlocked: false,
      progress: 0,
      total: total * 3600,
      conditionType: "time",
    });
  });

  const streakTiers = [3, 7, 14, 30, 50, 100, 365, 1000];
  const streakNames = [
    "三天打鱼",
    "一周连续",
    "两周相伴",
    "满月连续",
    "五十天",
    "百日筑基",
    "周年纪念",
    "千日之恋",
  ];
  streakTiers.forEach((total, i) => {
    achievements.push({
      id: `streak-${total}`,
      name: streakNames[i],
      nameEn: `Streak ${total}`,
      description: `连续 ${total} 天听歌`,
      descriptionEn: `Listen for ${total} days in a row`,
      icon: "🔥",
      category: "milestone",
      difficulty: i < 2 ? "bronze" : i < 5 ? "silver" : i < 7 ? "gold" : "platinum",
      unlocked: false,
      progress: 0,
      total: total,
      conditionType: "streak",
    });
  });

  // Temporal Achievements
  const temporalSpecials: Partial<Achievement>[] = [
    {
      id: "midnight-melodies",
      name: "午夜旋律",
      nameEn: "Midnight Melodies",
      icon: "🌙",
      description: "在凌晨 0 点到 2 点之间听歌 10 次",
      total: 10,
      category: "temporal",
      conditionType: "special",
    },
    {
      id: "morning-coffee",
      name: "晨间咖啡",
      nameEn: "Morning Coffee",
      icon: "☕",
      description: "在早上 7 点到 9 点之间听歌 10 次",
      total: 10,
      category: "temporal",
      conditionType: "special",
    },
    {
      id: "focus-mode",
      name: "深度专注",
      nameEn: "Deep Focus",
      icon: "🧠",
      description: "连续听歌超过 3 小时不间断",
      total: 1,
      category: "temporal",
      conditionType: "special",
    },
  ];

  temporalSpecials.forEach((s) => {
    achievements.push({
      ...s,
      difficulty: "silver",
      unlocked: false,
      progress: 0,
      total: s.total || 1,
    } as Achievement);
  });

  // Technical Achievements
  const technicalSpecials: Partial<Achievement>[] = [
    {
      id: "audiophile-starter",
      name: "初级发烧友",
      nameEn: "Audiophile Starter",
      icon: "🎧",
      description: "播放 5 首 Hi-Res 歌曲",
      total: 5,
      conditionType: "quality",
    },
    {
      id: "dsd-master",
      name: "DSD 大师",
      nameEn: "DSD Master",
      icon: "💎",
      description: "使用 DSD 转换器处理 10 首歌曲",
      total: 10,
      conditionType: "pro-tools",
    },
    {
      id: "eq-wizard",
      name: "均衡器巫师",
      nameEn: "EQ Wizard",
      icon: "🎚️",
      description: "自定义并保存 3 个 EQ 预设",
      total: 3,
      conditionType: "pro-tools",
    },
    {
      id: "visual-connoisseur",
      name: "视觉鉴赏家",
      nameEn: "Visual Connoisseur",
      icon: "🌈",
      description: "尝试所有的可视化效果",
      total: 10,
      conditionType: "pro-tools",
    },
    {
      id: "preset-artisan",
      name: "预设工匠",
      nameEn: "Preset Artisan",
      icon: "🎨",
      description: "保存 3 个自定义可视化预设",
      total: 3,
      conditionType: "pro-tools",
    },
  ];

  technicalSpecials.forEach((s) => {
    achievements.push({
      ...s,
      category: "technical",
      difficulty: "gold",
      unlocked: false,
      progress: 0,
      total: s.total || 1,
    } as Achievement);
  });

  // Exploration / Mood Achievements
  const extraExploration: Partial<Achievement>[] = [
    {
      id: "genre-nomad",
      name: "风格游牧民",
      nameEn: "Genre Nomad",
      icon: "🌍",
      description: "聆听超过 5 种不同的音乐风格",
      total: 5,
      category: "exploration",
      conditionType: "special",
    },
    {
      id: "lyric-legend",
      name: "歌词传奇",
      nameEn: "Lyric Legend",
      icon: "📜",
      description: "在全屏模式下阅读歌词超过 10 次",
      total: 10,
      category: "exploration",
      conditionType: "special",
    },
    {
      id: "wave-rider",
      name: "波浪冲浪者",
      nameEn: "Wave Rider",
      icon: "🏄",
      description: "在一次会话中切换 5 种不同的视觉效果",
      total: 5,
      category: "technical",
      conditionType: "special",
    },
  ];

  extraExploration.forEach((s) => {
    achievements.push({
      ...s,
      difficulty: "silver",
      unlocked: false,
      progress: 0,
      total: s.total || 1,
    } as Achievement);
  });

  return achievements.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.total - b.total;
  });
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = generateAchievements();

const DEFAULT_STATS: ListeningStats = {
  totalPlayCount: 0,
  totalListenTime: 0,
  uniqueArtists: 0,
  uniqueAlbums: 0,
  uniqueSongs: 0,
  favoriteArtist: null,
  favoriteAlbum: null,
  favoriteSong: null,
  topArtists: [],
  topAlbums: [],
  topSongs: [],
  genreDistribution: [],
  dailyPlayData: [],
  hourlyDistribution: {},
  dayOfWeekDistribution: {},
  audioQualityDistribution: {},
  moodDistribution: {},
  completedSongsCount: 0,
  skippedSongsCount: 0,
  proToolsUsage: {},
};

const DEFAULT_PERIOD: StatsPeriod = {
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endDate: Date.now(),
  timeRange: "week",
};

function getTodayString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const useStatsAchievementsStore = create<StatsAchievementsState>()(
  persist(
    (set, get) => ({
      listeningStats: DEFAULT_STATS,
      achievements: DEFAULT_ACHIEVEMENTS,
      currentPeriod: DEFAULT_PERIOD,
      isCalculating: false,
      lastCalculated: 0,
      activeToasts: [],

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

      calculateStats: async (songs, timeRange = "all") => {
        set({ isCalculating: true });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const artistPlayCounts = new Map<string, number>();
        const albumPlayCounts = new Map<string, number>();
        const songPlayCounts = new Map<string, number>();
        const uniqueArtists = new Set<string>();
        const uniqueAlbums = new Set<string>();
        const uniqueSongs = new Set<string>();

        for (const song of songs) {
          uniqueArtists.add(song.artist);
          if (song.album) uniqueAlbums.add(song.album);
          uniqueSongs.add(song.id);

          const currentArtistCount = artistPlayCounts.get(song.artist) || 0;
          artistPlayCounts.set(song.artist, currentArtistCount + 1);

          if (song.album) {
            const currentAlbumCount = albumPlayCounts.get(song.album) || 0;
            albumPlayCounts.set(song.album, currentAlbumCount + 1);
          }

          const currentSongCount = songPlayCounts.get(song.id) || 0;
          songPlayCounts.set(song.id, currentSongCount + 1);
        }

        const topArtists = Array.from(artistPlayCounts.entries())
          .map(([artist, playCount]) => ({ artist, playCount }))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 10);

        const topAlbums = Array.from(albumPlayCounts.entries())
          .map(([album, playCount]) => ({ album, playCount }))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 10);

        const topSongs = Array.from(songPlayCounts.entries())
          .map(([songId, playCount]) => {
            const song = songs.find((s) => s.id === songId);
            return song
              ? {
                  song: {
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    album: song.album,
                    duration: song.duration,
                    cover: song.cover?.startsWith("data:") ? "" : song.cover,
                  } as Song,
                  playCount,
                }
              : null;
          })
          .filter((item): item is { song: Song; playCount: number } => item !== null)
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 5); // Reduced from 10 to 5

        const favoriteArtist = topArtists[0]?.artist || null;
        const favoriteAlbum = topAlbums[0]?.album || null;
        const favoriteSong = topSongs[0]?.song.title || null;

        set((state) => ({
          listeningStats: {
            ...state.listeningStats,
            uniqueArtists: uniqueArtists.size,
            uniqueAlbums: uniqueAlbums.size,
            uniqueSongs: uniqueSongs.size,
            favoriteArtist,
            favoriteAlbum,
            favoriteSong,
            topArtists,
            topAlbums,
            topSongs,
          },
          isCalculating: false,
          lastCalculated: Date.now(),
        }));

        get().checkAchievements(get().listeningStats);
      },

      getStatsForPeriod: (period) => {
        return get().listeningStats;
      },

      unlockAchievement: (achievementId) => {
        set((state) => {
          const achievement = state.achievements.find((a) => a.id === achievementId);
          const alreadyUnlocked = achievement?.unlocked;

          const newAchievements = state.achievements.map((a) =>
            a.id === achievementId
              ? {
                  ...a,
                  unlocked: true,
                  unlockedAt: Date.now(),
                  progress: a.total,
                }
              : a
          );

          let newToasts = state.activeToasts;
          if (achievement && !alreadyUnlocked) {
            newToasts = [
              ...state.activeToasts,
              {
                id: `${achievementId}-${Date.now()}`,
                achievement,
                timestamp: Date.now(),
              },
            ];
          }

          return {
            achievements: newAchievements,
            activeToasts: newToasts,
          };
        });
      },

      removeToast: (toastId) => {
        set((state) => ({
          activeToasts: state.activeToasts.filter((t) => t.id !== toastId),
        }));
      },

      checkAchievements: (stats) => {
        const { achievements, unlockAchievement } = get();

        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();

        achievements.forEach((achievement) => {
          if (achievement.unlocked) return;

          let progress = 0;
          let shouldUnlock = false;

          switch (achievement.conditionType) {
            case "plays":
              progress = Math.min(stats.totalPlayCount, achievement.total);
              break;
            case "songs":
              progress = Math.min(stats.uniqueSongs, achievement.total);
              break;
            case "artists":
              progress = Math.min(stats.uniqueArtists, achievement.total);
              break;
            case "albums":
              progress = Math.min(stats.uniqueAlbums, achievement.total);
              break;
            case "time":
              progress = Math.min(stats.totalListenTime, achievement.total);
              break;
            case "streak":
              progress = Math.min(stats.dailyPlayData.length, achievement.total);
              break;
            case "special":
              if (achievement.id === "night-owl" && currentHour >= 2 && currentHour < 5) {
                progress = 1;
              } else if (achievement.id === "early-bird" && currentHour >= 5 && currentHour < 8) {
                progress = 1;
              } else if (
                achievement.id === "weekend-warrior" &&
                (currentDay === 0 || currentDay === 6)
              ) {
                progress = 1;
              } else if (
                achievement.id === "midnight-melodies" &&
                currentHour >= 0 &&
                currentHour < 2
              ) {
                progress = Math.min((achievement.progress || 0) + 1, achievement.total);
              } else if (
                achievement.id === "morning-coffee" &&
                currentHour >= 7 &&
                currentHour < 9
              ) {
                progress = Math.min((achievement.progress || 0) + 1, achievement.total);
              } else if (achievement.id === "genre-nomad") {
                progress = Math.min(
                  Object.keys(stats.genreDistribution).length || 0,
                  achievement.total
                );
              }
              break;
            case "quality":
              if (achievement.id === "audiophile-starter") {
                progress = Math.min(
                  stats.audioQualityDistribution["hi-res"] || 0,
                  achievement.total
                );
              }
              break;
            case "pro-tools":
              if (achievement.id === "dsd-master") {
                progress = Math.min(stats.proToolsUsage["dsd_conv"] || 0, achievement.total);
              } else if (achievement.id === "eq-wizard") {
                progress = Math.min(stats.proToolsUsage["eq"] || 0, achievement.total);
              } else if (achievement.id === "visual-connoisseur") {
                progress = Math.min(
                  stats.proToolsUsage["visualizer_config"] || 0,
                  achievement.total
                );
              } else if (achievement.id === "preset-artisan") {
                progress = Math.min(stats.proToolsUsage["save_preset"] || 0, achievement.total);
              }
              break;
            case "completion":
              progress = Math.min(stats.completedSongsCount, achievement.total);
              break;
            default:
              progress = 0;
          }

          shouldUnlock = progress >= achievement.total;

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
        const stats = get().listeningStats;
        const now = Date.now();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        let today = 0;
        let thisWeek = 0;
        let thisMonth = 0;

        for (const day of stats.dailyPlayData) {
          const dayDate = new Date(day.date).getTime();
          if (dayDate >= todayStart.getTime()) today += day.listenTime;
          if (dayDate >= weekStart.getTime()) thisWeek += day.listenTime;
          if (dayDate >= monthStart.getTime()) thisMonth += day.listenTime;
        }

        return {
          today,
          thisWeek,
          thisMonth,
          allTime: stats.totalListenTime,
        };
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
        const dist = get().listeningStats.hourlyDistribution;
        return Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: dist[hour] || 0,
        }));
      },
    }),
    {
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
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            if (error instanceof Error && error.name === "QuotaExceededError") {
              console.warn("Stats achievements store quota exceeded, pruning daily data...");
              try {
                const state = JSON.parse(JSON.stringify(value));
                if (state.state && state.state.listeningStats) {
                  // Aggressively prune to last 30 days
                  if (Array.isArray(state.state.listeningStats.dailyPlayData)) {
                    state.state.listeningStats.dailyPlayData =
                      state.state.listeningStats.dailyPlayData.slice(-30);
                  }
                  // Clear active toasts as they are temporary
                  state.state.activeToasts = [];
                }
                localStorage.setItem(name, JSON.stringify(state));
              } catch (e) {
                console.error("Failed to save even pruned stats store:", e);
                // Last resort: clear all daily data
                try {
                  const state = JSON.parse(JSON.stringify(value));
                  if (state.state && state.state.listeningStats) {
                    state.state.listeningStats.dailyPlayData = [];
                  }
                  localStorage.setItem(name, JSON.stringify(state));
                } catch (finalError) {
                  console.error("Critical storage failure in stats store:", finalError);
                }
              }
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
