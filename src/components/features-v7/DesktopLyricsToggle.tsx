"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useElectron } from "@/hooks/useElectron";
import { MonitorPlay } from "lucide-react";

export function DesktopLyricsToggle() {
  const { currentView } = useUIStore();
  const { isElectron, isDesktopLyricsOpen, toggleDesktopLyrics, checkDesktopLyricsOpen } = useElectron();

  useEffect(() => {
    if (isElectron) {
      checkDesktopLyricsOpen();
    }
  }, [isElectron, checkDesktopLyricsOpen]);

  if (!isElectron) return null;
  if (currentView !== "player" && currentView !== "visualization") return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleDesktopLyrics}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-2xl ${
        isDesktopLyricsOpen
          ? "bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          : "bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800"
      }`}
      title="桌面歌词"
    >
      <MonitorPlay className="w-6 h-6 text-white" />
    </motion.button>
  );
}
