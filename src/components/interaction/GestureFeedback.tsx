"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  FastForward,
  FileText,
  Hand,
  HandMetal,
  Info,
  MousePointer2,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  TriangleAlert,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGestureStore } from "@/store/gestureStore";
import { useAudioStore } from "@/store/audioStore";
import {
  findGestureActionDefinition,
  findGestureCommandDefinition,
  type GestureFeedbackTone,
  type GestureIconName,
} from "@/lib/gesture/types";

const TOAST_VISIBLE_MS = 1400;
const VOLUME_VISIBLE_MS = 1200;
const PLAY_BADGE_VISIBLE_MS = 1000;

const DWELL_RADIUS = 34;
const DWELL_CIRCUMFERENCE = 2 * Math.PI * DWELL_RADIUS;

const ICONS: Record<GestureIconName, LucideIcon> = {
  "swipe-left": ArrowLeft,
  "swipe-right": ArrowRight,
  "swipe-up": ArrowUp,
  "swipe-down": ArrowDown,
  hand: Hand,
  "volume-high": Volume2,
  "volume-low": Volume1,
  play: Play,
  pause: Pause,
  "skip-next": SkipForward,
  "skip-prev": SkipBack,
  mute: VolumeX,
  "fast-forward": FastForward,
  rewind: Rewind,
  lyrics: FileText,
  cursor: MousePointer2,
  fist: HandMetal,
  info: Info,
  warning: TriangleAlert,
  none: Ban,
};

const TONE_COLORS: Record<GestureFeedbackTone, string> = {
  info: "#2997ff",
  success: "#30d158",
  warning: "#ffd60a",
  error: "#ff453a",
};

const VOLUME_ACTIONS: readonly string[] = ["volume_up", "volume_down"];
const PLAY_ACTIONS: readonly string[] = ["toggle_play", "toggle_mute"];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, []);

  return reduced;
}

