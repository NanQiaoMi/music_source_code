/**
 * S6-9c：播放运行时状态机（requestId/targetSource/activeDeckId）的命令式快照入口。
 *
 * PlaybackClock 的绑定/初始同步要读「此刻」运行时状态；lib 层不再直接 getState，
 * 与 emotionActions 同理只做薄适配：每次现取、不缓存快照。
 */
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";

export const getPlaybackRuntimeSnapshot = () => usePlaybackRuntimeStore.getState();
