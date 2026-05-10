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
