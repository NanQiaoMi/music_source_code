"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useQueueStore } from "@/store/queueStore";
import { formatTime } from "@/utils/formatTime";
import { GlassPanel } from "@/components/shared/Glass";
import { GlassButton } from "@/components/shared/GlassButton";
import { Song } from "@/types/song";

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
  const {
    queue,
    currentIndex,
    removeFromQueue,
    removeMultipleFromQueue,
    clearQueue,
    reorderQueue,
    addToQueue,
  } = useQueueStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));

    // For multi-select drag: include all selected indices
    const dragIndices = selectedIndices.has(index) ? Array.from(selectedIndices) : [index];
    e.dataTransfer.setData("application/x-queue-indices", JSON.stringify(dragIndices));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    // Handle external drops (from search, playlist, etc.)
    const externalSongData = e.dataTransfer.getData("application/x-song");
    if (externalSongData) {
      try {
        const song: Song = JSON.parse(externalSongData);
        addToQueue(song);
        return;
      } catch {
        /* ignore parse errors */
      }
    }

    // Handle multi-select reorder
    const indicesData = e.dataTransfer.getData("application/x-queue-indices");
    if (indicesData) {
      try {
        const fromIndices: number[] = JSON.parse(indicesData);
        const sortedFrom = [...fromIndices].sort((a, b) => b - a);

        // Remove dragged items first (reverse order to preserve indices)
        const removedItems: { song: Song; originalIndex: number }[] = [];
        for (const fi of sortedFrom) {
          if (fi < queue.length) {
            removedItems.push({ song: queue[fi], originalIndex: fi });
          }
        }

        const newQueue = [...queue];
        for (const fi of sortedFrom) {
          if (fi < newQueue.length) newQueue.splice(fi, 1);
        }

        // Adjust target index based on removals
        const removedBeforeTarget = removedItems.filter(
          (r) => r.originalIndex < targetIndex
        ).length;
        const insertAt = Math.max(0, Math.min(targetIndex - removedBeforeTarget, newQueue.length));

        // Insert in original order
        removedItems.reverse().forEach((item, i) => {
          newQueue.splice(insertAt + i, 0, item.song);
        });

        useQueueStore.setState({ queue: newQueue });
        setSelectedIndices(new Set());
        return;
      } catch {
        /* ignore */
      }
    }

    // Single reorder fallback
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderQueue(draggedIndex, targetIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Drag-to-remove: detect drag outside the list
  const handleRemoveOnDragEnd = useCallback(
    (e: React.DragEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const { clientX, clientY } = e;
      const isOutside =
        clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;

      if (isOutside && draggedIndex !== null) {
        removeFromQueue(draggedIndex);
        setSelectedIndices(new Set());
      }
    },
    [draggedIndex, removeFromQueue]
  );

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleBulkDelete = () => {
    removeMultipleFromQueue(Array.from(selectedIndices));
    setSelectedIndices(new Set());
  };

  const handleSelectAll = () => {
    setSelectedIndices(new Set(queue.map((_, i) => i)));
  };

  const headerRight = (
    <div className="flex items-center gap-2">
      {selectedIndices.size > 0 && (
        <>
          <GlassButton size="sm" variant="ghost" onClick={() => setSelectedIndices(new Set())}>
            取消选择 ({selectedIndices.size})
          </GlassButton>
          <GlassButton size="sm" variant="primary" onClick={handleBulkDelete}>
            删除选中
          </GlassButton>
        </>
      )}
      {queue.length > 0 && selectedIndices.size === 0 && (
        <>
          <button
            onClick={handleSelectAll}
            className="text-white/60 hover:text-white text-[13px] px-3 py-1 rounded-full hover:bg-white/10 transition-colors"
          >
            全选
          </button>
          <button
            onClick={clearQueue}
            className="text-white/60 hover:text-white text-[13px] px-3 py-1 rounded-full hover:bg-white/10 transition-colors"
          >
            清空
          </button>
        </>
      )}
    </div>
  );

  return (
    <GlassPanel
      position="right"
      size="md"
      isOpen={isOpen}
      onClose={onClose}
      title="播放队列"
      headerRight={headerRight}
      footer={<p className="text-white/40 text-[13px] text-center">共 {queue.length} 首歌曲</p>}
    >
      <div
        className="p-3 space-y-1 min-h-[200px]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const songData = e.dataTransfer.getData("application/x-song");
          if (songData) {
            try {
              const song: Song = JSON.parse(songData);
              addToQueue(song);
            } catch {
              /* ignore */
            }
          }
        }}
      >
        {queue.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <svg
              className="w-14 h-14 mx-auto mb-3 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            <p className="text-[13px]">播放队列为空</p>
            <p className="text-[11px] text-white/20 mt-1">从音乐库拖入歌曲到此处</p>
          </div>
        ) : (
          queue.map((song, index) => (
            <motion.div
              key={song.id}
              layout
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={(e) => {
                handleDragEnd();
                handleRemoveOnDragEnd(e);
              }}
              className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150
                ${index === currentIndex ? "bg-white/[0.12]" : "hover:bg-white/[0.06]"}
                ${draggedIndex === index ? "opacity-40" : ""}
                ${dragOverIndex === index ? "border-t border-white/30" : ""}
                ${selectedIndices.has(index) ? "bg-white/[0.10] ring-1 ring-white/20" : ""}
              `}
              onClick={() => {
                if (selectedIndices.size > 0) {
                  toggleSelect(index);
                } else {
                  handlePlayFromQueue(index);
                }
              }}
            >
              <div
                className="text-white/20 cursor-grab active:cursor-grabbing"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(index);
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIndices.has(index)}
                  onChange={() => toggleSelect(index)}
                  className="w-3.5 h-3.5 accent-white/60 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="text-white/20 cursor-grab active:cursor-grabbing">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2zM5 5h2v2H5V5zm0 4h2v2H5V9zm0 4h2v2H5v-2zm0 4h2v2H5v-2z" />
                </svg>
              </div>

              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={song.cover} alt={song.title} fill className="object-cover" />
                {index === currentIndex && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="flex gap-0.5">
                      <motion.div
                        animate={{ height: [4, 12, 4] }}
                        transition={{ repeat: Infinity, duration: 0.5 }}
                        className="w-1 bg-white rounded-full"
                      />
                      <motion.div
                        animate={{ height: [8, 16, 8] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
                        className="w-1 bg-white rounded-full"
                      />
                      <motion.div
                        animate={{ height: [6, 14, 6] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }}
                        className="w-1 bg-white rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4
                  className={`text-[13px] font-medium truncate ${index === currentIndex ? "text-white" : "text-white/80"}`}
                >
                  {song.title}
                </h4>
                <p className="text-white/40 text-[11px] truncate">{song.artist}</p>
              </div>

              <span className="text-white/30 text-[11px]">{formatTime(song.duration)}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromQueue(index);
                }}
                className="text-white/20 hover:text-red-400 transition-colors p-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          ))
        )}
      </div>
    </GlassPanel>
  );
};
