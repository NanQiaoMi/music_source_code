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
