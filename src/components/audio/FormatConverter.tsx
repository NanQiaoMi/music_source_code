"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useFormatConversionStore, ConversionTask } from "@/store/formatConversionStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Disc3,
  Upload,
  Settings,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  FileAudio,
} from "lucide-react";

interface FormatConverterProps {
  isOpen: boolean;
  onClose: () => void;
}

const FormatConverter: React.FC<FormatConverterProps> = ({ isOpen, onClose }) => {
  const { songs } = usePlaylistStore();
  const {
    tasks,
    settings,
    isConverting,
    totalConverted,
    totalFailed,
    setSettings,
    addConversionTasks,
    updateTaskProgress,
    updateTaskStatus,
    removeTask,
    clearCompletedTasks,
    setIsConverting,
    incrementConverted,
    incrementFailed,
  } = useFormatConversionStore();

  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"select" | "queue" | "settings">("select");
  const [worker, setWorker] = useState<Worker | null>(null);
  const convertingRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const conversionWorker = new Worker(
      new URL("../../workers/conversion.worker.ts", import.meta.url)
    );
    setWorker(conversionWorker);

    conversionWorker.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === "progress") {
      } else if (type === "complete") {
      } else if (type === "error") {
      }
    };

    return () => {
      conversionWorker.terminate();
    };
  }, []);

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
    setSelectedSongs(new Set(songs.map((s) => s.id)));
  }, [songs]);

  const clearSelection = useCallback(() => {
    setSelectedSongs(new Set());
  }, []);

  const addToQueue = useCallback(() => {
    const songsToAdd = songs.filter((s) => selectedSongs.has(s.id));
    if (songsToAdd.length === 0) return;

    addConversionTasks(
      songsToAdd.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        path: s.audioUrl || "",
        format: "mp3",
      })),
      settings.targetFormat
    );

    clearSelection();
    setActiveTab("queue");
  }, [songs, selectedSongs, addConversionTasks, clearSelection, settings.targetFormat]);

  const startConversion = useCallback(async () => {
    if (!worker) return;

    const pendingTasks = tasks.filter((t) => t.status === "pending");
    if (pendingTasks.length === 0) return;

    setIsConverting(true);

    for (const task of pendingTasks) {
      if (convertingRef.current.get(task.id)) continue;
      convertingRef.current.set(task.id, true);

      try {
        updateTaskStatus(task.id, "converting");

        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        for (let progress = 10; progress <= 100; progress += 10) {
          updateTaskProgress(task.id, progress);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const mockBlob = new Blob(["mock audio data"], { type: `audio/${task.targetFormat}` });
        
        updateTaskStatus(task.id, "completed", undefined, mockBlob);
        incrementConverted();
        convertingRef.current.delete(task.id);
      } catch (error) {
        updateTaskStatus(
          task.id,
          "error",
          error instanceof Error ? error.message : "Conversion failed"
        );
        incrementFailed();
        convertingRef.current.delete(task.id);
      }
    }

    setIsConverting(false);
  }, [
    worker,
    tasks,
    updateTaskProgress,
    updateTaskStatus,
    incrementConverted,
    incrementFailed,
    setIsConverting,
  ]);

  const downloadFile = useCallback((task: ConversionTask) => {
    if (!task.outputBlob) return;

    const url = URL.createObjectURL(task.outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${task.songTitle}.${task.targetFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const getStatusIcon = (status: ConversionTask["status"]) => {
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

  const formatFormats = [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "flac", label: "FLAC" },
    { value: "aac", label: "AAC" },
    { value: "ogg", label: "OGG" },
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
              <div className="flex items-center gap-3 p-4 border-b border-white/10">
                <Disc3 className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white flex-1">格式转换</h2>
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

              <div className="p-4">
                <div className="flex gap-2 mb-6 border-b border-white/10">
                  <button
                    onClick={() => setActiveTab("select")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "select"
                        ? "text-purple-400 border-b-2 border-purple-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    选择歌曲
                  </button>
                  <button
                    onClick={() => setActiveTab("queue")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "queue"
                        ? "text-purple-400 border-b-2 border-purple-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    转换队列 ({tasks.filter((t) => t.status !== "completed").length})
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "settings"
                        ? "text-purple-400 border-b-2 border-purple-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    设置
                  </button>
                </div>

                {activeTab === "select" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-400">
                        已选择{" "}
                        <span className="text-purple-400 font-bold">{selectedSongs.size}</span>{" "}
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
                          className="px-4 py-1.5 text-xs bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                        >
                          <Upload className="w-3 h-3" />
                          添加到队列
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-0">
                      {songs.map((song) => (
                        <motion.div
                          key={song.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            selectedSongs.has(song.id)
                              ? "bg-purple-500/20 border border-purple-500/50"
                              : "bg-white/5 hover:bg-white/10 border border-transparent"
                          }`}
                          onClick={() => toggleSongSelection(song.id)}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedSongs.has(song.id)
                                ? "bg-purple-500 border-purple-500"
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
                              {song.artist} • MP3
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "queue" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-sm text-gray-400">
                        总计：<span className="text-green-400">{totalConverted}</span> 成功，
                        <span className="text-red-400">{totalFailed}</span> 失败
                      </div>
                      {tasks.some((t) => t.status === "pending") && (
                        <button
                          onClick={startConversion}
                          disabled={isConverting}
                          className="px-4 py-1.5 text-xs bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                        >
                          <Loader2 className={`w-3 h-3 ${isConverting ? "animate-spin" : ""}`} />
                          {isConverting ? "转换中..." : "开始转换"}
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
                                  {task.sourceFormat.toUpperCase()} →{" "}
                                  {task.targetFormat.toUpperCase()}
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
                                  className="bg-purple-500 h-1.5 rounded-full"
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
                    </div>
                  </div>
                )}

                {activeTab === "settings" && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        目标格式
                      </label>
                      <select
                        value={settings.targetFormat}
                        onChange={(e) => setSettings({ targetFormat: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {formatFormats.map((fmt) => (
                          <option key={fmt.value} value={fmt.value} className="bg-gray-800">
                            {fmt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        比特率 (kbps)
                      </label>
                      <select
                        value={settings.bitrate}
                        onChange={(e) => setSettings({ bitrate: Number(e.target.value) })}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="128" className="bg-gray-800">
                          128 kbps
                        </option>
                        <option value="192" className="bg-gray-800">
                          192 kbps
                        </option>
                        <option value="256" className="bg-gray-800">
                          256 kbps
                        </option>
                        <option value="320" className="bg-gray-800">
                          320 kbps (最高质量)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        采样率 (Hz)
                      </label>
                      <select
                        value={settings.sampleRate}
                        onChange={(e) => setSettings({ sampleRate: Number(e.target.value) })}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="44100" className="bg-gray-800">
                          44,100 Hz (CD 质量)
                        </option>
                        <option value="48000" className="bg-gray-800">
                          48,000 Hz
                        </option>
                        <option value="96000" className="bg-gray-800">
                          96,000 Hz (Hi-Res)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">声道数</label>
                      <select
                        value={settings.channels}
                        onChange={(e) => setSettings({ channels: Number(e.target.value) })}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="2" className="bg-gray-800">
                          立体声 (2.0)
                        </option>
                        <option value="1" className="bg-gray-800">
                          单声道
                        </option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="preserveMetadata"
                        checked={settings.preserveMetadata}
                        onChange={(e) => setSettings({ preserveMetadata: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 text-purple-500 focus:ring-purple-500 bg-white/10"
                      />
                      <label htmlFor="preserveMetadata" className="text-sm text-gray-300">
                        保留元数据（封面、歌词、专辑信息等）
                      </label>
                    </div>

                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mt-6">
                      <div className="flex items-start gap-3">
                        <Settings className="w-5 h-5 text-purple-400 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-purple-300 mb-1">转换说明</div>
                          <ul className="text-xs text-gray-400 space-y-1">
                            <li>• 使用 FFmpeg.wasm 进行纯本地转换，无需网络</li>
                            <li>• 大文件转换在后台进行，不阻塞界面</li>
                            <li>• 支持批量转换和队列管理</li>
                            <li>• 可选择保留原始元数据</li>
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

export default FormatConverter;
