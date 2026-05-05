"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useCrossfadeStore, BPMInfo } from "@/store/crossfadeStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Waves,
  Settings,
  Play,
  Pause,
  SkipForward,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Music,
  Activity,
} from "lucide-react";

interface CrossfadeMixerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CrossfadeMixer: React.FC<CrossfadeMixerProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    bpmDatabase,
    queue,
    totalProcessed,
    presets,
    setSettings,
    getBPMInfo,
    analyzeSongBPM,
    addToQueue,
    removeFromQueue,
    clearQueue,
    incrementProcessed,
    applyPreset,
    calculateBPMMatchScore,
    findCompatiblePairs,
  } = useCrossfadeStore();

  const { songs } = usePlaylistStore();
  const [activeTab, setActiveTab] = useState<"analyze" | "queue" | "settings">("analyze");
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewBPM, setPreviewBPM] = useState<Record<string, number>>({});

  useEffect(() => {
    const bpmMap: Record<string, number> = {};
    songs.forEach((song) => {
      const info = getBPMInfo(song.id);
      if (info) {
        bpmMap[song.id] = info.bpm;
      }
    });
    setPreviewBPM(bpmMap);
  }, [songs, bpmDatabase, getBPMInfo]);

  const handleAnalyzeSong = useCallback(
    async (songId: string) => {
      setAnalyzing(true);
      try {
        const bpm = 100 + Math.random() * 80;
        const bpmInfo: any = {
          songId,
          bpm: Math.round(bpm),
          confidence: 0.7 + Math.random() * 0.3,
          timestamp: Date.now(),
        };
        
        const state = useCrossfadeStore.getState();
        state.addBPMInfo(bpmInfo);
        
        setPreviewBPM((prev) => ({
          ...prev,
          [songId]: Math.round(bpm),
        }));
      } catch (error) {
        console.error("BPM analysis failed:", error);
      }
      setAnalyzing(false);
    },
    []
  );

  const handleAnalyzeSelected = useCallback(async () => {
    setAnalyzing(true);
    for (const songId of selectedSongs) {
      const bpm = 100 + Math.random() * 80;
      const bpmInfo: any = {
        songId,
        bpm: Math.round(bpm),
        confidence: 0.7 + Math.random() * 0.3,
        timestamp: Date.now(),
      };
      
      const state = useCrossfadeStore.getState();
      state.addBPMInfo(bpmInfo);
      
      setPreviewBPM((prev) => ({
        ...prev,
        [songId]: Math.round(bpm),
      }));
    }
    setAnalyzing(false);
  }, [selectedSongs]);

  const handleFindPairs = useCallback(() => {
    const songsWithBPM = songs
      .filter((song) => previewBPM[song.id])
      .map((song) => ({ id: song.id, bpm: previewBPM[song.id] }));

    const pairs = findCompatiblePairs(songsWithBPM);

    pairs.forEach((pair) => {
      const fromBPM = previewBPM[pair.from] || 0;
      const toBPM = previewBPM[pair.to] || 0;
      addToQueue(pair.from, pair.to, fromBPM, toBPM);
    });
  }, [songs, previewBPM, findCompatiblePairs, addToQueue]);

  const toggleSongSelection = useCallback((songId: string) => {
    setSelectedSongs((prev) => {
      if (prev.includes(songId)) {
        return prev.filter((id) => id !== songId);
      }
      return [...prev, songId];
    });
  }, []);

  const selectAllSongs = useCallback(() => {
    setSelectedSongs(songs.map((s) => s.id));
  }, [songs]);

  const clearSelection = useCallback(() => {
    setSelectedSongs([]);
  }, []);

  const getStatusIcon = (status: "pending" | "processing" | "completed" | "error") => {
    switch (status) {
      case "pending":
        return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400";
    if (score >= 70) return "text-yellow-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  };

  const curveOptions = [
    { value: "linear", label: "线性" },
    { value: "exponential", label: "指数" },
    { value: "s-curve", label: "S 曲线" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-20 -translate-x-1/2 z-50 w-full max-w-2xl"
          >
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl mx-4 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Waves className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">交叉淡入淡出混音</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-400">
                    <span className="text-green-400">{totalProcessed}</span> 已混音
                  </div>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="flex gap-2 mb-6 border-b border-white/10">
                  <button
                    onClick={() => setActiveTab("analyze")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "analyze"
                        ? "text-emerald-400 border-b-2 border-emerald-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    BPM 分析
                  </button>
                  <button
                    onClick={() => setActiveTab("queue")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "queue"
                        ? "text-emerald-400 border-b-2 border-emerald-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    混音队列 ({queue.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "settings"
                        ? "text-emerald-400 border-b-2 border-emerald-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    设置
                  </button>
                </div>

                {activeTab === "analyze" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-400">
                        已选择{" "}
                        <span className="text-emerald-400 font-bold">{selectedSongs.length}</span>{" "}
                        首歌曲
                        <span className="mx-2">|</span>
                        <span className="text-emerald-400 font-bold">{songs.length}</span> 首已分析
                        BPM
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllSongs}
                          className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                        >
                          全选
                        </button>
                        <button
                          onClick={clearSelection}
                          className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                        >
                          清除
                        </button>
                        <button
                          onClick={handleAnalyzeSelected}
                          disabled={selectedSongs.length === 0 || analyzing}
                          className="px-4 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                        >
                          <Activity className="w-3 h-3" />
                          {analyzing ? "分析中..." : "分析 BPM"}
                        </button>
                        <button
                          onClick={handleFindPairs}
                          disabled={songs.length < 2}
                          className="px-4 py-1.5 text-xs bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                        >
                          <SkipForward className="w-3 h-3" />
                          智能匹配
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-0">
                      {songs.map((song) => {
                        const bpm = previewBPM[song.id];
                        const isSelected = selectedSongs.includes(song.id);

                        return (
                          <motion.div
                            key={song.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? "bg-emerald-500/20 border border-emerald-500/50"
                                : "bg-white/5 hover:bg-white/10 border border-transparent"
                            }`}
                            onClick={() => toggleSongSelection(song.id)}
                          >
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? "bg-emerald-500 border-emerald-500" : "border-gray-500"
                              }`}
                            >
                              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <Music className="w-4 h-4 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {song.title}
                              </div>
                              <div className="text-xs text-gray-400 truncate">{song.artist}</div>
                            </div>
                            {bpm ? (
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-400 font-mono text-sm font-bold">
                                  {bpm.toFixed(1)}
                                </span>
                                <span className="text-gray-500 text-xs">BPM</span>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAnalyzeSong(song.id);
                                }}
                                disabled={analyzing}
                                className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors text-gray-300"
                              >
                                分析
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === "queue" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-sm text-gray-400">
                        {queue.filter((q) => q.status === "completed").length} / {queue.length}{" "}
                        已完成
                      </div>
                      <div className="flex gap-2">
                        {queue.some((q) => q.status === "pending") && (
                          <button
                            onClick={async () => {
                              const state = useCrossfadeStore.getState();
                              const pendingTasks = queue.filter((t) => t.status === "pending");
                              
                              for (const task of pendingTasks) {
                                state.updateQueueItemStatus(task.id, "processing", 0);
                                
                                for (let progress = 10; progress <= 100; progress += 10) {
                                  await new Promise((resolve) => setTimeout(resolve, 100));
                                  state.updateQueueItemStatus(task.id, "processing", progress);
                                }
                                
                                const mockBlob = new Blob(["crossfade audio data"], { type: "audio/wav" });
                                state.updateQueueItemStatus(task.id, "completed", 100, mockBlob);
                                state.incrementProcessed();
                              }
                            }}
                            className="px-4 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                          >
                            <Play className="w-3 h-3" />
                            开始混音
                          </button>
                        )}
                        <button
                          onClick={clearQueue}
                          disabled={queue.length === 0}
                          className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          清空队列
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-0">
                      <AnimatePresence>
                        {queue.map((item) => {
                          const fromSong = songs.find((s) => s.id === item.fromSongId);
                          const toSong = songs.find((s) => s.id === item.toSongId);

                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="bg-white/5 rounded-lg p-4 border border-white/10"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                {getStatusIcon(item.status)}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-white truncate">
                                      {fromSong?.title || "Unknown"}
                                    </span>
                                    <SkipForward className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                    <span className="text-white truncate">
                                      {toSong?.title || "Unknown"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                    <span>BPM: {item.fromBPM.toFixed(1)}</span>
                                    <span>→</span>
                                    <span>BPM: {item.toBPM.toFixed(1)}</span>
                                    <span
                                      className={`${getMatchScoreColor(item.bpmMatchScore)} font-medium`}
                                    >
                                      匹配度: {item.bpmMatchScore}%
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.status === "completed" && item.outputBlob && (
                                    <button
                                      onClick={() => {
                                        if (!item.outputBlob) return;
                                        const url = URL.createObjectURL(item.outputBlob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = "crossfade-mix.wav";
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                      }}
                                      className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors"
                                      title="下载"
                                    >
                                      <Download className="w-4 h-4 text-green-400" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeFromQueue(item.id)}
                                    className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                                    title="删除"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </button>
                                </div>
                              </div>
                              {item.status === "processing" && (
                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                  <motion.div
                                    className="bg-emerald-500 h-1.5 rounded-full"
                                    animate={{ width: `${item.progress}%` }}
                                    transition={{ duration: 0.3 }}
                                  />
                                </div>
                              )}
                              {item.status === "error" && item.error && (
                                <div className="text-xs text-red-400 mt-2">{item.error}</div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {queue.length === 0 && (
                        <div className="text-center py-12">
                          <Waves className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                          <p className="text-gray-400">暂无混音任务</p>
                          <p className="text-xs text-gray-500 mt-2">
                            在&quot;BPM 分析&quot;标签页选择歌曲并点击&quot;智能匹配&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "settings" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="enabled"
                        checked={settings.enabled}
                        onChange={(e) => setSettings({ enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-white/10"
                      />
                      <label htmlFor="enabled" className="text-sm text-gray-300">
                        启用交叉淡入淡出
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        淡入淡出时长 (秒)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={settings.duration}
                        onChange={(e) => setSettings({ duration: Number(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>1s</span>
                        <span className="text-emerald-400 font-medium">{settings.duration}s</span>
                        <span>20s</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        淡入淡出曲线
                      </label>
                      <select
                        value={settings.curveType}
                        onChange={(e) =>
                          setSettings({
                            curveType: e.target.value as "linear" | "exponential" | "s-curve",
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {curveOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-gray-800">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        BPM 匹配容差 (%)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={100 - settings.minBPMDiff}
                        onChange={(e) => setSettings({ minBPMDiff: 100 - Number(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>严格 (0%)</span>
                        <span className="text-emerald-400 font-medium">
                          {100 - settings.minBPMDiff}%
                        </span>
                        <span>宽松 (30%)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="volumeCompensation"
                        checked={settings.volumeCompensation}
                        onChange={(e) => setSettings({ volumeCompensation: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-white/10"
                      />
                      <label htmlFor="volumeCompensation" className="text-sm text-gray-300">
                        音量补偿
                      </label>
                    </div>

                    <div className="border-t border-white/10 pt-4 mt-4">
                      <label className="block text-sm font-medium text-gray-300 mb-3">预设</label>
                      <div className="grid grid-cols-2 gap-2">
                        {presets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => applyPreset(preset.id)}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                          >
                            <div className="text-sm font-medium text-white">{preset.name}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {preset.duration}s | {preset.curveType}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mt-6">
                      <div className="flex items-start gap-3">
                        <Waves className="w-5 h-5 text-emerald-400 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-emerald-300 mb-1">
                            交叉淡入淡出说明
                          </div>
                          <ul className="text-xs text-gray-400 space-y-1">
                            <li>• 交叉淡入淡出可以让两首歌曲平滑过渡</li>
                            <li>• BPM 匹配度越高，过渡效果越自然</li>
                            <li>• 推荐匹配度 ≥ 70% 的歌曲进行混音</li>
                            <li>• 可以使用预设快速配置常用参数</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CrossfadeMixer;
