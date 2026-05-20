"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Edit3, FileText, Loader2, Music, Search, Upload, X } from "lucide-react";
import { usePlaylistStore } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useLyricsSearchStore } from "@/store/lyricsSearchStore";
import { formatLyricsForDisplay, isValidLRCFormat } from "@/services/lyricsService";

interface LyricsImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LyricsImportPanel: React.FC<LyricsImportPanelProps> = ({ isOpen, onClose }) => {
  const { songs, updateSong } = usePlaylistStore();
  const currentSong = useAudioStore((state) => state.currentSong);
  const { importManualLyrics, lyricSourceState, setCurrentSongId } = useLyricsSearchStore();
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [lyricsContent, setLyricsContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSong = songs.find((song) => song.id === selectedSongId);
  const filteredSongs = songs.filter((song) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!isOpen || !currentSong) return;

    setCurrentSongId(currentSong.id);
    setSelectedSongId((previous) => previous || currentSong.id);
    setLyricsContent((previous) => previous || currentSong.lyrics || "");
  }, [currentSong, isOpen, setCurrentSongId]);

  const handleSelectSong = (songId: string) => {
    const song = songs.find((item) => item.id === songId);
    setSelectedSongId(songId);
    setCurrentSongId(songId);
    setLyricsContent(song?.lyrics || "");
    setIsEditing(false);
    setMessage(null);
  };

  const saveLyrics = (lyrics: string) => {
    if (!selectedSongId) return;

    const trimmedLyrics = lyrics.trim();
    const song = songs.find((item) => item.id === selectedSongId);
    updateSong(selectedSongId, { lyrics: trimmedLyrics });

    if (trimmedLyrics) {
      importManualLyrics(trimmedLyrics, {
        title: song?.title || currentSong?.title,
        artist: song?.artist || currentSong?.artist,
        album: song?.album || currentSong?.album,
      });
    }

    setMessage(trimmedLyrics ? "歌词已保存并同步到当前歌词状态" : "歌词已清空");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSongId) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      if (!isValidLRCFormat(text)) {
        setMessage("文件不是有效的 LRC 格式");
        return;
      }

      setLyricsContent(text);
      saveLyrics(text);
      setIsEditing(false);
    } catch {
      setMessage("读取歌词文件失败");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveLyrics = () => {
    if (!selectedSongId) return;
    if (lyricsContent.trim() && !isValidLRCFormat(lyricsContent)) {
      setMessage("歌词必须是有效的 LRC 格式，例如 [00:01.00]Hello");
      return;
    }

    saveLyrics(lyricsContent);
    setIsEditing(false);
  };

  const handleClearLyrics = () => {
    if (!selectedSongId) return;
    setLyricsContent("");
    saveLyrics("");
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
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[82vh] bg-zinc-950/90 backdrop-blur-[40px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white text-xl font-semibold">导入歌词</h2>
              <p className="text-white/45 text-xs truncate">当前来源状态: {lyricSourceState}</p>
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
                  placeholder="搜索歌曲"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 rounded-xl text-white placeholder-white/40 text-sm outline-none focus:ring-2 focus:ring-white/30"
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
                    {song.cover ? (
                      <img src={song.cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-5 h-5 text-white/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{song.title}</h4>
                    <p className="text-xs text-white/50 truncate">
                      {song.artist} · {formatTime(song.duration || 0)}
                    </p>
                  </div>
                  {song.lyrics && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedSong ? (
              <>
                <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold truncate">{selectedSong.title}</h3>
                    <p className="text-white/50 text-sm truncate">{selectedSong.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/85 text-sm transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      上传
                    </button>
                    {selectedSong.lyrics && (
                      <button
                        onClick={handleClearLyrics}
                        className="px-3 py-2 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 text-sm transition-colors"
                      >
                        清空
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
                  {message && (
                    <div className="mb-4 rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white/75">
                      {message}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-200 text-sm">
                        <Check className="w-4 h-4" />
                        {lyricsContent ? "已载入歌词" : "暂无歌词"}
                      </div>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        编辑
                      </button>
                    </div>

                    {isEditing || !lyricsContent ? (
                      <textarea
                        value={lyricsContent}
                        onChange={(e) => setLyricsContent(e.target.value)}
                        className="w-full h-72 p-4 bg-white/5 rounded-xl text-white/80 text-sm font-mono outline-none focus:ring-2 focus:ring-white/30 resize-none"
                        placeholder="[00:01.00]第一句歌词"
                      />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-xl">
                        <pre className="text-white/70 text-sm font-mono whitespace-pre-wrap">
                          {formatLyricsForDisplay(lyricsContent)}
                        </pre>
                      </div>
                    )}

                    {(isEditing || !lyricsContent) && (
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
                          className="px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition-colors"
                        >
                          保存
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Music className="w-10 h-10 text-white/30" />
                </div>
                <p className="text-white/70 text-lg mb-2">选择一首歌曲</p>
                <p className="text-white/40 text-sm">从左侧列表选择要导入歌词的歌曲</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
