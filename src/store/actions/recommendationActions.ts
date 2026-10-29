/**
 * S6-9d：每日推荐（useDailyRecommendation）的 store 命令式入口。
 *
 * 推荐生成是事件回调（定时/换一批）而非渲染体，必须读「此刻」的负反馈与收藏；
 * selector 化只会把最新值换成上一次渲染的快照，故命令式读取收口到动作层。
 */
import type { RecommendationContext } from "@/utils/recommendationLogic";
import type { Song } from "@/types/song";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useRecommendationStore } from "@/store/recommendationStore";

export const getNegativeFeedback = () => useRecommendationStore.getState().negativeFeedback;

export const getFavoriteSongs = (): Song[] => useFavoritesStore.getState().favorites || [];

export const refreshRecommendations = (songs: Song[], context: RecommendationContext): void => {
  useRecommendationStore.getState().refreshRecommendations(songs, context);
};
