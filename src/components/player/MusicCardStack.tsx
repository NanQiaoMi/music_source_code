"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylistStore } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";
import { useGestureStore } from "@/store/gestureStore";
import Link from "next/link";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0,
};

const DEFAULT_COVER_SRC = "/default-cover.svg";

export const MusicCardStack: React.FC = () => {
  const { songs, recentPlayed, setSelectedSong } = usePlaylistStore();
  const setCurrentSong = useAudioStore((state) => state.setCurrentSong);
  const setQueue = useAudioStore((state) => state.setQueue);
  const setCurrentIndex = useAudioStore((state) => state.setCurrentIndex);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const {
    setQueue: setQueueStore,
    setCurrentIndex: setQueueCurrentIndex,
    addToHistory,
  } = useQueueStore();
  const { setCurrentView, setIsTransitioning } = useUIStore();
  const { lastGesture, gestureTriggered } = useGestureStore();

  const [centerIndex, setCenterIndex] = useState(0);

  // 初始化时随机居中一张卡片
  useEffect(() => {
    if (songs.length > 0 || recentPlayed.length > 0) {
      const targetLength = songs.length > 0 ? songs.length : recentPlayed.length;
      setCenterIndex(Math.floor(Math.random() * targetLength));
    }
  }, [songs.length, recentPlayed.length]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const animatingRef = useRef(false);

  const NORMAL_CARD_WIDTH = 160;
  const NORMAL_CARD_HEIGHT = 220;
  const CENTER_CARD_WIDTH = 340;
  const CENTER_CARD_HEIGHT = 460;
  const VISIBLE_CARDS = Math.max(7, songs.length > 0 ? Math.min(songs.length, 15) : 7);

  const displaySongs = songs.length > 0 ? songs : recentPlayed;

  const visibleCards = React.useMemo(() => {
    const cards = [];
    const halfVisible = Math.floor(VISIBLE_CARDS / 2);

    for (let i = -halfVisible; i <= halfVisible; i++) {
      const index = centerIndex + i;
      const displayIndex =
        ((index % displaySongs.length) + displaySongs.length) % displaySongs.length;

      cards.push({
        ...displaySongs[displayIndex],
        displayIndex: index,
        offset: i,
      });
    }

    return cards;
  }, [centerIndex, displaySongs]);

  const handleCardClick = useCallback(
    (index: number) => {
      if (animatingRef.current || selectedCard !== null) return;

      const song = displaySongs[index];
      if (!song) return;

      setSelectedCard(index);
      setIsTransitioning(true);

      setSelectedSong(song);
      setCurrentSong(song);
      setQueue(displaySongs);
      setCurrentIndex(index);
      setIsPlaying(true);

      setQueueStore(displaySongs);
      setQueueCurrentIndex(index);
      addToHistory(song);

      requestAnimationFrame(() => {
        setCurrentView("player");

        setTimeout(() => {
          setIsTransitioning(false);
          setSelectedCard(null);
        }, 600);
      });
    },
    [
      displaySongs,
      setSelectedSong,
      setCurrentSong,
      setQueue,
      setCurrentIndex,
      setIsPlaying,
      setQueueStore,
      setQueueCurrentIndex,
      addToHistory,
      setCurrentView,
      setIsTransitioning,
      selectedCard,
    ]
  );

  const handlePrev = useCallback(() => {
    if (animatingRef.current || selectedCard !== null) return;
    animatingRef.current = true;
    setCenterIndex((prev) => prev - 1);

    setTimeout(() => {
      animatingRef.current = false;
    }, 300);
  }, [selectedCard]);

  const handleNext = useCallback(() => {
    if (animatingRef.current || selectedCard !== null) return;
    animatingRef.current = true;
    setCenterIndex((prev) => prev + 1);

    setTimeout(() => {
      animatingRef.current = false;
    }, 300);
  }, [selectedCard]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedCard !== null) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          handlePrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNext();
          break;
        case "Enter":
          e.preventDefault();
          const centerCardIndex = visibleCards.find((card) => card.offset === 0)?.displayIndex;
          if (centerCardIndex !== undefined) {
            handleCardClick(centerCardIndex);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, handleCardClick, selectedCard, visibleCards]);

  useEffect(() => {
    if (!lastGesture || selectedCard !== null) return;

    switch (lastGesture) {
      case "swipe_left":
        handleNext();
        break;
      case "swipe_right":
        handlePrev();
        break;
      case "fist":
        const centerCardIndex = visibleCards.find((card) => card.offset === 0)?.displayIndex;
        if (centerCardIndex !== undefined) {
          handleCardClick(centerCardIndex);
        }
        break;
    }
  }, [
    lastGesture,
    gestureTriggered,
    handleNext,
    handlePrev,
    handleCardClick,
    selectedCard,
    visibleCards,
  ]);

  if (displaySongs.length === 0) {
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div
            className="w-48 h-48 mx-auto mb-6 flex items-center justify-center rounded-3xl backdrop-blur-[24px]"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <svg
              className="w-16 h-16 text-white/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <h2 className="text-[21px] font-semibold mb-2 text-white">暂无音乐</h2>
          <p className="text-[15px] mb-6 text-white/50">导入您的音乐开始聆听</p>
          <Link href="/data-manager">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 rounded-full font-medium backdrop-blur-[20px] saturate-[180%] border border-white/[0.08] text-white bg-white/[0.08] hover:bg-white/[0.15] transition-all"
            >
              导入音乐
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: "100%", height: CENTER_CARD_HEIGHT + 120, perspective: 1500 }}
      >
        <AnimatePresence mode="popLayout">
          {visibleCards.map((card) => {
            const isCenter = card.offset === 0;
            const isSelected = selectedCard === card.displayIndex;
            const hasSelection = selectedCard !== null;
            const isOtherCard = hasSelection && !isSelected;

            const absOffset = Math.abs(card.offset);

            const cardWidth = isCenter ? CENTER_CARD_WIDTH : NORMAL_CARD_WIDTH;
            const cardHeight = isCenter ? CENTER_CARD_HEIGHT : NORMAL_CARD_HEIGHT;

            let x = 0;
            if (!isCenter) {
              const centerHalfWidth = CENTER_CARD_WIDTH / 2;
              const normalHalfWidth = NORMAL_CARD_WIDTH / 2;
              const gap = 48;

              if (card.offset < 0) {
                x = -(
                  centerHalfWidth +
                  normalHalfWidth +
                  gap +
                  absOffset * (NORMAL_CARD_WIDTH + gap * 0.4)
                );
              } else {
                x =
                  centerHalfWidth +
                  normalHalfWidth +
                  gap +
                  absOffset * (NORMAL_CARD_WIDTH + gap * 0.4);
              }
            }

            const scale = isCenter ? 1 : Math.max(0.65, 1 - absOffset * 0.12);
            const zIndex = 10 - absOffset;
            const rotateY = isCenter ? 0 : card.offset < 0 ? 15 : -15;

            return (
              <motion.div
                key={`${card.id}-${card.displayIndex}`}
                layoutId={`album-cover-${card.id}`}
                className="absolute cursor-pointer"
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  zIndex,
                  perspective: 1200,
                }}
                initial={{
                  x,
                  scale: isCenter ? 0.8 : scale * 0.8,
                  rotateY: isCenter ? 0 : card.offset < 0 ? -25 : 25,
                  opacity: 0,
                }}
                animate={{
                  x,
                  scale: isOtherCard ? 0.65 : isSelected ? 1.05 : scale,
                  rotateY: isSelected ? 0 : rotateY,
                  opacity: isOtherCard ? 0.15 : isCenter ? 1 : 0.3,
                  filter: isCenter
                    ? "brightness(1) contrast(1) drop-shadow(0 40px 80px rgba(0,0,0,0.5))"
                    : `brightness(${0.35 + (1 - absOffset * 0.1) * 0.3}) contrast(${0.8 + (1 - absOffset * 0.1) * 0.2})`,
                  z: isCenter ? 0 : -absOffset * 80,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.5,
                  transition: { duration: 0.2 },
                }}
                transition={APPLE_SPRING_CONFIG}
                onClick={() => {
                  if (isCenter) {
                    handleCardClick(card.displayIndex);
                  } else {
                    setCenterIndex(centerIndex + card.offset);
                    handleCardClick(card.displayIndex);
                  }
                }}
              >
                <div
                  className="w-full h-full overflow-hidden"
                  style={{
                    borderRadius: isCenter ? "2rem" : "1.25rem",
                    boxShadow: isCenter
                      ? `0 60px 100px rgba(0,0,0,0.6), 0 30px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.15), inset 0 1px 1px rgba(255,255,255,0.1)`
                      : `0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)`,
                  }}
                >
                  <div className="relative w-full h-full">
                    <div
                      className="relative w-full h-full overflow-hidden"
                      style={{ borderRadius: isCenter ? "2rem" : "1.25rem" }}
                    >
                      <Image
                        src={card.cover || DEFAULT_COVER_SRC}
                        alt={card.title}
                        fill
                        className="object-cover"
                        priority={isCenter}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/default-cover.svg";
                        }}
                        unoptimized
                      />

                      {!isCenter && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
                      )}

                      <div
                        className="absolute inset-0"
                        style={{
                          background: isCenter
                            ? "linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.85) 100%)"
                            : "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75) 100%)",
                          borderRadius: isCenter ? "2rem" : "1.25rem",
                        }}
                      />

                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)",
                          borderRadius: isCenter ? "2rem" : "1.25rem",
                        }}
                      />
                    </div>

                    {isCenter && (
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 p-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.4 }}
                      >
                        <h3 className="text-2xl font-bold mb-2 tracking-tight text-white truncate">
                          {card.title}
                        </h3>
                        <p className="text-base text-white/60 truncate">{card.artist}</p>
                      </motion.div>
                    )}

                    {!isCenter && (
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <p className="text-xs text-white/40 truncate font-medium">{card.title}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
