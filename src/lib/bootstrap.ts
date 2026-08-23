import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";

/**
 * bootstrapApp - Orchestrates the startup sequence of the application.
 */
export async function bootstrapApp() {
  console.log("[Bootstrap] Starting mimimusic initialization...");

  try {
    // 1. 同步恢复持久化的播放队列与当前选定歌曲
    const restoredSong = usePlayerStore.getState().currentSong;
    const restoredQueue = useQueueStore.getState().queue;
    const restoredIndex = useQueueStore.getState().currentIndex;

    if (restoredSong) {
      useAudioStore.setState({
        currentSong: restoredSong,
        isPlaying: false, // 启动时保持就绪状态，等待用户点击播放
        currentTime: usePlayerStore.getState().currentTime || 0,
        duration: usePlayerStore.getState().duration || restoredSong.duration || 0,
      });
      console.log(`[Bootstrap] 🎵 已恢复上次播放歌曲: 《${restoredSong.title}》- ${restoredSong.artist}`);
    }

    if (restoredQueue && restoredQueue.length > 0) {
      useAudioStore.setState({
        queue: restoredQueue,
        currentIndex: restoredIndex || 0,
      });
      console.log(`[Bootstrap] 📋 已恢复上次播放队列: ${restoredQueue.length} 首歌曲`);
    }

    await usePlaylistStore.getState().initializePlaylist();
    console.log("[Bootstrap] Playlist initialized.");

    useEmotionStore.getState().initializeEmotions();
    console.log("[Bootstrap] Emotion engine ready.");

    console.log("[Bootstrap] Application successfully bootstrapped.");
    return true;
  } catch (error) {
    console.error("[Bootstrap] Critical failure during startup:", error);
    return false;
  }
}
