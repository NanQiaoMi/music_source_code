"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { Settings } from "lucide-react";
import { ProfessionalToolsPanel } from "./ProfessionalToolsPanel";

interface ProfessionalToolsToggleProps {
  onOpenFormatConverter: () => void;
  onOpenTrackCutter: () => void;
  onOpenFingerprintScanner: () => void;
  onOpenDSDConverter: () => void;
  onOpenCrossfadeMixer: () => void;
  onOpenLibraryHealth: () => void;
}

export function ProfessionalToolsToggle({
  onOpenFormatConverter,
  onOpenTrackCutter,
  onOpenFingerprintScanner,
  onOpenDSDConverter,
  onOpenCrossfadeMixer,
  onOpenLibraryHealth,
}: ProfessionalToolsToggleProps) {
  const { currentView } = useUIStore();
  const [showPanel, setShowPanel] = useState(false);

  if (currentView !== "home" && currentView !== "player") return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowPanel(true)}
        className="w-14 h-14 rounded-full bg-white flex items-center justify-center transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)]"
        title="专业工具"
      >
        <Settings className="w-6 h-6 text-black" />
      </motion.button>

      <ProfessionalToolsPanel
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
        onOpenFormatConverter={onOpenFormatConverter}
        onOpenTrackCutter={onOpenTrackCutter}
        onOpenFingerprintScanner={onOpenFingerprintScanner}
        onOpenDSDConverter={onOpenDSDConverter}
        onOpenCrossfadeMixer={onOpenCrossfadeMixer}
        onOpenLibraryHealth={onOpenLibraryHealth}
      />
    </>
  );
}
