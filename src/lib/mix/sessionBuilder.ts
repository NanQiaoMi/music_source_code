import type { Song } from "@/types/song";

export interface SmartMixKnobs {
  energy: number;
  familiarity: number;
  length: number;
}

export interface SmartMixInput {
  seedSong: Song;
  library: Song[];
  recentSongIds: string[];
  knobs: SmartMixKnobs;
  random?: () => number;
}

export interface SmartMixSession {
  id: string;
  seedSongId: string;
  songs: Song[];
  knobs: SmartMixKnobs;
  createdAt: number;
}

interface ScoredSong {
  song: Song;
  score: number;
}

export function buildSession(input: SmartMixInput): SmartMixSession {
  const knobs = normalizeKnobs(input.knobs);
  const random = input.random || Math.random;
  const recentIds = new Set(input.recentSongIds);
  const createdAt = Date.now();
  const uniqueSongs = dedupeSongs([input.seedSong, ...input.library]);
  const candidates = uniqueSongs.filter((song) => song.id !== input.seedSong.id);

  const scored = candidates
    .map<ScoredSong>((song) => ({
      song,
      score: scoreSong(song, input.seedSong, knobs, recentIds, random()),
    }))
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title));

  return {
    id: `mix-${input.seedSong.id}-${createdAt}`,
    seedSongId: input.seedSong.id,
    songs: [input.seedSong, ...scored.map((item) => item.song)].slice(0, knobs.length),
    knobs,
    createdAt,
  };
}

export function normalizeKnobs(knobs: SmartMixKnobs): SmartMixKnobs {
  return {
    energy: clamp01(knobs.energy),
    familiarity: clamp01(knobs.familiarity),
    length: Math.max(5, Math.min(50, Math.round(knobs.length))),
  };
}

function dedupeSongs(songs: Song[]): Song[] {
  const seen = new Set<string>();
  const result: Song[] = [];

  for (const song of songs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    result.push(song);
  }

  return result;
}

function scoreSong(
  song: Song,
  seedSong: Song,
  knobs: SmartMixKnobs,
  recentIds: Set<string>,
  randomValue: number
): number {
  const genreMatch = song.genre && seedSong.genre && song.genre === seedSong.genre ? 0.25 : 0;
  const artistMatch = song.artist === seedSong.artist ? 0.2 : 0;
  const albumMatch = song.album && seedSong.album && song.album === seedSong.album ? 0.1 : 0;
  const energyScore = 1 - Math.abs(estimateEnergy(song) - knobs.energy);
  const familiarityScore = normalizePlayCount(song.playCount || 0);
  const recentPenalty = recentIds.has(song.id) ? -0.35 : 0.1;

  return (
    genreMatch +
    artistMatch +
    albumMatch +
    energyScore * 0.35 +
    familiarityScore * knobs.familiarity * 0.3 +
    recentPenalty * (1 - knobs.familiarity) +
    clamp01(randomValue) * 0.08
  );
}

function estimateEnergy(song: Song): number {
  if (typeof song.bpm === "number" && Number.isFinite(song.bpm)) {
    return clamp01((song.bpm - 70) / 110);
  }

  const genre = song.genre?.toLowerCase() || "";
  if (/edm|dance|rock|metal|punk|drum|house|techno/.test(genre)) return 0.85;
  if (/ambient|classical|lofi|jazz|acoustic|piano/.test(genre)) return 0.3;
  return 0.55;
}

function normalizePlayCount(playCount: number): number {
  if (playCount <= 0) return 0;
  return clamp01(Math.log10(playCount + 1) / 2);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
