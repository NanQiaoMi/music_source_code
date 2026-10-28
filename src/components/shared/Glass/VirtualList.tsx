"use client";

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface VirtualListHandle {
  scrollToIndex(
    index: number,
    opts?: { align?: "start" | "center" | "auto"; smooth?: boolean }
  ): void;
  scrollToTop(): void;
}

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  onScrollEnd?: () => void;
  /** S4-5a: imperative handle for programmatic scrolling (e.g. reveal current song). */
  handleRef?: React.Ref<VirtualListHandle>;
  /** S4-5a: scroll position applied on mount, before the first paint of the window. */
  initialIndex?: number;
  getItemKey?: (item: T, index: number) => React.Key;
}

/**
 * Fixed-height windowing list. Only the visible window (+overscan) is mounted, so a
 * 500-row list costs ~15 DOM nodes instead of 500 (S4-5).
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  className = "",
  overscan = 5,
  onScrollEnd,
  handleRef,
  initialIndex = 0,
  getItemKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endReachedRef = useRef(false);
  // initialIndex is a mount hint only; later jumps go through scrollToIndex.
  const [initialScrollTop] = useState(() =>
    Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)) * itemHeight)
  );
  const [scrollTop, setScrollTop] = useState(initialScrollTop);
  const [containerHeight, setContainerHeight] = useState(0);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // jsdom (and pre-layout frames) report 0 for clientHeight; fall back to the rect.
    setContainerHeight(el.clientHeight || el.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || initialScrollTop <= 0) return;
    el.scrollTop = initialScrollTop;
  }, [initialScrollTop]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);

    if (!onScrollEnd) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (!nearBottom) {
      endReachedRef.current = false;
    } else if (!endReachedRef.current) {
      endReachedRef.current = true;
      onScrollEnd();
    }
  }, [onScrollEnd]);

  const scrollToIndex = useCallback(
    (index: number, opts: { align?: "start" | "center" | "auto"; smooth?: boolean } = {}) => {
      const el = containerRef.current;
      if (!el || items.length === 0) return;
      const target = Math.max(0, Math.min(index, items.length - 1));
      const viewport = containerHeight || el.clientHeight || itemHeight;
      const centered = Math.max(0, target * itemHeight - (viewport - itemHeight) / 2);
      const top = opts.align === "center" ? centered : target * itemHeight;

      if (opts.smooth && typeof el.scrollTo === "function") {
        el.scrollTo({ top, behavior: "smooth" });
        return;
      }
      el.scrollTop = top;
      setScrollTop(top);
    },
    [containerHeight, itemHeight, items.length]
  );

  const scrollToTop = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = 0;
    setScrollTop(0);
  }, []);

  useImperativeHandle(handleRef, () => ({ scrollToIndex, scrollToTop }), [
    scrollToIndex,
    scrollToTop,
  ]);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  return (
    <div
      ref={containerRef}
      data-virtual-list=""
      onScroll={handleScroll}
      className={`overflow-y-auto ${className}`}
      style={{ willChange: "scroll-position" }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${startIndex * itemHeight}px)`,
          }}
        >
          {items.slice(startIndex, endIndex).map((item, i) => {
            const index = startIndex + i;
            return (
              <div
                key={getItemKey ? getItemKey(item, index) : index}
                data-virtual-item=""
                style={{ height: itemHeight }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
