"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDSDProcessingStore, DSDTask, formatDSDRate } from "@/store/dsdProcessingStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Settings,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  FileAudio,
  Zap,
} from "lucide-react";

interface DSDConverterProps {
  isOpen: boolean;
  onClose: () => void;
}

const DSDConverter: React.FC<DSDConverterProps> = ({ isOpen, onClose }) => {
  const { songs } = usePlaylistStore();
  const {
    isEnabled,
    settings,
    tasks,
    totalProcessed,
    totalFailed,
    setEnabled,
    setSettings,
    addTask,
    updateTaskProgress,
    updateTaskStatus,
    removeTask,
    clearCompletedTasks,
    incrementProcessed,
    incrementFailed,
  } = useDSDProcessingStore();
  const reportUsage = useStatsAchievementsStore((state) => state.reportProToolsUsage);

  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"select" | "queue" | "settings">("select");
  const [worker, setWorker] = useState<Worker | null>(null);
  const [dsdSongs, setDsdSongs] = useState<
    Array<{ id: string; title: string; artist: string; format: string }>
  >([]);
  const processingRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const dsdWorker = new Worker(new URL("../../workers/dsd.worker.ts", import.meta.url));
    setWorker(dsdWorker);

    dsdWorker.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === "progress") {
      } else if (type === "complete") {
      } else if (type === "error") {
      }
    };

    const detectedDsdSongs = songs
      .filter((song) => {
        const format = (song as { format?: string }).format?.toLowerCase() || "";
        return format.includes("dsd") || format.includes("dsf") || format.includes("dff");
      })
      .map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        format: (song as { format?: string }).format || "DSD",
      }));

    setDsdSongs(detectedDsdSongs);

    return () => {
      dsdWorker.terminate();
    };
  }, [songs]);

  const toggleSongSelection = useCallback((songId: string) => {
    setSelectedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedSongs(new Set(dsdSongs.map((s) => s.id)));
  }, [dsdSongs]);

  const clearSelection = useCallback(() => {
    setSelectedSongs(new Set());
  }, []);

  const addToQueue = useCallback(() => {
    const songsToAdd = dsdSongs.filter((s) => selectedSongs.has(s.id));
    if (songsToAdd.length === 0) return;

    songsToAdd.forEach((song) => {
      addTask(song.id, song.title, "dsd64");
    });

    clearSelection();
    setActiveTab("queue");
  }, [dsdSongs, selectedSongs, addTask, clearSelection]);

  const startConversion = useCallback(async () => {
    if (!worker) return;

    const pendingTasks = tasks.filter((t) => t.status === "pending");
    if (pendingTasks.length === 0) return;

    for (const task of pendingTasks) {
      if (processingRef.current.get(task.id)) continue;
      processingRef.current.set(task.id, true);

      try {
        updateTaskStatus(task.id, "converting");

        const blob = new Blob([new ArrayBuffer(1024)], { type: "audio/dsd" });

        worker.postMessage({
          type: "convertDSD",
          data: {
            fileBlob: blob,
            sourceRate: task.sourceRate,
            targetSampleRate: settings.targetSampleRate,
            outputMode: settings.outputMode,
            dsdQuality: settings.dsdQuality,
            filterType: settings.filterType,
            dithering: settings.dithering,
          },
        });

        const workerHandler = (event: MessageEvent) => {
          const { type, data } = event.data;

          if (type === "progress") {
            updateTaskProgress(task.id, data.progress);
          } else if (type === "complete") {
            updateTaskStatus(task.id, "completed", data.outputBlob);
            incrementProcessed();
            reportUsage("dsd_conv");
            processingRef.current.delete(task.id);
            worker.removeEventListener("message", workerHandler);
          } else if (type === "error") {
            updateTaskStatus(task.id, "error", undefined, data.error);
            incrementFailed();
            processingRef.current.delete(task.id);
            worker.removeEventListener("message", workerHandler);
          }
        };

        worker.addEventListener("message", workerHandler);
      } catch (error) {
        updateTaskStatus(
          task.id,
          "error",
          undefined,
          error instanceof Error ? error.message : "Conversion failed"
        );
        incrementFailed();
        processingRef.current.delete(task.id);
      }
    }
  }, [
    worker,
    tasks,
    settings,
    updateTaskProgress,
    updateTaskStatus,
    incrementProcessed,
    incrementFailed,
  ]);

  const downloadFile = useCallback((task: DSDTask) => {
    if (!task.outputBlob) return;

    const url = URL.createObjectURL(task.outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${task.songTitle}_${task.sourceRate}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const getStatusIcon = (status: DSDTask["status"]) => {
    switch (status) {
      case "pending":
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case "converting":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const outputModeOptions = [
    { value: "pcm", label: "PCM (推荐)" },
    { value: "dop", label: "DoP (DSD over PCM)" },
  ];
  const qualityOptions = [
    { value: "low", label: "低 (64x)" },
    { value: "standard", label: "标准 (48x)" },
    { value: "high", label: "高 (32x)" },
    { value: "ultra", label: "超高 (16x)" },
  ];
  const filterOptions = [
    { value: "sharp", label: "锐利" },
    { value: "medium", label: "中等" },
    { value: "slow", label: "柔和" },
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
                  <Cpu className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-xl font-bold text-white">DSD 转换器</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-400">
                    <span className="text-green-400">{totalProcessed}</span> 成功，
                    <span className="text-red-400">{totalFailed}</span> 失败
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
                    onClick={() => setActiveTab("select")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "select"
                        ? "text-cyan-400 border-b-2 border-cyan-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    选择歌曲 ({dsdSongs.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("queue")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "queue"
                        ? "text-cyan-400 border-b-2 border-cyan-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    转换队列 ({tasks.filter((t) => t.status !== "completed").length})
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "settings"
                        ? "text-cyan-400 border-b-2 border-cyan-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    设置
                  </button>
                </div>

                {activeTab === "select" && (
                  <div className="space-y-4">
                    {dsdSongs.length === 0 ? (
                      <div className="text-center py-12">
                        <FileAudio className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-400">未检测到 DSD 格式歌曲</p>
                        <p className="text-xs text-gray-500 mt-2">
                          支持 DSD64/DSD128/DSD256/DSD512 格式
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-400">
                            已选择{" "}
                            <span className="text-cyan-400 font-bold">{selectedSongs.size}</span>{" "}
                            首歌曲
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={selectAll}
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
                              onClick={addToQueue}
                              disabled={selectedSongs.size === 0}
                              className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                            >
                              <Zap className="w-3 h-3" />
                              添加到队列
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-0">
                          {dsdSongs.map((song) => (
                            <motion.div
                              key={song.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                selectedSongs.has(song.id)
                                  ? "bg-cyan-500/20 border border-cyan-500/50"
                                  : "bg-white/5 hover:bg-white/10 border border-transparent"
                              }`}
                              onClick={() => toggleSongSelection(song.id)}
                            >
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  selectedSongs.has(song.id)
                                    ? "bg-cyan-500 border-cyan-500"
                                    : "border-gray-500"
                                }`}
                              >
                                {selectedSongs.has(song.id) && (
                                  <CheckCircle className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <FileAudio className="w-4 h-4 text-gray-400" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {song.title}
                                </div>
                                <div className="text-xs text-gray-400 truncate">
                                  {song.artist} • {song.format}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "queue" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-sm text-gray-400">
                        总计：<span className="text-green-400">{totalProcessed}</span> 成功，
                        <span className="text-red-400">{totalFailed}</span> 失败
                      </div>
                      <div className="flex gap-2">
                        {tasks.some((t) => t.status === "pending") && (
                          <button
                            onClick={startConversion}
                            className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                          >
                            <Loader2 className="w-3 h-3 animate-spin" />
                            开始转换
                          </button>
                        )}
                        <button
                          onClick={clearCompletedTasks}
                          disabled={tasks.every((t) => t.status !== "completed")}
                          className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          清空已完成
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-0">
                      <AnimatePresence>
                        {tasks.map((task) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-white/5 rounded-lg p-4 border border-white/10"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              {getStatusIcon(task.status)}
                              <div className="flex-1">
                                <div className="text-sm font-medium text-white">
                                  {task.songTitle}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {formatDSDRate(task.sourceRate)} →{" "}
                                  {settings.outputMode.toUpperCase()}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {task.status === "completed" && task.outputBlob && (
                                  <button
                                    onClick={() => downloadFile(task)}
                                    className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors"
                                    title="下载"
                                  >
                                    <Download className="w-4 h-4 text-green-400" />
                                  </button>
                                )}
                                <button
                                  onClick={() => removeTask(task.id)}
                                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </div>
                            {task.status === "converting" && (
                              <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                                <motion.div
                                  className="bg-cyan-500 h-1.5 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${task.progress}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                            )}
                            {task.status === "error" && task.error && (
                              <div className="text-xs text-red-400 mt-2">{task.error}</div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {tasks.length === 0 && (
                        <div className="text-center py-12">
                          <Zap className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                          <p className="text-gray-400">暂无转换任务</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "settings" && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        输出模式
                      </label>
                      <select
                        value={settings.outputMode}
                        onChange={(e) =>
                          setSettings({ outputMode: e.target.value as "pcm" | "dop" | "native" })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {outputModeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-gray-800">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        目标采样率 (Hz) - 当输出为 PCM 时
                      </label>
                      <select
                        value={settings.targetSampleRate}
                        onChange={(e) => setSettings({ targetSampleRate: Number(e.target.value) })}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="88200" className="bg-gray-800">
                          88,200 Hz
                        </option>
                        <option value="176400" className="bg-gray-800">
                          176,400 Hz (首选)
                        </option>
                        <option value="352800" className="bg-gray-800">
                          352,800 Hz (DSD256)
                        </option>
                        <option value="705600" className="bg-gray-800">
                          705,600 Hz (DSD512)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        DSD 转换质量
                      </label>
                      <select
                        value={settings.dsdQuality}
                        onChange={(e) =>
                          setSettings({
                            dsdQuality: e.target.value as "low" | "standard" | "high" | "ultra",
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {qualityOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-gray-800">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        滤波器类型
                      </label>
                      <select
                        value={settings.filterType}
                        onChange={(e) =>
                          setSettings({ filterType: e.target.value as "sharp" | "slow" | "medium" })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {filterOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-gray-800">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="dithering"
                        checked={settings.dithering}
                        onChange={(e) => setSettings({ dithering: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 bg-white/10"
                      />
                      <label htmlFor="dithering" className="text-sm text-gray-300">
                        启用抖动（Dithering）- 提高低频转换质量
                      </label>
                    </div>

                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mt-6">
                      <div className="flex items-start gap-3">
                        <Cpu className="w-5 h-5 text-cyan-400 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-cyan-300 mb-1">DSD 转换说明</div>
                          <ul className="text-xs text-gray-400 space-y-1">
                            <li>• DSD (Direct Stream Digital) 是一种超高采样率的数字音频格式</li>
                            <li>• 支持 DSD64/DSD128/DSD256/DSD512 多种规格</li>
                            <li>• PCM 转换后可直接在任何设备上播放</li>
                            <li>• DoP 模式可在不支持 DSD 的设备上传输 DSD 信号</li>
                            <li>• 高质量转换需要更多处理时间</li>
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

export default DSDConverter;
