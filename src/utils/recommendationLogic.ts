import { Song } from "@/types/song";

export interface SongWithPlayCount extends Song {
  playCount: number;
  lastPlayedAt?: number;
  addedAt?: number;
}

export interface RecommendationParams {
  currentSong?: Song;
  x: number;
  y: number;
}

export interface SongWithScore extends SongWithPlayCount {
  _freshnessScore: number;
  _familiarityScore: number;
  _similarityScore: number;
  _diversityScore: number;
  _finalScore: number;
}

export interface RecommendationReason {
  code: "artist-match" | "genre-match" | "fresh-discovery" | "replay-friendly" | "skip-avoidance";
  label: string;
  weight: number;
}

export interface RecommendationContext {
  recentSongs: Song[];
  topArtists: string[];
  topGenres: string[];
  skippedSongIds: Set<string>;
  favoriteSongIds?: Set<string>;
  mode?: DailyRecommendationMode;
}

export interface ScoredRecommendation {
  song: SongWithPlayCount;
  score: number;
  reasons: RecommendationReason[];
}

export function getMaxPlayCount(songs: SongWithPlayCount[]): number {
  if (songs.length === 0) return 1;
  return Math.max(...songs.map((song) => song.playCount || 0), 1);
}

export function getNormalizedPlay(song: SongWithPlayCount, maxPlayCount: number): number {
  if (maxPlayCount === 0) return 0;
  const playCount = song.playCount || 0;
  return Math.min(playCount / maxPlayCount, 1);
}

export function calculateFreshnessScore(song: SongWithPlayCount, maxPlayCount: number): number {
  const normalizedPlay = getNormalizedPlay(song, maxPlayCount);
  const freshnessScore = 1 - normalizedPlay;
  return Math.max(0, Math.min(1, freshnessScore));
}

export function calculateFamiliarityScore(song: SongWithPlayCount, maxPlayCount: number): number {
  const normalizedPlay = getNormalizedPlay(song, maxPlayCount);
  let familiarityScore = normalizedPlay;

  if (song.lastPlayedAt) {
    const daysSincePlayed = (Date.now() - song.lastPlayedAt) / (1000 * 60 * 60 * 24);
    if (daysSincePlayed < 1) {
      familiarityScore = Math.min(1, familiarityScore + 0.3);
    } else if (daysSincePlayed < 3) {
      familiarityScore = Math.min(1, familiarityScore + 0.2);
    } else if (daysSincePlayed < 7) {
      familiarityScore = Math.min(1, familiarityScore + 0.1);
    }
  }

  return Math.max(0, Math.min(1, familiarityScore));
}

export function calculateSimilarity(songA: Song, songB: Song): number {
  if (!songA || !songB) return 0.5;

  let totalScore = 0;
  let totalWeight = 0;

  const artistA = (songA.artist || "").toLowerCase().trim();
  const artistB = (songB.artist || "").toLowerCase().trim();

  if (artistA && artistB) {
    let artistScore = 0;
    if (artistA === artistB) {
      artistScore = 1.0;
    } else if (artistA.includes(artistB) || artistB.includes(artistA)) {
      artistScore = 0.8;
    } else {
      const wordsA = artistA.split(/\s+/).filter((w) => w.length > 2);
      const wordsB = artistB.split(/\s+/).filter((w) => w.length > 2);
      const commonWords = wordsA.filter((w) => wordsB.includes(w));
      if (commonWords.length > 0) {
        artistScore = 0.3 + (commonWords.length / Math.max(wordsA.length, wordsB.length)) * 0.4;
      }
    }
    totalScore += artistScore * 0.5;
    totalWeight += 0.5;
  }

  const albumA = (songA.album || "").toLowerCase().trim();
  const albumB = (songB.album || "").toLowerCase().trim();

  if (albumA && albumB) {
    let albumScore = 0;
    if (albumA === albumB) {
      albumScore = 1.0;
    } else if (albumA.includes(albumB) || albumB.includes(albumA)) {
      albumScore = 0.7;
    }
    totalScore += albumScore * 0.25;
    totalWeight += 0.25;
  }

  const titleA = (songA.title || "").toLowerCase().trim();
  const titleB = (songB.title || "").toLowerCase().trim();

  if (titleA && titleB) {
    let titleScore = 0;

    const remixKeywords = [
      "remix",
      "mix",
      "edit",
      "version",
      "cover",
      "live",
      "acoustic",
      "demo",
      "radio",
    ];
    const hasKeywordA = remixKeywords.some((k) => titleA.includes(k));
    const hasKeywordB = remixKeywords.some((k) => titleB.includes(k));

    if (hasKeywordA || hasKeywordB) {
      const cleanTitleA = titleA
        .replace(/[[(){}].*?[\])}]/g, "")
        .replace(/remix|mix|edit|version|cover|live|acoustic|demo|radio/gi, "")
        .trim();
      const cleanTitleB = titleB
        .replace(/[[(){}].*?[\])}]/g, "")
        .replace(/remix|mix|edit|version|cover|live|acoustic|demo|radio/gi, "")
        .trim();

      if (cleanTitleA && cleanTitleB) {
        if (cleanTitleA === cleanTitleB) {
          titleScore = 0.9;
        } else if (cleanTitleA.includes(cleanTitleB) || cleanTitleB.includes(cleanTitleA)) {
          titleScore = 0.7;
        }
      }
    }

    totalScore += titleScore * 0.25;
    totalWeight += 0.25;
  }

  if (totalWeight === 0) return 0.5;
  return totalScore / totalWeight;
}

