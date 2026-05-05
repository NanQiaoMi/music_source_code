"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Space", action: "播放/暂停" },
    { key: "← / →", action: "快退/快进 5秒" },
    { key: "Shift + ← / →", action: "快退/快进 10秒" },
    { key: "↑ / ↓", action: "调节音量" },
    { key: "Ctrl + D", action: "收藏歌曲" },
    { key: "Ctrl + R / L", action: "切换播放模式" },
    { key: "Ctrl + M", action: "静音/取消静音" },
    { key: "Ctrl + N / P", action: "下一首/上一首" },
    { key: "Ctrl + F", action: "全屏歌词" },
    { key: "Esc", action: "返回/关闭面板" },
    { key: "= / -", action: "加快/减慢播放速度" },
    { key: "0-9", action: "跳转到进度 %" },
    { key: "Ctrl + Shift + A", action: "打开 AI 设置面板" },
    { key: "Ctrl + Shift + L", action: "打开歌词生成面板" },
    { key: "Ctrl + Shift + T", action: "打开 AI 教程面板" },
    { key: "Ctrl + I", action: "切换 AI 设置面板" },
  ];

  const categories = [
    { name: "播放控制", shortcuts: [0, 1, 2, 10, 11] },
    { name: "音量控制", shortcuts: [3, 4, 6] },
    { name: "歌曲操作", shortcuts: [5, 7] },
    { name: "界面切换", shortcuts: [8, 9] },
    { name: "AI 功能", shortcuts: [12, 13, 14, 15] },
  ];

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
        {/* Header */}
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

        {/* Shortcuts Grid */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar min-h-0">
          {categories.map((category) => (
            <div key={category.name}>
              <h3 className="text-white/60 font-medium mb-3 text-sm uppercase tracking-wider">
                {category.name}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {category.shortcuts.map((index) => {
                  const shortcut = shortcuts[index];
                  return (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg"
                    >
                      <span className="text-white/80 text-sm">{shortcut.action}</span>
                      <kbd className="px-2 py-1 bg-white/10 rounded text-white text-xs font-mono">
                        {shortcut.key}
                      </kbd>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <p className="text-white/40 text-xs text-center">按住 Shift 键可进行大幅度调节</p>
        </div>
      </motion.div>
    </motion.div>
  );
};
