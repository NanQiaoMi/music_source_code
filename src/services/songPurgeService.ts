import { Song } from "@/types/song";
import { deleteStoredMusic } from "./localMusicStorage";
import { deleteCoverFromCache } from "./coverCache";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { useLibraryHealthStore, generateHealthReport } from "@/store/libraryHealthStore";

export interface InvalidSongEvaluation {
  isInvalid: boolean;
  reasons: string[];
  severity: "critical" | "warning" | "info";
}

export interface PurgeReport {
  purgedSongIds: string[];
  purgedCount: number;
  remainingSongsCount: number;
  clearedFromQueueCount: number;
  stoppedPlayback: boolean;
  timestamp: number;
}

/**
 * Evaluates whether a song has no real/playable information or has critical flaws.
 */
export function evaluateSongIntegrity(song: Song): InvalidSongEvaluation {
  const reasons: string[] = [];

  const hasNoAudioUrl =
    !song.audioUrl ||
    typeof song.audioUrl !== "string" ||
    song.audioUrl.trim() === "" ||
    song.audioUrl === "undefined" ||
    song.audioUrl === "null";

  const hasInvalidDuration =
    song.duration === undefined ||
    song.duration === null ||
    isNaN(song.duration) ||
    song.duration <= 0;

  const normalizedTitle = (song.title || "").trim().toLowerCase();
  const normalizedArtist = (song.artist || "").trim().toLowerCase();

  const isGhostMetadata =
    (!normalizedTitle ||
      normalizedTitle === "untitled" ||
      normalizedTitle === "未命名" ||
      normalizedTitle === "unknown") &&
    (!normalizedArtist ||
      normalizedArtist === "unknown artist" ||
      normalizedArtist === "未知歌手" ||
      normalizedArtist === "unknown");

  if (hasNoAudioUrl) {
    reasons.push("缺失有效音频链接或本地源已失效");
  }

  if (hasInvalidDuration) {
    reasons.push("音频时长异常 (0秒或无效时长)");
  }

  if (isGhostMetadata) {
    reasons.push("核心元数据完全缺失 (无有效标题与歌手)");
  }

  // Critical invalid: no audio url OR (invalid duration + ghost metadata)
  const isCritical = hasNoAudioUrl || (hasInvalidDuration && isGhostMetadata);
  const isInvalid = isCritical || hasInvalidDuration;

  return {
    isInvalid,
    reasons,
    severity: isCritical ? "critical" : isInvalid ? "warning" : "info",
  };
}

/**
 * Scans a list of songs and extracts all invalid/unplayable song records.
 */
export function scanInvalidSongs(songs: Song[]): Array<{ song: Song; evaluation: InvalidSongEvaluation }> {
  return songs
    .map((song) => ({
      song,
      evaluation: evaluateSongIntegrity(song),
    }))
    .filter((item) => item.evaluation.isInvalid);
}

/**
 * Completely purges a list of songs across all stores, caches, and persistent IndexedDB storage.
 */
export async function purgeInvalidSongs(songIds: string[]): Promise<PurgeReport> {
  if (!songIds || songIds.length === 0) {
    const currentSongs = usePlaylistStore.getState().songs;
    return {
      purgedSongIds: [],
      purgedCount: 0,
      remainingSongsCount: currentSongs.length,
      clearedFromQueueCount: 0,
      stoppedPlayback: false,
      timestamp: Date.now(),
    };
  }

  const targetIdSet = new Set(songIds);

  // 1. Check & safely stop current playback if currently playing one of the target songs
  let stoppedPlayback = false;
  try {
    const audioState = useAudioStore.getState();
    if (audioState.currentSong && targetIdSet.has(audioState.currentSong.id)) {
      audioState.setIsPlaying(false);
      audioState.setCurrentSong(null);
      stoppedPlayback = true;
    }
  } catch (error) {
    console.warn("Error while updating audioStore during purge:", error);
  }

  // 2. Remove from QueueStore (queue, insertNext, history)
  let clearedFromQueueCount = 0;
  try {
    const queueState = useQueueStore.getState();
    const prevQueueLen = queueState.queue.length;
    const newQueue = queueState.queue.filter((s) => !targetIdSet.has(s.id));
    clearedFromQueueCount = prevQueueLen - newQueue.length;

    useQueueStore.setState({
      queue: newQueue,
      history: (queueState.history || []).filter((s) => !targetIdSet.has(s.id)),
    });
  } catch (error) {
    console.warn("Error while updating queueStore during purge:", error);
  }

  // 3. Remove from PlaylistStore (songs, filteredSongs, recentPlayed, selectedSong)
  let remainingSongsCount = 0;
  try {
    const playlistState = usePlaylistStore.getState();
    const newSongs = playlistState.songs.filter((s) => !targetIdSet.has(s.id));
    const newFiltered = playlistState.filteredSongs.filter((s) => !targetIdSet.has(s.id));
    const newRecent = playlistState.recentPlayed.filter((s) => !targetIdSet.has(s.id));
    const newSelectedIds = new Set(
      Array.from(playlistState.selectedSongIds).filter((id) => !targetIdSet.has(id))
    );
    const newSelectedSong =
      playlistState.selectedSong && targetIdSet.has(playlistState.selectedSong.id)
        ? null
        : playlistState.selectedSong;

    usePlaylistStore.setState({
      songs: newSongs,
      filteredSongs: newFiltered,
      recentPlayed: newRecent,
      selectedSongIds: newSelectedIds,
      selectedSong: newSelectedSong,
    });
    remainingSongsCount = newSongs.length;
  } catch (error) {
    console.warn("Error while updating playlistStore during purge:", error);
  }

  // 4. Cascade purge from IndexedDB & CoverCache
  await Promise.all(
    songIds.map(async (songId) => {
      try {
        await deleteStoredMusic(songId);
      } catch (err) {
        console.warn(`Failed to delete stored music for id ${songId}:`, err);
      }
      try {
        await deleteCoverFromCache(songId);
      } catch (err) {
        console.warn(`Failed to delete cover cache for id ${songId}:`, err);
      }
    })
  );

  // 5. Update LibraryHealthStore report
  try {
    const remainingSongs = usePlaylistStore.getState().songs;
    const newReport = generateHealthReport(remainingSongs);
    useLibraryHealthStore.getState().setHealthReport(newReport);
  } catch (error) {
    console.warn("Error while refreshing library health report after purge:", error);
  }

  return {
    purgedSongIds: songIds,
    purgedCount: songIds.length,
    remainingSongsCount,
    clearedFromQueueCount,
    stoppedPlayback,
    timestamp: Date.now(),
  };
}
