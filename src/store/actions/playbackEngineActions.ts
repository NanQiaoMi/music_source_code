/**
 * S6-9d：播放引擎（useAudioPlayer / useMediaSession）的命令式 store 入口。
 *
 * 音频元素事件回调、异步装载链路、跨淡入与 MediaSession 处理器都必须读「此刻」的
 * 快照：改成 selector 订阅会把事件瞬间的值换成上一次渲染的快照（切歌、跨淡入、
 * 连续点播会读到旧歌/旧请求），因此保留命令式读取，只收口到动作层——hooks 不再
 * 直接触达 store（S6-9d 棘轮：hooks.getState = 0）。
 *
 * 约定与 serviceActions/sourceActions 一致：每次调用现取 getState、不缓存快照
 * （水合/持久化后不会读到过期状态）；本文件只做薄适配，不承载播放编排。
 */
import type { PlaybackMachineEvent } from "@/lib/audio/playbackStateMachine";
import type { Song } from "@/types/song";
import type { AudioError } from "@/store/slices/types";
import type { LoopMode } from "@/store/playerStore";
import { useABLoopStore } from "@/store/abLoopStore";
import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useListeningJournalStore } from "@/store/listeningJournalStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import { useUserAccountStore, type PlatformType } from "@/store/userAccountStore";

// ---- playbackRuntimeStore：播放请求 / 机位绑定 / 媒体事件 ----
export const bindPlaybackDeck = (
  requestId: number,
  songId: string | null,
  deckId: string,
  source: string
): void => {
  usePlaybackRuntimeStore.getState().bindActiveDeck(requestId, songId, deckId, source);
};

export const dispatchPlaybackMediaEvent = (
  event: Exclude<PlaybackMachineEvent, { type: "request" }>
): void => {
  usePlaybackRuntimeStore.getState().dispatchMediaEvent(event);
};

export const dispatchPlaybackRequestError = (requestId: number, message: string): void => {
  usePlaybackRuntimeStore.getState().dispatchMediaEvent({
    type: "request-error",
    requestId,
    message,
  });
};

export const isPlaybackIntentActive = (): boolean => usePlaybackRuntimeStore.getState().shouldPlay;

export const getPlaybackPhase = () => usePlaybackRuntimeStore.getState().phase;

export const getPlaybackRequestId = (): number => usePlaybackRuntimeStore.getState().requestId;

export const getPlaybackTargetSongId = (): string | null =>
  usePlaybackRuntimeStore.getState().targetSongId;

// ---- playerStore：身份 / 进度快照 + 当前曲目补丁 ----
export const getCurrentPlayerSong = (): Song | null => usePlayerStore.getState().currentSong;

export const getPlayerCurrentTime = (): number => usePlayerStore.getState().currentTime;

/** 播放引擎恢复倍速/单曲循环判断用：只读 loopMode，不引入整个 serviceActions 图。 */
export const getPlayerLoopMode = (): LoopMode => usePlayerStore.getState().loopMode;

export const commitCurrentSongLyrics = (lyrics: string, translationLyrics?: string): void => {
  usePlayerStore.getState().updateCurrentSongLyrics(lyrics, translationLyrics);
};

export const commitCurrentSongCover = (cover: string): void => {
  usePlayerStore.getState().updateCurrentSongCover(cover);
};

// ---- 进度 / 时长 / 加载：audioStore（权威）与 playerStore（投影）成对写入 ----
export function commitPlaybackDuration(duration: number): void {
  useAudioStore.getState().setDuration(duration);
  usePlayerStore.getState().setDuration(duration);
}

export function commitPlaybackLoading(loading: boolean): void {
  useAudioStore.getState().setIsLoading(loading);
  usePlayerStore.getState().setIsLoading(loading);
}

export function resetPlaybackPosition(): void {
  useAudioStore.getState().setCurrentTime(0);
  usePlayerStore.getState().setCurrentTime(0);
}

// ---- audioStore：传输命令（MediaSession / 快捷键桥） ----
export const setPlaybackIsPlaying = (playing: boolean): void => {
  useAudioStore.getState().setIsPlaying(playing);
};

export const setPlaybackCurrentTime = (time: number): void => {
  useAudioStore.getState().setCurrentTime(time);
};

export const setAudioError = (error: AudioError | null): void => {
  useAudioStore.getState().setError(error);
};

export const setAudioLoading = (loading: boolean): void => {
  useAudioStore.getState().setIsLoading(loading);
};

export const togglePlaybackIntent = (): void => {
  useAudioStore.getState().togglePlaybackIntent();
};

export const nextPlayback = (): void => {
  useAudioStore.getState().nextSong();
};

export const prevPlayback = (): void => {
  useAudioStore.getState().prevSong();
};

// ---- abLoopStore / queueStore：事件回调里的即时判断 ----
export const getABLoopSnapshot = () => useABLoopStore.getState();

export const incrementABLoopCount = (): void => {
  useABLoopStore.getState().incrementLoopCount();
};

export const getQueueSnapshot = () => useQueueStore.getState();

// ---- 听歌记录：情绪标签与日志裁剪 ----
export const getSongEmotion = (songId: string) => useEmotionStore.getState().emotionMap[songId];

export const trimListeningJournal = (): void => {
  useListeningJournalStore.getState().trimToLast90Days();
};

// ---- 播放失败引导：网络平台未登录时定向打开账号弹窗 ----
export function promptPlatformLogin(platform: PlatformType): void {
  const account = useUserAccountStore.getState();
  account.setActivePlatform(platform);
  account.setIsAccountModalOpen(true);
}
