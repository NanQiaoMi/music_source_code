import React, { useEffect, useState } from "react";
import { usePlaylistStore } from "@/store/playlistStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import EmotionVisualizer from "./EmotionVisualizer";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Maximize2, 
  Minimize2, 
  MousePointer2, 
  Zap, 
  Search,
  RotateCcw,
  Play,
  TrendingUp,
  Layers
} from "lucide-react";
import { GlassButton } from "../GlassButton";
import { GlassCard } from "../GlassCard";
import { X } from "lucide-react";

interface EmotionMatrixViewProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmotionMatrixView: React.FC<EmotionMatrixViewProps> = ({ isOpen, onClose }) => {
  const { songs } = usePlaylistStore();
  const { 
    initializePoints, 
    viewMode, 
    setViewMode, 
    isLassoActive, 
    setLassoActive,
    isCurveActive,
    setCurveActive,
    selectedIds,
    setSelectedIds,
    clearSelection,
    points,
    setGlobalEmotion
  } = useEmotionStore();
  
  const { setCurrentView } = useUIStore();

  const { playQueue, setIsEmotionCurveMode } = useAudioStore();

  const [isFullscreen, setIsFullscreen] = useState(true);

  useEffect(() => {
    if (isOpen && songs.length > 0) {
      initializePoints(songs);
    }
  }, [isOpen, songs, initializePoints]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl h-[80vh] min-h-[600px] flex"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full h-full relative overflow-hidden flex flex-col p-0">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent z-40 flex items-center justify-between px-6 pointer-events-none">
            <h2 className="text-white font-bold text-lg pointer-events-auto">情绪资料库 (Emotion Matrix)</h2>
          </div>

          <div className="relative flex-1 w-full h-full">
            <EmotionVisualizer />
          </div>

      {/* UI Controls */}
      <div className="absolute top-16 left-6 flex flex-col gap-4 z-30 pointer-events-auto">
        <div className="flex items-center gap-2 p-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10">
          <button
            onClick={() => setViewMode("matrix")}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
              viewMode === "matrix" ? "bg-white text-black" : "text-white/60 hover:text-white"
            }`}
          >
            星图粒子
          </button>
          <button
            onClick={() => setViewMode("heatmap")}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
              viewMode === "heatmap" ? "bg-white text-black" : "text-white/60 hover:text-white"
            }`}
          >
            情绪热力
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <GlassButton
            onClick={() => setLassoActive(!isLassoActive)}
            className={`${isLassoActive ? "ring-2 ring-blue-500 bg-blue-500/20" : ""}`}
            title="玻璃套索 (Lasso Selection)"
          >
            <MousePointer2 size={18} />
          </GlassButton>
          <GlassButton
            onClick={() => setCurveActive(!isCurveActive)}
            className={`${isCurveActive ? "ring-2 ring-purple-500 bg-purple-500/20" : ""}`}
            title="情绪渐变曲线 (Curve Playback)"
          >
            <TrendingUp size={18} />
          </GlassButton>
        </div>
      </div>

      <div className="absolute top-6 right-6 flex gap-2 z-30 pointer-events-auto">
        <GlassButton onClick={clearSelection} title="清除选择">
          <RotateCcw size={18} />
        </GlassButton>
        <GlassButton onClick={onClose} title="关闭">
          <X size={18} />
        </GlassButton>
      </div>

      {/* Selection Info */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 flex items-center gap-6 z-30"
          >
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Selected</span>
              <span className="text-xl font-bold text-white">{selectedIds.length} <span className="text-sm font-normal text-white/60">Tracks</span></span>
            </div>
            <div className="h-8 w-[1px] bg-white/10" />
            <button 
              onClick={() => {
                if (selectedIds.length === 0) return;
                
                const songsMap = new Map(songs.map(s => [s.id, s]));
                const sortedSongs = selectedIds
                  .map(id => songsMap.get(id))
                  .filter((s): s is any => !!s);
                
                if (sortedSongs.length === 0) return;
                
                const { appendSongsAndPlay, setIsEmotionCurveMode } = useAudioStore.getState();
                setIsEmotionCurveMode(true);
                appendSongsAndPlay(sortedSongs);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-bold hover:scale-105 transition-transform active:scale-95"
            >
              <Play size={16} fill="currentColor" />
              播放选中歌曲
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tagged Songs List Panel */}
      <div className="absolute left-6 bottom-8 w-64 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-4 z-30 pointer-events-auto">
        <h3 className="text-white/60 text-[10px] font-bold uppercase mb-3 flex items-center justify-between">
          已标记歌曲 ({points.filter(p => p.isTagged).length})
          <span className="text-[8px] text-white/30 tracking-widest">TOTAL: {points.length}</span>
        </h3>
        <div className="max-h-48 overflow-y-auto space-y-2 pr-2 mb-3 custom-scrollbar">
          {points.filter(p => p.isTagged).length === 0 ? (
            <div className="text-[10px] text-white/20 italic py-2">暂无已标记歌曲，请使用雷达进行标注</div>
          ) : (
            points.filter(p => p.isTagged).map(p => (
              <div key={p.id} className="flex items-center gap-2 text-[10px] text-white/80 group">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]" />
                <span className="truncate flex-1 font-medium">{p.title}</span>
                <span className="text-white/20 group-hover:text-white/40">{(p.x).toFixed(1)}, {(p.y).toFixed(1)}</span>
              </div>
            ))
          )}
        </div>
        
        {/* Debug Button */}
        <button 
          onClick={() => {
            const mockEmotions: Record<string, {x: number, y: number}> = {};
            songs.slice(0, 20).forEach(s => {
              mockEmotions[s.id] = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
            });
            useEmotionStore.getState().setEmotionMap(mockEmotions);
            useEmotionStore.getState().initializePoints(songs);
          }}
          className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] text-white/40 uppercase tracking-widest transition-colors"
        >
          生成 20 条测试标记
        </button>
      </div>

      {/* Axis Labels */}
      <div className="absolute inset-0 pointer-events-none border border-white/5 opacity-30">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/20" />
        <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white/20" />
        
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">高亢 / 激昂</span>
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">平静 / 低沉</span>
        <span className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">悲伤 / 阴暗</span>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">欢快 / 明亮</span>
      </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default EmotionMatrixView;
