import React, { useEffect, useRef, useState } from "react";
import { useEmotionStore } from "@/store/emotionStore";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { Music2 } from "lucide-react";
import { motion } from "framer-motion";

const SAFE_PADDING = 80;

const getPointColor = (v: number, e: number, alpha: number = 1) => {
  // Continuous HSL color mapping based on Russell Circumplex Model
  // Angle determines Hue, Magnitude determines Saturation/Lightness

  // Calculate angle in degrees (0 to 360)
  // atan2(y, x) -> atan2(energy, valence)
  let angle = Math.atan2(e, v) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  // Magnitude (distance from center)
  const mag = Math.sqrt(v * v + e * e);
  const clampedMag = Math.min(1, mag);

  // Hue mapping:
  // 0 deg (Right, v+) -> Hue 45 (Yellow/Orange - Happy)
  // 90 deg (Top, e+) -> Hue 0 (Red - Energetic/Passionate)
  // 180 deg (Left, v-) -> Hue 240 (Blue - Sad/Melancholy)
  // 270 deg (Bottom, e-) -> Hue 140 (Green/Teal - Calm/Peaceful)

  // Linear interpolation of hue between primary emotion points
  let hue = 0;
  if (angle <= 90) {
    // Q1: Happy/Energetic
    hue = 45 - (angle / 90) * 45; // 45 down to 0
  } else if (angle <= 180) {
    // Q2: Angry/Tense
    hue = 360 - ((angle - 90) / 90) * 120; // 360 down to 240
  } else if (angle <= 270) {
    // Q3: Sad/Calm
    hue = 240 - ((angle - 180) / 90) * 100; // 240 down to 140
  } else {
    // Q4: Peaceful/Happy
    hue = 140 - ((angle - 270) / 90) * 95; // 140 down to 45
  }

  // Saturation increases with magnitude
  const saturation = 40 + clampedMag * 50;
  // Lightness: brighter for high valence, darker for low valence
  const lightness = 45 + v * 15;

  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
};

const EmotionVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stardustRef = useRef<{ x: number; y: number; size: number; speed: number }[]>([]);

  // Initialize stardust once
  useEffect(() => {
    stardustRef.current = Array.from({ length: 150 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.01 + 0.005,
    }));
  }, []);

  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const { audioPlaySong, currentSong: audioCurrentSong } = useAudioStore();
  const { songs } = usePlaylistStore();
  const { points, selectedIds, searchResults } = useEmotionStore();

  const getPixelPos = (p: { x: number; y: number }, w: number, h: number) => {
    const innerW = w - SAFE_PADDING * 2;
    const innerH = h - SAFE_PADDING * 2;
    return {
      x: SAFE_PADDING + (p.x * 0.5 + 0.5) * innerW,
      y: SAFE_PADDING + (-p.y * 0.5 + 0.5) * innerH,
    };
  };

  const canvasToWorld = (cx: number, cy: number, w: number, h: number) => {
    const innerW = w - SAFE_PADDING * 2;
    const innerH = h - SAFE_PADDING * 2;
    const wx = ((cx - SAFE_PADDING) / innerW - 0.5) * 2;
    const wy = -(((cy - SAFE_PADDING) / innerH - 0.5) * 2);
    return { x: wx, y: wy };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    const ro = new ResizeObserver(handleResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    handleResize();

    const draw = (time: number) => {
      const state = useEmotionStore.getState();
      const {
        points,
        viewMode,
        selectionMode,
        lassoPath,
        marqueeRect,
        selectedIds,
        searchResults,
        hoveredPointId,
      } = state;

      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      timeRef.current = time * 0.001;
      const t = timeRef.current;

      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, width, height);

      // 0. Atmospheric Quadrant Glows (Moved from CSS to Canvas for smoother blending)
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const drawQuadrantGlow = (cx: number, cy: number, color: string) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.8);
        g.addColorStop(0, color);
        g.addColorStop(0.6, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      };

      drawQuadrantGlow(width * 0.75, height * 0.25, "rgba(234, 179, 8, 0.03)"); // Q1
      drawQuadrantGlow(width * 0.25, height * 0.25, "rgba(239, 68, 68, 0.03)"); // Q2
      drawQuadrantGlow(width * 0.25, height * 0.75, "rgba(59, 130, 246, 0.03)"); // Q3
      drawQuadrantGlow(width * 0.75, height * 0.75, "rgba(16, 185, 129, 0.03)"); // Q4

      ctx.restore();

      // 1. Stardust Background - Hide in heatmap for maximum purity
      if (viewMode !== "heatmap") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        stardustRef.current.forEach((star) => {
          const sx = ((star.x + t * star.speed) % 1) * width;
          const sy = ((star.y + t * star.speed * 0.5) % 1) * height;
          ctx.beginPath();
          ctx.arc(sx, sy, star.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 2. Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2, 40);
      ctx.lineTo(width / 2, height - 40);
      ctx.moveTo(40, height / 2);
      ctx.lineTo(width - 40, height / 2);
      ctx.stroke();

      // 3. Heatmap (Nebula Effect) - REFINED SILK & SMOKE
      if (viewMode === "heatmap") {
        ctx.save();
        ctx.globalCompositeOperation = "screen";

        points.forEach((p) => {
          if (!p.isTagged) return;
          const pos = getPixelPos(p, width, height);

          // Ultra-slow atmospheric drift
          const seed = (p.x + p.y) * 100;
          const driftX = Math.sin(t * 0.3 + seed) * 15;
          const driftY = Math.cos(t * 0.2 + seed) * 15;

          const gradSize = 220; // Much wider for smoother blending

          const grad = ctx.createRadialGradient(
            pos.x + driftX,
            pos.y + driftY,
            0,
            pos.x + driftX,
            pos.y + driftY,
            gradSize
          );

          // Very low alpha steps for silk-like texture
          grad.addColorStop(0, getPointColor(p.x, p.y, 0.03));
          grad.addColorStop(0.4, getPointColor(p.x, p.y, 0.01));
          grad.addColorStop(1, "transparent");

          ctx.fillStyle = grad;
          ctx.fillRect(
            pos.x + driftX - gradSize,
            pos.y + driftY - gradSize,
            gradSize * 2,
            gradSize * 2
          );
        });

        ctx.restore();
      }

      // 4. Constellations (Connections between selected points)
      if (selectedIds.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 0.5;
        const selectedPoints = points.filter((p) => selectedIds.includes(p.id));
        for (let i = 0; i < selectedPoints.length; i++) {
          for (let j = i + 1; j < selectedPoints.length; j++) {
            const p1 = getPixelPos(selectedPoints[i], width, height);
            const p2 = getPixelPos(selectedPoints[j], width, height);
            const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
            if (dist < 200) {
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
            }
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // 3. Draw Stars
      points.forEach((p) => {
        const rawPos = getPixelPos(p, width, height);

        // Quantum Jitter: Deterministic micro-shift based on ID to prevent "piling"
        // This makes the map look more organic without changing the data
        const idSeed = p.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
        const jitterX = Math.sin(idSeed * 1.23) * 3;
        const jitterY = Math.cos(idSeed * 4.56) * 3;
        const pos = { x: rawPos.x + jitterX, y: rawPos.y + jitterY };

        const isSelected = selectedIds.includes(p.id);
        const isHovered = hoveredPointId === p.id;
        const isCurrent = audioCurrentSong?.id === p.id;
        const isSearchResult = searchResults.includes(p.id);
        const color = getPointColor(p.x, p.y);

        if (p.isTagged || isSelected || isSearchResult) {
          const pulse = Math.sin(t * 3 + (p.x + p.y) * 2) * 0.1 + 0.9;
          let radius = isCurrent ? 6 : isSelected ? 5 : 3;
          if (isHovered) radius *= 1.4;
          if (isSearchResult) radius = 8;

          const finalRadius = radius * (isCurrent ? pulse * 1.2 : 1.0);

          // Glow
          ctx.beginPath();
          const glowRadius = finalRadius * (isSelected ? 6 : 4);
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowRadius);
          if (isSearchResult) {
            grad.addColorStop(0, "rgba(251, 191, 36, 0.4)");
          } else if (isSelected) {
            grad.addColorStop(0, getPointColor(p.x, p.y, 0.4));
          } else {
            grad.addColorStop(0, getPointColor(p.x, p.y, 0.13));
          }
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          // Selection Rings
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, finalRadius + 5 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Core
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, finalRadius, 0, Math.PI * 2);

          if (isSearchResult) {
            ctx.fillStyle = "#fbbf24";
          } else if (isSelected) {
            ctx.fillStyle = "#fff";
          } else if (isHovered) {
            ctx.fillStyle = "#fff";
          } else if (isCurrent) {
            ctx.fillStyle = "#fff";
          } else {
            ctx.fillStyle = color;
          }
          ctx.fill();

          // Premium Outer Glow for Selection
          if (isSelected || isCurrent) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, finalRadius + 8 + Math.sin(t * 2) * 3, 0, Math.PI * 2);
            ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.4)" : color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (isSelected) {
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, finalRadius + 12 + Math.sin(t * 3) * 4, 0, Math.PI * 2);
              ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
              ctx.stroke();
            }
          }
        } else {
          // Untagged
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = isHovered ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.08)";
          ctx.fill();
        }
      });

      // 4. Tools Visuals
      if (selectionMode === "lasso" && lassoPath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
        lassoPath.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fill();
        ctx.setLineDash([]);
      }

      if (selectionMode === "marquee" && marqueeRect) {
        const { x1, y1, x2, y2 } = marqueeRect;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.setLineDash([]);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioCurrentSong]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const { selectionMode, setLassoPath, setMarqueeRect, clearSelection } =
      useEmotionStore.getState();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDraggingRef.current = true;
    startPosRef.current = { x, y };

    if (selectionMode === "lasso") setLassoPath([{ x, y }]);
    else if (selectionMode === "marquee") setMarqueeRect({ x1: x, y1: y, x2: x, y2: y });
    else if (selectionMode === "none" && !hoveredPoint) clearSelection();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const {
      points,
      selectionMode,
      lassoPath,
      setLassoPath,
      setMarqueeRect,
      setHoveredPointId,
      brushRadius,
      setSelectedIds,
    } = useEmotionStore.getState();

    if (isDraggingRef.current) {
      if (selectionMode === "lasso") {
        setLassoPath([...lassoPath, { x, y }]);
      } else if (selectionMode === "marquee") {
        setMarqueeRect({ x1: startPosRef.current.x, y1: startPosRef.current.y, x2: x, y2: y });
      } else if (selectionMode === "brush") {
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;
        const worldPos = canvasToWorld(x, y, width, height);
        const radiusInWorld = (brushRadius / (width - SAFE_PADDING * 2)) * 2;

        const newSelected = points
          .filter((p) => {
            const dist = Math.sqrt((p.x - worldPos.x) ** 2 + (p.y - worldPos.y) ** 2);
            return dist < radiusInWorld;
          })
          .map((p) => p.id);

        setSelectedIds((prev) =>
          Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...newSelected]))
        );
      }
    } else {
      // Hover detection
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      let minD = 20;
      let near = null;
      points.forEach((p) => {
        const pos = getPixelPos(p, width, height);
        const d = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (d < minD) {
          minD = d;
          near = p;
        }
      });
      setHoveredPoint(near);
      setHoveredPointId(near?.id || null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    const {
      selectionMode,
      marqueeRect,
      lassoPath,
      points,
      setSelectedIds,
      setMarqueeRect,
      setLassoPath,
    } = useEmotionStore.getState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;

    if (selectionMode === "marquee" && marqueeRect) {
      const xMin = Math.min(marqueeRect.x1, marqueeRect.x2);
      const xMax = Math.max(marqueeRect.x1, marqueeRect.x2);
      const yMin = Math.min(marqueeRect.y1, marqueeRect.y2);
      const yMax = Math.max(marqueeRect.y1, marqueeRect.y2);

      const ids = points
        .filter((p) => {
          const pos = getPixelPos(p, width, height);
          return pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax;
        })
        .map((p) => p.id);
      setSelectedIds(ids);
      setMarqueeRect(null);
    } else if (selectionMode === "lasso" && lassoPath.length > 2) {
      const ids = points
        .filter((p) => {
          const pos = getPixelPos(p, width, height);
          let inside = false;
          for (let i = 0, j = lassoPath.length - 1; i < lassoPath.length; j = i++) {
            if (
              lassoPath[i].y > pos.y !== lassoPath[j].y > pos.y &&
              pos.x <
                ((lassoPath[j].x - lassoPath[i].x) * (pos.y - lassoPath[i].y)) /
                  (lassoPath[j].y - lassoPath[i].y) +
                  lassoPath[i].x
            ) {
              inside = !inside;
            }
          }
          return inside;
        })
        .map((p) => p.id);
      setSelectedIds(ids);
      setLassoPath([]);
    } else if (selectionMode === "none" && hoveredPoint) {
      const song = songs.find((s) => s.id === hoveredPoint.id);
      if (song) audioPlaySong(song);
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDraggingRef.current = false;
          setHoveredPoint(null);
          useEmotionStore.getState().setHoveredPointId(null);
        }}
        className="w-full h-full cursor-crosshair"
      />
      {hoveredPoint && !isDraggingRef.current && (
        <div
          className="absolute z-[100] pointer-events-none px-6 py-4 bg-black/80 backdrop-blur-3xl rounded-[32px] border border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all min-w-[240px]"
          style={{
            left: Math.min(
              getPixelPos(
                hoveredPoint,
                canvasRef.current?.width ? canvasRef.current.width / window.devicePixelRatio : 0,
                canvasRef.current?.height ? canvasRef.current.height / window.devicePixelRatio : 0
              ).x + 30,
              (canvasRef.current?.clientWidth || 0) - 260
            ),
            top: Math.max(
              getPixelPos(
                hoveredPoint,
                canvasRef.current?.width ? canvasRef.current.width / window.devicePixelRatio : 0,
                canvasRef.current?.height ? canvasRef.current.height / window.devicePixelRatio : 0
              ).y - 120,
              20
            ),
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {hoveredPoint.cover ? (
                <img
                  src={hoveredPoint.cover}
                  className="w-12 h-12 rounded-2xl shadow-2xl object-cover border border-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                  <Music2 size={20} className="text-white/20" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-black tracking-tight truncate leading-tight">
                  {hoveredPoint.title}
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-[0.2em] truncate mt-1 font-bold">
                  {hoveredPoint.artist}
                </div>
              </div>
            </div>

            {hoveredPoint.description && (
              <div className="pt-3 border-t border-white/5">
                <div className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em] mb-2 opacity-50">
                  情绪意境 archeology
                </div>
                <div className="text-[11px] text-white/70 italic leading-relaxed font-medium">
                  "{hoveredPoint.description}"
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-1">
              <div className="px-2 py-1 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: getPointColor(hoveredPoint.x, hoveredPoint.y) }}
                />
                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                  {hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedIds.length === 1 &&
        !hoveredPoint &&
        !isDraggingRef.current &&
        (() => {
          const p = points.find((p) => p.id === selectedIds[0]);
          if (!p || !p.description) return null;
          return (
            <motion.div
              initial={{ opacity: 0, x: -20, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              className="absolute bottom-24 left-10 z-[90] pointer-events-none w-[320px] bg-black/60 backdrop-blur-3xl rounded-[32px] border border-white/10 p-8 shadow-2xl overflow-hidden"
            >
              {/* Tactical Accents */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-[32px]" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-indigo-500/30 rounded-br-[32px]" />

              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_#6366f1]" />
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.4em]">
                      深度意境解构 ANALYSIS
                    </span>
                  </div>
                  <span className="text-[10px] text-white/20 font-mono">
                    #{p.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                    className="text-sm text-white/90 font-medium italic leading-relaxed tracking-tight"
                  >
                    "{p.description}"
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <div className="text-[9px] text-white/20 uppercase font-black tracking-widest mb-1">
                        坐标 VECTOR
                      </div>
                      <div className="text-xs font-mono text-indigo-400/80">
                        {p.x.toFixed(3)}, {p.y.toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/20 uppercase font-black tracking-widest mb-1">
                        维度 DOMAIN
                      </div>
                      <div className="text-xs font-mono text-emerald-400/80">
                        {p.x >= 0 ? "BRIGHT" : "DARK"} / {p.y >= 0 ? "ENERGY" : "CALM"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
    </div>
  );
};

export default EmotionVisualizer;
