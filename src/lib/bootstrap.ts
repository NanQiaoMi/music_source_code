import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { AudioContextWatchdog } from "@/lib/audio/AudioContextWatchdog";
import { installFlushOnPageHide } from "@/lib/storage/throttledPersist";

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
    // S2-2：页面隐藏/关闭时补写节流中的播放进度（幂等）
    installFlushOnPageHide();

    // S2-6：dev-only 音频性能探针（window.__audioMetrics）；生产构建不会加载该 chunk。
    if (process.env.NODE_ENV !== "production") {
      void import("@/lib/perf/audioMetrics").catch(() => {});
    }

    // 1. 只在本次应用生命周期开始时恢复一次，路由返回主页不能重置播放中状态。
    if (!hasRestoredPlaybackState) {
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
        console.log(
          `[Bootstrap] 🎵 已恢复上次播放歌曲: 《${restoredSong.title}》- ${restoredSong.artist}`
        );
      }

      if (restoredQueue && restoredQueue.length > 0) {
        useAudioStore.setState({
          queue: restoredQueue,
          currentIndex: restoredIndex || 0,
        });
        console.log(`[Bootstrap] 📋 已恢复上次播放队列: ${restoredQueue.length} 首歌曲`);
      }

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
