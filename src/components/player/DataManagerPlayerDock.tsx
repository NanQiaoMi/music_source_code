"use client";

import React from "react";
import Image from "next/image";
import { ListMusic, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { usePlaybackClock } from "@/hooks/usePlaybackClock";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";
import { formatTime } from "@/utils/formatTime";

const DEFAULT_COVER_SRC = "/default-cover.svg";

export function DataManagerPlayerDock() {
  // S6-4: 身份字段读 playerStore，进度读 PlaybackClock；缺失时回退 playerStore 镜像
  const currentSong = usePlayerStore((state) => state.currentSong);
  const clockCurrentTime = usePlaybackClock((state) => state.currentTime);
  const playerCurrentTime = usePlayerStore((state) => state.currentTime);
  const currentTime = clockCurrentTime || playerCurrentTime;
  const audioDuration = usePlaybackClock((state) => state.duration);
  const playerDuration = usePlayerStore((state) => state.duration);
  const duration = audioDuration || currentSong?.duration || playerDuration || 0;
  const isPlaying = usePlaybackClock((state) => state.isPlaying);
  const audioIsLoading = usePlaybackClock((state) => state.isLoading);
  const playerIsLoading = usePlayerStore((state) => state.isLoading);
  const isLoading = audioIsLoading || playerIsLoading;
  const error = useAudioStore((state) => state.error);
  const seekTo = useAudioStore((state) => state.seekTo);
  const queue = useQueueStore((state) => state.queue);
  const openPanel = useUIStore((state) => state.openPanel);

  const handleQueueSkip = (direction: "previous" | "next") => {
    const { queue: visibleQueue, currentIndex: visibleIndex } = useQueueStore.getState();
    if (visibleQueue.length === 0) return;
    const safeVisibleIndex = Math.max(0, Math.min(visibleIndex, visibleQueue.length - 1));

    // S6-4: 身份字段读 playerStore
    const activeSong = usePlayerStore.getState().currentSong;
    const activeIndex = activeSong
      ? visibleQueue[visibleIndex]?.id === activeSong.id
        ? visibleIndex
        : visibleQueue.findIndex((song) => song.id === activeSong.id)
      : -1;
    const audioState = useAudioStore.getState();

    if (activeIndex >= 0 || usePlayerStore.getState().loopMode === "shuffle") {
      useAudioStore.setState({
        queue: visibleQueue,
        currentIndex: activeIndex >= 0 ? activeIndex : safeVisibleIndex,
      });
      const alignedAudioState = useAudioStore.getState();
      if (direction === "next") alignedAudioState.nextSong();
      else alignedAudioState.prevSong();
      return;
    }

    // If the playing song was removed from the visible queue, currentIndex points at the next
    // candidate. Select that item for Next; Previous selects the item immediately before it.
    const targetIndex =
      direction === "next"
        ? safeVisibleIndex
        : (safeVisibleIndex - 1 + visibleQueue.length) % visibleQueue.length;
    audioState.playQueue(visibleQueue, targetIndex);
  };

  const currentSongIsQueued = Boolean(
    currentSong && queue.some((song) => song.id === currentSong.id)
  );
  const isQueueSkipDisabled = currentSongIsQueued ? queue.length <= 1 : queue.length === 0;

  if (!currentSong) return null;

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrentTime = Number.isFinite(currentTime)
    ? Math.max(0, safeDuration > 0 ? Math.min(currentTime, safeDuration) : currentTime)
    : 0;
  const playbackStatus = error?.message
    ? `播放错误：${error.message}`
    : isLoading
      ? "正在加载"
      : null;

  return (
    <aside
      aria-label="管理曲库播放控制"
      data-testid="data-manager-player-dock"
      className="pointer-events-none fixed inset-x-0 bottom-3 z-[80] px-2 sm:bottom-4 sm:px-4"
    >
      <div className="pointer-events-auto relative mx-auto w-full max-w-5xl min-w-0 overflow-hidden rounded-[24px] border border-white/[0.16] bg-[#10131d]/90 text-white shadow-[0_18px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(34,211,238,0.16),transparent_38%),radial-gradient(ellipse_at_88%_100%,rgba(59,130,246,0.2),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/60 to-transparent" />

        <div className="relative flex min-w-0 items-center gap-1 p-2 sm:gap-4 sm:px-4 sm:py-3">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/10 shadow-[0_4px_18px_rgba(0,0,0,0.35)] sm:h-11 sm:w-11">
            <Image
              src={currentSong.cover || DEFAULT_COVER_SRC}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="min-w-0 flex-[1.15] sm:min-w-[124px]">
            <p className="truncate text-[12px] font-semibold tracking-tight text-white sm:text-[13px]">
              {currentSong.title}
            </p>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-[10px] text-white/55 sm:text-[11px]">
                {currentSong.artist || "未知歌手"}
              </p>
              {playbackStatus && (
                <span
                  role="status"
                  aria-live="polite"
                  className={`min-w-0 max-w-[72px] shrink truncate text-[9px] sm:max-w-none sm:text-[10px] ${
                    error ? "text-rose-300" : "text-cyan-200/75"
                  }`}
                >
                  {playbackStatus}
                </span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-[0.85] items-center gap-1.5 sm:min-w-[120px] sm:flex-[1.15] sm:gap-3">
            <span className="hidden whitespace-nowrap font-mono text-[10px] tabular-nums text-white/45 md:inline">
              {formatTime(safeCurrentTime)}
            </span>
            <input
              aria-label="播放进度"
              type="range"
              min={0}
              max={safeDuration}
              step={0.1}
              value={safeCurrentTime}
              disabled={safeDuration <= 0}
              onChange={(event) => seekTo(Number(event.currentTarget.value))}
              className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: safeDuration
                  ? `linear-gradient(to right, #67e8f9 ${(safeCurrentTime / safeDuration) * 100}%, rgba(255,255,255,0.15) ${(safeCurrentTime / safeDuration) * 100}%)`
                  : undefined,
              }}
            />
            <span className="hidden whitespace-nowrap font-mono text-[10px] tabular-nums text-white/45 md:inline">
              {formatTime(safeDuration)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-0 sm:gap-1.5">
            <button
              type="button"
              aria-label="上一首"
              title="上一首"
              disabled={isQueueSkipDisabled}
              onClick={() => handleQueueSkip("previous")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:h-9 sm:w-9"
            >
              <SkipBack aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={isPlaying ? "暂停" : "播放"}
              title={isPlaying ? "暂停" : "播放"}
              onClick={() => useAudioStore.getState().togglePlaybackIntent()}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-100/40 bg-gradient-to-br from-cyan-200 to-blue-400 text-slate-950 shadow-[0_4px_18px_rgba(34,211,238,0.25)] transition hover:brightness-110 active:scale-95 sm:h-10 sm:w-10"
            >
              {isPlaying ? (
                <Pause aria-hidden="true" className="h-4 w-4 fill-current" />
              ) : (
                <Play aria-hidden="true" className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </button>
            <button
              type="button"
              aria-label="下一首"
              title="下一首"
              disabled={isQueueSkipDisabled}
              onClick={() => handleQueueSkip("next")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:h-9 sm:w-9"
            >
              <SkipForward aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            data-panel-prefetch="queue"
            aria-label={`播放队列，${queue.length}首`}
            title="打开播放队列"
            onClick={() => openPanel("queue")}
            className="flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] p-0 text-white/75 transition hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-white sm:h-9 sm:w-auto sm:px-3"
          >
            <ListMusic aria-hidden="true" className="h-4 w-4 text-cyan-200" />
            <span className="sr-only min-w-[0.5rem] font-mono text-[10px] tabular-nums sm:not-sr-only">
              {queue.length}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default DataManagerPlayerDock;
