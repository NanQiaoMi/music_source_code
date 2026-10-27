"use client";

import { useAudioStore } from "@/store/audioStore";
import { VisualizationProgressBar } from "./VisualizationProgressBar";

interface VisualizationProgressContainerProps {
  onSeek: (time: number) => void;
}

/**
 * 进度条专用订阅边界。
 *
 * currentTime 随播放以 ~4Hz 更新、bufferedRanges 随缓冲刷新、duration 随换曲变化；
 * 这些字段只被进度条消费。让它们在这里订阅，可视化视图的顶层（画布、14 个效果按钮、
 * 页眉/页脚）就不会因为一次 timeupdate 而整体重渲染。
 */
export function VisualizationProgressContainer({ onSeek }: VisualizationProgressContainerProps) {
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const bufferedRanges = useAudioStore((state) => state.bufferedRanges);

  return (
    <VisualizationProgressBar
      currentTime={currentTime}
      duration={duration}
      bufferedRanges={bufferedRanges}
      onSeek={onSeek}
    />
  );
}
