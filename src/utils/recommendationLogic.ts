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
        .replace(/[\(\[\{].*?[\)\]\}]/g, "")
        .replace(/remix|mix|edit|version|cover|live|acoustic|demo|radio/gi, "")
        .trim();
      const cleanTitleB = titleB
        .replace(/[\(\[\{].*?[\)\]\}]/g, "")
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
  const { currentSong, x, y } = params;

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
      .map((item) => {
        const updatedScore = getSmartScore(item.song, maxPlayCount, params, selectedSongs);
        return updatedScore;
      });

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

export function scoreSongForRecommendation(
  song: SongWithPlayCount,
  context: RecommendationContext
): ScoredRecommendation {
  const reasons: RecommendationReason[] = [];
  let score = 50;
  const recentIds = new Set(context.recentSongs.map((recentSong) => recentSong.id));

  if (context.topArtists.includes(song.artist)) {
    reasons.push({ code: "artist-match", label: "常听歌手", weight: 24 });
    score += 24;
  }

  if (song.genre && context.topGenres.includes(song.genre)) {
    reasons.push({ code: "genre-match", label: "偏好风格", weight: 18 });
    score += 18;
  }

  if ((song.playCount || 0) >= 3) {
    reasons.push({ code: "replay-friendly", label: "适合复听", weight: 14 });
    score += 14;
  }

  if (!recentIds.has(song.id) && (song.playCount || 0) <= 1) {
    reasons.push({ code: "fresh-discovery", label: "新鲜发现", weight: 12 });
    score += 12;
  }

  if (!context.skippedSongIds.has(song.id)) {
    reasons.push({ code: "skip-avoidance", label: "低跳过风险", weight: 8 });
    score += 8;
  } else {
    score -= 20;
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
  if (h >= 5 && h < 11) return { name: "早间活力", hour: h, targetFamiliarity: 0.55, targetFreshness: 0.45, description: "充满活力的早间推荐" };
  if (h >= 11 && h < 14) return { name: "午间放松", hour: h, targetFamiliarity: 0.5, targetFreshness: 0.5, description: "舒缓的午间推荐" };
  if (h >= 14 && h < 17) return { name: "下午专注", hour: h, targetFamiliarity: 0.6, targetFreshness: 0.4, description: "专注工作的下午推荐" };
  if (h >= 17 && h < 21) return { name: "傍晚平衡", hour: h, targetFamiliarity: 0.45, targetFreshness: 0.55, description: "平衡的傍晚推荐" };
  return { name: "夜间舒缓", hour: h, targetFamiliarity: 0.65, targetFreshness: 0.35, description: "舒缓放松的夜间推荐" };
}

export function generateDailyRecommendationGroups(
  songs: SongWithPlayCount[],
  context: RecommendationContext,
  mode?: DailyRecommendationMode,
  groupSize: number = 6
): DailyRecommendationResult {
  const effectiveMode = mode ?? getDailyRecommendationMode();
  const maxPlayCount = getMaxPlayCount(songs);
  const now = Date.now();
  const recentThreshold = now - 14 * 24 * 60 * 60 * 1000;

  const scored = songs.map((song) => {
    const s = scoreSongForRecommendation(song, context);
    const f = calculateFamiliarityScore(song, maxPlayCount);
    const r = calculateFreshnessScore(song, maxPlayCount);
    return { ...s, _familiarity: f, _freshness: r, _isRecent: (song.addedAt ?? 0) > recentThreshold };
  }).sort((a, b) => b.score - a.score);

  const used = new Set<string>();
  const pick = (filter: (s: typeof scored[0]) => boolean, limit: number) => {
    const result: typeof scored = [];
    for (const s of scored) {
      if (result.length >= limit) break;
      if (used.has(s.song.id) || !filter(s)) continue;
      result.push(s);
      used.add(s.song.id);
    }
    return result;
  };

  const familiarSongs = pick((s) => s._familiarity >= 0.5 || s._familiarity >= effectiveMode.targetFamiliarity - 0.15, groupSize);
  const extendSongs = pick((s) => context.topArtists.includes(s.song.artist) || (!!s.song.genre && context.topGenres.includes(s.song.genre)), groupSize);
  const discoverSongs = pick(() => true, groupSize);

  const buildReasons = (items: {song: SongWithPlayCount; reasons: RecommendationReason[]}[]) => {
    const m = new Map<string, RecommendationReason[]>();
    for (const item of items) m.set(item.song.id, item.reasons);
    return m;
  };

  const groups: DailyRecommendationGroup[] = [];
  if (familiarSongs.length) groups.push({ category: "familiar", title: "熟悉再听", description: "你经常听的歌", songs: familiarSongs.map(s => s.song), reasons: buildReasons(familiarSongs) });
  if (extendSongs.length) groups.push({ category: "extend", title: "风格延展", description: "与你偏好相似的歌", songs: extendSongs.map(s => s.song), reasons: buildReasons(extendSongs) });
  if (discoverSongs.length) groups.push({ category: "discover", title: "新鲜发现", description: "探索未知音乐", songs: discoverSongs.map(s => s.song), reasons: buildReasons(discoverSongs) });

  const orderedSongs = [...familiarSongs, ...extendSongs, ...discoverSongs].map(s => s.song);
  return { groups, orderedSongs, mode: effectiveMode, generatedAt: now };
}
