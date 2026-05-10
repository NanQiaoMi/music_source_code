"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylistStore } from "@/store/playlistStore";
import { Song } from "@/types/song";
import { SongEditForm } from "./SongEditForm";
import {
  exportSongsToJSON,
  exportSongsToCSV,
  importSongsFromJSON,
  importSongsFromCSV,
  downloadFile,
  readFileAsText,
  ImportResult,
} from "@/utils/dataIO";
import { importLocalSongs, LocalImportResult, formatFileSize } from "@/utils/localMusicImport";
import { formatDuration } from "@/utils/songValidation";
import Image from "next/image";

export const DataManager: React.FC = () => {
  const {
    songs,
    filteredSongs,
    searchQuery,
    addSong,
    updateSong,
    removeSong,
    searchSongs,
    clearFilters,
    importSongs,
    exportSongs,
  } = usePlaylistStore();

  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [folderImportResult, setFolderImportResult] = useState<LocalImportResult | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFolderImportModal, setShowFolderImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSong = (song: Song) => {
    if (editingSong) {
      updateSong(song.id, song);
    } else {
      addSong(song);
    }
    setShowForm(false);
    setEditingSong(null);
  };

  const handleEdit = (song: Song) => {
    setEditingSong(song);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingSong(null);
    setShowForm(true);
  };

  const handleDelete = (songId: string) => {
    if (confirm("确定要删除这首歌曲吗？")) {
      removeSong(songId);
      setSelectedSongs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(songId);
        return newSet;
      });
    }
  };

  const handleBatchDelete = () => {
    if (confirm(`确定要删除选中的 ${selectedSongs.size} 首歌曲吗？`)) {
      selectedSongs.forEach((id) => removeSong(id));
      setSelectedSongs(new Set());
      setShowBatchActions(false);
    }
  };

  const handleToggleSelect = (songId: string) => {
    setSelectedSongs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(songId)) {
        newSet.delete(songId);
      } else {
        newSet.add(songId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const displaySongs = searchQuery ? filteredSongs : songs;
    if (selectedSongs.size === displaySongs.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(displaySongs.map((s) => s.id)));
    }
  };

  const handleExportJSON = () => {
    const songsToExport =
      selectedSongs.size > 0 ? songs.filter((s) => selectedSongs.has(s.id)) : exportSongs();
    const data = exportSongsToJSON(songsToExport);
    downloadFile(data, `songs_export_${Date.now()}.json`, "application/json");
  };

  const handleExportCSV = () => {
    const songsToExport =
      selectedSongs.size > 0 ? songs.filter((s) => selectedSongs.has(s.id)) : exportSongs();
    const data = exportSongsToCSV(songsToExport);
    downloadFile(data, `songs_export_${Date.now()}.csv`, "text/csv");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const content = await readFileAsText(file);
      let result: ImportResult;

      if (file.name.endsWith(".json")) {
        result = importSongsFromJSON(content);
      } else if (file.name.endsWith(".csv")) {
        result = importSongsFromCSV(content);
      } else {
        result = {
          success: false,
          songs: [],
          errors: ["不支持的文件格式，请上传 JSON 或 CSV 文件"],
          totalCount: 0,
          successCount: 0,
        };
      }

      setImportResult(result);
      setShowImportModal(true);

      if (result.success && result.songs.length > 0) {
        importSongs(result.songs);
      }
    } catch (error) {
      setImportResult({
        success: false,
        songs: [],
        errors: ["文件读取失败"],
        totalCount: 0,
        successCount: 0,
      });
      setShowImportModal(true);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    try {
      const result = await importLocalSongs(files);
      setFolderImportResult(result);
      setShowFolderImportModal(true);

      if (result.success && result.songs.length > 0) {
        importSongs(result.songs);
      }
    } catch (error) {
      setFolderImportResult({
        success: false,
        songs: [],
        errors: ["文件夹导入失败: " + (error instanceof Error ? error.message : "未知错误")],
        totalCount: 0,
        successCount: 0,
      });
      setShowFolderImportModal(true);
    } finally {
      setIsImporting(false);
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    }
  };

  const displaySongs = searchQuery ? filteredSongs : songs;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleAddNew}
            className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            添加歌曲
          </button>

          {selectedSongs.size > 0 && (
            <>
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                删除选中 ({selectedSongs.size})
              </button>
              <button
                onClick={() => setSelectedSongs(new Set())}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
              >
                取消选择
              </button>
            </>
          )}
        </div>

        <div className="flex gap-3">
          {/* Folder Import */}
          <label className="px-4 py-2.5 bg-white/5 hover:bg-white/15 text-white backdrop-blur-md rounded-xl border border-white/10 transition-all cursor-pointer flex items-center gap-2 hover:scale-105">
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            导入文件夹
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore - webkitdirectory is not in standard HTMLInputElement
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              className="hidden"
            />
          </label>

          <label className="px-4 py-2.5 bg-white/5 hover:bg-white/15 text-white backdrop-blur-md rounded-xl border border-white/10 transition-all cursor-pointer flex items-center gap-2 hover:scale-105">
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            导入文件
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <div className="relative">
            <button
              onClick={() => setShowBatchActions(!showBatchActions)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/15 text-white backdrop-blur-md rounded-xl border border-white/10 transition-all flex items-center gap-2 hover:scale-105"
            >
              <svg
                className="w-5 h-5 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              导出
            </button>

            <AnimatePresence>
              {showBatchActions && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 py-2 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl overflow-hidden min-w-[140px] z-50"
                >
                  <button
                    onClick={() => {
                      handleExportJSON();
                      setShowBatchActions(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
                  >
                    导出为 JSON
                  </button>
                  <button
                    onClick={() => {
                      handleExportCSV();
                      setShowBatchActions(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
                  >
                    导出为 CSV
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => searchSongs(e.target.value)}
            placeholder="搜索歌曲、艺术家或专辑..."
            className="w-full px-5 py-3 pl-12 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-pink-500/50 focus:bg-white/10 transition-all shadow-inner"
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <button
          onClick={handleSelectAll}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors text-sm"
        >
          {selectedSongs.size === displaySongs.length && displaySongs.length > 0
            ? "取消全选"
            : "全选"}
        </button>

        {searchQuery && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-white/60 hover:text-white transition-colors"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center text-white/60 text-sm">
        <span>
          共 {displaySongs.length} 首歌曲
          {selectedSongs.size > 0 && `，已选择 ${selectedSongs.size} 首`}
          {searchQuery && ` (搜索: "${searchQuery}")`}
        </span>
        <span className="text-white/40">支持格式: MP3, WAV, FLAC, AAC, OGG, M4A, WMA</span>
      </div>

      {/* Loading Indicator */}
      {isImporting && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
          <span className="text-white/60">正在导入...</span>
        </div>
      )}

      {/* Edit Form */}
      <AnimatePresence>
        {showForm && (
          <SongEditForm
            song={editingSong}
            onSave={handleSaveSong}
            onCancel={() => {
              setShowForm(false);
              setEditingSong(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Song List */}
      <div className="grid gap-3">
        <AnimatePresence>
          {displaySongs.map((song, index) => (
            <motion.div
              key={song.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.03 }}
              className={`bg-white/5 backdrop-blur-sm rounded-xl p-4 border transition-all group ${
                selectedSongs.has(song.id)
                  ? "border-pink-500/50 bg-pink-500/10"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleSelect(song.id)}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    selectedSongs.has(song.id)
                      ? "bg-pink-500 border-pink-500"
                      : "border-white/30 hover:border-white/50"
                  }`}
                >
                  {selectedSongs.has(song.id) && (
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </button>

                {/* Cover */}
                <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={song.cover} alt={song.title} fill className="object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{song.title}</h3>
                  <p className="text-white/60 text-sm truncate">{song.artist}</p>
                  <div className="flex items-center gap-3 text-white/40 text-xs mt-1">
                    <span>{song.album || "未知专辑"}</span>
                    <span>•</span>
                    <span>{formatDuration(song.duration)}</span>
                    <span>•</span>
                    <span
                      className={`capitalize px-1.5 py-0.5 rounded ${
                        song.source === "local"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {song.source || "local"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(song)}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    title="编辑"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(song.id)}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {displaySongs.length === 0 && !isImporting && (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-white/20 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <p className="text-white/40 text-lg mb-2">暂无歌曲数据</p>
          <p className="text-white/30 text-sm">
            点击&quot;导入文件夹&quot;或&quot;添加歌曲&quot;开始管理您的音乐
          </p>
        </div>
      )}

      {/* File Import Result Modal */}
      <AnimatePresence>
        {showImportModal && importResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-white mb-4">文件导入结果</h3>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">总数量:</span>
                  <span className="text-white">{importResult.totalCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">成功:</span>
                  <span className="text-green-400">{importResult.successCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">失败:</span>
                  <span className="text-red-400">
                    {importResult.totalCount - importResult.successCount}
                  </span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto bg-red-500/10 rounded-lg p-3 mb-4 min-h-0">
                  <p className="text-red-400 text-sm font-medium mb-2">错误信息:</p>
                  {importResult.errors.map((error, i) => (
                    <p key={i} className="text-red-300 text-xs">
                      {error}
                    </p>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowImportModal(false)}
                className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                关闭
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder Import Result Modal */}
      <AnimatePresence>
        {showFolderImportModal && folderImportResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowFolderImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">文件夹导入完成</h3>
              </div>

              <div className="space-y-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">音频文件:</span>
                    <span className="text-white font-medium">{folderImportResult.totalCount}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">导入成功:</span>
                    <span className="text-green-400 font-medium">
                      {folderImportResult.successCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">导入失败:</span>
                    <span
                      className={
                        folderImportResult.totalCount - folderImportResult.successCount > 0
                          ? "text-red-400"
                          : "text-white/40"
                      }
                    >
                      {folderImportResult.totalCount - folderImportResult.successCount}
                    </span>
                  </div>
                </div>

                {folderImportResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto bg-red-500/10 rounded-lg p-3 min-h-0">
                    <p className="text-red-400 text-sm font-medium mb-2">错误信息:</p>
                    {folderImportResult.errors.slice(0, 5).map((error, i) => (
                      <p key={i} className="text-red-300 text-xs mb-1">
                        {error}
                      </p>
                    ))}
                    {folderImportResult.errors.length > 5 && (
                      <p className="text-red-300/60 text-xs">
                        还有 {folderImportResult.errors.length - 5} 个错误...
                      </p>
                    )}
                  </div>
                )}

                <div className="text-white/40 text-xs">
                  <p>提示：文件名格式为 &quot;艺术家 - 歌曲名&quot; 时将自动解析元数据</p>
                </div>
              </div>

              <button
                onClick={() => setShowFolderImportModal(false)}
                className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                确定
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
