import React from "react";
import { useGestureStore } from "@/store/gestureStore";

export const VirtualCursor: React.FC = () => {
  const isHandDetected = useGestureStore((state) => state.isHandDetected);
  const cursorPosition = useGestureStore((state) => state.cursorPosition);
  const isPinching = useGestureStore((state) => state.isPinching);

  // 当未使用手势控制时，完全不挂载 DOM 与事件监听，零开销
  if (!isHandDetected) return null;

  // Clamp position to prevent overflow
  const clampedPosition = {
    x: Math.max(0.01, Math.min(0.99, cursorPosition.x)),
    y: Math.max(0.01, Math.min(0.99, cursorPosition.y)),
  };

  return (
    <div
      className="fixed pointer-events-none z-[10000] overflow-hidden"
      style={{
        left: `${clampedPosition.x * 100}%`,
        top: `${clampedPosition.y * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className={`
        rounded-full
        transition-all duration-100 ease-out
        ${isPinching ? "w-4 h-4 bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.8)] scale-75" : "w-6 h-6 bg-white/50 backdrop-blur-sm shadow-[0_0_10px_rgba(255,255,255,0.5)]"}
      `}
      >
        <div
          className={`absolute inset-1 rounded-full bg-white transition-opacity ${isPinching ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      {!isPinching && (
        <div
          className="absolute -inset-2 rounded-full border border-white/40 animate-[spin_3s_linear_infinite]"
          style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }}
        />
      )}
    </div>
  );
};
