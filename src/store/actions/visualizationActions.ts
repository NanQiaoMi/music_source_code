/**
 * S6-10b：可视化画布的「此刻」快照（每帧读取，不能订阅）。
 */
import { useVisualizationStore } from "@/store/visualizationStore";

export const getVisualizationSnapshot = () => useVisualizationStore.getState();
