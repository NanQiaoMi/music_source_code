"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Edit, FileText, Heart, History, Music, RefreshCw, Search, Star, X } from "lucide-react";
import { useLyricsSearchStore, LyricSourceState } from "@/store/lyricsSearchStore";
import { LyricSearchResult } from "@/services/lyricsSearchService";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useGlassToast } from "@/components/shared/GlassToast";

interface LyricsSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const sourceStateCopy: Record<LyricSourceState, { label: string; className: string }> = {
  none: { label: "未选择歌词", className: "bg-white/10 text-white/60" },
  searching: { label: "正在搜索", className: "bg-sky-500/20 text-sky-200" },
  matched: { label: "已匹配", className: "bg-emerald-500/20 text-emerald-200" },
  manual: { label: "手动导入", className: "bg-amber-500/20 text-amber-200" },
  failed: { label: "未找到", className: "bg-red-500/20 text-red-200" },
};

export default function LyricsSearchPanel({ isOpen, onClose }: LyricsSearchPanelProps) {
  const [titleInput, setTitleInput] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "favorites" | "history">("search");

  const {
    searchResults,
    isLoading,
    error,
    currentLyrics,
    parsedLyrics,
    searchHistory,
    favoriteLyrics,
    lyricSourceState,
    setCurrentSongId,
    searchLyrics,
    selectLyrics,
    clearSearchHistory,
    toggleFavoriteLyrics,
    editLyrics,
    autoMatchLyrics,
  } = useLyricsSearchStore();

  const currentSong = useAudioStore((state) => state.currentSong);
  const openPanel = useUIStore((state) => state.openPanel);
  const { showToast } = useGlassToast();
  const sourceState = sourceStateCopy[lyricSourceState];

  const currentPreview = useMemo(() => {
    if (!currentLyrics) return [];
    return parsedLyrics.slice(0, 4).map((line) => line.text);
  }, [currentLyrics, parsedLyrics]);

  useEffect(() => {
    if (!isOpen) return;

    setCurrentSongId(currentSong?.id ?? null);
    if (currentSong) {
      setTitleInput(currentSong.title);
      setArtistInput(currentSong.artist);
    }
  }, [currentSong, isOpen, setCurrentSongId]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!titleInput.trim()) {
      showToast("请输入歌曲名", "warning");
      return;
    }

    await searchLyrics(titleInput.trim(), artistInput.trim() || undefined);
  };

  const handleAutoMatch = async () => {
    if (!currentSong) {
      showToast("当前没有正在播放的歌曲", "warning");
      return;
    }

    await autoMatchLyrics(currentSong.title, currentSong.artist);
    const matched = useLyricsSearchStore.getState().currentLyrics;
    showToast(matched ? "歌词匹配成功" : "未找到匹配歌词", matched ? "success" : "info");
  };

  const handleSelectLyrics = (lyrics: LyricSearchResult) => {
    selectLyrics(lyrics);
    showToast("已选择歌词", "success");
  };

  const handleToggleFavorite = (e: React.MouseEvent, lyrics: LyricSearchResult) => {
    e.stopPropagation();
    const wasFavorite = favoriteLyrics.some((item) => item.id === lyrics.id);
    toggleFavoriteLyrics(lyrics);
    showToast(wasFavorite ? "已从收藏移除" : "已加入收藏", "success");
  };

  const handleSaveEdit = () => {
    if (!currentLyrics) return;

    editLyrics(currentLyrics.id, editContent);
    setIsEditing(false);
    showToast("歌词已保存", "success");
  };

  const openManualImport = () => {
    openPanel("lyricsImport");
    onClose();
  };

  const isFavorite = (lyricsId: string) => favoriteLyrics.some((lyrics) => lyrics.id === lyricsId);

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
            initial={{ scale: 0.96, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 18 }}
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col"
          >
            <div className="backdrop-blur-xl bg-zinc-950/80 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-white">歌词搜索</h2>
                    <p className="text-sm text-white/55 truncate">
                      {currentSong
                        ? `${currentSong.title} - ${currentSong.artist}`
                        : "选择或导入当前歌词"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs ${sourceState.className}`}>
                    {sourceState.label}
                  </span>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 border-b border-white/10">
                {[
                  { id: "search", icon: Search, label: "搜索" },
                  { id: "favorites", icon: Star, label: "收藏" },
                  { id: "history", icon: History, label: "历史" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`py-3 px-4 text-sm font-medium transition-all ${
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

              <div className="p-5 overflow-y-auto max-h-[62vh] custom-scrollbar min-h-0">
                {activeTab === "search" && (
                  <div className="space-y-5">
                    <form onSubmit={handleSearch} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="space-y-2">
                          <span className="block text-sm text-white/60">歌曲名</span>
                          <input
                            type="text"
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            placeholder="输入歌曲名"
                            className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-xl text-white placeholder-white/35 focus:outline-none focus:border-white/45 transition-all"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="block text-sm text-white/60">歌手</span>
                          <input
                            type="text"
                            value={artistInput}
                            onChange={(e) => setArtistInput(e.target.value)}
                            placeholder="可选"
                            className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-xl text-white placeholder-white/35 focus:outline-none focus:border-white/45 transition-all"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 min-w-40 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Search className="w-5 h-5" />
                          )}
                          {isLoading ? "搜索中..." : "搜索歌词"}
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoMatch}
                          disabled={isLoading || !currentSong}
                          className="px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all disabled:opacity-40"
                        >
                          自动匹配
                        </button>
                        <button
                          type="button"
                          onClick={openManualImport}
                          className="px-5 py-3 bg-amber-400/15 hover:bg-amber-400/25 rounded-xl text-amber-100 font-medium transition-all flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          手动导入
                        </button>
                      </div>
                    </form>

                    {error && (
                      <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-100">
                        {error}
                      </div>
                    )}

                    {searchResults.length === 0 && !isLoading ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                        <Search className="w-10 h-10 mx-auto mb-3 text-white/35" />
                        <p className="text-white/70">没有可选结果时，可以直接手动导入 LRC 歌词。</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {searchResults.map((lyrics) => (
                          <motion.button
                            type="button"
                            key={lyrics.id}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => handleSelectLyrics(lyrics)}
                            className={`w-full p-4 rounded-xl border text-left transition-all ${
                              currentLyrics?.id === lyrics.id
                                ? "bg-purple-500/20 border-purple-300/50"
                                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-white font-medium truncate">{lyrics.title}</h3>
                                <p className="text-white/60 text-sm mt-1 truncate">
                                  {lyrics.artist}
                                  {lyrics.album ? ` · ${lyrics.album}` : ""}
                                </p>
                                <p className="text-white/40 text-xs mt-1">
                                  {lyrics.source}
                                  {lyrics.score ? ` · 匹配度 ${lyrics.score}` : ""}
                                </p>
                              </div>
                              <span
                                onClick={(e) => handleToggleFavorite(e, lyrics)}
                                className={`p-2 rounded-lg transition-all ${
                                  isFavorite(lyrics.id)
                                    ? "bg-pink-500/20 text-pink-300"
                                    : "hover:bg-white/10 text-white/40 hover:text-white"
                                }`}
                              >
                                <Heart
                                  className={`w-5 h-5 ${isFavorite(lyrics.id) ? "fill-current" : ""}`}
                                />
                              </span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "favorites" && (
                  <LyricsList
                    emptyIcon={<Star className="w-12 h-12 mx-auto mb-4 opacity-50" />}
                    emptyText="暂无收藏歌词"
                    lyrics={favoriteLyrics}
                    currentLyricsId={currentLyrics?.id}
                    isFavorite={isFavorite}
                    onSelect={handleSelectLyrics}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}

                {activeTab === "history" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white/45">最近搜索</p>
                      {searchHistory.length > 0 && (
                        <button
                          onClick={clearSearchHistory}
                          className="text-sm text-white/45 hover:text-white transition-all"
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
                      searchHistory.map((query) => (
                        <button
                          key={query}
                          onClick={() => {
                            const [title, artist = ""] = query.split(" - ");
                            setTitleInput(title);
                            setArtistInput(artist);
                            setActiveTab("search");
                          }}
                          className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-left transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <History className="w-4 h-4 text-white/40" />
                            <span className="text-white">{query}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {currentLyrics && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <h3 className="text-white font-medium">当前歌词</h3>
                        <p className="text-white/60 text-sm truncate">
                          {currentLyrics.title} - {currentLyrics.artist}
                        </p>
                        <p className="text-white/40 text-xs mt-1">
                          {currentLyrics.source} · {parsedLyrics.length} 行已解析
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditContent(currentLyrics.lyrics);
                            setIsEditing(true);
                          }}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleToggleFavorite(e, currentLyrics)}
                          className={`p-2 rounded-lg transition-all ${
                            isFavorite(currentLyrics.id)
                              ? "bg-pink-500/20 text-pink-300"
                              : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${isFavorite(currentLyrics.id) ? "fill-current" : ""}`}
                          />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-64 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/45 transition-all font-mono text-sm"
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
                            className="px-4 py-2 bg-white text-black rounded-xl transition-all"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto p-4 bg-white/5 rounded-xl custom-scrollbar min-h-0">
                        {currentPreview.length > 0 ? (
                          currentPreview.map((line) => (
                            <p key={line} className="text-white/80 text-sm leading-7">
                              {line}
                            </p>
                          ))
                        ) : (
                          <pre className="text-white/75 text-sm whitespace-pre-wrap font-mono">
                            {currentLyrics.lyrics}
                          </pre>
                        )}
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

function LyricsList({
  emptyIcon,
  emptyText,
  lyrics,
  currentLyricsId,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  emptyIcon: React.ReactNode;
  emptyText: string;
  lyrics: LyricSearchResult[];
  currentLyricsId?: string;
  isFavorite: (lyricsId: string) => boolean;
  onSelect: (lyrics: LyricSearchResult) => void;
  onToggleFavorite: (e: React.MouseEvent, lyrics: LyricSearchResult) => void;
}) {
  if (lyrics.length === 0) {
    return (
      <div className="text-center py-12 text-white/40">
        {emptyIcon}
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lyrics.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onSelect(item)}
          className={`w-full p-4 rounded-xl border text-left transition-all ${
            currentLyricsId === item.id
              ? "bg-purple-500/20 border-purple-300/50"
              : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-white font-medium truncate">{item.title}</h3>
              <p className="text-white/60 text-sm mt-1 truncate">{item.artist}</p>
            </div>
            <span
              onClick={(e) => onToggleFavorite(e, item)}
              className={`p-2 rounded-lg transition-all ${
                isFavorite(item.id) ? "bg-pink-500/20 text-pink-300" : "text-white/40"
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorite(item.id) ? "fill-current" : ""}`} />
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
