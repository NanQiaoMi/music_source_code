"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Shuffle, X, Zap } from "lucide-react";
import { usePlaylistStore, Song } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import { toast } from "@/components/GlassToast";

interface InstantMixProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WeightedSong {
  song: Song;
  weight: number;
}

const QUICK_OPTIONS = [5, 10, 20];

export const InstantMix: React.FC<InstantMixProps> = ({ isOpen, onClose }) => {
  const { songs } = usePlaylistStore();
  const playQueue = useAudioStore(state => state.playQueue);
  const { getPlayCount, getLastPlayedAt } = useListeningHistory();
  const [customCount, setCustomCount] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWeightedSongs = useCallback((): WeightedSong[] => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const artistCount = new Map<string, number>();

    const weightedSongs: WeightedSong[] = songs.map((song) => {
      let weight = 1;
      const playCount = getPlayCount(song.id);
      const lastPlayedAt = getLastPlayedAt(song.id);

      if (playCount === 0) {
        weight *= 3;
      } else if (lastPlayedAt) {
        const daysSincePlayed = (now - lastPlayedAt) / oneDay;
        if (daysSincePlayed > 30) {
          weight *= 2.5;
        } else if (daysSincePlayed > 7) {
          weight *= 1.5;
        } else if (daysSincePlayed < 1) {
          weight *= 0.3;
        }
      }

      if (playCount > 0 && playCount <= 5) {
        weight *= 1.5;
      } else if (playCount > 10) {
        weight *= 1.2;
      }

      const currentArtistCount = artistCount.get(song.artist) || 0;
      artistCount.set(song.artist, currentArtistCount + 1);

      if (currentArtistCount > 0) {
        weight *= Math.pow(0.7, currentArtistCount);
      }

      return { song, weight };
    });

    return weightedSongs.sort((a, b) => b.weight - a.weight);
  }, [songs, getPlayCount, getLastPlayedAt]);

  const selectRandomSongs = useCallback((weightedSongs: WeightedSong[], count: number): Song[] => {
    const selected: Song[] = [];
    const usedArtists = new Set<string>();
    const available = [...weightedSongs];

    for (let i = 0; i < count && available.length > 0; i++) {
      const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * totalWeight;

      for (let j = 0; j < available.length; j++) {
        random -= available[j].weight;
        if (random <= 0) {
          const selectedSong = available[j].song;
          usedArtists.add(selectedSong.artist);
          selected.push(selectedSong);
          available.splice(j, 1);

          for (let k = available.length - 1; k >= 0; k--) {
            if (usedArtists.has(available[k].song.artist)) {
              available[k].weight *= 0.3;
            }
          }
          break;
        }
      }
    }

    return selected;
  }, []);

  const handleGenerate = useCallback(async (selectedCount: number) => {
    if (songs.length === 0) {
      toast.error("请先导入音乐");
      return;
    }

    const actualCount = Math.min(selectedCount, songs.length);
    setIsGenerating(true);

    try {
      const weightedSongs = generateWeightedSongs();
      const selectedSongs = selectRandomSongs(weightedSongs, actualCount);

      playQueue(selectedSongs, 0);
      toast.success(`已生成 ${selectedSongs.length} 首灵感歌单`);
      onClose();
    } catch (error) {
      toast.error("生成歌单失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  }, [songs, generateWeightedSongs, selectRandomSongs, playQueue, onClose]);

  const handleCustomCount = useCallback(() => {
    const num = parseInt(customCount);
    if (num && num > 0) {
      handleGenerate(num);
    }
  }, [customCount, handleGenerate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
        style={{
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      >
        <div className="p-6 min-w-[300px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white text-lg font-semibold">灵感瞬间</h3>
                <p className="text-white/60 text-sm">Instant Mix</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-white/70 text-sm font-medium mb-2">快速选择</div>
            <div className="flex gap-2">
              {QUICK_OPTIONS.map((num) => (
                <button
                  key={num}
                  onClick={() => handleGenerate(num)}
                  disabled={isGenerating}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {num} 首
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max={songs.length}
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                placeholder="自定义数量"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-yellow-500/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCustomCount();
                  }
                }}
              />
              <button
                onClick={handleCustomCount}
                disabled={isGenerating || !customCount}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="text-white/50 text-xs space-y-1">
                <p>✨ 新鲜度：好久没听的歌曲权重更高</p>
                <p>🎨 多样性：避免连续抽到同一歌手</p>
                <p>❤️ 喜好度：结合播放次数智能推荐</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const InstantMixButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10 group"
      style={{ color: "var(--theme-text-secondary)" }}
      title="灵感瞬间"
    >
      <motion.div
        whileHover={{ rotate: 10, scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Shuffle className="w-[18px] h-[18px]" />
      </motion.div>
    </button>
  );
};
