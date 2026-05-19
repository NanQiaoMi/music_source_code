"use client";

import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SmartMixSessionCard } from "./SmartMixSessionCard";

interface SmartMixSessionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartMixSessionPanel({ isOpen, onClose }: SmartMixSessionPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 p-4 pt-20 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/70 transition-colors hover:bg-black/55 hover:text-white"
          aria-label="Close smart mix session"
        >
          <X className="h-5 w-5" />
        </button>
        <SmartMixSessionCard />
      </motion.div>
    </div>
  );
}
