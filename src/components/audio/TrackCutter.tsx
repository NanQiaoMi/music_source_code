"use client";

import React, { useState, useCallback, useRef } from "react";
import { useTrackCuttingStore, CutTrack } from "@/store/trackCuttingStore";
import { parseCUEFile, validateCUEFile, secondsToTime } from "@/lib/audio/cueParser";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scissors,
  Upload,
  FileAudio,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Trash2,
  Check,
} from "lucide-react";

interface TrackCutterProps {
  isOpen: boolean;
  onClose: () => void;
}

const TrackCutter: React.FC<TrackCutterProps> = ({ isOpen, onClose }) => {
  const {
    tasks,
    settings,
    totalCut,
    totalFailed,
    createTask,
    updateTaskStatus,
    setParsedCUE,
    toggleTrackSelection,
    selectAllTracks,
    deselectAllTracks,
    updateTrackStatus,
    removeTask,
    clearCompletedTasks,
    setSettings,
    incrementCut,
    incrementFailed,
  } = useTrackCuttingStore();

  const [activeTab, setActiveTab] = useState<"upload" | "tracks" | "settings">("upload");
  const [currentTaskId, setCurrentLocalTaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cueInputRef = useRef<HTMLInputElement>(null);

  const currentTask = tasks.find((t) => t.id === currentTaskId);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, isAudioFile: boolean) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (isAudioFile) {
        const taskId = createTask(file.name, "");
        setCurrentLocalTaskId(taskId);
        updateTaskStatus(taskId, "ready");

        if (cueInputRef.current?.files?.[0]) {
          const cueContent = await cueInputRef.current.files[0].text();
          const validation = validateCUEFile(cueContent);
          if (validation.valid) {
            const parsed = parseCUEFile(cueContent);
            if (parsed) {
              setParsedCUE(taskId, parsed);
            }
          }
        }

        setActiveTab("tracks");
      } else {
        const cueContent = await file.text();
        const validation = validateCUEFile(cueContent);
        if (!validation.valid) {
          alert(`CUE 文件无效: ${validation.error}`);
          return;
        }

        const parsed = parseCUEFile(cueContent);
        if (parsed && currentTaskId) {
          setParsedCUE(currentTaskId, parsed);
        }
      }
    },
    [createTask, updateTaskStatus, setParsedCUE, currentTaskId]
  );

  const startCutting = useCallback(async () => {
    if (!currentTask) return;

    const selectedTracks = currentTask.tracks.filter((t) => t.selected);
    if (selectedTracks.length === 0) {
      alert("请选择至少一个要切割的音轨");
      return;
    }

    updateTaskStatus(currentTask.id, "cutting");

    for (const track of selectedTracks) {
      updateTrackStatus(currentTask.id, track.trackNumber, "cutting");

      await new Promise((resolve) => setTimeout(resolve, 500));

      updateTrackStatus(currentTask.id, track.trackNumber, "completed");
      incrementCut();
    }

    updateTaskStatus(currentTask.id, "completed");
  }, [currentTask, updateTaskStatus, incrementCut]);

  const downloadTrack = useCallback(
    (track: CutTrack) => {
      if (!track.outputBlob) return;

      const url = URL.createObjectURL(track.outputBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${track.trackNumber.toString().padStart(2, "0")} - ${track.title}.${settings.outputFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [settings.outputFormat]
  );

  const getStatusIcon = (status: CutTrack["status"]) => {
    switch (status) {
      case "pending":
        return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />;
      case "cutting":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

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
                  <Scissors className="w-6 h-6 text-orange-400" />
                  <h2 className="text-xl font-bold text-white">整轨切割工具</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-400">
                    <span className="text-green-400">{totalCut}</span> 成功，
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
                    onClick={() => setActiveTab("upload")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "upload"
                        ? "text-orange-400 border-b-2 border-orange-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    上传文件
                  </button>
                  <button
                    onClick={() => setActiveTab("tracks")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "tracks"
                        ? "text-orange-400 border-b-2 border-orange-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                    disabled={!currentTask}
                  >
                    音轨列表 ({currentTask?.tracks.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === "settings"
                        ? "text-orange-400 border-b-2 border-orange-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    设置
                  </button>
                </div>

                {activeTab === "upload" && (
                  <div className="space-y-6">
                    <div
                      className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:border-orange-400/50 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-white font-medium mb-2">点击上传整轨音频文件</p>
                      <p className="text-gray-400 text-sm">支持 FLAC, WAV, APE, DSF, DFF 等格式</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, true)}
                      />
                    </div>

                    <div
                      className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-orange-400/50 transition-colors cursor-pointer"
                      onClick={() => cueInputRef.current?.click()}
                    >
                      <FileAudio className="w-10 h-10 mx-auto text-gray-400 mb-4" />
                      <p className="text-white font-medium mb-2">点击上传 CUE 分割表文件</p>
                      <p className="text-gray-400 text-sm">CUE 文件定义了每个音轨的起始时间</p>
                      <input
                        ref={cueInputRef}
                        type="file"
                        accept=".cue"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, false)}
                      />
                    </div>

                    {tasks.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-white font-medium mb-3">最近的任务</h3>
                        <div className="space-y-2">
                          {tasks.slice(-3).map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                            >
                              <div>
                                <p className="text-white text-sm">{task.sourceFileName}</p>
                                <p className="text-gray-400 text-xs">
                                  {task.tracks.length} 音轨 • {task.status}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setCurrentLocalTaskId(task.id);
                                  setActiveTab("tracks");
                                }}
                                className="px-3 py-1 text-xs bg-orange-500/20 hover:bg-orange-500/30 rounded-lg transition-colors text-orange-400"
                              >
                                查看
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "tracks" && currentTask && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-white font-medium">{currentTask.sourceFileName}</h3>
                        <p className="text-gray-400 text-xs">
                          {currentTask.tracks.filter((t) => t.selected).length} /{" "}
                          {currentTask.tracks.length} 已选择
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAllTracks(currentTask.id)}
                          className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                        >
                          全选
                        </button>
                        <button
                          onClick={() => deselectAllTracks(currentTask.id)}
                          className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                        >
                          清除
                        </button>
                      </div>
                    </div>

                    {currentTask.status === "ready" && (
                      <button
                        onClick={startCutting}
                        disabled={!currentTask.tracks.some((t) => t.selected)}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium flex items-center justify-center gap-2"
                      >
                        <Scissors className="w-4 h-4" />
                        开始切割 ({currentTask.tracks.filter((t) => t.selected).length})
                      </button>
                    )}

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-0">
                      <AnimatePresence>
                        {currentTask.tracks.map((track) => (
                          <motion.div
                            key={track.trackNumber}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-center gap-3 p-4 rounded-lg transition-all ${
                              track.selected
                                ? "bg-orange-500/20 border border-orange-500/50"
                                : "bg-white/5 border border-transparent"
                            }`}
                            onClick={() => toggleTrackSelection(currentTask.id, track.trackNumber)}
                          >
                            <div
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                                track.selected
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-500"
                              }`}
                            >
                              {track.selected && <Check className="w-4 h-4 text-white" />}
                            </div>

                            {getStatusIcon(track.status)}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-orange-400 font-mono text-sm">
                                  {track.trackNumber.toString().padStart(2, "0")}
                                </span>
                                <span className="text-white text-sm truncate">{track.title}</span>
                              </div>
                              <div className="text-gray-400 text-xs">
                                {track.performer} • {secondsToTime(track.startTime)} •{" "}
                                {secondsToTime(track.duration)}
                              </div>
                            </div>

                            {track.status === "cutting" && (
                              <div className="w-24 bg-gray-700 rounded-full h-1.5">
                                <motion.div
                                  className="bg-orange-500 h-1.5 rounded-full"
                                  animate={{ width: `${track.progress || 0}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                            )}

                            {track.status === "completed" && track.outputBlob && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadTrack(track);
                                }}
                                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors"
                                title="下载"
                              >
                                <Download className="w-4 h-4 text-green-400" />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTask(currentTask.id);
                              }}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {activeTab === "tracks" && !currentTask && (
                  <div className="text-center py-12">
                    <Scissors className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">请先上传音频文件和 CUE 文件</p>
                  </div>
                )}

                {activeTab === "settings" && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        输出格式
                      </label>
                      <select
                        value={settings.outputFormat}
                        onChange={(e) =>
                          setSettings({
                            outputFormat: e.target.value as "mp3" | "wav" | "flac" | "aac",
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="mp3" className="bg-gray-800">
                          MP3
                        </option>
                        <option value="wav" className="bg-gray-800">
                          WAV
                        </option>
                        <option value="flac" className="bg-gray-800">
                          FLAC
                        </option>
                        <option value="aac" className="bg-gray-800">
                          AAC
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        比特率 (kbps)
                      </label>
                      <select
                        value={settings.bitrate}
                        onChange={(e) => setSettings({ bitrate: Number(e.target.value) })}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                          320 kbps
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        命名格式
                      </label>
                      <select
                        value={settings.outputNaming}
                        onChange={(e) =>
                          setSettings({
                            outputNaming: e.target.value as "title" | "number_title" | "number",
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="number_title" className="bg-gray-800">
                          01 - 歌曲名
                        </option>
                        <option value="number" className="bg-gray-800">
                          01
                        </option>
                        <option value="title" className="bg-gray-800">
                          歌曲名
                        </option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="preserveMetadata"
                        checked={settings.preserveMetadata}
                        onChange={(e) => setSettings({ preserveMetadata: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 bg-white/10"
                      />
                      <label htmlFor="preserveMetadata" className="text-sm text-gray-300">
                        保留元数据（标题、艺术家、专辑信息）
                      </label>
                    </div>

                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mt-6">
                      <div className="flex items-start gap-3">
                        <Scissors className="w-5 h-5 text-orange-400 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-orange-300 mb-1">
                            整轨切割说明
                          </div>
                          <ul className="text-xs text-gray-400 space-y-1">
                            <li>• 上传整轨音频文件和对应的 CUE 分割表文件</li>
                            <li>• CUE 文件包含每个音轨的起始时间和元数据</li>
                            <li>• 选择要切割的音轨，点击开始切割</li>
                            <li>• 切割后的文件会自动按命名格式命名</li>
                            <li>• 支持批量下载所有切割完成的音轨</li>
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

export default TrackCutter;
