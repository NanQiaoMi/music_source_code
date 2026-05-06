import React, { useEffect, useRef, useState } from 'react';
import { usePlaylistStore } from '../../store/playlistStore';
import { useEmotionStore } from '../../store/emotionStore';
import { Music } from 'lucide-react';

const SAFE_PADDING = 100;

// 辅助函数：根据坐标获取颜色
const getPointColor = (x: number, y: number) => {
  if (x >= 0 && y >= 0) return '#22c55e'; // Q1: 欢快
  if (x < 0 && y >= 0) return '#8b5cf6'; // Q2: 深沉
  if (x < 0 && y < 0) return '#3b82f6'; // Q3: 宁静
  return '#f97316'; // Q4: 轻快
};

const EmotionVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { points, hoveredPointId, setHoveredPointId, searchResults } = useEmotionStore();
  const { currentSong: audioCurrentSong, playSong: audioPlaySong } = useAudioStore();
  const { playSong: playlistPlaySong, selectedIds } = usePlaylistStore();

  const handleCanvasClick = () => {
    if (hoveredPoint) {
      audioPlaySong(hoveredPoint);
    }
  };

  return (
    <div className="relative w-full h-full group cursor-crosshair">
      <canvas
        ref={canvasRef}
        width={1000}
        height={1000}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
      />
      
      {hoveredPoint && (
        <div
          className="absolute z-30 pointer-events-none p-3 bg-black/90 backdrop-blur-3xl rounded-2xl border border-white/10 text-white shadow-2xl flex items-center gap-4 transition-all duration-200"
          style={{
            left: Math.min(
              ((SAFE_PADDING + ((currentPositionsRef.current[hoveredPoint.id]?.x || hoveredPoint.x) * 0.5 + 0.5) * (canvasRef.current!.width - SAFE_PADDING*2)) / 1000 * (canvasRef.current!.clientWidth)) + 20,
              (canvasRef.current!.clientWidth) - 250
            ),
            top: Math.max(
              ((SAFE_PADDING + ((-(currentPositionsRef.current[hoveredPoint.id]?.y || hoveredPoint.y)) * 0.5 + 0.5) * (canvasRef.current!.height - SAFE_PADDING*2)) / 1000 * (canvasRef.current!.clientHeight)) - 60,
              20
            ),
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
             {hoveredPoint.cover ? <img src={hoveredPoint.cover} className="w-full h-full object-cover" /> : <Music size={20} className="text-white/20" />}
          </div>
          <div>
            <div className="text-sm font-black truncate max-w-[160px] tracking-tight">{hoveredPoint.title}</div>
            <div className="text-[10px] text-white/40 truncate max-w-[160px] font-medium">{hoveredPoint.artist}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getPointColor(hoveredPoint.x, hoveredPoint.y) }} />
              <span className="text-[9px] text-white/20 font-mono">{(hoveredPoint.x ?? 0).toFixed(2)}, {(hoveredPoint.y ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmotionVisualizer;
