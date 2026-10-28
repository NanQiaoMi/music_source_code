"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Download, HardDrive, Sparkles, RefreshCw, Trash2, Play } from "lucide-react";
import { useNetworkAudioCache } from "@/hooks/useNetworkAudioCache";
import { getAllCachedAudioMeta, CachedNetworkAudioMeta } from "@/services/networkAudioCache";
import { useAudioStore } from "@/store/audioStore";
import { ErrorBanner } from "@/components/ui/settings";
import { EmptyState } from "@/components/shared/Glass";

/**
 * 离线缓存页不接外壳的 loading/error：那是「音源配置同步」的状态，
 * 与本页要读的 IndexedDB 缓存列表是两回事。本页的加载与失败全部由 loadSongs 自己管，
 * 否则会出现「音源同步失败 → 离线缓存页也报错」这种张冠李戴的提示。
 */
export function OfflineCacheTab() {
  const { stats, clearAllCache, deleteSongCache, refreshStats } = useNetworkAudioCache();
  const playSong = useAudioStore((state) => state.playSong);
  const [cachedSongs, setCachedSongs] = useState<CachedNetworkAudioMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadSongs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await getAllCachedAudioMeta();
      setCachedSongs(list.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt));
    } catch (e) {
      // 以前这里静默吞掉异常并置空列表，读失败看起来就像「缓存被清空了」。
      // 现在保留上一次已知的列表，只把失败原因挂到横幅上交给用户决定是否重试。
      setLoadError(e instanceof Error ? e.message : "读取本地缓存数据库失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // 挂载时拉取曲库列表（调用外部接口）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSongs();
  }, [loadSongs]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return cachedSongs;
    const q = searchQuery.toLowerCase();
    return cachedSongs.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.artist && s.artist.toLowerCase().includes(q))
    );
  }, [cachedSongs, searchQuery]);

  const handleDelete = async (songId: string, source: string) => {
    await deleteSongCache(songId, source);
    await loadSongs();
  };

  const handleClearAll = async () => {
    if (window.confirm("确定要清空所有本地离线音频缓存吗？清空后再次播放将重新联网下载。")) {
      await clearAllCache();
      await loadSongs();
    }
  };

  const handlePlaySong = (item: CachedNetworkAudioMeta) => {
    const src = item.source || "netease";
    playSong({
      id: item.songId,
      title: item.title || "未知歌曲",
      artist: item.artist || "未知艺术家",
      album: item.album,
      duration: item.duration || 0,
      cover: item.cover,
      source: src,
      audioUrl: `cached://${src}/${item.songId}`,
    });
  };

  // 非阻断错误横幅：读失败时挂在列表容器之上，不遮挡上一次已读到的缓存数据。
  const errorBanner = loadError ? (
    <ErrorBanner message={loadError} onRetry={() => void loadSongs()} />
  ) : null;

  return (
    <>
      <div className="space-y-4">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-white/50 font-medium">已缓存歌曲总数</div>
              <div className="text-xl font-bold text-white tracking-tight">
                {stats.count} <span className="text-xs font-normal text-white/40">首</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-white/50 font-medium">占用本地磁盘</div>
              <div className="text-xl font-bold text-white tracking-tight">
                {stats.totalSizeMB}{" "}
                <span className="text-xs font-normal text-white/40">MB / 4000 MB</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-white/50 font-medium">离线播放特性</div>
              <div className="text-sm font-semibold text-purple-300">0ms 秒开 · 自动 LRU</div>
            </div>
          </div>
        </div>

        {/* Action Header & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              placeholder="搜索已缓存的歌名或歌手..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-xs bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={() => {
                refreshStats();
                loadSongs();
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              title="刷新列表"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {stats.count > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer font-medium self-end sm:self-auto border border-rose-500/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空全部离线缓存</span>
            </button>
          )}
        </div>

        {/* Cached Songs List：三态分派（优先级 读取中 > 横幅 + （失败/空态 | 列表））。
            顶部统计卡保留在上方，仅替换列表区。
            错误不再阻断：横幅挂在列表容器之上，不遮挡本地已缓存数据。 */}
        {errorBanner}
        <div className="border border-white/10 rounded-2xl bg-white/[0.01] overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-white/40 text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>正在读取本地 IndexedDB 缓存数据库...</span>
            </div>
          ) : cachedSongs.length === 0 && loadError ? (
            // 读失败时不再冒充「还没有缓存」——那是把故障说成了空库。
            <div className="py-12 text-center text-white/40 text-xs">
              本地缓存数据库读取失败，请点上方「重试」重新载入
            </div>
          ) : cachedSongs.length === 0 ? (
            <EmptyState
              title="还没有缓存的歌曲"
              description="播放网络歌曲后，系统会自动在后台完成二进制无损缓存"
            />
          ) : filteredSongs.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-xs">没有匹配的缓存歌曲</div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto custom-scrollbar">
              {filteredSongs.map((item) => {
                const sizeMB = item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(1) : "0.0";
                const cachedTimeStr = item.cachedAt
                  ? new Date(item.cachedAt).toLocaleDateString()
                  : "未知时间";
                const displaySource = (item.source || "NET").toUpperCase();
                const displayFormat = item.fileType?.split("/")[1]?.toUpperCase() || "MP3";

                return (
                  <div
                    key={item.cacheKey || `${item.source || "cache"}:${item.songId}`}
                    className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => handlePlaySong(item)}
                        className="w-8 h-8 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-transform hover:scale-105 shrink-0 cursor-pointer"
                        title="立即离线播放"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {item.title || "未知曲目"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/60 font-mono">
                            {displaySource}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 font-mono">
                            {displayFormat}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/50 truncate flex items-center gap-2 mt-0.5">
                          <span>{item.artist || "未知艺术家"}</span>
                          <span>·</span>
                          <span>{sizeMB} MB</span>
                          <span>·</span>
                          <span>缓存于 {cachedTimeStr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDelete(item.songId, item.source || "")}
                        className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="删除此歌曲缓存"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
