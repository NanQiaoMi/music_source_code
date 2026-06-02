import { hasPlayableAudioSource } from "@/lib/audio/playableAudioSource";
import type { HistorySong } from "@/store/queueStore";
import type { Song } from "@/types/song";

function historySongFallback(song: HistorySong): Song {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    cover: song.cover || "/default-cover.png",
    source: "local",
  };
}

export function resolveHistoryPlaybackSong(historySong: HistorySong, librarySongs: Song[]): Song {
  return (
    librarySongs.find((song) => song.id === historySong.id) || historySongFallback(historySong)
  );
}

export function resolvePlayableHistorySongs(
  historySongs: HistorySong[],
  librarySongs: Song[]
): Song[] {
  return historySongs
    .map((song) => resolveHistoryPlaybackSong(song, librarySongs))
    .filter(hasPlayableAudioSource);
}
