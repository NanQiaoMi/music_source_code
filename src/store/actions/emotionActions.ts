/**
 * S6-10b：情绪画布的「此刻」快照。
 *
 * draw 循环与指针事件里必须读到最新选择/悬停状态；改成 selector 会让每次
 * lasso 采点都触发 React 重渲染，因此保留命令式读取，只是收口到动作层。
 */
import { useEmotionStore } from "@/store/emotionStore";

export const getEmotionSnapshot = () => useEmotionStore.getState();
