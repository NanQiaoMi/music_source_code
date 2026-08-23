"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search,
  X,
  Play,
  Download,
  ListPlus,
  Heart,
  MoreHorizontal,
  FolderPlus,
  Copy,
  Sparkles,
  Layers,
  ArrowUpDown,
  CheckSquare,
  Square,
  Check,
  Music2,
  FolderHeart,
  Radio,
  ExternalLink,
  ChevronDown,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  Headphones,
  FileCode,
} from "lucide-react";
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { multiSourceResolver } from "@/services/MultiSourceResolver";
import { LXRunner } from "@/lib/sources/lxRunner";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { PlaylistDetailDrawer, DrawerPlaylistInfo } from "./PlaylistDetailDrawer";
import type { OnlinePlaylistResult } from "@/app/api/playlist/search/route";

type SearchSourceTab = "all" | "kuwo" | "kugou" | "qq" | "netease" | "migu" | "lx_custom";
type SearchMode = "songs" | "playlists";
type SortField = "index" | "title" | "artist" | "album" | "duration";
type SortOrder = "asc" | "desc";
type QualityFilter = "all" | "24bit" | "flac" | "320k";

const SOURCE_TABS: { id: SearchSourceTab; label: string; tag: string; color: string; badgeBg: string }[] = [
  { id: "all", label: "聚合大会", tag: "ALL", color: "text-cyan-400", badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  { id: "kuwo", label: "酷我音乐", tag: "kw", color: "text-emerald-400", badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { id: "kugou", label: "酷狗音乐", tag: "kg", color: "text-blue-400", badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "qq", label: "QQ 音乐", tag: "tx", color: "text-teal-400", badgeBg: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  { id: "netease", label: "网易云", tag: "wy", color: "text-rose-400", badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  { id: "migu", label: "咪咕音乐", tag: "mg", color: "text-amber-400", badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "lx_custom", label: "落雪母带", tag: "lx", color: "text-purple-400", badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
];

const HOT_SEARCH_TAGS = [
  "周杰伦",
  "邓紫棋",
  "陈奕迅",
  "林俊杰",
  "Taylor Swift",
  "七里香",
  "晴天",
  "海阔天空",
  "华语金曲",
  "ACG 纯音",
];

export const LxMusicSearchTab: React.FC = () => {
  const [keyword, setKeyword] = useState("周杰伦");
  const [activeTab, setActiveTab] = useState<SearchSourceTab>("all");
  const [searchMode, setSearchMode] = useState<SearchMode>("songs");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");

  const [isSearching, setIsSearching] = useState(false);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [playlistResults, setPlaylistResults] = useState<OnlinePlaylistResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(["周杰伦", "晴天", "七里香"]);

  // 表格排序与多选
  const [sortField, setSortField] = useState<SortField>("index");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 歌单详情抽屉
  const [selectedPlaylist, setSelectedPlaylist] = useState<DrawerPlaylistInfo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 右键上下文菜单
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    song: Song | null;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { playSong, playQueue } = useAudioStore();
  const { addToQueue, insertNext } = useQueueStore();
  const { addBatchDownloads, isSongOffline } = useOfflineDownloadStore();
  const { addSong, importSongs } = usePlaylistStore();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // 执行搜索
  const handleSearch = useCallback(
    async (queryText?: string, targetTab = activeTab, targetMode = searchMode) => {
      const q = (queryText !== undefined ? queryText : keyword).trim();
      if (!q) return;

      setIsSearching(true);
      setSelectedIds(new Set());

      // 记录历史
      setSearchHistory((prev) => Array.from(new Set([q, ...prev])).slice(0, 10));

      try {
        if (targetMode === "songs") {
          if (targetTab === "all") {
            const seg = await multiSourceResolver.searchOnlineMusicSegmented(q);
            setSongResults(seg.all);
          } else if (targetTab === "lx_custom") {
            const lxScripts = useSourceConfigStore.getState().lxScripts;
            const activeScript = lxScripts.find((s) => s.enabled) || {
              id: "exclusive_v4",
              name: "独家音源",
              author: "LX",
              version: "4.0",
              description: "",
              enabled: true,
              lastUpdated: Date.now(),
              supportedActions: ["search" as const],
            };
            const list = await LXRunner.search(activeScript, q, 1, 100);
            setSongResults(list);
          } else {
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const epMap: Record<string, string> = {
              kuwo: `${base}/api/kuwo/search?keywords=${encodeURIComponent(q)}&limit=100`,
              kugou: `${base}/api/kugou/search?keywords=${encodeURIComponent(q)}&limit=100`,
              qq: `${base}/api/qq/search?keywords=${encodeURIComponent(q)}&limit=100`,
              netease: `${base}/api/search?keywords=${encodeURIComponent(q)}&limit=100`,
              migu: `${base}/api/search?keywords=${encodeURIComponent(q)}&limit=100`,
            };
            const targetUrl = epMap[targetTab] || `${base}/api/search?keywords=${encodeURIComponent(q)}&limit=100`;
            const res = await fetch(targetUrl);
            if (res.ok) {
              const data = await res.json();
              setSongResults(Array.isArray(data.songs) ? data.songs : []);
            } else {
              setSongResults([]);
            }
          }
        } else {
          // 歌单搜索
          const res = await fetch(`/api/playlist/search?keywords=${encodeURIComponent(q)}&limit=60&source=${targetTab === "all" ? "all" : targetTab}`);
          if (res.ok) {
            const data = await res.json();
            setPlaylistResults(Array.isArray(data.playlists) ? data.playlists : []);
          } else {
            setPlaylistResults([]);
          }
        }
      } catch (e) {
        console.warn("[LxMusicSearchTab] Search error:", e);
        showToast("搜索接口响应异常，请重试");
      } finally {
        setIsSearching(false);
      }
    },
    [keyword, activeTab, searchMode, showToast]
  );

  // 初始加载一次默认搜索
  useEffect(() => {
    handleSearch("周杰伦", "all", "songs");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换音源 Tab 时触发
  const handleTabChange = (tab: SearchSourceTab) => {
    setActiveTab(tab);
    handleSearch(keyword, tab, searchMode);
  };

  // 切换单曲/歌单模式
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    handleSearch(keyword, activeTab, mode);
  };

  // 排序与过滤处理
  const processedSongs = useMemo(() => {
    let list = [...songResults];

    // 1. 音质过滤
    if (qualityFilter === "24bit") {
      list = list.filter((s) => s.title.includes("24bit") || s.format === "flac" || s.album?.includes("Master"));
    } else if (qualityFilter === "flac") {
      list = list.filter((s) => s.format === "flac" || !s.format || s.format === "mp3");
    }

    // 2. 排序
    if (sortField !== "index") {
      list.sort((a, b) => {
        let valA: string | number = "";
        let valB: string | number = "";

        if (sortField === "title") {
          valA = a.title;
          valB = b.title;
        } else if (sortField === "artist") {
          valA = a.artist;
          valB = b.artist;
        } else if (sortField === "album") {
          valA = a.album || "";
          valB = b.album || "";
        } else if (sortField === "duration") {
          valA = a.duration;
          valB = b.duration;
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
    }

    return list;
  }, [songResults, qualityFilter, sortField, sortOrder]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // 多选逻辑
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === processedSongs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedSongs.map((s) => s.id)));
    }
  };

  // 播放与队列
  const handlePlaySingle = (song: Song) => {
    const list = processedSongs.length > 0 ? processedSongs : [song];
    const idx = list.findIndex((s) => s.id === song.id);
    playQueue(list, idx >= 0 ? idx : 0);
    showToast(`正在播放: ${song.title}`);
  };

  const handlePlayAll = () => {
    if (processedSongs.length > 0) {
      playQueue(processedSongs, 0);
      showToast(`已将 ${processedSongs.length} 首搜索结果加入播放队列`);
    }
  };

  // 批量离线下载
  const handleDownloadSelected = () => {
    const toDownload =
      selectedIds.size > 0
        ? processedSongs.filter((s) => selectedIds.has(s.id))
        : processedSongs;
    if (toDownload.length > 0) {
      addBatchDownloads(toDownload, "lossless");
      showToast(`已提交 ${toDownload.length} 首歌曲的高解析离线下载任务`);
    }
  };

  const handleBatchAddToQueue = () => {
    const toAdd =
      selectedIds.size > 0
        ? processedSongs.filter((s) => selectedIds.has(s.id))
        : processedSongs;
    toAdd.forEach((s) => addToQueue(s));
    showToast(`已将 ${toAdd.length} 首歌曲追加至当前播放队列`);
  };

  // 歌单卡片点击
  const handleOpenPlaylist = (p: OnlinePlaylistResult) => {
    setSelectedPlaylist({
      id: p.id,
      name: p.name,
      coverImgUrl: p.coverImgUrl,
      creatorName: p.creatorName,
      playCount: p.playCount,
      trackCount: p.trackCount,
      source: p.source,
      description: p.description,
    });
    setIsDrawerOpen(true);
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, song: Song) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      song,
    });
  };

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

  const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds <= 0) return "03:45";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getSourceBadge = (source?: string) => {
    const s = (source || "all").toLowerCase();
    if (s === "kuwo" || s === "kw") {
      return <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">kw</span>;
    }
    if (s === "kugou" || s === "kg") {
      return <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">kg</span>;
    }
    if (s === "qq" || s === "tx") {
      return <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">tx</span>;
    }
    if (s === "netease" || s === "wy") {
      return <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">wy</span>;
    }
    if (s === "migu" || s === "mg") {
      return <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">mg</span>;
    }
    if (s === "lx_custom" || s === "lx") {
      return <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">lx</span>;
    }
    return <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-white/10 text-white/70">src</span>;
  };

  const getQualityBadge = (song: Song) => {
    if (song.title.includes("24bit") || song.format === "flac") {
      return (
        <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
          24bit
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
        SQ
      </span>
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
      {/* 顶部控制中枢 */}
      <div className="p-4 md:p-6 border-b border-white/10 bg-white/[0.02] backdrop-blur-xl flex flex-col gap-4 shrink-0">
        {/* 1. 搜索框与模式切换 */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1 w-full max-w-2xl flex items-center">
            <div className="relative w-full flex items-center bg-white/[0.07] hover:bg-white/[0.1] focus-within:bg-white/[0.12] border border-white/15 focus-within:border-emerald-400/60 rounded-2xl px-4 py-2.5 transition-all shadow-inner">
              <Search className="w-4 h-4 text-emerald-400 shrink-0 mr-3" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="搜索全网海量歌曲、歌手、专辑或落雪母带源..."
                className="w-full bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
              />
              {keyword && (
                <button
                  onClick={() => setKeyword("")}
                  className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => handleSearch()}
                disabled={isSearching}
                className="ml-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "检索"}
              </button>
            </div>
          </div>

          {/* 右侧：单曲 / 歌单模式切换 */}
          <div className="flex items-center bg-black/40 border border-white/10 p-1 rounded-2xl shrink-0">
            <button
              onClick={() => handleModeChange("songs")}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                searchMode === "songs"
                  ? "bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white shadow-md shadow-emerald-500/20"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5" />
                歌曲搜索
              </span>
            </button>
            <button
              onClick={() => handleModeChange("playlists")}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                searchMode === "playlists"
                  ? "bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white shadow-md shadow-emerald-500/20"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FolderHeart className="w-3.5 h-3.5" />
                歌单搜索
              </span>
            </button>
          </div>
        </div>

        {/* 2. 多音源切换 Tab 栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {SOURCE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isActive
                      ? "bg-white/15 text-white border-white/20 shadow-sm"
                      : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border-white/10"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${tab.color.replace("text-", "bg-")}`} />
                  <span>{tab.label}</span>
                  <span className={`px-1 py-0.2 text-[9px] font-mono rounded ${tab.badgeBg}`}>
                    {tab.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 音质筛选与全选播放 */}
          {searchMode === "songs" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-xs text-white/60">
                {(["all", "24bit", "flac"] as QualityFilter[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQualityFilter(q)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      qualityFilter === q ? "bg-white/15 text-white" : "hover:text-white"
                    }`}
                  >
                    {q === "all" ? "全部音质" : q === "24bit" ? "Hi-Res 24bit" : "SQ 无损"}
                  </button>
                ))}
              </div>

              <button
                onClick={handlePlayAll}
                disabled={processedSongs.length === 0}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                播放全部
              </button>
            </div>
          )}
        </div>

        {/* 3. 热门推荐标签 */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs text-white/40 pt-1">
          <span className="shrink-0 flex items-center gap-1 text-[11px] text-white/50">
            <Sparkles className="w-3 h-3 text-amber-400" /> 热搜:
          </span>
          {HOT_SEARCH_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setKeyword(tag);
                handleSearch(tag);
              }}
              className="px-2.5 py-0.5 rounded-lg bg-white/[0.04] hover:bg-white/10 text-white/60 hover:text-white text-[11px] transition-colors shrink-0"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 主体展示区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        {isSearching ? (
          <div className="h-96 flex flex-col items-center justify-center text-white/40 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            <p className="text-sm">正在检索全网高解析音乐资源...</p>
          </div>
        ) : searchMode === "songs" ? (
          /* 单曲模式表格 */
          processedSongs.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-white/40 gap-3">
              <Music2 className="w-12 h-12 opacity-30" />
              <p className="text-sm">未检索到相关曲目，请更换关键词或切换音源</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-[11px] select-none">
                    <th className="py-2.5 px-3 w-10">
                      <button onClick={handleSelectAll} className="hover:text-white">
                        {selectedIds.size === processedSongs.length && processedSongs.length > 0 ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-white/30" />
                        )}
                      </button>
                    </th>
                    <th
                      onClick={() => handleSortToggle("index")}
                      className="py-2.5 px-2 w-12 cursor-pointer hover:text-white"
                    >
                      #
                    </th>
                    <th
                      onClick={() => handleSortToggle("title")}
                      className="py-2.5 px-3 cursor-pointer hover:text-white"
                    >
                      <span className="flex items-center gap-1">
                        歌曲名
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSortToggle("artist")}
                      className="py-2.5 px-3 cursor-pointer hover:text-white"
                    >
                      <span className="flex items-center gap-1">
                        艺术家
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSortToggle("album")}
                      className="py-2.5 px-3 cursor-pointer hover:text-white"
                    >
                      <span className="flex items-center gap-1">
                        专辑名
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSortToggle("duration")}
                      className="py-2.5 px-3 w-20 cursor-pointer hover:text-white text-right"
                    >
                      <span className="flex items-center justify-end gap-1">
                        时长
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      </span>
                    </th>
                    <th className="py-2.5 px-3 w-32 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {processedSongs.map((song, idx) => {
                    const isSelected = selectedIds.has(song.id);
                    const isDownloaded = isSongOffline(song.id);

                    return (
                      <tr
                        key={`${song.source || "src"}-${song.id || idx}-${idx}`}
                        onDoubleClick={() => handlePlaySingle(song)}
                        onContextMenu={(e) => handleContextMenu(e, song)}
                        className={`group transition-all select-none cursor-pointer ${
                          isSelected
                            ? "bg-emerald-500/15"
                            : "hover:bg-white/[0.05]"
                        }`}
                      >
                        {/* 勾选框 */}
                        <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleSelect(song.id)}
                            className="text-white/40 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-white/30" />
                            )}
                          </button>
                        </td>

                        {/* 序号 */}
                        <td className="py-2.5 px-2 font-mono text-white/30 tabular-nums">
                          {idx + 1}
                        </td>

                        {/* 歌曲名 + 音质/来源徽标 */}
                        <td className="py-2.5 px-3 font-medium text-white/90">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-xs">{song.title}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {getQualityBadge(song)}
                              {getSourceBadge(song.source)}
                              {isDownloaded && (
                                <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-cyan-500/20 text-cyan-300">
                                  已离线
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 艺术家 */}
                        <td className="py-2.5 px-3 text-white/60">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setKeyword(song.artist);
                              handleSearch(song.artist);
                            }}
                            className="truncate max-w-xs hover:text-emerald-400 hover:underline transition-colors text-left"
                          >
                            {song.artist}
                          </button>
                        </td>

                        {/* 专辑名 */}
                        <td className="py-2.5 px-3 text-white/40 truncate max-w-xs">
                          {song.album || "精选大碟"}
                        </td>

                        {/* 时长 */}
                        <td className="py-2.5 px-3 text-right font-mono text-white/40 tabular-nums">
                          {formatDuration(song.duration)}
                        </td>

                        {/* 快捷悬浮动作 */}
                        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handlePlaySingle(song)}
                              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-emerald-500 hover:text-white flex items-center justify-center text-white/70 transition-colors"
                              title="立即播放"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              onClick={() => {
                                insertNext(song);
                                showToast(`已将《${song.title}》设置为下一首播放`);
                              }}
                              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                              title="下一首播放"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                addBatchDownloads([song], "lossless");
                                showToast(`已添加《${song.title}》至离线下载队列`);
                              }}
                              disabled={isDownloaded}
                              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors disabled:opacity-40"
                              title={isDownloaded ? "已离线" : "离线缓存最高音质"}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleContextMenu(e, song)}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                              title="更多操作"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* 歌单模式网格 */
          playlistResults.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-white/40 gap-3">
              <FolderHeart className="w-12 h-12 opacity-30" />
              <p className="text-sm">未检索到相关歌单，请更换关键词</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {playlistResults.map((p, idx) => (
                <div
                  key={`${p.source}-${p.id}-${idx}`}
                  onClick={() => handleOpenPlaylist(p)}
                  className="group flex flex-col rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 p-3 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg mb-2.5 bg-black/40">
                    <Image
                      src={p.coverImgUrl || "/default-cover.svg"}
                      alt={p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="200px"
                    />
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white/80 font-mono">
                      {p.source === "netease" ? "网易云" : "QQ音乐"}
                    </div>
                  </div>
                  <h4 className="text-xs font-semibold text-white/90 line-clamp-2 leading-snug">
                    {p.name}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-white/40 mt-2">
                    <span className="truncate">{p.creatorName}</span>
                    <span>{p.trackCount} 首</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 底部批量操作悬浮条 */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#161a26]/95 border border-white/20 backdrop-blur-2xl rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-4 text-xs"
          >
            <div className="flex items-center gap-2 pr-2 border-r border-white/15">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white">已选择 {selectedIds.size} 首歌曲</span>
            </div>

            <button
              onClick={handleDownloadSelected}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              一键下载已选 (最高音质)
            </button>

            <button
              onClick={handleBatchAddToQueue}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium active:scale-95 transition-all flex items-center gap-1.5"
            >
              <ListPlus className="w-3.5 h-3.5" />
              批量加入队列
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              取消选择
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 右键上下文菜单 */}
      {contextMenu && contextMenu.song && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[200px] bg-[#1a1d29]/95 border border-white/15 backdrop-blur-2xl rounded-2xl p-1.5 shadow-2xl text-xs text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-white/10 font-semibold text-white/90 truncate max-w-[220px]">
            {contextMenu.song.title}
          </div>
          <div className="py-1 space-y-0.5">
            <button
              onClick={() => {
                if (contextMenu.song) handlePlaySingle(contextMenu.song);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-lg hover:bg-emerald-500 hover:text-white flex items-center gap-2 text-left transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              立即播放
            </button>
            <button
              onClick={() => {
                if (contextMenu.song) {
                  insertNext(contextMenu.song);
                  showToast("已设为下一首播放");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors"
            >
              <ListPlus className="w-3.5 h-3.5" />
              下一首播放
            </button>
            <button
              onClick={() => {
                if (contextMenu.song) {
                  addToQueue(contextMenu.song);
                  showToast("已加入播放队列");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors"
            >
              <Music2 className="w-3.5 h-3.5" />
              加入播放队列
            </button>
            <button
              onClick={() => {
                if (contextMenu.song) {
                  addBatchDownloads([contextMenu.song], "lossless");
                  showToast("已提交离线下载");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              离线缓存最高音质
            </button>
            <div className="h-[1px] bg-white/10 my-1" />
            <button
              onClick={() => {
                if (contextMenu.song) {
                  navigator.clipboard.writeText(`${contextMenu.song.title} - ${contextMenu.song.artist}`);
                  showToast("已复制歌曲信息到剪贴板");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 text-left transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              复制歌曲名称与艺术家
            </button>
          </div>
        </div>
      )}

      {/* 歌单详情抽屉 */}
      <PlaylistDetailDrawer
        isOpen={isDrawerOpen}
        playlist={selectedPlaylist}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Toast 悬浮提示 */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-xl border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-2xl flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