function useTimedVisibility(active: boolean, seq: number | null, timeoutMs: number): boolean {
  const [dismissedSeq, setDismissedSeq] = useState<number | null>(null);

  useEffect(() => {
    if (!active || seq === null) return;
    const timer = window.setTimeout(() => setDismissedSeq(seq), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [active, seq, timeoutMs]);

  return active && seq !== dismissedSeq;
}

/**
 * 手势动作反馈层。
 *
 * 所有可见性都由「当前 lastEvent + 已 dismiss 的 seq」推导，事件 seq 变化即重新计时，
 * 因此同一动作连续触发也能刷新；仅计时器写在 effect 里，静态渲染（renderToStaticMarkup）
 * 也能直接断言事件内容。prefers-reduced-motion 时只保留透明度过渡。
 */
export const GestureFeedback: React.FC = () => {
  const lastEvent = useGestureStore((state) => state.lastEvent);
  const dwell = useGestureStore((state) => state.dwell);
  const volume = useAudioStore((state) => state.volume);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);
  const prefersReducedMotion = usePrefersReducedMotion();

  const action = lastEvent?.action ?? null;
  const toastVisible = useTimedVisibility(
    lastEvent !== null,
    lastEvent?.seq ?? null,
    TOAST_VISIBLE_MS
  );
  const volumeVisible = useTimedVisibility(
    action !== null && VOLUME_ACTIONS.indexOf(action) >= 0,
    lastEvent?.seq ?? null,
    VOLUME_VISIBLE_MS
  );
  const playBadgeVisible = useTimedVisibility(
    action !== null && PLAY_ACTIONS.indexOf(action) >= 0,
    lastEvent?.seq ?? null,
    PLAY_BADGE_VISIBLE_MS
  );

  const volumePercent = Math.round(Math.min(1, Math.max(0, volume)) * 100);
  const dwellClamped = Math.min(1, Math.max(0, dwell?.progress ?? 0));
  const dwellPercent = Math.round(dwellClamped * 100);
  const dwellLabel = dwell ? findGestureCommandDefinition(dwell.command).label : "";

  const toastMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -14, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -10, scale: 0.98 },
      };
  const toastTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { type: "spring" as const, stiffness: 420, damping: 34 };

  const volumeMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 18 },
      };
  const badgeMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.04 },
      };

  const ToastIcon = lastEvent ? ICONS[findGestureActionDefinition(lastEvent.action).icon] : Info;

  return (
    <>
      <AnimatePresence>
        {toastVisible && lastEvent && (
          <motion.div
            key={lastEvent.seq}
            data-gesture-ignore="true"
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed left-1/2 top-6 z-[9996] -translate-x-1/2"
            initial={toastMotion.initial}
            animate={toastMotion.animate}
            exit={toastMotion.exit}
            transition={toastTransition}
          >
            <div className="flex items-center gap-3 rounded-full border border-white/[0.12] bg-[#1c1c1e]/70 px-5 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <ToastIcon
                className="h-4 w-4 shrink-0"
                style={{ color: TONE_COLORS[lastEvent.tone] }}
              />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold tracking-tight text-white">
                  {lastEvent.label}
                </div>
                {lastEvent.detail && (
                  <div className="truncate text-[11px] text-[#86868b]">{lastEvent.detail}</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {volumeVisible && (
          <motion.div
            data-gesture-ignore="true"
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed right-6 top-1/2 z-[9996] -translate-y-1/2"
            initial={volumeMotion.initial}
            animate={volumeMotion.animate}
            exit={volumeMotion.exit}
            transition={toastTransition}
          >
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.12] bg-[#1c1c1e]/70 px-3 py-4 shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              {volumePercent === 0 ? (
                <VolumeX className="h-5 w-5 text-white/80" />
              ) : (
                <Volume2 className="h-5 w-5 text-white/80" />
              )}
              <div className="relative h-24 w-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-[#0071e3] to-[#2997ff]"
                  style={{ height: volumePercent + "%" }}
                />
              </div>
              <span className="font-mono text-[11px] font-semibold text-white">
                {volumePercent}%
              </span>
              <span className="text-[10px] text-[#86868b]">音量</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playBadgeVisible && (
          <motion.div
            data-gesture-ignore="true"
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed left-1/2 top-1/2 z-[9996] -translate-x-1/2 -translate-y-1/2"
            initial={badgeMotion.initial}
            animate={badgeMotion.animate}
            exit={badgeMotion.exit}
            transition={toastTransition}
          >
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-white/[0.12] bg-[#1c1c1e]/70 px-7 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                {isPlaying ? (
                  <Pause className="h-6 w-6 text-white" />
                ) : (
                  <Play className="h-6 w-6 text-white" />
                )}
              </div>
              <span className="text-[14px] font-semibold text-white">
                {isPlaying ? "播放中" : "已暂停"}
              </span>
              <span className="max-w-[180px] truncate text-[11px] text-[#86868b]">
                {currentSong?.title ?? "未在播放"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {dwell && (
        <div
          data-gesture-ignore="true"
          className="pointer-events-none fixed left-1/2 top-24 z-[9994] -translate-x-1/2"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center"
          >
            <div className="relative h-[88px] w-[88px]">
              <svg className="h-[88px] w-[88px] -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
                <circle
                  cx={44}
                  cy={44}
                  r={DWELL_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={4}
                />
                <circle
                  cx={44}
                  cy={44}
                  r={DWELL_RADIUS}
                  fill="none"
                  stroke="#0071e3"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={DWELL_CIRCUMFERENCE}
                  strokeDashoffset={DWELL_CIRCUMFERENCE * (1 - dwellClamped)}
                  style={{ transition: "stroke-dashoffset 120ms linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <Hand className="h-4 w-4 text-white/85" />
                <span className="font-mono text-[11px] text-white/80">{dwellPercent}%</span>
              </div>
            </div>
            <span className="mt-1 text-[10px] text-[#86868b]">{dwellLabel}</span>
          </motion.div>
        </div>
      )}
    </>
  );
};
