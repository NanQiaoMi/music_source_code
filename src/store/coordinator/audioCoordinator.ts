/**
 * @deprecated 2026-10-21: unwired coordinator shell (0 imports outside this directory).
 * Kept for one release per AGENTS.md "不要删除不确定的代码"; do not import.
 * Replaced by the S6 domain use-cases + typed events (src/domain, src/lib/events).
 * Reference: docs/nbl/plans/2026-10-21-arch-perf-execution/S6-state-architecture.md
 */
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import type { Song } from "@/types/song";
import type { AudioCoordinator } from "./types";

export const audioCoordinator: AudioCoordinator = {
  playSong: (song: Song) => {
    const { playSong } = useAudioStore.getState();
    const { addToHistory } = useQueueStore.getState();
    playSong(song);
    addToHistory(song);
  },

  appendAndPlay: (songs: Song[]) => {
    const { appendSongsAndPlay } = useAudioStore.getState();
    appendSongsAndPlay(songs);
  },

  stopPlayback: () => {
    const { setCurrentSong, setIsPlaying } = useAudioStore.getState();
    const { clearQueue } = useQueueStore.getState();
    setCurrentSong(null);
    setIsPlaying(false);
    clearQueue();
  },
};
