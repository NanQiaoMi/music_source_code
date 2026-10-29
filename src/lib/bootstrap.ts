import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { AudioContextWatchdog } from "@/lib/audio/AudioContextWatchdog";
import { hydrateStores } from "@/lib/bootstrapStores";
import { getEmotionSnapshot } from "@/store/actions/emotionActions";
import { getPlayerSnapshot } from "@/store/actions/playbackActions";

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

  // S7-2b: 仅开发环境挂载缓存指标探针。生产构建下该分支被 DCE，且不会加载 chunk。
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    void import("@/lib/cache/cacheStats")
      .then(({ installCacheStatsProbe }) => installCacheStatsProbe())
      .catch(() => {
        // 探针失败不影响启动
      });
  }

  try {
    // 0. 所有 persist store 都设了 skipHydration；先按依赖顺序显式补齐，再做跨 store 投影。
    const { hydrated } = await hydrateStores();
    if (hydrated.length > 0) {
      console.log(`[Bootstrap] Hydrated ${hydrated.length} persisted stores.`);
    }

    // 1. 只在本次应用生命周期开始时恢复一次，路由返回主页不能重置播放中状态。
    if (!hasRestoredPlaybackState) {
      // S6-9c 白名单：启动恢复只跑一次，player 走动作层快照；队列没有可注入的 ports，
      // 这里保留一处直读（目标 restore 快照就取这一瞬间）。
      const player = getPlayerSnapshot();
      const restoredSong = player.currentSong;
      // eslint-disable-next-line no-lib-service-getstate -- S6-9c 白名单：restore 只跑一次，队列无 ports
      const queueState = useQueueStore.getState();
      const restoredQueue = queueState.queue;
      const restoredIndex = queueState.currentIndex;

      if (restoredSong) {
        // S6-4: 身份字段 currentSong 归 playerStore（hydrate 已恢复）；audioStore 镜像由
        // playerStore 投影维护，这里只回填进度/就绪字段，不再重复写身份字段。
        useAudioStore.setState({
          isPlaying: false, // 启动时保持就绪状态，等待用户点击播放
          currentTime: player.currentTime || 0,
          duration: player.duration || restoredSong.duration || 0,
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

      // S6-4: loopMode 归 playerStore；同名 setter 触发兼容投影，保持 audioStore 镜像一致
      const restoredLoopMode = player.loopMode;
      if (restoredLoopMode) {
        player.setLoopMode(restoredLoopMode);
        console.log(`[Bootstrap] 🔁 已恢复播放循环模式: ${restoredLoopMode}`);
      }

      hasRestoredPlaybackState = true;
    }

    // S6-9c 白名单：启动初始化命令（无 React 上下文，仅此处调用一次）。
    // eslint-disable-next-line no-lib-service-getstate -- S6-9c 白名单：启动仅一次，无 React 上下文
    await usePlaylistStore.getState().initializePlaylist();
    console.log("[Bootstrap] Playlist initialized.");

    getEmotionSnapshot().initializeEmotions();
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
