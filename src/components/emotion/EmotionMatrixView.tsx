import React, { useEffect, useState, useMemo } from "react";
import { usePlaylistStore } from "@/store/playlistStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useAudioStore } from "@/store/audioStore";
import EmotionVisualizer from "./EmotionVisualizer";
import { motion, AnimatePresence } from "framer-motion";
import {
  MousePointer2,
  Zap,
  RotateCcw,
  Play,
  TrendingUp,
  Layers,
  Search,
  Sparkles,
  Music2,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/shared/Glass/GlassCard";

const QUADRANT_META: Record<string, { label: string; color: string; desc: string }> = {
  Q1: { label: "高亢激昂", color: "rgb(249, 115, 22)", desc: "充满能量与激情" },
  Q2: { label: "悲伤阴暗", color: "rgb(139, 92, 246)", desc: "深沉而富有感染力" },
  Q3: { label: "平静低沉", color: "rgb(59, 130, 246)", desc: "宁静舒缓的氛围" },
  Q4: { label: "欢快明亮", color: "rgb(34, 197, 94)", desc: "轻松愉悦的心情" },
};

interface EmotionMatrixViewProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmotionMatrixView: React.FC<EmotionMatrixViewProps> = ({ isOpen, onClose }) => {
  const { songs } = usePlaylistStore();
  const {
    initializePoints, viewMode, setViewMode, selectionMode,
    setSelectionMode, selectedIds,
    setSelectedIds, clearSelection, points, searchQuery,
    setSearchQuery, searchResults, findSimilar, getSelectionAnalytics,
    getQuadrantStats, autoTagSong, autoTagBatch, taggingStatus,
    stopTagging
  } = useEmotionStore();

  const [isAutoTagging, setIsAutoTagging] = useState(false);

  const currentSong = useAudioStore(state => state.currentSong);

  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"analytics" | "similar" | "tagged">("analytics");
  const [similarSongs, setSimilarSongs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && songs.length > 0) {
      initializePoints(songs);
    }
  }, [isOpen, songs, initializePoints]);

  useEffect(() => {
    if (selectedIds.length === 1) {
      const results = findSimilar(selectedIds[0], 8);
      setSimilarSongs(results);
    } else {
      setSimilarSongs([]);
    }
  }, [selectedIds, findSimilar]);

  const analytics = useMemo(() => getSelectionAnalytics(), [selectedIds, points]);
  const quadrantStats = useMemo(() => getQuadrantStats(), [points]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-7xl h-[90vh] min-h-[700px] flex"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full h-full relative overflow-hidden flex flex-col p-0 border-white/5 bg-black/40 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-[40px]">
          {/* Header Area */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/90 to-transparent z-40 flex items-start justify-between px-10 pt-8 pointer-events-none">
            <div className="flex flex-col gap-1 pointer-events-auto">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Sparkles size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-black text-2xl tracking-tighter uppercase italic">情绪星谱 <span className="text-white/20 font-light ml-2 not-italic text-sm tracking-widest">VIBE MATRIX v2</span></h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black">已同步 {points.length} 维坐标</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 pointer-events-auto">
              {/* Relocated Search Bar */}
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500/10 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="检索频谱..."
                    className="w-[200px] lg:w-[280px] pl-10 pr-10 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] backdrop-blur-3xl rounded-2xl border border-white/5 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/10 focus:w-[320px] transition-all font-bold tracking-tight"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-4 text-white/20 hover:text-white transition-colors">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
              {currentSong && (
                <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 bg-white/5 backdrop-blur-3xl rounded-[20px] border border-white/10 shadow-2xl group transition-all hover:bg-white/10">
                  <div className="relative">
                    <img src={currentSong.cover} className="w-10 h-10 rounded-xl object-cover border border-white/10 group-hover:scale-110 transition-transform shadow-lg" />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#121212] animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-[120px]">
                    <span className="text-[10px] text-white/40 font-black uppercase tracking-widest leading-none mb-1">正在共鸣</span>
                    <span className="text-xs text-white font-black truncate max-w-[180px]">{currentSong.title}</span>
                  </div>
                </div>
              )}
              <button 
                onClick={onClose}
                className="w-12 h-12 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-[20px] border border-white/10 flex items-center justify-center transition-all group active:scale-90"
              >
                <X size={24} className="group-hover:rotate-90 transition-transform" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="relative flex-1 w-full h-full flex">
            {/* Visualizer Container */}
            <div className="relative flex-1 h-full">
              <EmotionVisualizer />
              
              {/* Axis Labels Overlay */}
              <div className="absolute inset-0 pointer-events-none z-20">
                {/* Visual Guides */}
                <div className="absolute top-1/2 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="absolute top-10 bottom-10 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                
                <div className="absolute top-32 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <span className="text-[11px] text-orange-400 font-black uppercase tracking-[0.6em] drop-shadow-[0_0_10px_rgba(249,115,22,0.4)] italic">高亢 / 激昂 / ENERGY</span>
                  <div className="w-[1px] h-6 bg-gradient-to-b from-orange-400/60 to-transparent mt-2" />
                </div>
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="w-[1px] h-6 bg-gradient-to-t from-blue-400/60 to-transparent mb-2" />
                  <span className="text-[11px] text-blue-400 font-black uppercase tracking-[0.6em] drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] italic">平静 / 低沉 / CALM</span>
                </div>
                <div className="absolute left-32 top-1/2 -translate-y-1/2 flex items-center">
                  <span className="text-[11px] text-purple-400 font-black uppercase tracking-[0.6em] -rotate-90 origin-center translate-x-[-50%] drop-shadow-[0_0_10px_rgba(139,92,246,0.4)] italic">悲伤 / 阴暗 / DARK</span>
                  <div className="w-6 h-[1px] bg-gradient-to-l from-purple-400/60 to-transparent" />
                </div>
                <div className="absolute right-32 top-1/2 -translate-y-1/2 flex items-center">
                  <div className="w-6 h-[1px] bg-gradient-to-r from-green-400/60 to-transparent" />
                  <span className="text-[11px] text-green-400 font-black uppercase tracking-[0.6em] rotate-90 origin-center translate-x-[50%] drop-shadow-[0_0_10px_rgba(34,197,94,0.4)] italic">欢快 / 明亮 / BRIGHT</span>
                </div>

                {/* Vignette Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />

                {/* Quadrant Quick Selection Corners */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden p-12">
                  {[
                    { q: "Q1", label: "能量爆发", pos: "top-28 right-8", check: (p: any) => p.x >= 0 && p.y >= 0 },
                    { q: "Q2", label: "深沉情感", pos: "top-28 left-8", check: (p: any) => p.x < 0 && p.y >= 0 },
                    { q: "Q3", label: "宁静舒缓", pos: "bottom-28 left-8", check: (p: any) => p.x < 0 && p.y < 0 },
                    { q: "Q4", label: "轻快悦动", pos: "bottom-28 right-8", check: (p: any) => p.x >= 0 && p.y < 0 },
                  ].map((quad) => (
                    <div key={quad.q} className={`absolute ${quad.pos} z-30`}>
                      <button
                        onClick={() => {
                          const ids = points.filter(p => quad.check(p) && p.isTagged).map(p => p.id);
                          setSelectedIds(ids);
                        }}
                        className="flex items-center gap-3 pointer-events-auto px-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/10 transition-all group backdrop-blur-sm"
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: QUADRANT_META[quad.q].color }} />
                        <span className="text-[10px] font-black text-white/20 group-hover:text-white/60 transition-colors tracking-tight uppercase italic">{quad.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Indicator */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-40 left-1/2 -translate-x-1/2 z-40"
                  >
                    <span className="text-[10px] text-yellow-400 font-black px-4 py-2 bg-yellow-400/10 backdrop-blur-3xl rounded-full border border-yellow-400/20 tracking-[0.2em] uppercase shadow-2xl">
                      发现 {searchResults.length} 个匹配节点
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Progress Overlay */}
              <AnimatePresence>
                {taggingStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 w-[400px]"
                  >
                    <GlassCard className="p-6 border-indigo-500/30 bg-black/80 backdrop-blur-3xl shadow-[0_20px_50px_rgba(79,70,229,0.3)]">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <span className="text-[10px] text-white/60 font-black uppercase tracking-widest">AI 智能解析中</span>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-mono">{taggingStatus.current} / {taggingStatus.total}</span>
                      </div>
                      <div className="text-xs text-white font-black mb-4 truncate italic">“正在解构: {taggingStatus.currentTitle}”</div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${(taggingStatus.current / taggingStatus.total) * 100}%` }}
                        />
                      </div>
                      <div className="mt-5 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-white/20 uppercase tracking-tighter">数据已实时同步至本地持久化层</span>
                          {taggingStatus.isStopping && <span className="text-[8px] text-red-500 font-bold uppercase mt-1">正在强行终止...</span>}
                        </div>
                        <button 
                          onClick={() => stopTagging()}
                          className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-500 text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          终止任务
                        </button>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Interaction Bar - BOTTOM CENTER */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 pointer-events-auto">
                {/* Mode Selector */}
                <div className="flex items-center p-1 bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/5 shadow-2xl">
                  {[
                    { id: "matrix", label: "星图", active: viewMode === "matrix" },
                    { id: "heatmap", label: "热力", active: viewMode === "heatmap" }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setViewMode(mode.id as any)}
                      className={`px-4 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${
                        mode.active ? "bg-white text-black shadow-lg" : "text-white/20 hover:text-white/40"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* AI Auto-tag Button */}
                <button
                  onClick={async () => {
                    const idsToTag = selectedIds.length > 0 ? selectedIds : points.filter(p => !p.isTagged).map(p => p.id);
                    if (idsToTag.length === 0) return;
                    setIsAutoTagging(true);
                    await autoTagBatch(idsToTag);
                    setIsAutoTagging(false);
                  }}
                  disabled={isAutoTagging}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border transition-all shadow-xl font-black text-[10px] uppercase tracking-widest ${
                    isAutoTagging 
                    ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 animate-pulse cursor-wait" 
                    : "bg-black/60 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-400"
                  }`}
                >
                  <Sparkles size={14} className={isAutoTagging ? "animate-spin" : ""} />
                  {isAutoTagging ? "AI 深度分析中..." : selectedIds.length > 0 ? `AI 分析选中 (${selectedIds.length})` : "AI 智能补全"}
                </button>

                {!isAutoTagging && selectedIds.length === 0 && (
                   <button
                    onClick={async () => {
                      const allIds = points.map(p => p.id);
                      if (allIds.length === 0) return;
                      setIsAutoTagging(true);
                      await autoTagBatch(allIds);
                      setIsAutoTagging(false);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-white/5 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <Layers size={14} />
                    扫描全库
                  </button>
                )}

                <div className="h-8 w-[1px] bg-white/5 mx-0.5" />

                {/* Tool Selector */}
                <div className="flex items-center gap-1.5 p-1 bg-black/60 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl">
                  {[
                    { id: "marquee", icon: Layers, label: "矩形" },
                    { id: "lasso", icon: MousePointer2, label: "套索" },
                    { id: "brush", icon: Zap, label: "笔刷" }
                  ].map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => setSelectionMode(selectionMode === tool.id ? "none" : tool.id as any)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        selectionMode === tool.id ? "bg-white text-black shadow-lg" : "text-white/30 hover:bg-white/5"
                      }`}
                    >
                      <tool.icon size={16} />
                    </button>
                  ))}
                </div>

                 {selectedIds.length > 0 && (
                  <>
                    <div className="h-8 w-[1px] bg-white/5 mx-0.5" />
                    <button 
                      onClick={() => setShowSidebar(!showSidebar)}
                      className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center ${
                        showSidebar ? "bg-indigo-500 border-indigo-400 text-white shadow-lg" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"
                      }`}
                      title="分析面板"
                    >
                      <TrendingUp size={16} />
                    </button>
                    <button 
                      onClick={clearSelection}
                      className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white/20 hover:text-white rounded-xl border border-white/5 flex items-center justify-center transition-all active:scale-90"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={() => {
                        const sortedSongs = selectedIds.map(id => songs.find(s => s.id === id)).filter((s): s is any => !!s);
                        if (sortedSongs.length > 0) {
                          const { appendSongsAndPlay } = useAudioStore.getState();
                          appendSongsAndPlay(sortedSongs);
                        }
                      }}
                      className="h-11 px-6 bg-white text-black rounded-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] font-black italic tracking-tight uppercase text-xs group"
                    >
                      <Play size={16} fill="currentColor" className="group-hover:translate-x-0.5 transition-transform" />
                      触发共鸣 <span className="opacity-40 ml-1">({selectedIds.length})</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Docked Sidebar Panel */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 360, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="h-full bg-black/60 backdrop-blur-3xl border-l border-white/10 relative z-50 flex flex-col overflow-hidden shadow-[-40px_0_100px_rgba(0,0,0,0.8)]"
                >
                  <div className="absolute top-6 right-6 z-50">
                    <button onClick={() => setShowSidebar(false)} className="text-white/20 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-8 flex flex-col h-full">
                    {/* Sidebar Tabs */}
                    <div className="flex p-1 bg-white/[0.03] rounded-2xl mb-8 border border-white/5 shadow-inner">
                      {[
                        { key: "analytics" as const, label: "分析", icon: TrendingUp },
                        { key: "similar" as const, label: "推荐", icon: Sparkles },
                        { key: "tagged" as const, label: "列表", icon: Music2 },
                      ].map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setSidebarTab(tab.key)}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                            sidebarTab === tab.key ? "bg-white text-black shadow-lg scale-[1.02]" : "text-white/20 hover:text-white/50"
                          }`}
                        >
                          <tab.icon size={12} />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                      {sidebarTab === "analytics" && (
                        <div className="space-y-10">
                          <div className="space-y-5">
                            <span className="text-[11px] text-white/20 uppercase tracking-[0.4em] font-black flex items-center gap-2">
                              <div className="w-4 h-[1px] bg-white/10" /> 情绪维度实时解算
                            </span>
                            
                            {!isAutoTagging && points.filter(p => !p.isTagged).length > 0 && (
                              <button 
                                onClick={async () => {
                                  const untagged = points.filter(p => !p.isTagged).map(p => p.id);
                                  setIsAutoTagging(true);
                                  await autoTagBatch(untagged);
                                  setIsAutoTagging(false);
                                }}
                                className="w-full py-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-2xl flex flex-col items-center gap-1 group transition-all"
                              >
                                <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-widest">
                                  <Sparkles size={12} className="group-hover:rotate-12 transition-transform" />
                                  智能补全全库模型
                                </div>
                                <span className="text-[9px] text-white/20">共有 {points.filter(p => !p.isTagged).length} 首歌曲待打标</span>
                              </button>
                            )}
                            
                            <div className="grid grid-cols-1 gap-5">
                              <div className="p-6 bg-white/[0.03] rounded-[32px] border border-white/5 group hover:bg-white/[0.07] transition-all shadow-xl">
                                <div className="flex justify-between items-end mb-3">
                                  <span className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em]">能量震级 ENERGY</span>
                                  <div className="text-4xl font-black text-white italic tracking-tighter">{analytics.avgEnergy}%</div>
                                </div>
                                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden shadow-inner p-[1px]">
                                  <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${analytics.avgEnergy}%` }} 
                                    className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.6)] rounded-full" 
                                  />
                                </div>
                              </div>
                              <div className="p-6 bg-white/[0.03] rounded-[32px] border border-white/5 group hover:bg-white/[0.07] transition-all shadow-xl">
                                <div className="flex justify-between items-end mb-3">
                                  <span className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em]">愉悦偏置 VALENCE</span>
                                  <div className="text-4xl font-black text-white italic tracking-tighter">{analytics.avgValence}%</div>
                                </div>
                                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden shadow-inner p-[1px]">
                                  <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${analytics.avgValence}%` }} 
                                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 shadow-[0_0_15px_rgba(20,184,166,0.6)] rounded-full" 
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-8 bg-white/[0.01] rounded-[32px] border border-white/5 shadow-2xl">
                            <span className="text-[11px] text-white/20 uppercase tracking-[0.4em] font-black block mb-6">星图分布密度图</span>
                            <div className="space-y-5">
                              {Object.entries(QUADRANT_META).map(([q, meta]) => {
                                const count = (quadrantStats as any)[q.toLowerCase()] || 0;
                                const percent = Math.round((count / Math.max(1, points.length)) * 100);
                                return (
                                  <div key={q} className="flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="w-3 h-3 rounded-full shadow-[0_0_12px_currentColor]" style={{ color: meta.color, backgroundColor: meta.color }} />
                                        <span className="text-sm text-white/80 font-black tracking-tight uppercase italic">{meta.label}</span>
                                      </div>
                                      <span className="text-[11px] text-white/30 font-mono font-bold tracking-widest">{count} 样本</span>
                                    </div>
                                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden p-[1px]">
                                      <div className="h-full transition-all duration-1000 cubic-bezier(0.2, 0.8, 0.2, 1) rounded-full" style={{ width: `${percent}%`, backgroundColor: meta.color, opacity: 0.7, boxShadow: `0 0 10px ${meta.color}40` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="p-8 bg-indigo-600/10 rounded-[32px] border border-indigo-500/20 shadow-[0_20px_50px_rgba(79,70,229,0.15)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                              <Sparkles size={60} className="text-indigo-400" />
                            </div>
                            <div className="relative">
                              <div className="flex items-center gap-3 mb-3">
                                <Sparkles size={16} className="text-indigo-400" />
                                <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.5em]">主导氛围 DOMINANT MOOD</span>
                              </div>
                              <div className="text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-xl flex items-baseline gap-2">
                                {analytics.dominantQuadrant}
                                <span className="text-xs font-light text-white/20 not-italic uppercase tracking-widest">Selected</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {sidebarTab === "similar" && (
                        <div className="space-y-4 pb-24">
                          {selectedIds.length === 1 ? (
                            <>
                              <span className="text-[11px] text-white/20 uppercase tracking-[0.4em] font-black block mb-6">基于同质维度的情感延展</span>
                              {similarSongs.map((s, idx) => (
                                <motion.button
                                  initial={{ opacity: 0, y: 15 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.08, type: "spring", stiffness: 200 }}
                                  key={s.id}
                                  onClick={() => {
                                    const song = songs.find(ss => ss.id === s.id);
                                    if (song) useAudioStore.getState().appendSongsAndPlay([song]);
                                  }}
                                  className="w-full flex items-center gap-5 p-5 rounded-[28px] hover:bg-white/[0.05] transition-all text-left border border-white/0 hover:border-white/5 group shadow-lg"
                                >
                                  <div className="relative shrink-0">
                                    <img src={s.cover} alt="" className="w-14 h-14 rounded-[20px] object-cover border border-white/10 group-hover:scale-105 transition-transform shadow-2xl" />
                                    <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[20px] transition-opacity backdrop-blur-[2px]">
                                      <Play size={20} className="text-white fill-white drop-shadow-xl" />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white font-black truncate group-hover:text-indigo-400 transition-colors tracking-tight">{s.title}</div>
                                    <div className="text-[11px] text-white/30 truncate mt-1.5 font-bold tracking-wide uppercase">{s.artist}</div>
                                  </div>
                                </motion.button>
                              ))}
                            </>
                          ) : (
                            <div className="h-[65vh] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-[50px] bg-white/[0.01]">
                              <div className="w-24 h-24 rounded-[32px] bg-white/[0.03] flex items-center justify-center mb-8 shadow-2xl">
                                <Sparkles size={48} className="text-white/10" />
                              </div>
                              <span className="text-base text-white/30 font-black leading-relaxed tracking-tight uppercase italic">
                                锁定单点座标<br/><span className="text-xs font-light not-italic tracking-[0.2em]">探寻相似的情感共鸣</span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {sidebarTab === "tagged" && (
                        <div className="space-y-4 pb-24">
                           <span className="text-[11px] text-white/20 uppercase tracking-[0.4em] font-black block mb-6">已存证的星图样本 ({points.filter(p => p.isTagged).length})</span>
                           {points.filter(p => p.isTagged).map(p => (
                            <div
                              key={p.id}
                              onClick={() => setSelectedIds([p.id])}
                              className={`flex items-center gap-5 p-5 rounded-[28px] border transition-all cursor-pointer group shadow-xl ${
                                selectedIds.includes(p.id) ? "bg-white text-black scale-[1.02]" : "hover:bg-white/[0.05] border-white/0"
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full shrink-0 shadow-2xl transition-all ${selectedIds.includes(p.id) ? "scale-125 shadow-black/20" : "opacity-40"}`} style={{ backgroundColor: QUADRANT_META[getQuadrantLabel(p.x, p.y)].color }} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-black truncate tracking-tight ${selectedIds.includes(p.id) ? "text-black" : "text-white"}`}>{p.title}</div>
                                <div className={`text-[10px] font-black tracking-widest mt-1.5 uppercase ${selectedIds.includes(p.id) ? "text-black/30" : "text-white/10"}`}>
                                  VECTOR: {p.x.toFixed(3)} , {p.y.toFixed(3)}
                                </div>
                              </div>
                            </div>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

function getQuadrantLabel(x: number, y: number): string {
  if (x >= 0 && y >= 0) return "Q1";
  if (x < 0 && y >= 0) return "Q2";
  if (x < 0 && y < 0) return "Q3";
  return "Q4";
}

export default EmotionMatrixView;
