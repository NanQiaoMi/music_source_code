/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useAudioSourceStore } from "@/store/audioSourceStore";
import { multiSourceResolver, SongMetadataQuery, ResolvedAudioSource } from "@/services/MultiSourceResolver";
import { beatMapAnalyzer, BeatMapData } from "@/services/BeatMapAnalyzer";
import { Song } from "@/types/song";

export function useIntegratedAudioPipeline() {
  const setCurrentSong = useAudioStore((state) => (state as any).setCurrentSong || (state as any).playSong);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);

  /**
   * 智能播放核心调度器：统一调用播放器核心，杜绝并发竞态与状态重置
   */
  const playTrackWithPipeline = useCallback(
    async (song: Song) => {
      console.log(`[IntegratedPipeline] Playing track: ${song.title} - ${song.artist}`);

      // 1. 直接交由播放器核心调度器触发播放与队列同步
      const audioState = useAudioStore.getState();
      if (typeof audioState.playSong === "function") {
        audioState.playSong(song);
      } else {
        usePlayerStore.getState().setCurrentSong(song);
        usePlayerStore.getState().setIsPlaying(true);
        useAudioStore.setState({ currentSong: song, isPlaying: true, error: null, isLoading: true });
        if (setCurrentSong) {
          setCurrentSong(song);
        }
        setIsPlaying(true);
      }

      // 2. 后台异步执行 Biquad DSP 离线节拍分析与缓存（不影响播放主链路）
      const targetUrl = song.audioUrl;
      if (targetUrl) {
        setTimeout(async () => {
          try {
            const beatMap: BeatMapData = await beatMapAnalyzer.analyzeAudioUrl(targetUrl, song.id || song.title);
            useAudioSourceStore.getState().setCurrentBeatMap(beatMap);
          } catch (e) {
            console.warn("[IntegratedPipeline] Background BeatMap analysis skipped:", e);
          }
        }, 300);
      }

      return song;
    },
    [setCurrentSong, setIsPlaying]
  );

  return {
    playTrackWithPipeline,
  };
}
