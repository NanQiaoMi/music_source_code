"use client";

import { useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useAudioSourceStore } from "@/store/audioSourceStore";
import { beatMapAnalyzer, BeatMapData } from "@/services/BeatMapAnalyzer";
import { Song } from "@/types/song";

export function useIntegratedAudioPipeline() {
  // S6-4: 身份字段 setter 归 playerStore（audioStore 同名 action 仅为转发）
  const setCurrentSong = usePlayerStore((state) => state.setCurrentSong);
  const setPlayerIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  // S6-9c: 动作引用走 selector（引用稳定），不再在回调里 getState 取整店快照
  const playSongAction = useAudioStore((state) => state.playSong);
  const setCurrentBeatMap = useAudioSourceStore((state) => state.setCurrentBeatMap);

  /**
   * 智能播放核心调度器：统一调用播放器核心，杜绝并发竞态与状态重置
   */
  const playTrackWithPipeline = useCallback(
    async (song: Song) => {
      console.log(`[IntegratedPipeline] Playing track: ${song.title} - ${song.artist}`);

      // 1. 直接交由播放器核心调度器触发播放与队列同步
      if (typeof playSongAction === "function") {
        playSongAction(song);
      } else {
        setCurrentSong(song);
        setPlayerIsPlaying(true);
        // S6-4: audioStore.currentSong 由 playerStore 投影维护，不再重复写入
        useAudioStore.setState({
          isPlaying: true,
          error: null,
          isLoading: true,
        });
        setIsPlaying(true);
      }

      // 2. 后台异步执行 Biquad DSP 离线节拍分析与缓存（不影响播放主链路）
      const targetUrl = song.audioUrl;
      if (targetUrl) {
        setTimeout(async () => {
          try {
            const beatMap: BeatMapData = await beatMapAnalyzer.analyzeAudioUrl(
              targetUrl,
              song.id || song.title
            );
            setCurrentBeatMap(beatMap);
          } catch (e) {
            console.warn("[IntegratedPipeline] Background BeatMap analysis skipped:", e);
          }
        }, 300);
      }

      return song;
    },
    [playSongAction, setCurrentBeatMap, setCurrentSong, setIsPlaying, setPlayerIsPlaying]
  );

  return {
    playTrackWithPipeline,
  };
}
