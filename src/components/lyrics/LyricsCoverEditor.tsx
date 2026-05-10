"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Image, Upload, Edit3 } from "lucide-react";
import { useLyricsCoverStore } from "@/store/lyricsCoverStore";
import { usePlaylistStore } from "@/store/playlistStore";
import type { Song } from "@/types/song";

interface LyricsCoverEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "lyrics", name: "歌词编辑器", icon: "📝" },
  { id: "cover", name: "封面管理", icon: "🖼️" },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

export const LyricsCoverEditor: React.FC<LyricsCoverEditorProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("lyrics");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const { songs } = usePlaylistStore();

  const {
    lyrics,
    covers,
    currentLyric,
    loadLyric,
    saveLyric,
    importLRC,
    exportLRC,
    loadCover,
    saveCover,
    importCoverImage,
  } = useLyricsCoverStore();

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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white text-2xl font-semibold">歌词与封面编辑器</h2>
              <p className="text-white/60 text-sm">编辑歌词和管理歌曲封面</p>
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
                  ? "text-white border-b-2 border-blue-500 bg-white/5"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-0">
          {activeTab === "lyrics" && (
            <LyricsTab
              songs={songs}
              selectedSong={selectedSong}
              onSelectSong={setSelectedSong}
              lyrics={lyrics}
              currentLyric={currentLyric}
              onLoadLyric={loadLyric}
              onSaveLyric={saveLyric}
              onImportLRC={importLRC}
              onExportLRC={exportLRC}
            />
          )}

          {activeTab === "cover" && (
            <CoverTab
              songs={songs}
              selectedSong={selectedSong}
              onSelectSong={setSelectedSong}
              covers={covers}
              onLoadCover={loadCover}
              onSaveCover={saveCover}
              onImportCover={importCoverImage}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

function LyricsTab({
  songs,
  selectedSong,
  onSelectSong,
  lyrics,
  currentLyric,
  onLoadLyric,
  onSaveLyric,
  onImportLRC,
  onExportLRC,
}: {
  songs: Song[];
  selectedSong: Song | null;
  onSelectSong: (song: Song | null) => void;
  lyrics: any[];
  currentLyric: any;
  onLoadLyric: (songId: string) => any;
  onSaveLyric: (lyric: any) => void;
  onImportLRC: (songId: string, lrcText: string) => any;
  onExportLRC: (songId: string) => string;
}) {
  const [lrcText, setLrcText] = useState("");

  const handleImport = () => {
    if (selectedSong && lrcText) {
      onImportLRC(selectedSong.id, lrcText);
      setLrcText("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-white font-semibold mb-4">选择歌曲</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto min-h-0">
            {songs.map((song) => (
              <button
                key={song.id}
                onClick={() => {
                  onSelectSong(song);
                  onLoadLyric(song.id);
                }}
                className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                  selectedSong?.id === song.id
                    ? "bg-blue-500/20 border border-blue-500/30"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="text-white text-sm font-medium truncate">{song.title}</div>
                <div className="text-white/60 text-xs truncate">{song.artist}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <h3 className="text-white font-semibold mb-4">
            {selectedSong ? `编辑: ${selectedSong.title}` : "请选择歌曲"}
          </h3>

          {selectedSong && (
            <div className="space-y-4">
              <div>
                <label className="text-white/80 text-sm mb-2 block">LRC歌词文本</label>
                <textarea
                  value={lrcText}
                  onChange={(e) => setLrcText(e.target.value)}
                  placeholder="粘贴LRC格式歌词..."
                  className="w-full h-40 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={!lrcText}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  导入LRC
                </button>

                {currentLyric && (
                  <button
                    onClick={() => {
                      const lrc = onExportLRC(selectedSong.id);
                      const blob = new Blob([lrc], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${selectedSong.title}.lrc`;
                      a.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    导出LRC
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverTab({
  songs,
  selectedSong,
  onSelectSong,
  covers,
  onLoadCover,
  onSaveCover,
  onImportCover,
}: {
  songs: Song[];
  selectedSong: Song | null;
  onSelectSong: (song: Song | null) => void;
  covers: any[];
  onLoadCover: (songId: string) => any;
  onSaveCover: (cover: any) => void;
  onImportCover: (songId: string, imageData: string, format: string) => any;
}) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedSong && e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        const format = file.type.includes("png") ? "png" : "jpg";
        onImportCover(selectedSong.id, imageData, format);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-white font-semibold mb-4">选择歌曲</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto min-h-0">
            {songs.map((song) => (
              <button
                key={song.id}
                onClick={() => {
                  onSelectSong(song);
                  onLoadCover(song.id);
                }}
                className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                  selectedSong?.id === song.id
                    ? "bg-blue-500/20 border border-blue-500/30"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="text-white text-sm font-medium truncate">{song.title}</div>
                <div className="text-white/60 text-xs truncate">{song.artist}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <h3 className="text-white font-semibold mb-4">
            {selectedSong ? `封面: ${selectedSong.title}` : "请选择歌曲"}
          </h3>

          {selectedSong && (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="w-48 h-48 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  {selectedSong?.cover ? (
                    <img
                      src={selectedSong.cover}
                      alt={selectedSong.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image className="w-16 h-16 text-white/40" />
                  )}
                </div>
              </div>

              <div className="text-center">
                <label className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  上传封面
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
