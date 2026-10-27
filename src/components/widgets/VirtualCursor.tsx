"use client";

import React from "react";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const CURSOR_SIZE = 48;

/**
 * 隔空手势虚拟光标。
 *
 * pointer-events-none 保证不会拦截真实鼠标事件；只有 cursorVisible && showCursor 时挂载，
 * 手势关闭后不残留任何 DOM。dwell 用 SVG strokeDasharray 表示蓄力进度，不做旋转动画。
 */
export const VirtualCursor: React.FC = () => {
  const showCursor = useGestureSettingsStore((state) => state.showCursor);
  const cursorVisible = useGestureStore((state) => state.cursorVisible);
  const cursor = useGestureStore((state) => state.cursor);
  const pinching = useGestureStore((state) => state.pinching);
  const dragging = useGestureStore((state) => state.dragging);
  const dwell = useGestureStore((state) => state.dwell);

  if (!showCursor || !cursorVisible) return null;

  const x = Math.max(0.01, Math.min(0.99, cursor.x));
  const y = Math.max(0.01, Math.min(0.99, cursor.y));
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

  return (
    <div
      data-gesture-ignore="true"
      aria-hidden="true"
      className="pointer-events-none fixed z-[10000]"
      style={{
        left: x * 100 + "%",
        top: y * 100 + "%",
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        transform: "translate3d(-50%, -50%, 0)",
        willChange: "left, top",
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
