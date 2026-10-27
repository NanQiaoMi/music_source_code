import { AudioSliceCreator, SourceSliceState, Song } from "./types";
import {
  hasPlayableAudioSource,
  createMissingAudioSourceError,
} from "@/lib/audio/playableAudioSource";
import { toast } from "@/components/shared/GlassToast";
import { usePlayerStore } from "../playerStore";

export const createSourceSlice: AudioSliceCreator<SourceSliceState> = (set, get) => ({
  verifyAndResolveSource: async (song: Song, timeoutMs = 3000): Promise<boolean> => {
    if (!song) return false;

    // 基础静态合法性校验
    if (!hasPlayableAudioSource(song)) {
      get().handleSourceError(song, createMissingAudioSourceError());
      return false;
    }

    // 若为本地音源 (local://)，进行轻量防御性探测
    if (song.source === "local" || song.audioUrl?.startsWith("local://")) {
      try {
        const timeoutPromise = new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error("Local source resolution timeout")), timeoutMs)
        );

        const checkPromise = (async () => {
          // 若存在有效 blob 或 audioUrl，视为可解析
          return Boolean(song.audioUrl && song.audioUrl.length > 0);
        })();

        const isResolved = await Promise.race([checkPromise, timeoutPromise]);
        if (!isResolved) {
          get().handleSourceError(song, new Error("Empty audio source URL"));
          return false;
        }
      } catch (err) {
        get().handleSourceError(song, err);
        return false;
      }
    }

    return true;
  },

  handleSourceError: (song: Song, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : "音源无法解析或已失效";

    // 设置错误状态并停止加载转圈
    usePlayerStore.getState().setIsLoading(false);
    usePlayerStore.getState().setIsPlaying(false);
    set({
      isLoading: false,
      isPlaying: false,
      error: {
        type: "load",
        message: `「${song.title || "未知曲目"}」${errorMessage}`,
        timestamp: Date.now(),
      },
    });

    // 友好 Toast 提示
    try {
      toast.warning(`「${song.title || "当前歌曲"}」音源加载失败，正在自动播放下一首...`);
    } catch {
      // 在非 DOM 或测试环境下降级静默
    }

    // 优雅顺跳至下一首可播歌曲
    setTimeout(() => {
      const currentAudio = get();
      if (currentAudio.currentSong?.id === song.id) {
        currentAudio.nextSong();
      }
    }, 100);
  },
});
