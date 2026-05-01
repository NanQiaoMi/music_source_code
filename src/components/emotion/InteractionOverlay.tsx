import React, { useRef, useEffect, useState } from "react";
import { useEmotionStore } from "@/store/emotionStore";

const InteractionOverlay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    isLassoActive, 
    isCurveActive, 
    points, 
    setSelectedIds,
    lassoPath,
    setLassoPath,
    curvePath,
    setCurvePath
  } = useEmotionStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  // Project normalized p.x, p.y to screen pixels (2D Ortho Model)
  const projectPoint = (p: {x: number, y: number}, width: number, height: number) => {
    const aspect = width / height;
    // Simple Linear Mapping for Orthographic Camera
    const px = (p.x / aspect * 0.5 + 0.5) * width;
    const py = (1.0 - (p.y * 0.5 + 0.5)) * height; 
    return { x: px, y: py };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
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

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas;

      // Draw Lasso
      if (isLassoActive && lassoPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
        lassoPath.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = "rgba(100, 220, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.fillStyle = "rgba(100, 220, 255, 0.15)";
        ctx.fill();
        ctx.setLineDash([]);
      }

      // Draw Curve
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
        ctx.lineCap = "round";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(255, 45, 149, 0.5)";
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw Hover Indicator
      if (hoveredPoint && !isDrawing) {
        const pos = projectPoint(hoveredPoint, width, height);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    const animFrame = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animFrame);
    };
  }, [isLassoActive, isCurveActive, lassoPath, curvePath, hoveredPoint]);

  const handleMouseDown = (e: React.MouseEvent) => {
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

    if (!isDrawing) {
      let minDistance = 25;
      let nearest = null;
      points.forEach((p) => {
        const pos = projectPoint(p, canvas.width, canvas.height);
        const dist = Math.sqrt((x - pos.x)**2 + (y - pos.y)**2);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = p;
        }
      });
      setHoveredPoint(nearest);
    }

    if (!isDrawing) return;
    if (isLassoActive) setLassoPath([...lassoPath, { x, y }]);
    else if (isCurveActive) setCurvePath([...curvePath, { x, y }]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isLassoActive && lassoPath.length > 2) {
      const selected = points.filter((p) => {
        const pos = projectPoint(p, canvas.width, canvas.height);
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
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDrawing(false); setHoveredPoint(null); }}
        className="absolute inset-0 z-20 cursor-crosshair bg-transparent"
      />
      {hoveredPoint && (
        <div 
          className="absolute z-30 pointer-events-none px-4 py-2 bg-black/85 backdrop-blur-xl rounded-xl border border-white/20 text-white shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all"
          style={{ 
            left: projectPoint(hoveredPoint, canvasRef.current?.width || 0, canvasRef.current?.height || 0).x + 20,
            top: projectPoint(hoveredPoint, canvasRef.current?.width || 0, canvasRef.current?.height || 0).y - 45
          }}
        >
          <div className="text-sm font-black tracking-tight">{hoveredPoint.title}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">{hoveredPoint.artist}</div>
        </div>
      )}
    </>
  );
};

export default InteractionOverlay;
