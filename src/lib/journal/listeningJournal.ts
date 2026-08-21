import type { Song } from "@/types/song";
import type { EmotionCoordinate } from "@/types/emotion";

export interface JournalPlayEvent {
  songId: string;
  playedAt: number;
  listenSeconds: number;
  mood?: string | null;
}

export interface JournalDay {
  date: string;
  totalMinutes: number;
  topSongIds: string[];
  dominantMood: string | null;
  note?: string;
}

export interface JournalSongRow {
  id: string;
  title: string;
  artist: string;
  album?: string;
  missing: boolean;
  playCount: number;
  totalMinutes: number;
}

export function deriveJournalMood(emotion?: EmotionCoordinate | null): string | null {
  if (!emotion) return null;

  const valence = Number.isFinite(emotion.x) ? Math.max(-1, Math.min(1, emotion.x)) : 0;
  const arousal = Number.isFinite(emotion.y) ? Math.max(-1, Math.min(1, emotion.y)) : 0;

  if (Math.abs(valence) < 0.15 && Math.abs(arousal) < 0.15) return "neutral";
  if (arousal >= 0.35) return valence >= 0 ? "uplift" : "intense";
  if (arousal <= -0.35) return valence >= 0 ? "soft" : "low-key";
  return valence >= 0 ? "bright" : "reflective";
}

export function rollupDay(date: string, events: JournalPlayEvent[], note?: string): JournalDay {
  const songCounts = new Map<string, number>();
  const moodCounts = new Map<string, number>();
  const moodOrder = new Map<string, number>();
  let totalSeconds = 0;

  events.forEach((event, index) => {
    totalSeconds += Math.max(0, event.listenSeconds || 0);
    songCounts.set(event.songId, (songCounts.get(event.songId) || 0) + 1);

    const mood = event.mood?.trim();
    if (mood) {
      moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1);
      if (!moodOrder.has(mood)) moodOrder.set(mood, index);
    }
  });

  const topSongIds = [...songCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([songId]) => songId);

  const dominantMood =
    [...moodCounts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (moodOrder.get(a[0]) || 0) - (moodOrder.get(b[0]) || 0);
    })[0]?.[0] || null;

  return {
    date,
    totalMinutes: Math.round(totalSeconds / 60),
    topSongIds,
    dominantMood,
    ...(note ? { note } : {}),
  };
}

export function getIsoDate(offsetDays = 0, anchorDate = new Date()): string {
  const date = new Date(anchorDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function buildJournalSongRows(
  songIds: string[],
  library: Song[],
  events: JournalPlayEvent[] = []
): JournalSongRow[] {
  const songById = new Map(library.map((song) => [song.id, song]));
  const eventStats = new Map<string, { playCount: number; listenSeconds: number }>();

  events.forEach((event) => {
    const current = eventStats.get(event.songId) || { playCount: 0, listenSeconds: 0 };
    eventStats.set(event.songId, {
      playCount: current.playCount + 1,
      listenSeconds: current.listenSeconds + Math.max(0, event.listenSeconds || 0),
    });
  });

  return songIds.map((id) => {
    const song = songById.get(id);
    const stats = eventStats.get(id) || { playCount: 0, listenSeconds: 0 };
    const summary = {
      playCount: stats.playCount,
      totalMinutes: Math.round(stats.listenSeconds / 60),
    };

    if (!song) {
      return {
        id,
        title: id,
        artist: "Unknown artist",
        album: undefined,
        missing: true,
        ...summary,
      };
    }

    return {
      id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      missing: false,
      ...summary,
    };
  });
}