export function calculateDiversityScore(
  song: SongWithPlayCount,
  selectedSongs: SongWithPlayCount[]
): number {
  if (selectedSongs.length === 0) return 1.0;

  let diversityScore = 1.0;

  const recentArtists = selectedSongs.slice(-8).map((s) => (s.artist || "").toLowerCase());
  const recentAlbums = selectedSongs.slice(-5).map((s) => (s.album || "").toLowerCase());

  const songArtist = (song.artist || "").toLowerCase();
  const songAlbum = (song.album || "").toLowerCase();

  if (songArtist && recentArtists.includes(songArtist)) {
    const count = recentArtists.filter((a) => a === songArtist).length;
    diversityScore *= Math.pow(0.6, count);
  }

  if (songAlbum && recentAlbums.includes(songAlbum)) {
    const count = recentAlbums.filter((a) => a === songAlbum).length;
    diversityScore *= Math.pow(0.7, count);
  }

  return Math.max(0.1, diversityScore);
}

export function getSmartScore(
  song: SongWithPlayCount,
  maxPlayCount: number,
  params: RecommendationParams,
  selectedSongs: SongWithPlayCount[]
): SongWithScore {
  const { currentSong, x, y } = params;

  const freshnessScore = calculateFreshnessScore(song, maxPlayCount);
  const familiarityScore = calculateFamiliarityScore(song, maxPlayCount);

  let similarityScore = 0.5;
  if (currentSong) {
    similarityScore = calculateSimilarity(currentSong, song);
  }

  const diversityScore = calculateDiversityScore(song, selectedSongs);

  const absX = Math.abs(x);
  const absY = Math.abs(y);

  let frequencyScore: number;
  if (x < -0.3) {
    frequencyScore = freshnessScore;
  } else if (x > 0.3) {
    frequencyScore = familiarityScore;
  } else {
    const blend = (x + 0.3) / 0.6;
    frequencyScore = freshnessScore * (1 - blend) + familiarityScore * blend;
  }

  let styleScore: number;
  if (y < -0.3) {
    styleScore = similarityScore;
  } else if (y > 0.3) {
    styleScore = 1 - similarityScore;
  } else {
    const blend = (y + 0.3) / 0.6;
    styleScore = similarityScore * (1 - blend) + (1 - similarityScore) * blend;
  }

  styleScore *= diversityScore;

  const baseWeight = 0.3;
  const totalWeight = absX + absY + baseWeight;

  const finalScore = (frequencyScore * absX + styleScore * absY + 0.5 * baseWeight) / totalWeight;

  return {
    ...song,
    _freshnessScore: freshnessScore,
    _familiarityScore: familiarityScore,
    _similarityScore: similarityScore,
    _diversityScore: diversityScore,
    _finalScore: finalScore,
  };
}

