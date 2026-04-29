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
        className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center hover:from-purple-600 hover:to-indigo-700 transition-all shadow-2xl"
        title="专业工具"
      >
        <Settings className="w-6 h-6 text-white" />
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
