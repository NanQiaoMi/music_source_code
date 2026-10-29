// S6-12r: 成就域纯逻辑 —— 特殊成就目录（纯数据构造）+ 进度评估（纯函数）。
// 不含任何 store 状态读写；解锁/落库仍由 store 本体负责。
import type { Achievement, ListeningStats } from "./types";

/** 非阶梯类特殊成就：时间场景 / 技术 / 探索。按拆前 generateAchievements 的原始顺序插入。 */
export function createSpecialAchievements(): Achievement[] {
  const achievements: Achievement[] = [];

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

  return achievements;
}

/**
 * 单条成就的进度评估（拆前 checkAchievements 的 switch）。
 * currentHour / currentDay 由调用方统一取一次，保持拆前的批次语义。
 */
export function computeAchievementProgress(
  achievement: Achievement,
  stats: ListeningStats,
  currentHour: number,
  currentDay: number
): number {
  let progress = 0;

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
      } else if (achievement.id === "weekend-warrior" && (currentDay === 0 || currentDay === 6)) {
        progress = 1;
      } else if (achievement.id === "midnight-melodies" && currentHour >= 0 && currentHour < 2) {
        progress = Math.min((achievement.progress || 0) + 1, achievement.total);
      } else if (achievement.id === "morning-coffee" && currentHour >= 7 && currentHour < 9) {
        progress = Math.min((achievement.progress || 0) + 1, achievement.total);
      } else if (achievement.id === "genre-nomad") {
        progress = Math.min(Object.keys(stats.genreDistribution).length || 0, achievement.total);
      }
      break;
    case "quality":
      if (achievement.id === "audiophile-starter") {
        progress = Math.min(stats.audioQualityDistribution["hi-res"] || 0, achievement.total);
      }
      break;
    case "pro-tools":
      if (achievement.id === "dsd-master") {
        progress = Math.min(stats.proToolsUsage["dsd_conv"] || 0, achievement.total);
      } else if (achievement.id === "eq-wizard") {
        progress = Math.min(stats.proToolsUsage["eq"] || 0, achievement.total);
      } else if (achievement.id === "visual-connoisseur") {
        progress = Math.min(stats.proToolsUsage["visualizer_config"] || 0, achievement.total);
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

  return progress;
}