export function generateRecommendations(
  songs: SongWithPlayCount[],
  params: RecommendationParams,
  limit: number = 50
): SongWithPlayCount[] {
  if (songs.length === 0) return [];

  const maxPlayCount = getMaxPlayCount(songs);
  const { currentSong } = params;

  const availableSongs = songs.filter((song) => !currentSong || song.id !== currentSong.id);

  if (availableSongs.length === 0) return [];

  const selectedSongs: SongWithScore[] = [];
  const usedSongIds = new Set<string>();

  const preScoredSongs = availableSongs.map((song) => ({
    song,
    baseScore: getSmartScore(song, maxPlayCount, params, []),
  }));

  for (let i = 0; i < Math.min(limit, availableSongs.length); i++) {
    const candidates = preScoredSongs
      .filter((item) => !usedSongIds.has(item.song.id))
      .map((item) => getSmartScore(item.song, maxPlayCount, params, selectedSongs));

    if (candidates.length === 0) break;

    candidates.sort((a, b) => b._finalScore - a._finalScore);

    const selected = candidates[0];

    if (selected) {
      selectedSongs.push(selected);
      usedSongIds.add(selected.id);
    }
  }

  return selectedSongs;
}

// ─── 1. 垃圾/杂音/伴奏类型文件质量检测 ───
export function isLowQualityOrNoiseTrack(song: Song): { isLowQuality: boolean; reason?: string } {
  const title = (song.title || "").trim();
  const duration = song.duration || 0;

  // 标题缺失或过短
  if (!title || title.length < 2) {
    return { isLowQuality: true, reason: "标题过短或缺失" };
  }

  // 纯标点符号/表情包标题（如 ^.^, :-), ..., ???）
  const isPureSymbols = /^[^a-zA-Z0-9\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]+$/.test(title);
  if (isPureSymbols && title.length <= 4) {
    return { isLowQuality: true, reason: "纯标点表情无意义标题" };
  }

  // 伴奏 / Type Beat / 纯伴奏租借
  const isTypeBeat = /type\s*beat|free\s*beat|lease\s*beat|instrumental\s*beat/i.test(title);
  if (isTypeBeat) {
    return { isLowQuality: true, reason: "伴奏/Type Beat文件" };
  }

  // 超短片段（< 45秒），除非明确标有前奏/间奏/Intro
  if (duration > 0 && duration < 45) {
    const isIntroOrInterlude = /intro|outro|interlude|序|尾声/i.test(title);
    if (!isIntroOrInterlude) {
      return { isLowQuality: true, reason: "音频碎片过短" };
    }
  }

  return { isLowQuality: false };
}

export function scoreSongForRecommendation(
  song: SongWithPlayCount,
  context: RecommendationContext
): ScoredRecommendation {
  const reasons: RecommendationReason[] = [];
  let score = 50;
  const recentIds = new Set(context.recentSongs.map((recentSong) => recentSong.id));

  // 1. 低质与杂音伴奏惩罚
  const quality = isLowQualityOrNoiseTrack(song);
  if (quality.isLowQuality) {
    score -= 40;
  }

  // 2. 红心收藏加分
  if (context.favoriteSongIds && context.favoriteSongIds.has(song.id)) {
    reasons.push({ code: "replay-friendly", label: "红心收藏", weight: 16 });
    score += 16;
  }

  // 3. 常听歌手匹配（保留原有代码与测试权重）
  if (context.topArtists.includes(song.artist)) {
    reasons.push({ code: "artist-match", label: "常听歌手", weight: 24 });
    score += 24;
  }

  // 4. 偏好流派风格（保留原有代码与测试权重）
  if (song.genre && context.topGenres.includes(song.genre)) {
    reasons.push({ code: "genre-match", label: "偏好风格", weight: 18 });
    score += 18;
  }

  // 5. 时段氛围契合度
  if (context.mode) {
    const titleAndGenre = `${song.title || ""} ${song.genre || ""} ${song.album || ""}`.toLowerCase();
    const modeName = (
      context.mode.name ||
      (context.mode as any).title ||
      ""
    ).toLowerCase();
    if (modeName.includes("专注") || modeName.includes("下午") || modeName.includes("focus")) {
      const isFocusFriendly = /focus|acoustic|piano|lofi|ambient|instrumental|chill|吉他|钢琴|民谣|纯音乐|慢|安静/i.test(titleAndGenre);
      if (isFocusFriendly) {
        score += 15;
      }
    } else if (modeName.includes("沉浸") || modeName.includes("深夜") || modeName.includes("夜晚") || modeName.includes("night")) {
      const isNightFriendly = /night|dream|ambient|ballad|slow|soul|jazz|夜|梦|星|晚安|轻/i.test(titleAndGenre);
      if (isNightFriendly) {
        score += 15;
      }
    } else if (modeName.includes("活力") || modeName.includes("早间") || modeName.includes("morning")) {
      const isMorningFriendly = /morning|sun|bright|energy|pop|rock|dance|早|晨|光|燃|活力/i.test(titleAndGenre);
      if (isMorningFriendly) {
        score += 15;
      }
    }
  }

  // 6. 适合复听（保留原有代码与测试权重）
  if ((song.playCount || 0) >= 3) {
    reasons.push({ code: "replay-friendly", label: "适合复听", weight: 14 });
    score += 14;
  }

  // 7. 新鲜发现（保留原有代码与测试权重）
  if (!recentIds.has(song.id) && (song.playCount || 0) <= 1) {
    reasons.push({ code: "fresh-discovery", label: "新鲜发现", weight: 12 });
    score += 12;
  }

  // 8. 跳过风险考量（保留原有代码与测试权重）
  if (!context.skippedSongIds.has(song.id)) {
    reasons.push({ code: "skip-avoidance", label: "低跳过风险", weight: 8 });
    score += 8;
  } else {
    score -= 20;
  }

  if (reasons.length === 0) {
    reasons.push({ code: "fresh-discovery", label: "新鲜发现", weight: 8 });
    score += 8;
  }

  return {
    song,
    score: Math.max(0, score),
    reasons,
  };
}

