import React, { useEffect, useRef, useState, useCallback } from "react";
import { useEmotionStore } from "@/store/emotionStore";
import { useAudioStore } from "@/store/audioStore";

const SAFE_PADDING = 60;

const QUADRANT_COLORS = {
  Q1: { r: 249, g: 115, b: 22 },
  Q2: { r: 139, g: 92, b: 246 },
  Q3: { r: 59, g: 130, b: 246 },
  Q4: { r: 34, g: 197, b: 94 },
};

function getPixelPos(p: { x: number; y: number }, w: number, h: number) {
  const innerW = w - SAFE_PADDING * 2;
  const innerH = h - SAFE_PADDING * 2;
  return {
    x: SAFE_PADDING + (p.x * 0.5 + 0.5) * innerW,
    y: SAFE_PADDING + ((-p.y) * 0.5 + 0.5) * innerH,
  };
}

function getQuadrant(x: number, y: number): keyof typeof QUADRANT_COLORS {
  if (x >= 0 && y >= 0) return "Q1";
  if (x < 0 && y >= 0) return "Q2";
  if (x < 0 && y < 0) return "Q3";
  return "Q4";
}

function getPointColor(p: { x: number; y: number }, alpha: number) {
  const q = getQuadrant(p.x, p.y);
  const c = QUADRANT_COLORS[q];
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

const EmotionVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = useEmotionStore.getState();
    const { points, selectionMode, setSelectedIds, setIsDragging, setDragPointId } = state;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: any = null;
    let minD = 20;
    points.forEach(p => {
      const pos = getPixelPos(p, canvas.width, canvas.height);
      const d = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (d < minD) { minD = d; found = p; }
    });

    if (found && selectionMode === "none") {
      if (e.shiftKey) {
        setSelectedIds(prev =>
          prev.includes(found.id) ? prev.filter(id => id !== found.id) : [...prev, found.id]
        );
      } else {
        setSelectedIds([found.id]);
      }
      setIsDragging(true);
      setDragPointId(found.id);
      setIsDraggingPoint(true);
      isDrawingRef.current = false;
      return;
    }

    if (selectionMode === "none") {
      if (!found) setSelectedIds([]);
      return;
    }

    isDrawingRef.current = true;
    if (selectionMode === "lasso") state.setLassoPath([{ x, y }]);
    if (selectionMode === "marquee") state.setMarqueeRect({ x1: x, y1: y, x2: x, y2: y });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y };

    const state = useEmotionStore.getState();
    const { isDragging, dragPointId, saveSongEmotion, points, selectionMode, lassoPath, marqueeRect, brushRadius, selectedIds, setSelectedIds } = state;

    if (isDragging && dragPointId) {
      const innerW = canvas.width - SAFE_PADDING * 2;
      const innerH = canvas.height - SAFE_PADDING * 2;
      const normX = ((x - SAFE_PADDING) / innerW) * 2 - 1;
      const normY = -(((y - SAFE_PADDING) / innerH) * 2 - 1);
      const clampedX = Math.max(-1, Math.min(1, normX));
      const clampedY = Math.max(-1, Math.min(1, normY));
      saveSongEmotion(dragPointId, clampedX, clampedY);
      return;
    }

    if (!isDrawingRef.current) {
      let minD = 25;
      let near: any = null;
      points.forEach(p => {
        const pos = getPixelPos(p, canvas.width, canvas.height);
        const d = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (d < minD) { minD = d; near = p; }
      });
      setHoveredPoint(near);
      useEmotionStore.getState().setHoveredPointId(near?.id || null);
      canvas.style.cursor = near ? (selectionMode === "none" ? "grab" : "crosshair") : "crosshair";
      return;
    }

    if (selectionMode === "lasso") {
      useEmotionStore.getState().setLassoPath([...lassoPath, { x, y }]);
    } else if (selectionMode === "marquee" && marqueeRect) {
      useEmotionStore.getState().setMarqueeRect({ ...marqueeRect, x2: x, y2: y });
    } else if (selectionMode === "brush") {
      const nearIds = points.filter(p => {
        const pos = getPixelPos(p, canvas.width, canvas.height);
        const d = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        return d < brushRadius;
      }).map(p => p.id);
      const newSelection = Array.from(new Set([...selectedIds, ...nearIds]));
      if (newSelection.length !== selectedIds.length) setSelectedIds(newSelection);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    const state = useEmotionStore.getState();
    if (state.isDragging && state.dragPointId) {
      state.setIsDragging(false);
      state.setDragPointId(null);
      setIsDraggingPoint(false);
      if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
      return;
    }

    isDrawingRef.current = false;
    const { selectionMode, marqueeRect, lassoPath, points, setSelectedIds } = state;
    if (!canvasRef.current) return;
    const { width, height } = canvasRef.current;

    if (selectionMode === "lasso" && lassoPath.length >= 3) {
      const selected = points.filter(p => {
        const pos = getPixelPos(p, width, height);
        let inside = false;
        for (let i = 0, j = lassoPath.length - 1; i < lassoPath.length; j = i++) {
          if (((lassoPath[i].y > pos.y) !== (lassoPath[j].y > pos.y)) &&
            (pos.x < (lassoPath[j].x - lassoPath[i].x) * (pos.y - lassoPath[i].y) / (lassoPath[j].y - lassoPath[i].y) + lassoPath[i].x)) {
            inside = !inside;
          }
        }
        return inside;
      });
      setSelectedIds(selected.map(p => p.id));
      state.setLassoPath([]);
    } else if (selectionMode === "marquee" && marqueeRect) {
      const xMin = Math.min(marqueeRect.x1, marqueeRect.x2);
      const xMax = Math.max(marqueeRect.x1, marqueeRect.x2);
      const yMin = Math.min(marqueeRect.y1, marqueeRect.y2);
      const yMax = Math.max(marqueeRect.y1, marqueeRect.y2);
      const selected = points.filter(p => {
        const pos = getPixelPos(p, width, height);
        return pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax;
      });
      setSelectedIds(selected.map(p => p.id));
      state.setMarqueeRect(null);
    }
    
    // Clear path if it was a temporary selection
    if (selectionMode !== "none") {
       // Done
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas.parentElement!);
    handleResize();

    const draw = (time: number) => {
      const state = useEmotionStore.getState();
      const {
        points, viewMode, selectionMode,
        lassoPath, marqueeRect, selectedIds,
        brushRadius, searchResults, hoveredPointId
      } = state;
      const currentSongId = useAudioStore.getState().currentSong?.id;

      timeRef.current = time * 0.001;
      const t = timeRef.current;
      const { width, height } = canvas;

      ctx.clearRect(0, 0, width, height);

      // 0. Quadrant gradient backgrounds
      const cx = SAFE_PADDING + (width - SAFE_PADDING * 2) / 2;
      const cy = SAFE_PADDING + (height - SAFE_PADDING * 2) / 2;
      const halfW = (width - SAFE_PADDING * 2) / 2;
      const halfH = (height - SAFE_PADDING * 2) / 2;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // Nebula Effect - Dynamic and deep
      const drawNebula = (nx: number, ny: number, color: string, scale: number) => {
        const driftX = Math.cos(t * 0.1) * 20;
        const driftY = Math.sin(t * 0.15) * 20;
        const grad = ctx.createRadialGradient(nx + driftX, ny + driftY, 0, nx + driftX, ny + driftY, halfW * scale);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      };

      drawNebula(cx + halfW * 0.5, cy - halfH * 0.5, `rgba(249, 115, 22, ${0.08 + Math.sin(t * 0.2) * 0.02})`, 1.2);
      drawNebula(cx - halfW * 0.5, cy - halfH * 0.5, `rgba(139, 92, 246, ${0.08 + Math.sin(t * 0.25 + 1) * 0.02})`, 1.3);
      drawNebula(cx - halfW * 0.5, cy + halfH * 0.5, `rgba(59, 130, 246, ${0.08 + Math.sin(t * 0.22 + 2) * 0.02})`, 1.2);
      drawNebula(cx + halfW * 0.5, cy + halfH * 0.5, `rgba(34, 197, 94, ${0.08 + Math.sin(t * 0.28 + 3) * 0.02})`, 1.4);
      
      // Background Stars (Parallax)
      const starCount = 50;
      for (let i = 0; i < starCount; i++) {
        const sx = ((Math.sin(i * 1234.5) * 0.5 + 0.5) * width + Math.cos(t * 0.05) * 10) % width;
        const sy = ((Math.cos(i * 5678.9) * 0.5 + 0.5) * height + Math.sin(t * 0.03) * 10) % height;
        const size = (Math.sin(t + i) * 0.5 + 0.5) * 1.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.sin(t + i) * 0.1})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 1. Heatmap mode
      if (viewMode === "heatmap") {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        points.forEach(p => {
          if (!p.isTagged) return;
          const pos = getPixelPos(p, width, height);
          const pulse = Math.sin(t * 1.5 + p.x * 10) * 0.1 + 0.9;
          const gradSize = 120 * pulse;
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, gradSize);
          const q = getQuadrant(p.x, p.y);
          const c = QUADRANT_COLORS[q];
          grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0.25)`);
          grad.addColorStop(0.4, `rgba(${c.r}, ${c.g}, ${c.b}, 0.05)`);
          grad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(pos.x - gradSize, pos.y - gradSize, gradSize * 2, gradSize * 2);
        });
        ctx.restore();
      }

      // 2. Grid & HUD
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 0.8;
      const gridCount = 10;
      for (let i = 0; i <= gridCount; i++) {
        const ratio = i / gridCount;
        const gx = SAFE_PADDING + (width - SAFE_PADDING * 2) * ratio;
        const gy = SAFE_PADDING + (height - SAFE_PADDING * 2) * ratio;
        
        ctx.beginPath(); 
        ctx.moveTo(gx, SAFE_PADDING); 
        ctx.lineTo(gx, height - SAFE_PADDING); 
        ctx.stroke();
        
        ctx.beginPath(); 
        ctx.moveTo(SAFE_PADDING, gy); 
        ctx.lineTo(width - SAFE_PADDING, gy); 
        ctx.stroke();

        // Add small coordinate markers
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.font = "bold 8px Inter";
          ctx.fillText(((ratio * 2 - 1).toFixed(1)), gx - 5, height - SAFE_PADDING + 15);
          ctx.fillText(((-(ratio * 2 - 1)).toFixed(1)), SAFE_PADDING - 25, gy + 3);
        }
      }

      // Scanner Line
      const scannerY = (SAFE_PADDING + ((Math.sin(t * 0.5) * 0.5 + 0.5) * (height - SAFE_PADDING * 2)));
      const scannerGrad = ctx.createLinearGradient(0, scannerY - 2, 0, scannerY + 2);
      scannerGrad.addColorStop(0, "transparent");
      scannerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.15)");
      scannerGrad.addColorStop(1, "transparent");
      ctx.fillStyle = scannerGrad;
      ctx.fillRect(SAFE_PADDING, scannerY - 20, width - SAFE_PADDING * 2, 40);



      // 3. Draw points
      points.forEach(p => {
        const pos = getPixelPos(p, width, height);
        const isSelected = selectedIds.includes(p.id);
        const isHovered = hoveredPointId === p.id;
        const isPlaying = p.id === currentSongId;
        const isSearchMatch = searchResults.includes(p.id);

        if (p.isTagged || isSelected || isPlaying || isSearchMatch) {
          const pulse = Math.sin(t * 2.5 + (p.x + p.y) * 4) * 0.12 + 1.0;
          
          // --- Density-Aware Scaling ---
          const densityFactor = Math.max(0.4, 1 - (selectedIds.length / 80));
          const baseSize = isPlaying ? 6 : (isSelected ? 4.5 : 3);
          const finalSize = (isHovered ? baseSize * 1.4 : baseSize) * pulse;
          const glowMultiplier = (isSelected || isPlaying) ? (3.5 + 2.5 * densityFactor) : 3;
          const glowSize = finalSize * glowMultiplier;

          // Diffraction spikes for selected/playing/hovered
          const shouldDrawSpikes = isPlaying || isHovered || (isSelected && selectedIds.length < 15);
          if (shouldDrawSpikes) {
            ctx.save();
            ctx.translate(pos.x, pos.y);
            if (isPlaying) ctx.rotate(t * 0.5);
            else ctx.rotate(t * 0.2);
            
            const spikeOpacity = isPlaying ? 0.6 : (isSelected ? 0.3 * densityFactor : 0.2);
            const spikeColor = isPlaying ? `rgba(255, 255, 255, ${spikeOpacity})` :
              isSelected ? `rgba(255, 255, 255, ${spikeOpacity})` :
                getPointColor(p, spikeOpacity);
            
            ctx.strokeStyle = spikeColor;
            ctx.lineWidth = isPlaying ? 1.5 : 0.8;
            const spikeLen = finalSize * (isPlaying ? 4.5 : 3.5);
            ctx.beginPath();
            ctx.moveTo(-spikeLen, 0); ctx.lineTo(spikeLen, 0);
            ctx.moveTo(0, -spikeLen); ctx.lineTo(0, spikeLen);
            ctx.stroke();
            ctx.restore();
          }

          // Glow
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowSize);
          if (isPlaying) {
            const playPulse = Math.sin(t * 3) * 0.1 + 0.6;
            grad.addColorStop(0, `rgba(255, 255, 255, ${playPulse})`);
            grad.addColorStop(0.3, getPointColor(p, 0.4));
            grad.addColorStop(1, "transparent");
          } else if (isSelected) {
            grad.addColorStop(0, `rgba(255, 255, 255, ${0.7 * densityFactor})`);
            grad.addColorStop(0.3, getPointColor(p, 0.3 * densityFactor));
            grad.addColorStop(1, "transparent");
          } else {
            grad.addColorStop(0, getPointColor(p, 0.4));
            grad.addColorStop(1, "transparent");
          }
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2); ctx.fill();

          // Core
          ctx.fillStyle = (isPlaying || isSelected) ? "#fff" : getPointColor(p, 0.8);
          ctx.beginPath(); ctx.arc(pos.x, pos.y, finalSize, 0, Math.PI * 2); ctx.fill();

          // Playing ring
          if (isPlaying) {
            const ringRadius = finalSize + 8 + Math.sin(t * 4) * 3;
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(t * 4) * 0.15})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2); ctx.stroke();

            const ringRadius2 = finalSize + 14 + Math.sin(t * 3 + 1) * 4;
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + Math.sin(t * 3 + 1) * 0.08})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, ringRadius2, 0, Math.PI * 2); ctx.stroke();
          }

          // Hover ring
          if (isHovered && !isPlaying) {
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, finalSize + 3, 0, Math.PI * 2); ctx.stroke();
          }

          // Search match indicator
          if (isSearchMatch && !isSelected && !isPlaying) {
            ctx.strokeStyle = "rgba(250, 204, 21, 0.6)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.arc(pos.x, pos.y, finalSize + 5, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
          const untaggedSize = isHovered ? 3.5 : 1.5;
          const alpha = isHovered ? 0.5 : 0.1;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, untaggedSize, 0, Math.PI * 2); ctx.fill();
        }
      });

      // 4. Selection tools
      if (selectionMode === "lasso" && lassoPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
        lassoPath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fill();
        ctx.setLineDash([]);
      }

      if (selectionMode === "marquee" && marqueeRect) {
        const mx = Math.min(marqueeRect.x1, marqueeRect.x2);
        const my = Math.min(marqueeRect.y1, marqueeRect.y2);
        const mw = Math.abs(marqueeRect.x2 - marqueeRect.x1);
        const mh = Math.abs(marqueeRect.y2 - marqueeRect.y1);
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, mw, mh);
        const mGrad = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
        mGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
        mGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
        mGrad.addColorStop(1, "rgba(255, 255, 255, 0.15)");
        ctx.fillStyle = mGrad;
        ctx.fillRect(mx, my, mw, mh);
        ctx.restore();
      }

      if (selectionMode === "brush" && mousePosRef.current) {
        const { x: bx, y: by } = mousePosRef.current;
        ctx.beginPath();
        ctx.arc(bx, by, brushRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const bGrad = ctx.createRadialGradient(bx, by, 0, bx, by, brushRadius);
        bGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
        bGrad.addColorStop(1, "transparent");
        ctx.fillStyle = bGrad;
        ctx.fill();
        const scanY = by + Math.sin(t * 10) * brushRadius;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.moveTo(bx - brushRadius, scanY);
        ctx.lineTo(bx + brushRadius, scanY);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDrawingRef.current = false;
          setHoveredPoint(null);
          useEmotionStore.getState().setHoveredPointId(null);
          mousePosRef.current = null;
          if (useEmotionStore.getState().isDragging) {
            useEmotionStore.getState().setIsDragging(false);
            useEmotionStore.getState().setDragPointId(null);
            setIsDraggingPoint(false);
          }
        }}
        className="absolute inset-0 z-10"
        style={{ cursor: isDraggingPoint ? "grabbing" : "crosshair" }}
      />
      {hoveredPoint && !isDrawingRef.current && (
        <div
          className="absolute z-30 pointer-events-none p-2 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-3"
          style={{
            left: Math.min(
              getPixelPos(hoveredPoint, canvasRef.current?.width || 0, canvasRef.current?.height || 0).x + 20,
              (canvasRef.current?.width || 0) - 280
            ),
            top: Math.max(
              getPixelPos(hoveredPoint, canvasRef.current?.width || 0, canvasRef.current?.height || 0).y - 80,
              20
            ),
          }}
        >
          {hoveredPoint.cover ? (
            <img
              src={hoveredPoint.cover}
              alt={hoveredPoint.title}
              className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/10"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10"
              style={{ backgroundColor: getPointColor(hoveredPoint, 0.15) }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getPointColor(hoveredPoint, 0.8) }} />
            </div>
          )}
          <div className="pr-3 py-1">
            <div className="text-sm font-bold tracking-tight max-w-[200px] truncate">{hoveredPoint.title}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5 max-w-[200px] truncate">{hoveredPoint.artist}</div>
            
            {hoveredPoint.description && (
              <div className="mt-2 mb-1 py-1 px-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg max-w-[220px]">
                <div className="text-[10px] text-indigo-300 font-bold italic leading-tight">
                  “{hoveredPoint.description}”
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ backgroundColor: getPointColor(hoveredPoint, 0.2), color: getPointColor(hoveredPoint, 1) }}>
                {getQuadrant(hoveredPoint.x, hoveredPoint.y)}
              </span>
              <span className="text-[9px] text-white/30 font-mono">
                ({hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmotionVisualizer;
