"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useStatsAchievementsStore,
  AchievementToast as AchievementToastType,
} from "@/store/statsAchievementsStore";

const AchievementToastItem: React.FC<{ toast: AchievementToastType }> = ({ toast }) => {
  const removeToast = useStatsAchievementsStore((state) => state.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

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
      <div className="flex-shrink-0 text-3xl">{toast.achievement.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="text-white font-semibold text-lg">{toast.achievement.name}</div>
        <div className="text-white/60 text-sm mt-0.5">{toast.achievement.description}</div>
      </div>

      <button
        onClick={() => removeToast(toast.id)}
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
  const activeToasts = useStatsAchievementsStore((state) => state.activeToasts);

  return (
    <div className="fixed top-8 right-8 z-[9999] space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {activeToasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <AchievementToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
