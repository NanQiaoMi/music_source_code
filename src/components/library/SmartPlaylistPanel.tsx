"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ListMusic, Plus, Download, Upload, Sparkles, Play } from "lucide-react";
import { useSmartPlaylistStore } from "@/store/smartPlaylistStore";
import { usePlaylistStore } from "@/store/playlistStore";
import type { Song } from "@/types/song";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { toast } from "@/components/shared/GlassToast";

interface SmartPlaylistPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "system", name: "系统歌单", icon: "🎵" },
  { id: "custom", name: "自定义规则", icon: "⚙️" },
  { id: "import", name: "M3U导入导出", icon: "📦" },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

export const SmartPlaylistPanel: React.FC<SmartPlaylistPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const { songs } = usePlaylistStore();

  const {
    smartPlaylists,
    customPlaylists,
    selectedPlaylist,
    createSmartPlaylist,
    updateSmartPlaylist,
    deleteSmartPlaylist,
    generatePlaylist,
    exportPlaylist,
    importPlaylist,
    getDefaultSmartPlaylists,
  } = useSmartPlaylistStore();

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
        className="relative w-full max-w-5xl max-h-[85vh] flex flex-col bg-[#1c1c1e]/90 backdrop-blur-[40px] rounded-[24px] border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500/30 to-rose-500/30 flex items-center justify-center">
              <ListMusic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white text-2xl font-semibold">智能歌单</h2>
              <p className="text-white/60 text-sm">系统歌单、自定义规则、M3U导入导出</p>
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
                  ? "text-white border-b-2 border-pink-500 bg-white/5"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-0">
          {activeTab === "system" && (
            <SystemPlaylistsTab
              playlists={smartPlaylists}
              songs={songs}
              onGeneratePlaylist={generatePlaylist}
              getDefaultPlaylists={getDefaultSmartPlaylists}
            />
          )}

          {activeTab === "custom" && (
            <CustomRulesTab
              playlists={customPlaylists}
              onCreatePlaylist={createSmartPlaylist}
              onUpdatePlaylist={updateSmartPlaylist}
              onDeletePlaylist={deleteSmartPlaylist}
            />
          )}

          {activeTab === "import" && (
            <ImportExportTab
              songs={songs}
              onExportPlaylist={exportPlaylist}
              onImportPlaylist={importPlaylist}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

function SystemPlaylistsTab({
  playlists,
  songs,
  onGeneratePlaylist,
  getDefaultPlaylists,
}: {
  playlists: any[];
  songs: Song[];
  onGeneratePlaylist: (playlist: any, songs: Song[]) => Song[];
  getDefaultPlaylists: () => any[];
}) {
  const defaultPlaylists = getDefaultPlaylists();
  const queueStore = useQueueStore();
  // No reactive subscription needed - only used in click handlers

  const handleGeneratePlaylist = (playlist: any) => {
    const generatedSongs = onGeneratePlaylist(playlist, songs);

    if (generatedSongs.length > 0) {
      queueStore.setQueue(generatedSongs);
      if (generatedSongs[0]) {
        useAudioStore.getState().playQueue(generatedSongs, 0);
      }

      toast.success(`已生成歌单「${playlist.name}」，共 ${generatedSongs.length} 首歌曲！`);
    } else {
      toast.info("未找到符合条件的歌曲");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-white text-xl font-semibold">系统歌单</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {defaultPlaylists.map((playlist) => (
          <div key={playlist.id} className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/30 to-rose-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-white font-semibold">{playlist.name}</div>
                <div className="text-white/60 text-sm">{playlist.description}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGeneratePlaylist(playlist)}
                className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all duration-200"
              >
                生成歌单
              </button>
              <button
                onClick={() => {
                  const generatedSongs = onGeneratePlaylist(playlist, songs);
                  if (generatedSongs.length > 0) {
                    useAudioStore.getState().playQueue(generatedSongs, 0);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-medium transition-all duration-200 flex items-center justify-center"
              >
                <Play className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomRulesTab({
  playlists,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
}: {
  playlists: any[];
  onCreatePlaylist: (name: string, type: any, rules?: any[]) => any;
  onUpdatePlaylist: (id: string, updates: Partial<any>) => void;
  onDeletePlaylist: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-xl font-semibold">自定义规则歌单</h3>
        <button
          onClick={() => onCreatePlaylist("新歌单", "custom")}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium hover:from-pink-600 hover:to-rose-600 transition-all duration-200 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建歌单
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-white/5 flex items-center justify-center">
            <ListMusic className="w-10 h-10 text-white/40" />
          </div>
          <h3 className="text-white font-semibold mb-2">暂无自定义歌单</h3>
          <p className="text-white/60">点击上方按钮创建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold">{playlist.name}</div>
                  <div className="text-white/60 text-sm">{playlist.songCount} 首歌曲</div>
                </div>
                <button
                  onClick={() => onDeletePlaylist(playlist.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportExportTab({
  songs,
  onExportPlaylist,
  onImportPlaylist,
}: {
  songs: Song[];
  onExportPlaylist: (songs: Song[], format: any) => string;
  onImportPlaylist: (content: string, format: any, songs: Song[]) => Song[];
}) {
  const [importText, setImportText] = useState("");

  const handleExport = () => {
    const m3u = onExportPlaylist(songs, "m3u");
    const blob = new Blob([m3u], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playlist.m3u";
    a.click();
  };

  const handleImport = () => {
    if (importText) {
      onImportPlaylist(importText, "m3u", songs);
      setImportText("");
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-white text-xl font-semibold">M3U导入导出</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-white font-semibold">导出歌单</h4>
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-white/60 text-sm mb-4">导出当前所有歌曲为M3U格式</p>
            <button
              onClick={handleExport}
              className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium hover:from-pink-600 hover:to-rose-600 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出M3U
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-semibold">导入歌单</h4>
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="粘贴M3U内容..."
              className="w-full h-32 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-pink-500 mb-4"
            />
            <button
              onClick={handleImport}
              disabled={!importText}
              className="w-full px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              导入M3U
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
