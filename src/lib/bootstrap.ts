import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { AudioContextWatchdog } from "@/lib/audio/AudioContextWatchdog";

let bootstrapPromise: Promise<boolean> | null = null;
let hasRestoredPlaybackState = false;

/**
 * bootstrapApp - Orchestrates the startup sequence of the application.
 */
export function bootstrapApp(): Promise<boolean> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().then((success) => {
      // Allow service initialization to retry after a failure without restoring
      // the old playback snapshot over state the user may have changed meanwhile.
      if (!success) bootstrapPromise = null;
      return success;
    });
  }

  return bootstrapPromise;
}

async function runBootstrap(): Promise<boolean> {
  console.log("[Bootstrap] Starting mimimusic initialization...");

  try {
    // 1. 只在本次应用生命周期开始时恢复一次，路由返回主页不能重置播放中状态。
    if (!hasRestoredPlaybackState) {
      const restoredSong = usePlayerStore.getState().currentSong;

      if (restoredSong) {
        useAudioStore.setState({
          currentSong: restoredSong,
          isPlaying: false, // 启动时保持就绪状态，等待用户点击播放
          currentTime: usePlayerStore.getState().currentTime || 0,
          duration: usePlayerStore.getState().duration || restoredSong.duration || 0,
        });
        console.log(
          `[Bootstrap] 🎵 已恢复上次播放歌曲: 《${restoredSong.title}》- ${restoredSong.artist}`
        );
      }

      // S1-5: queue/currentIndex 已由 queueStore 自行持久化和恢复，
      // 启动时不再复制到 audioStore（单向投影会处理镜像）。
      const restoredLoopMode = usePlayerStore.getState().loopMode;
      if (restoredLoopMode) {
        useAudioStore.setState({ loopMode: restoredLoopMode });
        console.log(`[Bootstrap] 🔁 已恢复播放循环模式: ${restoredLoopMode}`);
      }

      hasRestoredPlaybackState = true;
    }

    await usePlaylistStore.getState().initializePlaylist();
    console.log("[Bootstrap] Playlist initialized.");

    useEmotionStore.getState().initializeEmotions();
    console.log("[Bootstrap] Emotion engine ready.");

    // 启动音频硬件自愈与系统健康巡检守卫
    AudioContextWatchdog.getInstance().start();

    console.log("[Bootstrap] Application successfully bootstrapped.");
    return true;
  } catch (error) {
    console.error("[Bootstrap] Critical failure during startup:", error);
    return false;
  }
}
