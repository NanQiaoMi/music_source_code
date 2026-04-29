"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { Zap } from "lucide-react";
import { AudioEffectsPanel } from "./AudioEffectsPanel";

export function AudioEnhancementToggle() {
  const { currentView } = useUIStore();
  const [showEffects, setShowEffects] = useState(false);

  if (currentView !== "player") return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowEffects(true)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center hover:from-yellow-600 hover:to-orange-700 transition-all shadow-2xl"
        title="音频特效"
      >
        <Zap className="w-6 h-6 text-white" />
      </motion.button>

      <AudioEffectsPanel
        isOpen={showEffects}
        onClose={() => setShowEffects(false)}
      />
    </>
  );
}
