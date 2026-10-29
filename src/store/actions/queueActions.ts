/**
 * S6-9c：队列写入的命令式入口。
 *
 * 后台预取只依赖 queueStore 一个事实源；单独成文件，避免把 audioStore/playerStore
 * 的模块图带进只用队列的调用方（与 sourceActions 分文件的理由相同）。
 * 与 playbackActions 的队列命令同源：薄适配、每次现取 getState、不缓存快照。
 */
import type { Song } from "@/types/song";
import { useQueueStore } from "@/store/queueStore";

/** 预取解析出直链后就地回填队列条目（顺序/长度不变，供即时切歌）。 */
export function patchQueueSongAudio(
  songId: string,
  patch: Pick<Song, "audioUrl" | "source">
): void {
  const { queue, setQueue } = useQueueStore.getState();
  setQueue(queue.map((song) => (song.id === songId ? { ...song, ...patch } : song)));
}
