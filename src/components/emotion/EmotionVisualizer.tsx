import React, { useEffect, useRef, useState } from "react";
import { useEmotionStore } from "@/store/emotionStore";

const EmotionVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Constants for safe rendering
  const SAFE_PADDING = 60;

  // Helper: Mapping with Safe Padding
  const getPixelPos = (p: {x: number, y: number}, w: number, h: number) => {
    const innerW = w - SAFE_PADDING * 2;
    const innerH = h - SAFE_PADDING * 2;
    return {
      x: SAFE_PADDING + (p.x * 0.5 + 0.5) * innerW,
      y: SAFE_PADDING + ((-p.y) * 0.5 + 0.5) * innerH
    };
  };

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
      // Get the LATEST state from store without triggering re-renders
      const state = useEmotionStore.getState();
      const { 
        points, 
        viewMode, 
        isLassoActive, 
        isCurveActive, 
        lassoPath, 
        curvePath, 
        selectedIds 
      } = state;

      timeRef.current = time * 0.001;
      const t = timeRef.current;
      const { width, height } = canvas;
      
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Heatmap Cloud
      if (viewMode === "heatmap") {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        points.forEach(p => {
          if (!p.isTagged) return;
          const pos = getPixelPos(p, width, height);
          const pulse = Math.sin(t * 1.5 + p.x * 10) * 0.1 + 0.9;
          const gradSize = 100 * pulse;
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, gradSize);
          grad.addColorStop(0, "rgba(236, 72, 153, 0.2)");
          grad.addColorStop(1, "rgba(236, 72, 153, 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(pos.x - gradSize, pos.y - gradSize, gradSize * 2, gradSize * 2);
        });
        ctx.restore();
      }

      // 2. Subtle Star Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      const gridCount = 10;
      for (let i = 0; i <= gridCount; i++) {
        const x = (width / gridCount) * i;
        const y = (height / gridCount) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // 3. Draw Stars
      points.forEach(p => {
        const pos = getPixelPos(p, width, height);
        const isSelected = selectedIds.includes(p.id);
        // We use a local ref for hovered state check to avoid re-renders if possible,
        // but for now, we'll just check the store state if needed.
        const isHovered = (window as any).__vibe_hovered_id === p.id;
        
        if (p.isTagged || isSelected) {
          const pulse = Math.sin(t * 2.5 + (p.x + p.y) * 4) * 0.12 + 1.0;
          const baseSize = isSelected ? 5.5 : 3.5;
          const finalSize = (isHovered ? baseSize * 1.4 : baseSize) * pulse;
          const glowSize = finalSize * 4;

          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowSize);
          if (isSelected) {
            grad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
            grad.addColorStop(1, "transparent");
          } else {
            grad.addColorStop(0, "rgba(236, 72, 153, 0.55)");
            grad.addColorStop(1, "transparent");
          }
          
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2); ctx.fill();
          
          ctx.fillStyle = isSelected ? "#fff" : "#ec4899";
          ctx.beginPath(); ctx.arc(pos.x, pos.y, finalSize, 0, Math.PI * 2); ctx.fill();
          if (isHovered) {
             ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
          }
        } else {
          const untaggedSize = isHovered ? 3 : 1.8;
          ctx.fillStyle = isHovered ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.1)";
          ctx.beginPath(); ctx.arc(pos.x, pos.y, untaggedSize, 0, Math.PI * 2); ctx.fill();
        }
      });

      // 4. Tools (Drawing logic remains same but now decoupled)
      if (isLassoActive && lassoPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
        lassoPath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
        ctx.fill();
        ctx.setLineDash([]);
      }

      if (isCurveActive && curvePath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(curvePath[0].x, curvePath[0].y);
        for (let i = 1; i < curvePath.length - 2; i++) {
          const xc = (curvePath[i].x + curvePath[i + 1].x) / 2;
          const yc = (curvePath[i].y + curvePath[i + 1].y) / 2;
          ctx.quadraticCurveTo(curvePath[i].x, curvePath[i].y, xc, yc);
        }
        ctx.strokeStyle = "#ff2d95";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animationRef.current);
    };
  }, []); // EMPTY DEPENDENCIES - Loop runs forever!

  // We still use some state for mouse events, but they don't restart the loop
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const { isLassoActive, isCurveActive, setLassoPath, setCurvePath } = useEmotionStore.getState();
    if (!isLassoActive && !isCurveActive) return;
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (isLassoActive) setLassoPath([{ x, y }]);
    if (isCurveActive) setCurvePath([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { points, isLassoActive, isCurveActive, lassoPath, curvePath, setLassoPath, setCurvePath } = useEmotionStore.getState();

    if (!isDrawing) {
      let minD = 30;
      let near = null;
      points.forEach(p => {
        const pos = getPixelPos(p, canvas.width, canvas.height);
        const d = Math.sqrt((x - pos.x)**2 + (y - pos.y)**2);
        if (d < minD) { minD = d; near = p; }
      });
      setHoveredPoint(near);
      (window as any).__vibe_hovered_id = near?.id || null;
    } else {
      if (isLassoActive) setLassoPath([...lassoPath, { x, y }]);
      else if (isCurveActive) setCurvePath([...curvePath, { x, y }]);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    const { isLassoActive, lassoPath, points, setSelectedIds } = useEmotionStore.getState();
    if (!canvasRef.current || !isLassoActive) return;
    const { width, height } = canvasRef.current;
    if (lassoPath.length < 3) return;

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
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDrawing(false); setHoveredPoint(null); (window as any).__vibe_hovered_id = null; }}
        className="absolute inset-0 z-10 cursor-crosshair"
      />
      {hoveredPoint && !isDrawing && (
        <div 
          className="absolute z-30 pointer-events-none px-4 py-2 bg-black/85 backdrop-blur-xl rounded-xl border border-white/20 text-white shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all"
          style={{ 
            left: Math.min(getPixelPos(hoveredPoint, canvasRef.current?.width || 0, canvasRef.current?.height || 0).x + 20, (canvasRef.current?.width || 0) - 150),
            top: Math.max(getPixelPos(hoveredPoint, canvasRef.current?.width || 0, canvasRef.current?.height || 0).y - 60, 20)
          }}
        >
          <div className="text-sm font-black tracking-tight">{hoveredPoint.title}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">{hoveredPoint.artist}</div>
        </div>
      )}
    </>
  );
};

export default EmotionVisualizer;
