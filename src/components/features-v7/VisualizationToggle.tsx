"use client";

import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { Activity } from "lucide-react";

export function VisualizationToggle() {
  const { currentView, setCurrentView } = useUIStore();

  if (currentView !== "player") return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setCurrentView("visualization")}
      className="w-14 h-14 rounded-full bg-white flex items-center justify-center transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)]"
      title="切换到可视化界面"
    >
      <Activity className="w-6 h-6 text-black" />
    </motion.button>
  );
}
