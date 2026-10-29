// S6-12r: 统计域纯函数 —— 日期键、播放聚合、看板查询与持久化候选裁剪。
// 不读写 store 状态；store 只负责把结果落进 state。
import type { Song } from "@/types/song";
import type { PersistCandidate } from "@/lib/storage/quotaPolicy";
import type { ListeningStats } from "./types";

export type AggregatedListeningStats = Pick<
  ListeningStats,
  | "uniqueArtists"
  | "uniqueAlbums"
  | "uniqueSongs"
  | "favoriteArtist"
  | "favoriteAlbum"
  | "favoriteSong"
  | "topArtists"
  | "topAlbums"
  | "topSongs"
>;

export function getTodayString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** calculateStats 的聚合主体：从曲目列表推导唯一计数、最爱条目与 Top 列表。 */
export function aggregateListeningStats(songs: Song[]): AggregatedListeningStats {
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

  return {
    uniqueArtists: uniqueArtists.size,
    uniqueAlbums: uniqueAlbums.size,
    uniqueSongs: uniqueSongs.size,
    favoriteArtist,
    favoriteAlbum,
    favoriteSong,
    topArtists,
    topAlbums,
    topSongs,
  };
}

/** 看板：今天 / 本周 / 本月 / 全部听歌时长。 */
export function computePlayTimeStats(stats: ListeningStats): {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
} {
  const _now = Date.now();
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
}

/** 看板：24 小时分布，缺失小时补 0。 */
export function toHourlyDistribution(
  dist: Record<number, number>
): { hour: number; count: number }[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: dist[hour] || 0,
  }));
}

interface StatsEnvelope {
  state?: {
    listeningStats?: {
      dailyPlayData?: unknown[];
      topSongs?: unknown[];
      topArtists?: unknown[];
      topAlbums?: unknown[];
      genreDistribution?: unknown[];
      [key: string]: unknown;
    };
    achievements?: unknown[];
    currentPeriod?: unknown;
    lastCalculated?: number;
  };
  version?: number;
}

function cloneStatsEnvelope(value: unknown): StatsEnvelope {
  return JSON.parse(JSON.stringify(value)) as StatsEnvelope;
}

/** 配额降级候选：全量 -> 30 天 -> 裁剪 Top -> 仅索引。 */
export function buildStatsCandidates(value: unknown): PersistCandidate[] {
  const candidates: PersistCandidate[] = [{ value: JSON.stringify(cloneStatsEnvelope(value)) }];

  const last30 = cloneStatsEnvelope(value);
  if (last30.state?.listeningStats?.dailyPlayData) {
    last30.state.listeningStats.dailyPlayData =
      last30.state.listeningStats.dailyPlayData.slice(-30);
  }
  candidates.push({ value: JSON.stringify(last30), degradedTo: "history-trimmed" });

  const pruned = cloneStatsEnvelope(value);
  if (pruned.state?.listeningStats) {
    const stats = pruned.state.listeningStats;
    stats.dailyPlayData = Array.isArray(stats.dailyPlayData) ? stats.dailyPlayData.slice(-7) : [];
    stats.topSongs = Array.isArray(stats.topSongs) ? stats.topSongs.slice(0, 10) : [];
    stats.topArtists = Array.isArray(stats.topArtists) ? stats.topArtists.slice(0, 10) : [];
    stats.topAlbums = Array.isArray(stats.topAlbums) ? stats.topAlbums.slice(0, 10) : [];
    stats.genreDistribution = Array.isArray(stats.genreDistribution)
      ? stats.genreDistribution.slice(0, 10)
      : [];
  }
  candidates.push({ value: JSON.stringify(pruned), degradedTo: "pruned" });

  const minimal = cloneStatsEnvelope(value);
  if (minimal.state?.listeningStats) {
    const stats = minimal.state.listeningStats;
    stats.dailyPlayData = Array.isArray(stats.dailyPlayData) ? stats.dailyPlayData.slice(-1) : [];
    stats.topSongs = Array.isArray(stats.topSongs) ? stats.topSongs.slice(0, 5) : [];
    stats.topArtists = Array.isArray(stats.topArtists) ? stats.topArtists.slice(0, 5) : [];
    stats.topAlbums = Array.isArray(stats.topAlbums) ? stats.topAlbums.slice(0, 5) : [];
    stats.genreDistribution = [];
  }
  candidates.push({ value: JSON.stringify(minimal), degradedTo: "index-only" });

  return candidates;
}
