// S6-12r: 默认统计 / 默认成就目录 / 展示常量。
// 阶梯类成就目录与拆前 generateAchievements 完全一致（仅搬家与排序位置不变）。
import type { Achievement, ListeningStats, StatsPeriod } from "./types";
import { createSpecialAchievements } from "./achievements";

/** 成就 toast 的展示时长（=拆前 AchievementToastItem 的 4000ms 定时器）。 */
export const ACHIEVEMENT_TOAST_DURATION = 4000;

function generateTierAchievements(): Achievement[] {
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

  return achievements;
}

function compareAchievements(a: Achievement, b: Achievement): number {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.total - b.total;
}

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  ...generateTierAchievements(),
  ...createSpecialAchievements(),
].sort(compareAchievements);

export const DEFAULT_STATS: ListeningStats = {
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

export const DEFAULT_PERIOD: StatsPeriod = {
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endDate: Date.now(),
  timeRange: "week",
};
