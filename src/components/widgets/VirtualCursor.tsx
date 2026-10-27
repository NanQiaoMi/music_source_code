"use client";

import React, { useCallback, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const CURSOR_SIZE = 48;

type CursorStyle = CSSProperties & {
  "--gesture-cursor-x": string;
  "--gesture-cursor-y": string;
};

function clampCursor(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

/**
 * 隔空手势虚拟光标。
 *
 * 性能要点：高频光标位置不再走 React 状态更新 —— 组件只订阅一次 store，
 * 通过 CSS 变量（--gesture-cursor-x/y）直接改 transform，避免每帧 re-render / layout。
 * 只在 cursorVisible / pinching / dragging / dwell 变化时重新渲染。
 *
 * pointer-events-none 保证不会拦截真实鼠标事件；dwell 用 SVG strokeDasharray
 * 表示蓄力进度，不做旋转动画。
 */
export const VirtualCursor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const showCursor = useGestureSettingsStore((state) => state.showCursor);
  const cursorVisible = useGestureStore((state) => state.cursorVisible);
  const pinching = useGestureStore((state) => state.pinching);
  const dragging = useGestureStore((state) => state.dragging);
  const dwell = useGestureStore((state) => state.dwell);
  // 非响应式读取：位置由 effect 直接写 CSS 变量；渲染时只用它初始化一次样式。
  const cursor = useGestureStore.getState().cursor;

  const applyCursor = useCallback((next: { x: number; y: number }) => {
    const element = containerRef.current;
    if (!element) return;
    const x = clampCursor(next.x);
    const y = clampCursor(next.y);
    element.style.setProperty("--gesture-cursor-x", `${(x * 100).toFixed(3)}vw`);
    element.style.setProperty("--gesture-cursor-y", `${(y * 100).toFixed(3)}vh`);
  }, []);

  useLayoutEffect(() => {
    applyCursor(useGestureStore.getState().cursor);
    return useGestureStore.subscribe((state, previous) => {
      if (state.cursor !== previous.cursor) applyCursor(state.cursor);
    });
  }, [applyCursor]);

  if (!showCursor || !cursorVisible) return null;

  const x = clampCursor(cursor.x);
  const y = clampCursor(cursor.y);
  const progress = Math.min(1, Math.max(0, dwell?.progress ?? 0));
  const showDwell = dwell !== null && progress > 0;

  const dotClass = pinching
    ? "h-2.5 w-2.5 bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]"
    : "h-3.5 w-3.5 bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.65)]";
  const haloClass = dragging
    ? "border-[#30d158]/80 bg-[#30d158]/10"
    : pinching
      ? "border-[#ffd60a]/80 bg-[#ffd60a]/10"
      : "border-white/45 bg-white/[0.06]";
  const positionStyle: CursorStyle = {
    "--gesture-cursor-x": `${(x * 100).toFixed(3)}vw`,
    "--gesture-cursor-y": `${(y * 100).toFixed(3)}vh`,
  };

  return (
    <div
      ref={containerRef}
      data-gesture-ignore="true"
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[10000]"
      style={{
        ...positionStyle,
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        transform:
          "translate3d(calc(var(--gesture-cursor-x, 50vw) - 50%), calc(var(--gesture-cursor-y, 50vh) - 50%), 0)",
        willChange: "transform",
      }}
    >
      {showDwell && (
        <svg
          className="absolute inset-0 -rotate-90"
          width={CURSOR_SIZE}
          height={CURSOR_SIZE}
          viewBox="0 0 48 48"
        >
          <circle
            cx={24}
            cy={24}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={3}
          />
          <circle
            cx={24}
            cy={24}
            r={RING_RADIUS}
            fill="none"
            stroke="#0071e3"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
            style={{ transition: "stroke-dashoffset 100ms linear" }}
          />
        </svg>
      )}

      <div
        className="absolute inset-0 transition-transform duration-100 ease-out"
        style={{ transform: pinching ? "scale(0.8)" : "scale(1)" }}
      >
        <div
          className={
            "absolute inset-0 rounded-full border backdrop-blur-[2px] transition-colors duration-150 " +
            haloClass
          }
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={"rounded-full transition-all duration-100 " + dotClass} />
        </div>
      </div>

      {dragging && (
        <div className="absolute inset-1 rounded-full border border-dashed border-[#30d158]/70" />
      )}
    </div>
  );
};
