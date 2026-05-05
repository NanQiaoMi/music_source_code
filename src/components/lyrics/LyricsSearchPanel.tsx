"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Music, Heart, Edit, History, Star, RefreshCw } from "lucide-react";
import { useLyricsSearchStore } from "@/store/lyricsSearchStore";
import { useAudioStore } from "@/store/audioStore";
import { useGlassToast } from "@/components/shared/GlassToast";

interface LyricsSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LyricsSearchPanel({ isOpen, onClose }: LyricsSearchPanelProps) {
  const [titleInput, setTitleInput] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const {
    searchQuery,
    searchResults,
    isLoading,
    error,
    currentLyrics,
    parsedLyrics,
    searchHistory,
    favoriteLyrics,
    setSearchQuery,
    searchLyrics,
    selectLyrics,
    clearSearchResults,
    clearSearchHistory,
    toggleFavoriteLyrics,
    editLyrics,
    autoMatchLyrics,
  } = useLyricsSearchStore();

  const currentSong = useAudioStore(state => state.currentSong);
  const { showToast } = useGlassToast();

  const [activeTab, setActiveTab] = useState<"search" | "favorites" | "history">("search");

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!titleInput.trim()) {
      showToast("请输入歌曲名称", "warning");
      return;
    }
    await searchLyrics(titleInput, artistInput);
  };

  const handleAutoMatch = async () => {
    if (!currentSong) {
      showToast("当前没有播放的歌曲", "warning");
      return;
    }
    await autoMatchLyrics(currentSong.title, currentSong.artist);
    if (currentLyrics) {
      showToast("歌词匹配成功！", "success");
    } else {
      showToast("未找到匹配的歌词", "info");
    }
  };

  const handleSelectLyrics = (lyrics: any) => {
    selectLyrics(lyrics);
    showToast("已选择歌词", "success");
  };

  const handleToggleFavorite = (e: React.MouseEvent, lyrics: any) => {
    e.stopPropagation();
    toggleFavoriteLyrics(lyrics);
    const isFav = favoriteLyrics.some((f) => f.id === lyrics.id);
    showToast(isFav ? "已从收藏移除" : "已添加到收藏", "success");
  };

  const handleEditLyrics = () => {
    if (!currentLyrics) return;
    setEditContent(currentLyrics.lyrics);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!currentLyrics) return;
    editLyrics(currentLyrics.id, editContent);
    setIsEditing(false);
    showToast("歌词已保存", "success");
  };

  const isFavorite = (lyricsId: string) => favoriteLyrics.some((f) => f.id === lyricsId);

  useEffect(() => {
    if (isOpen) {
      if (currentSong) {
        setTitleInput(currentSong.title);
        setArtistInput(currentSong.artist);
      }
    }
  }, [isOpen, currentSong]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col"
          >
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)] flex items-center justify-center">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">歌词搜索</h2>
                    <p className="text-sm text-white/60">寻找完美的歌词</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex border-b border-white/10">
                {[
                  { id: "search", icon: Search, label: "搜索" },
                  { id: "favorites", icon: Star, label: "收藏" },
                  { id: "history", icon: History, label: "历史" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-4 px-6 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "text-white bg-white/10 border-b-2 border-white"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar min-h-0">
                {activeTab === "search" && (
                  <div className="space-y-6">
                    <form onSubmit={handleSearch} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-white/60 mb-2">歌曲名</label>
                          <input
                            type="text"
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            placeholder="输入歌曲名称..."
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-white/60 mb-2">歌手</label>
                          <input
                            type="text"
                            value={artistInput}
                            onChange={(e) => setArtistInput(e.target.value)}
                            placeholder="输入歌手名称（可选）..."
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Search className="w-5 h-5" />
                          )}
                          {isLoading ? "搜索中..." : "搜索歌词"}
                        </button>
                        {currentSong && (
                          <button
                            type="button"
                            onClick={handleAutoMatch}
                            disabled={isLoading}
                            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all disabled:opacity-50"
                          >
                            自动匹配
                          </button>
                        )}
                      </div>
                    </form>

                    {error && (
                      <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200">
                        {error}
                      </div>
                    )}

                    <div className="space-y-3">
                      {searchResults.map((lyrics) => (
                        <motion.div
                          key={lyrics.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => handleSelectLyrics(lyrics)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            currentLyrics?.id === lyrics.id
                              ? "bg-purple-500/20 border-purple-400/50"
                              : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-white font-medium">{lyrics.title}</h3>
                              <p className="text-white/60 text-sm mt-1">
                                {lyrics.artist}
                                {lyrics.album && ` · ${lyrics.album}`}
                              </p>
                              {lyrics.score && (
                                <p className="text-purple-300 text-xs mt-1">
                                  匹配度: {lyrics.score}%
                                </p>
                              )}
                            </div>
                            <button
                              onClick={(e) => handleToggleFavorite(e, lyrics)}
                              className={`p-2 rounded-lg transition-all ${
                                isFavorite(lyrics.id)
                                  ? "bg-pink-500/20 text-pink-400"
                                  : "hover:bg-white/10 text-white/40 hover:text-white"
                              }`}
                            >
                              <Heart
                                className={`w-5 h-5 ${isFavorite(lyrics.id) ? "fill-current" : ""}`}
                              />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "favorites" && (
                  <div className="space-y-3">
                    {favoriteLyrics.length === 0 ? (
                      <div className="text-center py-12 text-white/40">
                        <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>暂无收藏的歌词</p>
                      </div>
                    ) : (
                      favoriteLyrics.map((lyrics) => (
                        <motion.div
                          key={lyrics.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => handleSelectLyrics(lyrics)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            currentLyrics?.id === lyrics.id
                              ? "bg-purple-500/20 border-purple-400/50"
                              : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-white font-medium">{lyrics.title}</h3>
                              <p className="text-white/60 text-sm mt-1">{lyrics.artist}</p>
                            </div>
                            <button
                              onClick={(e) => handleToggleFavorite(e, lyrics)}
                              className="p-2 rounded-lg bg-pink-500/20 text-pink-400"
                            >
                              <Heart className="w-5 h-5 fill-current" />
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "history" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-white/40">最近搜索</p>
                      {searchHistory.length > 0 && (
                        <button
                          onClick={clearSearchHistory}
                          className="text-sm text-white/40 hover:text-white transition-all"
                        >
                          清空历史
                        </button>
                      )}
                    </div>
                    {searchHistory.length === 0 ? (
                      <div className="text-center py-12 text-white/40">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>暂无搜索历史</p>
                      </div>
                    ) : (
                      searchHistory.map((query, index) => (
                        <motion.button
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => {
                            const parts = query.split(" - ");
                            setTitleInput(parts[0]);
                            setArtistInput(parts[1] || "");
                            setActiveTab("search");
                          }}
                          className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-left transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <History className="w-4 h-4 text-white/40" />
                            <span className="text-white">{query}</span>
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                )}

                {currentLyrics && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-white font-medium">当前歌词</h3>
                        <p className="text-white/60 text-sm">
                          {currentLyrics.title} - {currentLyrics.artist}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleEditLyrics}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleToggleFavorite(e, currentLyrics)}
                          className={`p-2 rounded-lg transition-all ${
                            isFavorite(currentLyrics.id)
                              ? "bg-pink-500/20 text-pink-400"
                              : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isFavorite(currentLyrics.id) ? "fill-current" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-64 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition-all font-mono text-sm"
                        />
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="px-4 py-2 bg-white text-black rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto p-4 bg-white/5 rounded-xl custom-scrollbar min-h-0">
                        <pre className="text-white/80 text-sm whitespace-pre-wrap font-mono">
                          {currentLyrics.lyrics}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
