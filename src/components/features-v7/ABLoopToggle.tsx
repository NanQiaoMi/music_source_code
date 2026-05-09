"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { Repeat } from "lucide-react";
import { ABLoopPanel } from "./ABLoopPanel";

export function ABLoopToggle() {
  const { currentView } = useUIStore();
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const seekTo = useAudioStore((state) => state.seekTo);
  const [showPanel, setShowPanel] = useState(false);

  if (currentView !== "player" && currentView !== "visualization") return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowPanel(true)}
        className="w-14 h-14 rounded-full bg-white flex items-center justify-center transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)]"
        title="A-B 循环"
      >
        <Repeat className="w-6 h-6 text-black" />
      </motion.button>

      <ABLoopPanel
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
        currentTime={currentTime}
        duration={duration}
        seekTo={seekTo}
      />
    </>
  );
}
