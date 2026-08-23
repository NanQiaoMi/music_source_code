"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search,
  X,
  Play,
  Download,
  ListPlus,
  MoreHorizontal,
  Copy,
  Sparkles,
  ArrowUpDown,
  CheckSquare,
  Square,
  Music2,
  FolderHeart,
  Loader2,
  Plus,
  Flame,
  Check,
  SlidersHorizontal,
  Settings2,
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
type QualityFilter = "all" | "24bit" | "flac";

const SOURCE_TABS: { id: SearchSourceTab; label: string; tag: string; dotColor: string; activeBorder: string; badgeStyle: string }[] = [
  { id: "all", label: "聚合大会", tag: "ALL", dotColor: "bg-cyan-400", activeBorder: "border-cyan-400/50 shadow-cyan-500/10", badgeStyle: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  { id: "kuwo", label: "酷我音乐", tag: "kw", dotColor: "bg-emerald-400", activeBorder: "border-emerald-400/50 shadow-emerald-500/10", badgeStyle: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { id: "kugou", label: "酷狗音乐", tag: "kg", dotColor: "bg-blue-400", activeBorder: "border-blue-400/50 shadow-blue-500/10", badgeStyle: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "qq", label: "QQ 音乐", tag: "tx", dotColor: "bg-teal-400", activeBorder: "border-teal-400/50 shadow-teal-500/10", badgeStyle: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  { id: "netease", label: "网易云", tag: "wy", dotColor: "bg-rose-400", activeBorder: "border-rose-400/50 shadow-rose-500/10", badgeStyle: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  { id: "migu", label: "咪咕音乐", tag: "mg", dotColor: "bg-amber-400", activeBorder: "border-amber-400/50 shadow-amber-500/10", badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "lx_custom", label: "落雪母带", tag: "lx", dotColor: "bg-purple-400", activeBorder: "border-purple-400/50 shadow-purple-500/10", badgeStyle: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
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
  "起风了",
  "华语经典",
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
  const [selectedScriptId, setSelectedScriptId] = useState<string>("aggregate_special_v9");

  const { playSong, playQueue } = useAudioStore();
  const { addToQueue, insertNext } = useQueueStore();
  const { addBatchDownloads, isSongOffline } = useOfflineDownloadStore();
  const { addSong, importSongs } = usePlaylistStore();
  const { lxScripts, openManagementModal } = useSourceConfigStore();

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

      try {
        if (targetMode === "songs") {
          if (targetTab === "all") {
            const seg = await multiSourceResolver.searchOnlineMusicSegmented(q);
            setSongResults(seg.all);
          } else if (targetTab === "lx_custom") {
            const lxScripts = useSourceConfigStore.getState().lxScripts;
            const activeScript =
              lxScripts.find((s) => s.id === selectedScriptId && s.enabled) ||
              lxScripts.find((s) => s.enabled) || {
                id: "aggregate_special_v9",
                name: "全豆要[聚合音源] 9.3特供版",
                author: "全豆要",
                version: "9.3.0",
                description: "",
                scriptUrl: "/api/sources/builtin?id=aggregate_special_v9",
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
    const idx = list.findIndex(
      (s) => s.id === song.id && (!song.source || s.source === song.source)
    );
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
      return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">kw</span>;
    }
    if (s === "kugou" || s === "kg") {
      return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-blue-500/15 text-blue-400 font-bold border border-blue-500/30">kg</span>;
    }
    if (s === "qq" || s === "tx") {
      return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-teal-500/15 text-teal-400 font-bold border border-teal-500/30">tx</span>;
    }
    if (s === "netease" || s === "wy") {
      return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30">wy</span>;
    }
    if (s === "migu" || s === "mg") {
      return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">mg</span>;
    }
    if (s === "lx_custom" || s === "lx") {
      return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-purple-500/15 text-purple-400 font-bold border border-purple-500/30">lx</span>;
    }
    return <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-white/10 text-white/70">src</span>;
  };

  const getQualityBadge = (song: Song) => {
    if (song.title.includes("24bit") || song.format === "flac") {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
          24bit
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
        SQ
      </span>
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col gap-5 select-none font-sans">
      {/* ── 顶部控制中枢 Bento ── */}
      <div className="p-5 md:p-6 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-4">
        {/* 第一行：搜索框 + 模式胶囊切换 + 音质过滤与播放全部 */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1 w-full flex items-center">
            <div className="relative w-full flex items-center bg-white/[0.06] hover:bg-white/[0.09] focus-within:bg-white/[0.12] border border-white/15 focus-within:border-emerald-400/70 rounded-2xl px-4 py-2.5 transition-all shadow-inner group">
              <Search className="w-4 h-4 text-emerald-400 shrink-0 mr-3 group-focus-within:scale-110 transition-transform" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="搜索全网海量歌曲、歌手、专辑或落雪特供母带..."
                className="w-full bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword("")}
                  className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={isSearching}
                className="ml-3 px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "检索"}
              </button>
            </div>
          </div>

          {/* 右侧功能组：歌曲/歌单切换 & 音质过滤 */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0">
            {/* 歌曲 / 歌单模式切换 */}
            <div className="flex items-center bg-black/40 border border-white/10 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => handleModeChange("songs")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  searchMode === "songs"
                    ? "bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white shadow-md shadow-emerald-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5" />
                  歌曲搜索
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("playlists")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  searchMode === "playlists"
                    ? "bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white shadow-md shadow-emerald-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FolderHeart className="w-3.5 h-3.5" />
                  歌单搜索
                </span>
              </button>
            </div>

            {/* 音质过滤 & 播放全部 */}
            {searchMode === "songs" && (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-black/30 border border-white/10 rounded-2xl p-1 text-xs text-white/60">
                  {(["all", "24bit", "flac"] as QualityFilter[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQualityFilter(q)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        qualityFilter === q ? "bg-white/15 text-white shadow-sm" : "hover:text-white"
                      }`}
                    >
                      {q === "all" ? "全部" : q === "24bit" ? "Hi-Res 24bit" : "SQ 无损"}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePlayAll}
                  disabled={processedSongs.length === 0}
                  className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  播放全部
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 第二行：多音源切换 Tab 栏 & 音源管理配置快捷入口 */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-1 border-t border-white/[0.08]">
          {/* 多音源切换 Tab 栏 */}
          <div className="flex flex-wrap items-center gap-2">
            {SOURCE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                    isActive
                      ? `bg-white/15 text-white ${tab.activeBorder} shadow-md`
                      : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border-white/10"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded ${tab.badgeStyle}`}>
                    {tab.tag}
                  </span>
                </button>
              );
            })}

            {/* 音源矩阵与脚本配置中枢入口 */}
            <button
              type="button"
              onClick={() => openManagementModal("lx_scripts")}
              className="px-3 py-1.5 rounded-2xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ml-1"
              title="管理自定义落雪音源与配置多音源优先级"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>音源管理</span>
            </button>
          </div>

          {/* 热门搜索标签 */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs text-white/40 shrink-0">
            <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-400/90">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> 热搜:
            </span>
            {HOT_SEARCH_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setKeyword(tag);
                  handleSearch(tag);
                }}
                className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors shrink-0 cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 当选择「落雪母带」Tab 时，展示已安装的特供音源二级切换器 */}
        {activeTab === "lx_custom" && (
          <div className="flex items-center gap-2 pt-2 border-t border-purple-500/20 text-xs">
            <span className="text-purple-300 font-semibold flex items-center gap-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> 当前可用特供脚本:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {lxScripts
                .filter((s) => s.enabled)
                .map((script) => {
                  const isSelected = selectedScriptId === script.id;
                  return (
                    <button
                      key={script.id}
                      type="button"
                      onClick={() => {
                        setSelectedScriptId(script.id);
                        handleSearch(keyword, "lx_custom", searchMode);
                        showToast(`已切换至音源: ${script.name}`);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-medium transition-all border ${
                        isSelected
                          ? "bg-purple-500/25 text-purple-200 border-purple-400/50 shadow-md shadow-purple-500/20 font-bold"
                          : "bg-white/5 text-white/60 hover:text-white border-white/10"
                      }`}
                    >
                      {script.name}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* ── 主体展示区 (全宽度、高呼吸感表格与卡片) ── */}
      <div className="flex-1 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        {isSearching ? (
          <div className="h-96 flex flex-col items-center justify-center text-white/40 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            <p className="text-sm font-medium">正在全网检索高保真母带音频资源...</p>
          </div>
        ) : searchMode === "songs" ? (
          /* 单曲模式表格 */
          processedSongs.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-white/40 gap-3">
              <Music2 className="w-12 h-12 opacity-30" />
              <p className="text-sm">未检索到相关曲目，请尝试更换关键词或切换音源</p>
            </div>
          ) : (
            <div className="w-full flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              {/* 表头 */}
              <div className="sticky top-0 bg-[#0c0e17]/95 backdrop-blur-2xl z-20 border-b border-white/10 text-white/50 text-xs font-semibold px-4 py-3 flex items-center select-none">
                {/* 勾选框 & 序号 */}
                <div className="w-16 shrink-0 flex items-center justify-center gap-2">
                  <button type="button" onClick={handleSelectAll} className="hover:text-white cursor-pointer">
                    {selectedIds.size === processedSongs.length && processedSongs.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-white/30" />
                    )}
                  </button>
                  <span
                    onClick={() => handleSortToggle("index")}
                    className="cursor-pointer hover:text-white font-mono"
                  >
                    #
                  </span>
                </div>

                {/* 歌曲名 */}
                <div
                  onClick={() => handleSortToggle("title")}
                  className="flex-[4] min-w-[240px] px-3 flex items-center gap-1.5 cursor-pointer hover:text-white"
                >
                  <span>歌曲名</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                </div>

                {/* 艺术家 */}
                <div
                  onClick={() => handleSortToggle("artist")}
                  className="flex-[2.5] min-w-[150px] px-3 flex items-center gap-1.5 cursor-pointer hover:text-white"
                >
                  <span>艺术家</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                </div>

                {/* 专辑名 */}
                <div
                  onClick={() => handleSortToggle("album")}
                  className="flex-[3] min-w-[160px] px-3 flex items-center gap-1.5 cursor-pointer hover:text-white"
                >
                  <span>专辑名</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                </div>

                {/* 时长 */}
                <div
                  onClick={() => handleSortToggle("duration")}
                  className="w-24 shrink-0 px-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white"
                >
                  <span>时长</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                </div>

                {/* 操作列 */}
                <div className="w-36 shrink-0 text-right pr-4">操作</div>
              </div>

              {/* 表体行 */}
              <div className="divide-y divide-white/[0.04] p-2">
                {processedSongs.map((song, idx) => {
                  const isSelected = selectedIds.has(song.id);
                  const isDownloaded = isSongOffline(song.id);

                  return (
                    <div
                      key={`${song.source || "src"}-${song.id || idx}-${idx}`}
                      onClick={() => handlePlaySingle(song)}
                      onDoubleClick={() => handlePlaySingle(song)}
                      onContextMenu={(e) => handleContextMenu(e, song)}
                      className={`group flex items-center px-2 py-3 rounded-2xl transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-emerald-500/15 border border-emerald-500/30"
                          : "hover:bg-white/[0.06] border border-transparent"
                      }`}
                    >
                      {/* 勾选框 & 序号 */}
                      <div
                        className="w-16 shrink-0 flex items-center justify-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(song.id)}
                          className="text-white/40 hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-white/30" />
                          )}
                        </button>
                        <span className="font-mono text-white/30 text-xs tabular-nums w-4 text-center">
                          {idx + 1}
                        </span>
                      </div>

                      {/* 歌曲名 + 徽标 */}
                      <div className="flex-[4] min-w-[240px] px-3 flex items-center gap-2.5 overflow-hidden">
                        <span className="font-semibold text-white/90 text-sm truncate">
                          {song.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {getQualityBadge(song)}
                          {getSourceBadge(song.source)}
                          {isDownloaded && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              已离线
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 艺术家 */}
                      <div className="flex-[2.5] min-w-[150px] px-3 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setKeyword(song.artist);
                            handleSearch(song.artist);
                          }}
                          className="text-xs text-white/60 hover:text-emerald-400 truncate hover:underline transition-colors text-left"
                        >
                          {song.artist}
                        </button>
                      </div>

                      {/* 专辑名 */}
                      <div className="flex-[3] min-w-[160px] px-3 overflow-hidden text-xs text-white/40 truncate">
                        {song.album || "精选大碟"}
                      </div>

                      {/* 时长 */}
                      <div className="w-24 shrink-0 px-2 text-right font-mono text-xs text-white/40 tabular-nums">
                        {formatDuration(song.duration)}
                      </div>

                      {/* 操作按钮组 (专享 144px 独立区域，永不遮挡时长) */}
                      <div
                        className="w-36 shrink-0 flex items-center justify-end gap-1.5 pr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handlePlaySingle(song)}
                            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-emerald-500 hover:text-white flex items-center justify-center text-white/80 transition-all active:scale-90 shadow-sm"
                            title="立即播放"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              insertNext(song);
                              showToast(`已将《${song.title}》设置为下一首播放`);
                            }}
                            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-90 shadow-sm"
                            title="下一首播放"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              addBatchDownloads([song], "lossless");
                              showToast(`已添加《${song.title}》至离线下载队列`);
                            }}
                            disabled={isDownloaded}
                            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-90 shadow-sm disabled:opacity-40"
                            title={isDownloaded ? "已离线" : "离线下载最高母带音质"}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleContextMenu(e, song)}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-90 shadow-sm"
                            title="更多操作"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* 歌单模式网格 */
          playlistResults.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-white/40 gap-3">
              <FolderHeart className="w-12 h-12 opacity-30" />
              <p className="text-sm">未检索到相关歌单，请尝试更换关键词</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {playlistResults.map((p, idx) => (
                <div
                  key={`${p.source}-${p.id}-${idx}`}
                  onClick={() => handleOpenPlaylist(p)}
                  className="group flex flex-col rounded-3xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 p-3.5 transition-all hover:scale-[1.03] hover:border-emerald-400/40 cursor-pointer shadow-lg"
                >
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-xl mb-3 bg-black/40">
                    <Image
                      src={p.coverImgUrl || "/default-cover.svg"}
                      alt={p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="240px"
                    />
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] text-white/90 font-mono font-semibold border border-white/10">
                      {p.source === "netease" ? "网易云" : "QQ音乐"}
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-white/90 line-clamp-2 leading-snug">
                    {p.name}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-white/40 mt-2">
                    <span className="truncate">{p.creatorName}</span>
                    <span className="font-mono">{p.trackCount} 首</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── 底部批量操作悬浮胶囊 ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#161a28]/95 border border-emerald-500/40 backdrop-blur-3xl rounded-3xl px-6 py-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-4 text-xs"
          >
            <div className="flex items-center gap-2 pr-3 border-r border-white/15">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-sm">已选择 {selectedIds.size} 首歌曲</span>
            </div>

            <button
              type="button"
              onClick={handleDownloadSelected}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              一键下载已选 (最高母带音质)
            </button>

            <button
              type="button"
              onClick={handleBatchAddToQueue}
              className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ListPlus className="w-4 h-4" />
              批量加入队列
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 rounded-2xl hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              取消选择
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 右键上下文菜单 ── */}
      {contextMenu && contextMenu.song && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[210px] bg-[#1a1d2c]/95 border border-white/15 backdrop-blur-3xl rounded-2xl p-2 shadow-2xl text-xs text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-white/10 font-bold text-white/90 truncate max-w-[220px]">
            {contextMenu.song.title}
          </div>
          <div className="py-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                if (contextMenu.song) handlePlaySingle(contextMenu.song);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-xl hover:bg-emerald-500 hover:text-white flex items-center gap-2.5 text-left transition-colors font-medium"
            >
              <Play className="w-3.5 h-3.5" />
              立即播放
            </button>
            <button
              type="button"
              onClick={() => {
                if (contextMenu.song) {
                  insertNext(contextMenu.song);
                  showToast("已设为下一首播放");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-left transition-colors"
            >
              <ListPlus className="w-3.5 h-3.5" />
              下一首播放
            </button>
            <button
              type="button"
              onClick={() => {
                if (contextMenu.song) {
                  addToQueue(contextMenu.song);
                  showToast("已加入播放队列");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-left transition-colors"
            >
              <Music2 className="w-3.5 h-3.5" />
              加入播放队列
            </button>
            <button
              type="button"
              onClick={() => {
                if (contextMenu.song) {
                  addBatchDownloads([contextMenu.song], "lossless");
                  showToast("已提交离线下载");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-left transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              离线缓存最高音质
            </button>
            <div className="h-[1px] bg-white/10 my-1" />
            <button
              type="button"
              onClick={() => {
                if (contextMenu.song) {
                  navigator.clipboard.writeText(`${contextMenu.song.title} - ${contextMenu.song.artist}`);
                  showToast("已复制歌曲信息到剪贴板");
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-left transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              复制歌曲名称与艺术家
            </button>
          </div>
        </div>
      )}

      {/* ── 歌单详情抽屉 ── */}
      <PlaylistDetailDrawer
        isOpen={isDrawerOpen}
        playlist={selectedPlaylist}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* ── Toast 悬浮提示 ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-black/85 backdrop-blur-2xl border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
