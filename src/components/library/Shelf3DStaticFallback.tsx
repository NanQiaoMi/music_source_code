"use client";

import { useState } from "react";

export interface Shelf3DStaticFallbackItem {
  id: string;
  title: string;
  subtitle: string;
  cover: string;
}

export interface Shelf3DStaticFallbackProps {
  items: Shelf3DStaticFallbackItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPlay: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

interface CoverArtworkProps {
  cover: string;
}

function MusicNoteIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M9 18V5l12-2v13M9 18c0 1.66-1.57 3-3.5 3S2 19.66 2 18s1.57-3 3.5-3S9 16.34 9 18Zm12-2c0 1.66-1.57 3-3.5 3S14 17.66 14 16s1.57-3 3.5-3 3.5 1.34 3.5 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CoverArtwork({ cover }: CoverArtworkProps) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const showFallback = !cover || failedCover === cover;

  return (
    <div className="relative aspect-square overflow-hidden bg-[#282725]">
      {showFallback ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_38%,rgba(176,160,134,0.18),transparent_64%)] text-white/45"
        >
          <MusicNoteIcon className="h-10 w-10" />
        </div>
      ) : (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedCover(cover)}
          src={cover}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/[0.04]"
      />
    </div>
  );
}

function getSlotTransform(offset: number): string {
  if (offset === 0) {
    return "translate(-50%, -50%)";
  }

  const distance =
    Math.abs(offset) === 1 ? "clamp(11.5rem, 28vw, 16rem)" : "clamp(23rem, 42vw, 29rem)";
  const translateX = offset < 0 ? `calc(0rem - ${distance})` : distance;
  const translateY = Math.abs(offset) === 1 ? "0.25rem" : "0.75rem";
  const rotation = offset < 0 ? "9deg" : "-9deg";
  const scale = Math.abs(offset) === 1 ? 0.86 : 0.7;

  return `translate(-50%, -50%) translateX(${translateX}) translateY(${translateY}) rotateY(${rotation}) scale(${scale})`;
}

const CARD_BUTTON_CLASSES =
  "group block overflow-hidden rounded-2xl border bg-[#171817] text-left shadow-[0_24px_60px_rgba(0,0,0,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#111211]";

