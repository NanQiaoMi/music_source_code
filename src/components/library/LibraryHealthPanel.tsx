"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Music,
  Image,
  FileText,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useLibraryHealthStore, generateHealthReport, HealthIssueType } from "@/store/libraryHealthStore";
import { usePlaylistStore } from "@/store/playlistStore";

interface LibraryHealthPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LibraryHealthPanel: React.FC<LibraryHealthPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { songs } = usePlaylistStore();
  const [activeTab, setActiveTab] = useState<"scan" | "results" | "settings">("scan");
  const [isScanning, setIsScanning] = useState(false);

  const {
    healthReport,
    lastScan,
    isScanning: storeIsScanning,
    scanProgress,
    autoScan,
    setHealthReport,
    setAutoScan,
    clearIssues,
  } = useLibraryHealthStore();

  const issues = healthReport?.issues || [];
  const issueCounts: Record<string, number> = {};

  if (healthReport) {
    issues.forEach((issue) => {
      issueCounts[issue.type] = (issueCounts[issue.type] || 0) + 1;
    });
  }

  const totalIssues = Object.values(issueCounts).reduce((a, b) => a + b, 0) as number;

  const startScan = useCallback(async () => {
    if (songs.length === 0) return;

    setIsScanning(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const report = generateHealthReport(songs);
    setHealthReport(report);

    setIsScanning(false);
    setActiveTab("results");
  }, [songs, setHealthReport]);

  const getIssueIcon = (type: string) => {
    switch (type) {
      case "missing-metadata":
        return <FileText className="w-4 h-4 text-yellow-400" />;
      case "missing-cover":
        return <Image className="w-4 h-4 text-orange-400" />;
      case "missing-lyrics":
        return <Music className="w-4 h-4 text-blue-400" />;
      case "duplicate":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "corrupted-file":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-white/50" />;
    }
  };

  const getIssueLabel = (type: string) => {
    switch (type) {
      case "missing-metadata":
        return "缺少元数据";
      case "missing-cover":
        return "缺少封面";
      case "missing-lyrics":
        return "缺少歌词";
      case "duplicate":
        return "重复歌曲";
      case "corrupted-file":
        return "文件损坏";
      case "low-quality":
        return "低音质";
      default:
        return type;
    }
  };

  const getIssueSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-500/20 border-red-500/50";
      case "medium":
        return "bg-yellow-500/20 border-yellow-500/50";
      case "low":
        return "bg-blue-500/20 border-blue-500/50";
      default:
        return "bg-white/5 border-white/10";
    }
  };

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
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <h2>音乐库健康检查</h2>
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
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  扫描
                </button>
                <button
                  onClick={() => setActiveTab("results")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === "results"
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  结果 ({totalIssues})
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === "settings"
                      ? "bg-emerald-600 text-white"
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
                      <div className="text-2xl font-bold text-red-400">{totalIssues}</div>
                      <div className="text-sm text-white/60">发现问题</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {songs.length - totalIssues}
                      </div>
                      <div className="text-sm text-white/60">健康歌曲</div>
                    </div>
                  </div>

                  {isScanning ? (
                    <div className="flex flex-col items-center py-8">
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
                      <p className="text-white/70">正在扫描音乐库...</p>
                    </div>
                  ) : (
                    <button
                      onClick={startScan}
                      disabled={songs.length === 0}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-white/20 disabled:text-white/50 rounded-xl transition-colors"
                    >
                      开始扫描
                    </button>
                  )}

                  <div className="bg-white/5 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-medium text-white/70">扫描项目</h4>
                    {Object.entries(issueCounts).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getIssueIcon(type)}
                          <span className="text-sm text-white/80">{getIssueLabel(type)}</span>
                        </div>
                        <span className="text-sm text-white/50">{count} 个</span>
                      </div>
                    ))}
                    {Object.keys(issueCounts).length === 0 && (
                      <p className="text-sm text-white/50 text-center">运行扫描以查看问题统计</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "results" && (
                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar min-h-0">
                  {totalIssues === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
                      <p className="text-lg text-white/80">音乐库非常健康！</p>
                      <p className="text-sm text-white/50 mt-2">没有发现任何问题</p>
                    </div>
                  ) : (
                    issues.map((issue, index) => (
                      <div
                        key={`${issue.songId}-${index}`}
                        className={`p-4 rounded-xl border ${getIssueSeverityColor(issue.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getIssueIcon(issue.type)}
                          <div className="flex-1">
                            <div className="font-medium text-white">
                              {issue.songId || "未知歌曲"}
                            </div>
                            <div className="text-sm text-white/60 mt-1">
                              {issue.description}
                            </div>
                            {issue.suggestion && (
                              <div className="text-sm text-emerald-400/80 mt-2">
                                建议: {issue.suggestion}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-medium text-white">自动扫描</div>
                      <div className="text-sm text-white/60">启动时自动检查音乐库</div>
                    </div>
                    <button
                      onClick={() => setAutoScan(!autoScan)}
                      className={`w-12 h-7 rounded-full transition-colors ${
                        autoScan ? "bg-emerald-600" : "bg-white/20"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          autoScan ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    onClick={clearIssues}
                    className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    清空所有问题记录
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