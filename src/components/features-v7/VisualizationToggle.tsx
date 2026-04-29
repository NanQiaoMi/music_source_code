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
      className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center hover:from-pink-600 hover:to-purple-700 transition-all shadow-2xl"
      title="切换到可视化界面"
    >
      <Activity className="w-6 h-6 text-white" />
    </motion.button>
  );
}
