"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Search, Trash2, Music, CheckCircle, AlertCircle } from "lucide-react";
import { useFingerprintStore } from "@/store/fingerprintStore";
import { usePlaylistStore } from "@/store/playlistStore";

interface FingerprintScannerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FingerprintScannerPanel: React.FC<FingerprintScannerPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    fingerprints,
    isScanning,
    scanProgress,
    scannedCount,
    totalCount,
    matchThreshold,
    setScanning,
    setScanProgress,
    setScannedCount,
    setTotalCount,
    setMatchThreshold,
    clearFingerprints,
  } = useFingerprintStore();

  const { songs } = usePlaylistStore();
  const [activeTab, setActiveTab] = useState<"scan" | "matches" | "settings">("scan");

  const startScan = useCallback(() => {
    if (songs.length === 0) return;

    setScanning(true);
    setTotalCount(songs.length);
    setScannedCount(0);
    setScanProgress(0);

    let processed = 0;
    const processNext = () => {
      if (processed >= songs.length) {
        setScanning(false);
        setScanProgress(100);
        return;
      }

      setTimeout(() => {
        processed++;
        setScannedCount(processed);
        setScanProgress(Math.round((processed / songs.length) * 100));
        processNext();
      }, 100);
    };

    processNext();
  }, [songs, setScanning, setTotalCount, setScannedCount, setScanProgress]);

  const fingerprintCount = fingerprints.size;
  const scannedSongs = songs.filter((s) => fingerprints.has(s.id)).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl mx-4 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-purple-400" />
                </div>
                <h2>音频指纹识别</h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar min-h-0">
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setActiveTab("scan")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === "scan"
                      ? "bg-purple-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  扫描
                </button>
                <button
                  onClick={() => setActiveTab("matches")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === "matches"
                      ? "bg-purple-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  匹配
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === "settings"
                      ? "bg-purple-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  设置
                </button>
              </div>

              {activeTab === "scan" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-white">{songs.length}</div>
                      <div className="text-sm text-white/60">总歌曲</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">{fingerprintCount}</div>
                      <div className="text-sm text-white/60">已生成指纹</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-purple-400">{scannedSongs}</div>
                      <div className="text-sm text-white/60">已扫描</div>
                    </div>
                  </div>

                  {isScanning ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">扫描进度</span>
                        <span className="text-white">{scanProgress}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-purple-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${scanProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-white/50 text-center">
                        正在扫描 {scannedCount}/{totalCount} 首歌曲...
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={startScan}
                      disabled={songs.length === 0}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-white/20 disabled:text-white/50 rounded-xl transition-colors"
                    >
                      开始扫描
                    </button>
                  )}

                  <div className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      说明
                    </div>
                    <p className="text-sm text-white/60">
                      音频指纹可以识别音乐库中的重复歌曲，即使文件名不同也能通过音频特征匹配。
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "matches" && (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <Music className="w-12 h-12 mx-auto text-white/30 mb-3" />
                    <p className="text-white/60">扫描完成后即可查看匹配结果</p>
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-xl p-4">
                    <label className="text-sm text-white/70 mb-2 block">
                      匹配阈值: {Math.round(matchThreshold * 100)}%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={matchThreshold * 100}
                      onChange={(e) => setMatchThreshold(Number(e.target.value) / 100)}
                      className="w-full"
                    />
                    <p className="text-xs text-white/50 mt-2">
                      较高的阈值会更严格匹配，较低会匹配更多可能的重复
                    </p>
                  </div>

                  <button
                    onClick={clearFingerprints}
                    className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    清空所有指纹数据
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};