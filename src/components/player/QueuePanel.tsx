"use client";

import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { CopyX, CornerDownRight, GripVertical, ListMusic, Shuffle, Trash2, X } from "lucide-react";
import { EmptyState, GlassPanel } from "@/components/shared/Glass";
import { GlassButton } from "@/components/shared/GlassButton";
import { countDuplicateSongs } from "@/lib/queue/queueActions";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { Song } from "@/types/song";
import { formatTime } from "@/utils/formatTime";

const DEFAULT_COVER_SRC = "/default-cover.svg";

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function orderedSelection(selection: Set<string>, queue: Song[]): string[] {
  return queue.map((song) => song.id).filter((id) => selection.has(id));
}

function hasShiftKey(event: Event): event is Event & { shiftKey: boolean } {
  return "shiftKey" in event && typeof event.shiftKey === "boolean";
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
  const {
    queue,
    currentIndex,
    removeFromQueue,
    clearQueue,
    clearPlayed,
    reorderQueue,
    addToQueue,
    moveToNext,
    clearAfterCurrent,
    bulk移除,
    dedupeQueue,
    shuffleAfterCurrent,
  } = useQueueStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const selectedOrderedIds = useMemo(
    () => orderedSelection(selectedIds, queue),
    [queue, selectedIds]
  );
  const selectedCount = selectedOrderedIds.length;
  const duplicateCount = useMemo(() => countDuplicateSongs(queue), [queue]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  }, []);

  const applyRangeSelection = useCallback(
    (fromIndex: number, toIndex: number) => {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let index = start; index <= end; index += 1) {
          const song = queue[index];
          if (song) next.add(song.id);
        }
        return next;
      });
    },
    [queue]
  );

  const toggleSelect = useCallback(
    (index: number, range = false) => {
      const song = queue[index];
      if (!song) return;

      if (range && lastSelectedIndex !== null) {
        applyRangeSelection(lastSelectedIndex, index);
        return;
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(song.id)) next.delete(song.id);
        else next.add(song.id);
        return next;
      });
      setLastSelectedIndex(index);
    },
    [applyRangeSelection, lastSelectedIndex, queue]
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    const externalSongData = e.dataTransfer.getData("application/x-song");
    if (externalSongData) {
      try {
        const song: Song = JSON.parse(externalSongData);
        addToQueue(song);
        return;
      } catch {
        return;
      }
    }

    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderQueue(draggedIndex, targetIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handlePlayFromQueue = useCallback(
    (index: number) => {
      const song = queue[index];
      if (!song) return;

      useAudioStore.getState().playQueue(queue, index);
    },
    [queue]
  );

  const handleBulkDelete = () => {
    bulk移除(selectedOrderedIds);
    clearSelection();
  };

  const handlePlayNext = () => {
    const firstSelectedIndex = queue.findIndex((song) => selectedIds.has(song.id));
    if (firstSelectedIndex >= 0) {
      moveToNext(firstSelectedIndex);
      clearSelection();
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(queue.map((song) => song.id)));
    setLastSelectedIndex(queue.length > 0 ? queue.length - 1 : null);
  };

  const handleClearAfterCurrent = () => {
    clearAfterCurrent();
    clearSelection();
  };

  const handleShuffleRemaining = () => {
    shuffleAfterCurrent();
    clearSelection();
  };

  const handleDedupeQueue = () => {
    dedupeQueue();
    clearSelection();
  };

  const headerRight = (
    <div className="flex items-center gap-2">
      {selectedCount > 0 ? (
        <>
          <GlassButton size="sm" variant="ghost" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" />
            {selectedCount}
          </GlassButton>
          <GlassButton size="sm" variant="ghost" onClick={handlePlayNext}>
            <CornerDownRight className="h-3.5 w-3.5" />
            下一首播放
          </GlassButton>
          <GlassButton size="sm" variant="primary" onClick={handleBulkDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            移除
          </GlassButton>
        </>
      ) : (
        queue.length > 0 && (
          <>
            <button
              onClick={handleSelectAll}
              className="rounded-full px-3 py-1 text-[13px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              Select all
            </button>
            {currentIndex > 0 && (
              <button
                onClick={clearPlayed}
                className="rounded-full px-3 py-1 text-[13px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                Clear played
              </button>
            )}
            <button
              onClick={clearQueue}
              className="rounded-full px-3 py-1 text-[13px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          </>
        )
      )}
    </div>
  );

  return (
    <GlassPanel
      position="right"
      size="md"
      isOpen={isOpen}
      onClose={onClose}
      title="Queue"
      headerRight={headerRight}
      footer={
        <p className="text-center text-[13px] text-white/40">
          {queue.length} songs{queue.length > 0 ? ` - current ${currentIndex + 1}` : ""}
        </p>
      }
    >
      <div
        className="min-h-[200px] space-y-2 p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const songData = e.dataTransfer.getData("application/x-song");
          if (!songData) return;

          try {
            const song: Song = JSON.parse(songData);
            addToQueue(song);
          } catch {
            // Ignore malformed drag payloads from outside the app.
          }
        }}
      >
        {queue.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2">
            <GlassButton size="sm" variant="ghost" onClick={handleClearAfterCurrent}>
              Clear after current
            </GlassButton>
            {duplicateCount > 0 && (
              <GlassButton size="sm" variant="ghost" onClick={handleDedupeQueue}>
                <CopyX className="h-3.5 w-3.5" />
                移除 duplicates ({duplicateCount})
              </GlassButton>
            )}
            <GlassButton size="sm" variant="ghost" onClick={handleShuffleRemaining}>
              <Shuffle className="h-3.5 w-3.5" />
              Shuffle remaining
            </GlassButton>
          </div>
        )}

        {queue.length === 0 ? (
          <EmptyState
            icon={<ListMusic className="h-14 w-14" />}
            title="Queue is empty"
            description="Add songs from the library, search results, or recommendations."
          />
        ) : (
          queue.map((song, index) => {
            const isSelected = selectedIds.has(song.id);
            const isCurrent = index === currentIndex;

            return (
              <div
                key={`${song.id}-${index}`}
                draggable
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? "Deselect" : "Select"} ${song.title}`}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onKeyDown={(e) => {
                  if (e.key === " ") {
                    e.preventDefault();
                    toggleSelect(index, e.shiftKey);
                  }
                  if (e.key === "Enter") {
                    handlePlayFromQueue(index);
                  }
                }}
                onClick={(e) => {
                  if (e.shiftKey) {
                    toggleSelect(index, true);
                  } else if (selectedCount > 0) {
                    toggleSelect(index);
                  } else {
                    handlePlayFromQueue(index);
                  }
                }}
                className={`group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-white/40 ${
                  isCurrent ? "bg-white/[0.14] ring-1 ring-white/15" : "hover:bg-white/[0.06]"
                } ${draggedIndex === index ? "opacity-40" : ""} ${
                  dragOverIndex === index ? "border-t border-white/30" : ""
                } ${isSelected ? "bg-white/[0.10] ring-1 ring-white/20" : ""}`}
              >
                <label
                  className="flex cursor-pointer items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="sr-only">Select {song.title}</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) =>
                      toggleSelect(index, hasShiftKey(e.nativeEvent) && e.nativeEvent.shiftKey)
                    }
                    className="h-3.5 w-3.5 cursor-pointer accent-white/70"
                  />
                </label>

                <div
                  className="cursor-grab text-white/20 active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </div>

                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={song.cover || DEFAULT_COVER_SRC}
                    alt={song.title}
                    fill
                    className="object-cover"
                  />
                  {isCurrent && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="flex gap-0.5" aria-hidden="true">
                        <motion.div
                          animate={{ height: [4, 12, 4] }}
                          transition={{ repeat: Infinity, duration: 0.5 }}
                          className="w-1 rounded-full bg-white"
                        />
                        <motion.div
                          animate={{ height: [8, 16, 8] }}
                          transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
                          className="w-1 rounded-full bg-white"
                        />
                        <motion.div
                          animate={{ height: [6, 14, 6] }}
                          transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }}
                          className="w-1 rounded-full bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {isCurrent && (
                    <div className="mb-0.5 text-[9px] font-semibold tracking-[0.18em] text-white/45">
                      正在播放
                    </div>
                  )}
                  <h4
                    className={`truncate text-[13px] font-medium ${isCurrent ? "text-white" : "text-white/80"}`}
                  >
                    {song.title}
                  </h4>
                  <p className="truncate text-[11px] text-white/40">{song.artist}</p>
                </div>

                <span className="text-[11px] text-white/30">{formatTime(song.duration)}</span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveToNext(index);
                  }}
                  disabled={index === currentIndex || index === currentIndex + 1}
                  className="p-1 text-white/20 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                  title="下一首播放"
                  aria-label={`播放下一首 ${song.title}`}
                >
                  <CornerDownRight className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromQueue(index);
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      next.delete(song.id);
                      return next;
                    });
                  }}
                  className="p-1 text-white/20 transition-colors hover:text-red-400"
                  title="从队列移除"
                  aria-label={`从队列移除 ${song.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
};
