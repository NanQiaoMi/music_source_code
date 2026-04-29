"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Database, Trash2, FileScan, Settings, BarChart3, RefreshCw } from "lucide-react";
import { useLibraryManagerStore } from "@/store/libraryManagerStore";
import { usePlaylistStore, type Song } from "@/store/playlistStore";

interface LibraryManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "deduplicate", name: "智能去重", icon: "♻️" },
  { id: "rename", name: "批量重命名", icon: "📝" },
  { id: "scan", name: "扫描设置", icon: "🔍" },
  { id: "stats", name: "统计分析", icon: "📊" },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

export const LibraryManagerPanel: React.FC<LibraryManagerPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("deduplicate");
  const { songs } = usePlaylistStore();

  const {
    duplicateGroups,
    isScanningDuplicates,
    duplicateScanProgress,
    renameRules,
    selectedRenameRule,
    scanFilters,
    libraryStats,
    findDuplicates,
    deleteSelectedDuplicates,
    addRenameRule,
    updateRenameRule,
    deleteRenameRule,
    setSelectedRenameRule,
    setScanFilters,
    updateLibraryStats,
  } = useLibraryManagerStore();

  useEffect(() => {
    if (isOpen) {
      updateLibraryStats(songs);
    }
  }, [isOpen, songs, updateLibraryStats]);

  const handleFindDuplicates = useCallback(() => {
    findDuplicates(songs);
  }, [findDuplicates, songs]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white text-2xl font-semibold">智能音乐库管理</h2>
              <p className="text-white/60 text-sm">去重、重命名、扫描、统计分析</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-violet-500 bg-white/5"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar min-h-0">
          {activeTab === "deduplicate" && (
            <DeduplicateTab
              duplicateGroups={duplicateGroups}
              isScanning={isScanningDuplicates}
              scanProgress={duplicateScanProgress}
              onFindDuplicates={handleFindDuplicates}
              onDeleteDuplicates={deleteSelectedDuplicates}
            />
          )}

          {activeTab === "rename" && (
            <RenameTab
              renameRules={renameRules}
              selectedRule={selectedRenameRule}
              onAddRule={addRenameRule}
              onUpdateRule={updateRenameRule}
              onDeleteRule={deleteRenameRule}
              onSelectRule={setSelectedRenameRule}
            />
          )}

          {activeTab === "scan" && (
            <ScanTab scanFilters={scanFilters} onSetFilters={setScanFilters} />
          )}

          {activeTab === "stats" && <StatsTab stats={libraryStats} />}
        </div>
      </motion.div>
    </motion.div>
  );
};

function DeduplicateTab({
  duplicateGroups,
  isScanning,
  scanProgress,
  onFindDuplicates,
  onDeleteDuplicates,
}: {
  duplicateGroups: any[];
  isScanning: boolean;
  scanProgress: number;
  onFindDuplicates: () => void;
  onDeleteDuplicates: () => Promise<void>;
}) {
  const handleDelete = async () => {
    try {
      await onDeleteDuplicates();
    } catch (error) {
      console.error("Delete duplicates failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-xl font-semibold">智能去重</h3>
        <button
          onClick={onFindDuplicates}
          disabled={isScanning}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:from-violet-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          {isScanning ? "扫描中..." : "扫描重复歌曲"}
        </button>
      </div>

      {isScanning && (
        <div className="p-6 rounded-2xl bg-violet-500/10 border border-violet-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="text-violet-300 font-semibold">正在扫描...</div>
            <div className="text-violet-300">{scanProgress}%</div>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${scanProgress}%` }}
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
            />
          </div>
        </div>
      )}

      {duplicateGroups.length === 0 && !isScanning && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-white/5 flex items-center justify-center">
            <Trash2 className="w-10 h-10 text-white/40" />
          </div>
          <h3 className="text-white font-semibold mb-2">暂无重复歌曲</h3>
          <p className="text-white/60">点击扫描按钮查找重复歌曲</p>
        </div>
      )}

      {duplicateGroups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-white/80 font-medium">
              找到 {duplicateGroups.length} 组重复歌曲
            </div>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium transition-all duration-200"
            >
              删除选中的重复项
            </button>
          </div>
          {duplicateGroups.map((group) => (
            <div key={group.groupId} className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-white font-semibold mb-3">
                {group.songs[0]?.title} - {group.songs[0]?.artist}
              </div>
              <div className="space-y-2">
                {group.songs.map((song: any) => (
                  <div
                    key={song.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      song.isRecommended
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-white/5"
                    }`}
                  >
                    <div>
                      <div className="text-white text-sm">{song.title}</div>
                      <div className="text-white/60 text-xs">
                        {song.artist} · {Math.round(song.duration / 60)}:
                        {(song.duration % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                    {song.isRecommended && (
                      <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs">
                        推荐保留
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RenameTab({
  renameRules,
  selectedRule,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onSelectRule,
}: {
  renameRules: any[];
  selectedRule: string;
  onAddRule: (rule: any) => void;
  onUpdateRule: (id: string, rule: Partial<any>) => void;
  onDeleteRule: (id: string) => void;
  onSelectRule: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-white text-xl font-semibold">批量重命名规则</h3>
      <div className="space-y-3">
        {renameRules.map((rule) => (
          <div
            key={rule.id}
            className={`p-5 rounded-2xl transition-all duration-200 ${
              selectedRule === rule.id
                ? "bg-violet-500/20 border border-violet-500/30"
                : "bg-white/5 border border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">{rule.name}</div>
                <div className="text-white/60 text-sm mt-1">{rule.pattern}</div>
                <div className="text-white/40 text-xs mt-1">示例：{rule.example}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onSelectRule(rule.id)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                >
                  选择
                </button>
                <button
                  onClick={() => onDeleteRule(rule.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScanTab({
  scanFilters,
  onSetFilters,
}: {
  scanFilters: any;
  onSetFilters: (filters: Partial<any>) => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-white text-xl font-semibold">扫描设置</h3>
      <div className="space-y-4">
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-white font-semibold mb-4">文件过滤</div>
          <div className="text-white/60 text-sm">
            <div>最小时长: {scanFilters.minDuration || 0}秒</div>
            <div>最大时长: {scanFilters.maxDuration || "无限"}秒</div>
            <div>格式: {scanFilters.formats?.join(", ") || "全部"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsTab({ stats }: { stats: any }) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  };

  const formatFileSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-white text-xl font-semibold">音乐库统计</h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-center">
          <div className="text-3xl font-bold text-white">{stats.totalSongs}</div>
          <div className="text-white/60 text-sm mt-1">首歌曲</div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-center">
          <div className="text-3xl font-bold text-white">{formatDuration(stats.totalDuration)}</div>
          <div className="text-white/60 text-sm mt-1">总时长</div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-center">
          <div className="text-3xl font-bold text-white">{formatFileSize(stats.totalFileSize)}</div>
          <div className="text-white/60 text-sm mt-1">总大小</div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-center">
          <div className="text-3xl font-bold text-white">{stats.artistsCount}</div>
          <div className="text-white/60 text-sm mt-1">位歌手</div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 text-center">
          <div className="text-3xl font-bold text-white">{stats.albumsCount}</div>
          <div className="text-white/60 text-sm mt-1">张专辑</div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 text-center">
          <div className="text-3xl font-bold text-white">{stats.duplicatesCount}</div>
          <div className="text-white/60 text-sm mt-1">重复歌曲</div>
        </div>
      </div>
    </div>
  );
}
