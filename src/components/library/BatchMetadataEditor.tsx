"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  useMetadataEditorStore,
  BatchEditOperation,
  RegexPreset,
} from "@/store/metadataEditorStore";
import { Edit2, Trash2, Plus, Eye, Save, X, Wand2 } from "lucide-react";
import { usePlaylistStore } from "@/store/playlistStore";

interface BatchMetadataEditorProps {
  className?: string;
}

export const BatchMetadataEditor: React.FC<BatchMetadataEditorProps> = ({ className = "" }) => {
  const { songs } = usePlaylistStore();
  const {
    selectedSongs,
    operations,
    previewChanges,
    previewMode,
    regexPresets,
    setSelectedSongs,
    addOperation,
    removeOperation,
    clearOperations,
    generatePreview,
    applyChanges,
    setPreviewMode,
  } = useMetadataEditorStore();

  const [activeTab, setActiveTab] = useState<"select" | "edit" | "preview">("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editField, setEditField] = useState("artist");
  const [editValue, setEditValue] = useState("");
  const [editType, setEditType] = useState<"set" | "clear" | "replace" | "append">("set");
  const [searchValue, setSearchValue] = useState("");
  const [regexPattern, setRegexPattern] = useState("");

  const handleSelectAll = () => {
    setSelectedIds(songs.map((s) => s.id));
    setSelectedSongs(songs);
  };

  const handleToggleSong = (songId: string) => {
    const newSelected = selectedIds.includes(songId)
      ? selectedIds.filter((id) => id !== songId)
      : [...selectedIds, songId];
    setSelectedIds(newSelected);

    const selectedSongsList = songs.filter((s) => newSelected.includes(s.id));
    setSelectedSongs(selectedSongsList);
  };

  const handleAddOperation = () => {
    const operation: BatchEditOperation = {
      id: Date.now().toString(),
      type: editType,
      field: editField,
      value: editValue,
      searchValue: editType === "replace" ? searchValue : undefined,
      applyToSelected: true,
      selectedSongIds: selectedIds,
      createdAt: Date.now(),
    };

    addOperation(operation);
    setEditValue("");
    setSearchValue("");
  };

  const handleApplyRegex = () => {
    const preset = regexPresets.find((p) => p.name === regexPattern);
    if (!preset) return;

    songs.forEach((song) => {
      const extracted = extractMetadataFromFilename(song.title, preset.pattern, preset.fields);
      Object.entries(extracted).forEach(([field, value]) => {
        addOperation({
          id: `${Date.now()}-${song.id}-${field}`,
          type: "set",
          field,
          value,
          applyToSelected: false,
          selectedSongIds: [song.id],
          createdAt: Date.now(),
        });
      });
    });
  };

  const handleGeneratePreview = () => {
    generatePreview();
    setActiveTab("preview");
  };

  const handleApplyChanges = () => {
    applyChanges();
    setActiveTab("select");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 ${className}`}
    >
      <div className="p-6 border-b border-white/10">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <Edit2 className="w-6 h-6" />
          批量元数据编辑器
        </h2>
      </div>

      <div className="p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("select")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "select" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            选择歌曲 ({selectedIds.length})
          </button>
          <button
            onClick={() => setActiveTab("edit")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "edit" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            批量编辑 ({operations.length})
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "preview" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            预览
          </button>
        </div>

        {activeTab === "select" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">选择要编辑的歌曲</h3>
              <button
                onClick={handleSelectAll}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl transition-all"
              >
                全选 ({songs.length})
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar min-h-0">
              {songs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleToggleSong(song.id)}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                    selectedIds.includes(song.id)
                      ? "bg-blue-500/20 border border-blue-500/50"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-white/10 overflow-hidden">
                    {song.cover ? (
                      <img
                        src={song.cover}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/40">
                        ♫
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white font-medium">{song.title}</div>
                    <div className="text-white/60 text-sm">{song.artist}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "edit" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-white font-semibold mb-4">添加批量操作</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-sm block mb-2">字段</label>
                  <select
                    value={editField}
                    onChange={(e) => setEditField(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                  >
                    <option value="artist">艺术家</option>
                    <option value="album">专辑</option>
                    <option value="genre">流派</option>
                    <option value="year">年代</option>
                    <option value="composer">作曲</option>
                    <option value="lyricist">作词</option>
                  </select>
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-2">操作类型</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                  >
                    <option value="set">设置</option>
                    <option value="clear">清空</option>
                    <option value="replace">替换</option>
                    <option value="append">追加</option>
                  </select>
                </div>
              </div>

              {editType !== "clear" && (
                <div className="mt-4">
                  <label className="text-white/60 text-sm block mb-2">值</label>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                    placeholder="输入要设置的值"
                  />
                </div>
              )}

              {editType === "replace" && (
                <div className="mt-4">
                  <label className="text-white/60 text-sm block mb-2">搜索</label>
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                    placeholder="输入要替换的文本"
                  />
                </div>
              )}

              <button
                onClick={handleAddOperation}
                className="mt-4 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                添加操作
              </button>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">当前操作队列</h3>
              <div className="space-y-2">
                {operations.map((op) => (
                  <div
                    key={op.id}
                    className="p-3 bg-white/5 rounded-xl flex items-center justify-between"
                  >
                    <div className="text-white/80">
                      <span className="text-blue-400 font-medium">{op.type}</span>{" "}
                      <span className="text-purple-400">{op.field}</span>{" "}
                      {op.type !== "clear" && <span>= &quot;{op.value}&quot;</span>}
                    </div>
                    <button
                      onClick={() => removeOperation(op.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-white/60" />
                    </button>
                  </div>
                ))}
              </div>

              {operations.length > 0 && (
                <button
                  onClick={clearOperations}
                  className="mt-3 w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all"
                >
                  清空操作队列
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGeneratePreview}
                className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-5 h-5" />
                生成预览
              </button>
            </div>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">预览更改</h3>

            <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar min-h-0">
              {Array.from(previewChanges.entries()).map(([songId, changes]) => {
                const song = songs.find((s) => s.id === songId);
                if (!song) return null;

                return (
                  <div key={songId} className="p-4 bg-white/5 rounded-xl">
                    <div className="text-white font-medium mb-2">{song.title}</div>
                    <div className="space-y-1">
                      {Object.entries(changes).map(([field, value]) => (
                        <div key={field} className="text-sm">
                          <span className="text-white/60">{field}:</span>{" "}
                          <span className="text-green-400">{value?.toString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("edit")}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
              >
                返回编辑
              </button>
              <button
                onClick={handleApplyChanges}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                应用更改
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

function extractMetadataFromFilename(
  filename: string,
  pattern: string,
  fields: { field: string; group: number }[]
) {
  const regex = new RegExp(pattern);
  const match = filename.match(regex);

  if (!match) {
    return {};
  }

  const result: { [key: string]: string } = {};

  fields.forEach(({ field, group }) => {
    if (match[group]) {
      result[field] = match[group].trim();
    }
  });

  return result;
}
