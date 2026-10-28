/**
 * S6-10b：自动匹配完成后读取「此刻」的匹配结果。
 * await 之后渲染期闭包已过期，只能由 store 动作层返回最新值。
 */
import { useLyricsSearchStore } from "@/store/lyricsSearchStore";

export const getMatchedLyrics = () => useLyricsSearchStore.getState().currentLyrics;
