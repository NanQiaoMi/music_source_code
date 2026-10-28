import { Song } from "@/types/song";
import { deleteStoredMusic } from "./localMusicStorage";
import { deleteCoverFromCache } from "./coverCache";
import { defaultPlaybackPorts, type PlaybackPorts } from "@/domain/playback/ports";
import {
  getPlaylistSongsSnapshot,
  refreshHealthReport,
  removeSongsFromPlaylist,
  removeSongsFromQueue,
} from "@/store/actions/serviceActions";

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
export function scanInvalidSongs(
  songs: Song[]
): Array<{ song: Song; evaluation: InvalidSongEvaluation }> {
  return songs
    .map((song) => ({
      song,
      evaluation: evaluateSongIntegrity(song),
    }))
    .filter((item) => item.evaluation.isInvalid);
}

/**
 * Completely purges a list of songs across all stores, caches, and persistent IndexedDB storage.
 * 播放停止走 PlaybackPorts（S6-10），其余跨 store 写入走 store 导出的命令式 action。
 */
export async function purgeInvalidSongs(
  songIds: string[],
  playbackPorts: PlaybackPorts = defaultPlaybackPorts
): Promise<PurgeReport> {
  if (!songIds || songIds.length === 0) {
    const currentSongs = getPlaylistSongsSnapshot();
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
    // 播放快照/停止统一走 PlaybackPorts；默认适配器读 playerStore、写 audioStore。
    const currentSong = playbackPorts.getSnapshot().currentSong;
    if (currentSong && targetIdSet.has(currentSong.id)) {
      playbackPorts.clearCurrentSong();
      stoppedPlayback = true;
    }
  } catch (error) {
    console.warn("Error while stopping playback during purge:", error);
  }

  // 2. Remove from QueueStore (queue, insertNext, history)
  let clearedFromQueueCount = 0;
  try {
    clearedFromQueueCount = removeSongsFromQueue(targetIdSet);
  } catch (error) {
    console.warn("Error while updating queueStore during purge:", error);
  }

  // 3. Remove from PlaylistStore (songs, filteredSongs, recentPlayed, selectedSong)
  let remainingSongsCount = 0;
  try {
    remainingSongsCount = removeSongsFromPlaylist(targetIdSet);
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
    refreshHealthReport(getPlaylistSongsSnapshot());
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
