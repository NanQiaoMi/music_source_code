"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore, type ToastMessage } from "@/store/toastStore";

/**
 * S6-8b：成就 toast 的数据/生命周期在 toastStore（variant="achievement"）。
 * 本组件只负责成就专属视觉；自动消失由 toastStore 的 duration 定时器统一处理，
 * 这里不再自建 4000ms 定时器，也不再持有第二份队列。
 */
const AchievementToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const dismissToast = useToastStore((state) => state.dismissToast);
  const achievement = toast.achievement;

  if (!achievement) return null;

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ type: "spring", damping: 15, stiffness: 200 }}
      className="relative flex items-center gap-4 px-6 py-4 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl"
      style={{
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex-shrink-0 text-3xl">{achievement.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="text-white font-semibold text-lg">{achievement.name}</div>
        <div className="text-white/60 text-sm mt-0.5">{achievement.description}</div>
      </div>

      <button
        onClick={() => dismissToast(toast.id)}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </motion.div>
  );
};

export const AchievementToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const achievements = toasts.filter((toast) => toast.variant === "achievement");

  return (
    <div className="fixed top-8 right-8 z-[9999] space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {achievements.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <AchievementToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
