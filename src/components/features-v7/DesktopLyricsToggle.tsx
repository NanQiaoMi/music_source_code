"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useElectron } from "@/hooks/useElectron";
import { MonitorPlay } from "lucide-react";

export function DesktopLyricsToggle() {
  const { currentView } = useUIStore();
  const { isElectron, isDesktopLyricsOpen, toggleDesktopLyrics, checkDesktopLyricsOpen } =
    useElectron();

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
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)] ${
        isDesktopLyricsOpen ? "bg-white" : "bg-white/10 hover:bg-white/20"
      }`}
      title="桌面歌词"
    >
      <MonitorPlay className={`w-6 h-6 ${isDesktopLyricsOpen ? "text-black" : "text-white"}`} />
    </motion.button>
  );
}
