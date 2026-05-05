"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylistStore } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { X, Upload, FileText, Search, Edit3, Check, Clock, Music, Loader2 } from "lucide-react";
import { parseLRCLyrics, isValidLRCFormat, formatLyricsForDisplay } from "@/services/lyricsService";

interface LyricsImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LyricsImportPanel: React.FC<LyricsImportPanelProps> = ({ isOpen, onClose }) => {
  const { songs, updateSong } = usePlaylistStore();
  const currentSong = useAudioStore(state => state.currentSong);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [lyricsContent, setLyricsContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSong = songs.find((s) => s.id === selectedSongId);

  const filteredSongs = songs.filter((song) => {
    const query = searchQuery.toLowerCase();
    return song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query);
  });

  const handleSelectSong = (songId: string) => {
    setSelectedSongId(songId);
    const song = songs.find((s) => s.id === songId);
    if (song?.lyrics) {
      setLyricsContent(song.lyrics);
    } else {
      setLyricsContent("");
    }
    setIsEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSongId) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      if (isValidLRCFormat(text)) {
        setLyricsContent(text);
        updateSongLyrics(selectedSongId, text);
      } else {
        alert("无效的LRC格式文件");
      }
    } catch (error) {
      console.error("Error reading lyrics file:", error);
      alert("读取歌词文件失败");
    } finally {
      setIsLoading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveLyrics = () => {
    if (!selectedSongId) return;

    if (lyricsContent.trim() && !isValidLRCFormat(lyricsContent)) {
      alert("歌词必须是有效的LRC格式");
      return;
    }

    updateSongLyrics(selectedSongId, lyricsContent.trim());
    setIsEditing(false);
  };

  const updateSongLyrics = (songId: string, lyrics: string) => {
    updateSong(songId, { lyrics });
  };

  const handleClearLyrics = () => {
    if (!selectedSongId) return;
    if (confirm("确定要清除这首歌的歌词吗？")) {
      setLyricsContent("");
      updateSongLyrics(selectedSongId, "");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
        className="relative w-full max-w-4xl max-h-[80vh] bg-[#1c1c1e]/90 backdrop-blur-[40px] rounded-[24px] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white text-xl font-semibold">导入歌词</h2>
                <p className="text-white/40 text-xs">为歌曲导入LRC格式歌词</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="w-80 border-r border-white/10 flex flex-col">
              <div className="p-4 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="搜索歌曲..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 rounded-xl text-white placeholder-white/40 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 min-h-0">
                {filteredSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleSelectSong(song.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      selectedSongId === song.id
                        ? "bg-white/20 text-white"
                        : "hover:bg-white/10 text-white/80"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {song.cover && song.cover !== "" ? (
                        <img src={song.cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-5 h-5 text-white/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{song.title}</h4>
                      <p className="text-xs text-white/50 truncate">{song.artist}</p>
                    </div>
                    {song.lyrics && (
                      <div
                        className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"
                        title="已有歌词"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              {selectedSong ? (
                <>
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                        {selectedSong.cover && selectedSong.cover !== "" ? (
                          <img
                            src={selectedSong.cover}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-6 h-6 text-white/40" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{selectedSong.title}</h3>
                        <p className="text-white/50 text-sm">{selectedSong.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedSong.lyrics && (
                        <button
                          onClick={handleClearLyrics}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm transition-colors"
                        >
                          清除歌词
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
                    {lyricsContent ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-green-400 text-sm">
                            <Check className="w-4 h-4" />
                            歌词已导入
                          </div>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                            编辑
                          </button>
                        </div>

                        {isEditing ? (
                          <textarea
                            value={lyricsContent}
                            onChange={(e) => setLyricsContent(e.target.value)}
                            className="w-full h-64 p-4 bg-white/5 rounded-xl text-white/80 text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                            placeholder="粘贴LRC格式歌词..."
                          />
                        ) : (
                          <div className="p-4 bg-white/5 rounded-xl">
                            <pre className="text-white/70 text-sm font-mono whitespace-pre-wrap">
                              {formatLyricsForDisplay(lyricsContent)}
                            </pre>
                          </div>
                        )}

                        {isEditing && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setIsEditing(false);
                                setLyricsContent(selectedSong.lyrics || "");
                              }}
                              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                            >
                              取消
                            </button>
                            <button
                              onClick={handleSaveLyrics}
                              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-colors"
                            >
                              保存
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                          <FileText className="w-8 h-8 text-white/30" />
                        </div>
                        <p className="text-white/60 mb-2">暂无歌词</p>
                        <p className="text-white/40 text-sm mb-6">导入LRC格式歌词文件</p>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".lrc,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium transition-all disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                          上传LRC文件
                        </button>

                        <p className="text-white/30 text-xs mt-4">支持 .lrc 格式的歌词文件</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Music className="w-10 h-10 text-white/30" />
                  </div>
                  <p className="text-white/60 text-lg mb-2">选择一首歌曲</p>
                  <p className="text-white/40 text-sm">从左侧列表选择要导入歌词的歌曲</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
