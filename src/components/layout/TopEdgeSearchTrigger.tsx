"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/uiStore";

export function TopEdgeSearchTrigger() {
  const isSearchOpen = useUIStore((state) => state.panels.search);
  const openPanel = useUIStore((state) => state.openPanel);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Mouse top-edge proximity detection
    const handleMouseMove = (e: MouseEvent) => {
      // If mouse is within top 15px and search panel is not already open
      if (e.clientY <= 15 && !useUIStore.getState().panels.search) {
        openPanel("search");
      }
    };

    // 2. Touch pull-down detection from top edge
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0 && e.touches[0].clientY <= 40) {
        touchStartYRef.current = e.touches[0].clientY;
      } else {
        touchStartYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current !== null && e.touches.length > 0) {
        const deltaY = e.touches[0].clientY - touchStartYRef.current;
        if (deltaY > 30 && !useUIStore.getState().panels.search) {
          openPanel("search");
          touchStartYRef.current = null;
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [openPanel]);

  return (
    // Invisible top edge sensor bar
    <div
      data-testid="top-edge-search-sensor"
      onMouseEnter={() => {
        if (!useUIStore.getState().panels.search) {
          openPanel("search");
        }
      }}
      onPointerEnter={() => {
        if (!useUIStore.getState().panels.search) {
          openPanel("search");
        }
      }}
      className="fixed top-0 left-0 right-0 h-2.5 z-40 pointer-events-auto cursor-default select-none"
      aria-hidden="true"
    />
  );
}
