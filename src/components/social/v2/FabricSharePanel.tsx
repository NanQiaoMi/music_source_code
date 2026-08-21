"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Clipboard, Download, Loader2, Edit3, ImagePlus, LayoutTemplate, Settings2 } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { usePosterV2Store } from "@/store/posterV2Store";
import { toast } from "@/components/shared/GlassToast";
import FabricCanvas from "./FabricCanvas";
import FabricControls from "./FabricControls";

interface FabricSharePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchBack?: () => void;
}

export const FabricSharePanel: React.FC<FabricSharePanelProps> = ({ isOpen, onClose, onSwitchBack }) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Store for triggering export in the canvas component
  const [exportTrigger, setExportTrigger] = useState<number>(0);
  const [copyTrigger, setCopyTrigger] = useState<number>(0);

  const handleExportComplete = useCallback((dataUrl: string, isCopy: boolean) => {
    setIsGenerating(false);
    if (!dataUrl) {
      toast.error("生成失败");
      return;
    }

    if (isCopy) {
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopied(true);
          toast.success("已复制到剪贴板");
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => toast.error("复制失败"));
    } else {
      const link = document.createElement("a");
      link.download = `poster-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("海报已保存");
    }
  }, []);

  const handleSaveImage = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setExportTrigger(Date.now());
  };

  const handleCopyImage = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setCopyTrigger(Date.now());
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1400px] h-[90vh] bg-[#111]/90 backdrop-blur-[60px] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Loading Overlay */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-[32px]"
            >
              <div className="relative">
                <Loader2 className="w-16 h-16 text-pink-500 animate-spin" />
                <div className="absolute inset-0 border-4 border-pink-500/20 rounded-full animate-pulse" />
              </div>
              <h3 className="text-white mt-6 text-xl font-bold tracking-widest uppercase">System Rendering</h3>
              <p className="text-white/50 text-sm mt-2">Exporting 4K High-Res Poster...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 shrink-0 bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 border border-white/20">
              <Settings2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white text-2xl font-bold tracking-wide">Poster Editor V2</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">PRO</span>
                <p className="text-white/50 text-xs">Canvas Rendering Engine Active</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {onSwitchBack && (
              <button
                onClick={onSwitchBack}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border border-white/10 text-sm font-medium"
              >
                返回旧版
              </button>
            )}
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white transition-colors border border-white/10 hover:scale-105 active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        {currentSong ? (
          <div className="flex flex-1 min-h-0">
            {/* Canvas Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0c] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]">
              <div className="absolute top-6 left-6 z-20 flex flex-col gap-2 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl rounded-full px-5 py-2.5 flex items-center gap-3 border border-white/10 shadow-xl">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]" />
                  <span className="text-white/80 text-xs font-bold tracking-widest uppercase">Canvas Live Preview</span>
                </div>
                <div className="bg-black/40 backdrop-blur-md rounded-xl px-4 py-2 border border-white/5 inline-flex flex-col gap-1 w-max">
                  <span className="text-white/40 text-[10px] uppercase">Controls</span>
                  <span className="text-white/70 text-xs">Drag elements to move • Scroll to zoom • Corner to scale</span>
                </div>
              </div>

              <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative p-8">
                <FabricCanvas 
                  song={currentSong} 
                  exportTrigger={exportTrigger}
                  copyTrigger={copyTrigger}
                  onExportComplete={handleExportComplete}
                />
              </div>
            </div>

            {/* Right Controls */}
            <div className="w-[460px] bg-black/40 border-l border-white/10 flex flex-col shrink-0 shadow-2xl z-10 backdrop-blur-2xl">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <FabricControls />
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-white/10 bg-black/40 shrink-0">
                <div className="flex gap-4">
                  <button
                    onClick={handleCopyImage}
                    disabled={isGenerating}
                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold tracking-wide transition-all flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 group"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 text-emerald-400" /> <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-5 h-5 group-hover:scale-110 transition-transform" /> Copy
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSaveImage}
                    disabled={isGenerating}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white font-bold tracking-wide transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                    <Download className="w-5 h-5 relative z-10 group-hover:-translate-y-1 transition-transform" />
                    <span className="relative z-10">Export 4K</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h3 className="text-white font-medium text-lg">暂无播放内容</h3>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