export default function Shelf3DStaticFallback({
  items,
  activeIndex,
  onSelect,
  onPlay,
  onPrevious,
  onNext,
}: Shelf3DStaticFallbackProps) {
  const safeActiveIndex =
    items.length === 0
      ? -1
      : Math.min(
          items.length - 1,
          Math.max(0, Number.isFinite(activeIndex) ? Math.trunc(activeIndex) : 0)
        );
  const activeItem = safeActiveIndex >= 0 ? items[safeActiveIndex] : undefined;
  const slots = items
    .map((item, index) => ({ item, index, offset: index - safeActiveIndex }))
    .filter(({ offset }) => Math.abs(offset) <= 2);

  return (
    <section
      aria-label="唱片架"
      className="relative isolate overflow-hidden rounded-3xl border border-white/[0.09] bg-[#111211] text-white shadow-[0_32px_100px_rgba(0,0,0,0.45)]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,159,122,0.11),transparent_54%)]" />
        <div className="absolute inset-x-[12%] bottom-[18%] h-24 rounded-[50%] bg-[radial-gradient(ellipse,rgba(192,166,128,0.12),transparent_70%)]" />
        <div className="absolute inset-x-[9%] bottom-[17%] h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      </div>

      <div className="relative flex items-center justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
            MINERADIO
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-wide text-white/90 sm:text-xl">
            唱片架
          </h2>
        </div>
        <p className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs tabular-nums text-white/55">
          {safeActiveIndex >= 0 ? `${safeActiveIndex + 1} / ${items.length}` : "0 首曲目"}
        </p>
      </div>

      <div className="relative mx-auto mt-2 h-[21rem] w-full max-w-6xl overflow-hidden [perspective:1100px] sm:h-[23rem]">
        {items.length === 0 ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            role="status"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/40">
              <MusicNoteIcon className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium text-white/75">这里还没有曲目</p>
            <p className="mt-1.5 max-w-xs text-xs leading-5 text-white/40">
              添加音乐后，唱片封面会显示在这里。
            </p>
          </div>
        ) : (
          <div aria-label="曲目封面" className="absolute inset-0" role="list">
            {slots.map(({ item, index, offset }) => {
              const isActive = index === safeActiveIndex;
              const isFarSlot = Math.abs(offset) === 2;
              const cardOpacity = isActive ? 1 : isFarSlot ? 0.55 : 0.86;
              const cardWidth = isActive
                ? "w-[min(66vw,17rem)] sm:w-[min(49vw,17rem)]"
                : isFarSlot
                  ? "w-[min(40vw,10rem)] sm:w-[min(32vw,11.5rem)]"
                  : "w-[min(50vw,13rem)] sm:w-[min(39vw,13rem)]";

              return (
                <div
                  className={`absolute left-1/2 top-1/2 ${isFarSlot ? "hidden sm:block" : ""}`}
                  key={`${item.id}-${index}`}
                  role="listitem"
                  style={{
                    opacity: cardOpacity,
                    transform: getSlotTransform(offset),
                    zIndex: 10 - Math.abs(offset),
                  }}
                >
                  <button
                    aria-label={`选择 ${item.title || `第 ${index + 1} 首曲目`}${item.subtitle ? `，${item.subtitle}` : ""}`}
                    aria-pressed={isActive}
                    className={`${CARD_BUTTON_CLASSES} ${cardWidth} ${isActive ? "border-white/20" : "border-white/[0.08]"}`}
                    onClick={() => onSelect(index)}
                    type="button"
                  >
                    <CoverArtwork cover={item.cover} />
                    <span className="block min-w-0 px-3.5 py-3 sm:px-4">
                      <span className="block truncate text-sm font-semibold text-white/90">
                        {item.title || "未命名曲目"}
                      </span>
                      <span className="mt-1 block truncate text-xs text-white/50">
                        {item.subtitle || "未知艺人"}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative mx-auto grid w-full max-w-3xl grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-3 px-4 pb-3 sm:px-6">
        <button
          aria-label="上一首"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-colors hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111211] disabled:cursor-not-allowed disabled:opacity-35"
          disabled={items.length <= 1}
          onClick={onPrevious}
          type="button"
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path
              d="m14.5 18-6-6 6-6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>

        <div aria-atomic="true" aria-live="polite" className="min-w-0 text-center">
          <p className="truncate text-sm font-medium text-white/85">
            {activeItem?.title || "尚未选择曲目"}
          </p>
          <p className="mt-1 truncate text-xs text-white/45">
            {activeItem?.subtitle || (activeItem ? "未知艺人" : "选择一张唱片开始浏览")}
          </p>
        </div>

        <button
          aria-label="下一首"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-colors hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111211] disabled:cursor-not-allowed disabled:opacity-35"
          disabled={items.length <= 1}
          onClick={onNext}
          type="button"
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path
              d="m9.5 18 6-6-6-6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      </div>

      <div className="relative flex justify-center px-4 pb-5 sm:pb-6">
        <button
          className="inline-flex min-h-12 min-w-48 items-center justify-center gap-2.5 rounded-full border border-cyan-200/20 bg-cyan-100/[0.09] px-6 text-sm font-semibold text-cyan-50 shadow-[0_8px_28px_rgba(88,190,196,0.08)] transition-colors hover:bg-cyan-100/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111211] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!activeItem}
          onClick={() => {
            if (safeActiveIndex >= 0) {
              onPlay(safeActiveIndex);
            }
          }}
          type="button"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.7c0-.78.85-1.26 1.52-.85l10.1 6.3a1 1 0 0 1 0 1.7l-10.1 6.3A1 1 0 0 1 8 18.3V5.7Z" />
          </svg>
          播放当前曲目
        </button>
      </div>
    </section>
  );
}