export function generateExplainableRecommendations(
  songs: SongWithPlayCount[],
  context: RecommendationContext,
  limit: number = 20,
  dismissedSongIds: string[] = []
): ScoredRecommendation[] {
  const dismissed = new Set(dismissedSongIds);

  return songs
    .filter((song) => !dismissed.has(song.id))
    .map((song) => scoreSongForRecommendation(song, context))
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title))
    .slice(0, limit);
}

export interface DailyRecommendationMode {
  name: string;
  hour: number;
  targetFamiliarity: number;
  targetFreshness: number;
  description: string;
}

export const AVAILABLE_RECOMMENDATION_MODES: DailyRecommendationMode[] = [
  {
    name: "下午专注",
    hour: 15,
    targetFamiliarity: 0.6,
    targetFreshness: 0.4,
    description: "专注工作的下午推荐",
  },
  {
    name: "深夜沉浸",
    hour: 23,
    targetFamiliarity: 0.7,
    targetFreshness: 0.3,
    description: "适合夜晚的沉浸推荐",
  },
  {
    name: "早间活力",
    hour: 8,
    targetFamiliarity: 0.55,
    targetFreshness: 0.45,
    description: "充满活力的早间推荐",
  },
  {
    name: "午间放松",
    hour: 12,
    targetFamiliarity: 0.5,
    targetFreshness: 0.5,
    description: "舒缓的午间推荐",
  },
  {
    name: "傍晚平衡",
    hour: 18,
    targetFamiliarity: 0.45,
    targetFreshness: 0.55,
    description: "平衡的傍晚推荐",
  },
];

export interface DailyRecommendationGroup {
  category: "familiar" | "extend" | "discover";
  title: string;
  description: string;
  songs: SongWithPlayCount[];
  reasons: Map<string, RecommendationReason[]>;
}

export interface DailyRecommendationResult {
  groups: DailyRecommendationGroup[];
  orderedSongs: SongWithPlayCount[];
  mode: DailyRecommendationMode;
  generatedAt: number;
}

export function getDailyRecommendationMode(hour?: number): DailyRecommendationMode {
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 11)
    return AVAILABLE_RECOMMENDATION_MODES[2]; // 早间活力
  if (h >= 11 && h < 14)
    return AVAILABLE_RECOMMENDATION_MODES[3]; // 午间放松
  if (h >= 14 && h < 17)
    return AVAILABLE_RECOMMENDATION_MODES[0]; // 下午专注
  if (h >= 17 && h < 21)
    return AVAILABLE_RECOMMENDATION_MODES[4]; // 傍晚平衡
  return AVAILABLE_RECOMMENDATION_MODES[1]; // 深夜沉浸
}

