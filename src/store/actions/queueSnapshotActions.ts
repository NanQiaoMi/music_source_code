/**
 * S6-5：非 React 调用方（手势动作层）读取「此刻」队列快照的唯一入口。
 * 单独成文件：queueActions/playbackActions 已冻结在 store 行数棘轮基线，
 * 且队列 owner 是 queueStore（audioStore 不再保留 queue 镜像）。
 */
import type { Song } from "@/types/song";
import { useQueueStore } from "@/store/queueStore";

/** 每次现取、不缓存快照；水合/删歌/重排后不会读到过期队列。 */
export function getQueueSnapshot(): Song[] {
  return useQueueStore.getState().queue;
}
