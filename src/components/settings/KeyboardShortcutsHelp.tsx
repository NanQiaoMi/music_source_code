"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useKeyboardShortcutsStore } from "@/store/keyboardShortcutsStore";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  const { defaults, getBinding } = useKeyboardShortcutsStore();

  if (!isOpen) return null;

  const shortcuts = defaults.map((d) => ({
    key: getBinding(d.id).join(" / "),
    action: d.description,
    category: d.category,
  }));

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-white/80" />
            <h2 className="text-white text-2xl font-semibold">键盘快捷键</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar min-h-0">
          {categories.map((cat) => {
            const catShortcuts = shortcuts.filter((s) => s.category === cat);
            if (catShortcuts.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-white/60 font-medium mb-3 text-sm uppercase tracking-wider">
                  {cat}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {catShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg"
                    >
                      <span className="text-white/80 text-sm">{shortcut.action}</span>
                      <kbd className="px-2 py-1 bg-white/10 rounded text-white text-xs font-mono">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5">
          <p className="text-white/40 text-xs text-center">按住 Shift 键可进行大幅度调节</p>
        </div>
      </motion.div>
    </motion.div>
  );
};