export function generateDailyRecommendationGroups(
  songs: SongWithPlayCount[],
  context: RecommendationContext,
  mode: DailyRecommendationMode = getDailyRecommendationMode(),
  perGroupLimit: number = 6
): DailyRecommendationResult {
  const effectiveContext = { ...context, mode };
  const scored = songs.map((song) => scoreSongForRecommendation(song, effectiveContext));
  const byScore = [...scored].sort(
    (a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title)
  );

  // ─── 艺术家多样性防堆砌算法 (Anti-Monopoly Artist Guard) ───
  const pickDiverse = (
    candidates: ScoredRecommendation[],
    limit: number,
    globalArtistCounts: Map<string, number>,
    maxPerArtist: number = 1
  ): ScoredRecommendation[] => {
    const picked: ScoredRecommendation[] = [];
    const localArtists = new Set<string>();

    for (const item of candidates) {
      if (picked.length >= limit) break;
      const artist = (item.song.artist || "未知歌手").toLowerCase().trim();
      const count = globalArtistCounts.get(artist) || 0;

      if (count < maxPerArtist && !localArtists.has(artist)) {
        picked.push(item);
        localArtists.add(artist);
        globalArtistCounts.set(artist, count + 1);
      }
    }

    // 若曲库总独立歌手数不足，平滑兜底填满
    if (picked.length < limit) {
      for (const item of candidates) {
        if (picked.length >= limit) break;
        if (!picked.some((p) => p.song.id === item.song.id)) {
          picked.push(item);
        }
      }
    }

    return picked;
  };

  const globalArtistCounts = new Map<string, number>();

  const familiarCandidates = byScore.filter((item) => (item.song.playCount || 0) >= 3);
  const familiar = pickDiverse(familiarCandidates, perGroupLimit, globalArtistCounts, 1);

  const discoverCandidates = byScore.filter(
    (item) => (item.song.playCount || 0) <= 1 && !familiar.some((f) => f.song.id === item.song.id)
  );
  const discover = pickDiverse(discoverCandidates, perGroupLimit, globalArtistCounts, 1);
  const familiarIds = new Set(familiar.map((item) => item.song.id));
  const discoverIds = new Set(discover.map((item) => item.song.id));
  const extendCandidates = byScore.filter(
    (item) => !familiarIds.has(item.song.id) && !discoverIds.has(item.song.id)
  );
  const extend = pickDiverse(extendCandidates, perGroupLimit, globalArtistCounts, 1);

  const makeGroup = (
    category: DailyRecommendationGroup["category"],
    title: string,
    description: string,
    items: ScoredRecommendation[]
  ): DailyRecommendationGroup => ({
    category,
    title,
    description,
    songs: items.map((item) => item.song),
    reasons: new Map(items.map((item) => [item.song.id, item.reasons])),
  });

  const groups = [
    makeGroup("familiar", "常听延续", "从你的高频播放里挑选", familiar),
    makeGroup("extend", "相邻探索", "沿着当前偏好向外扩展", extend),
    makeGroup("discover", "新鲜发现", "降低重复度，补充新鲜感", discover),
  ].filter((group) => group.songs.length > 0);

  const orderedSongs: SongWithPlayCount[] = [];
  const usedIds = new Set<string>();
  const rounds = Math.max(...groups.map((group) => group.songs.length), 0);
  for (let index = 0; index < rounds; index++) {
    for (const group of groups) {
      const song = group.songs[index];
      if (song && !usedIds.has(song.id)) {
        orderedSongs.push(song);
        usedIds.add(song.id);
      }
    }
  }

  // 保证连续两首曲目不会出现同一个歌手连续堆叠
  for (let i = 0; i < orderedSongs.length - 1; i++) {
    if (orderedSongs[i].artist && orderedSongs[i].artist === orderedSongs[i + 1].artist) {
      const swapIdx = orderedSongs.findIndex(
        (s, idx) => idx > i + 1 && s.artist !== orderedSongs[i].artist
      );
      if (swapIdx !== -1) {
        const temp = orderedSongs[i + 1];
        orderedSongs[i + 1] = orderedSongs[swapIdx];
        orderedSongs[swapIdx] = temp;
      }
    }
  }

  return {
    groups,
    orderedSongs,
    mode,
    generatedAt: Date.now(),
  };
}
