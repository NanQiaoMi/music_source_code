"use client";

import React, { useEffect, useRef, useCallback } from "react";
import * as fabric from "fabric";
import { usePosterV2Store } from "@/store/posterV2Store";
import { Song } from "@/types/song";

interface FabricCanvasProps {
  song: Song;
  exportTrigger: number;
  copyTrigger: number;
  onExportComplete: (dataUrl: string, isCopy: boolean) => void;
}

export default function FabricCanvas({
  song,
  exportTrigger,
  copyTrigger,
  onExportComplete,
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  // Store refs to specific objects for easy updating
  const objectsRef = useRef<{
    cover?: fabric.Image;
    title?: fabric.IText;
    artist?: fabric.IText;
    lyrics?: fabric.IText;
    qr?: fabric.Image;
    brand?: fabric.IText;
  }>({});

  const aspectRatio = usePosterV2Store((state) => state.aspectRatio);
  const primaryColor = usePosterV2Store((state) => state.primaryColor);
  const lyricColor = usePosterV2Store((state) => state.lyricColor);
  const lyricAlignment = usePosterV2Store((state) => state.lyricAlignment);
  const lineSpacing = usePosterV2Store((state) => state.lineSpacing);
  const lyricFont = usePosterV2Store((state) => state.lyricFont);
  const coverTransform = usePosterV2Store((state) => state.coverTransform);
  const titleTransform = usePosterV2Store((state) => state.titleTransform);
  const artistTransform = usePosterV2Store((state) => state.artistTransform);

  // We use this flag to prevent infinite loops when Canvas -> Store -> Canvas
  const isUpdatingFromCanvas = useRef(false);

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Cleanup previous instance
    if (fabricRef.current) {
      fabricRef.current.dispose();
    }

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 600,
      height: 600 / aspectRatio, // e.g. 600 / (9/16) = 1066.66
      backgroundColor: primaryColor,
      preserveObjectStacking: true,
      selection: true, // Allow multiple selection
    });

    fabricRef.current = canvas;

    // Load initial assets
    const initCanvas = async () => {
      try {
        // 1. Load Cover Image
        const coverImg = await fabric.Image.fromURL(song.cover || "/default-cover.png", {
          crossOrigin: "anonymous",
        });
        // Scale to fit nicely
        const scale = 300 / (coverImg.width || 300);
        coverImg.set({
          left: 150,
          top: 150,
          scaleX: scale,
          scaleY: scale,
          cornerStyle: "circle",
          borderColor: "#fa2d48",
          cornerColor: "#ffffff",
          transparentCorners: false,
        });
        // Mock corner radius (Fabric doesn't natively do CSS border-radius on images easily without clipPath)
        // We'll add clipPath logic later in a refined version, for now just basic image.

        objectsRef.current.cover = coverImg;
        canvas.add(coverImg);

        // 2. Title Text
        const titleText = new fabric.IText(song.title, {
          left: 150,
          top: 500,
          fontFamily: "sans-serif",
          fontSize: 32,
          fill: "#ffffff",
          fontWeight: "bold",
          shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.5)", blur: 10 }),
        });
        objectsRef.current.title = titleText;
        canvas.add(titleText);

        // 3. Artist Text
        const artistText = new fabric.IText(song.artist, {
          left: 150,
          top: 550,
          fontFamily: "sans-serif",
          fontSize: 20,
          fill: "rgba(255,255,255,0.7)",
        });
        objectsRef.current.artist = artistText;
        canvas.add(artistText);

        // 4. Dummy Lyrics
        const lyricsText = new fabric.IText("When the music fades\nAnd all is stripped away", {
          left: 150,
          top: 620,
          fontFamily: "sans-serif",
          fontSize: 24,
          fill: lyricColor,
          textAlign: lyricAlignment,
          lineHeight: lineSpacing,
        });
        objectsRef.current.lyrics = lyricsText;
        canvas.add(lyricsText);

        // 5. Brand text
        const brandText = new fabric.IText("MIMI MUSIC", {
          left: 30,
          top: 30,
          fontFamily: "sans-serif",
          fontSize: 16,
          fill: "rgba(255,255,255,0.4)",
          fontWeight: "bold",
        });
        objectsRef.current.brand = brandText;
        canvas.add(brandText);

        canvas.renderAll();
      } catch (err) {
        console.error("Failed to load images into Fabric", err);
      }
    };

    initCanvas();

    // Event listeners for Bidirectional Binding (Canvas -> Store)
    canvas.on("object:modified", (e) => {
      const target = e.target;
      if (!target) return;

      isUpdatingFromCanvas.current = true;

      const newTransform = {
        x: target.left || 0,
        y: target.top || 0,
        scaleX: target.scaleX || 1,
        scaleY: target.scaleY || 1,
        angle: target.angle || 0,
      };

      if (target === objectsRef.current.cover) {
        usePosterV2Store.getState().updateTransform("cover", newTransform);
      } else if (target === objectsRef.current.title) {
        usePosterV2Store.getState().updateTransform("title", newTransform);
      } else if (target === objectsRef.current.artist) {
        usePosterV2Store.getState().updateTransform("artist", newTransform);
      }

      // Reset flag after a small delay to allow react cycle to finish
      setTimeout(() => {
        isUpdatingFromCanvas.current = false;
      }, 50);
    });

    return () => {
      canvas.dispose();
    };
    // 刻意只在挂载时跑一次：初始化 effect 里有 canvas.dispose() + 重建，
    // 加上 song / store 依赖会让每次换歌或调色都销毁整个 fabric 画布，
    // 把用户已经调好的对象版式（位置/缩放/旋转）归零。
    // store 切片的颜色与排版由下面的专用 effect 同步，song 由紧随其后的 effect 同步。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // 歌曲切换时同步画布内容（初始化是 mount-only，必须单独同步，否则海报停在旧歌）
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let cancelled = false;

    objectsRef.current.title?.set({ text: song.title });
    objectsRef.current.artist?.set({ text: song.artist });

    const coverObj = objectsRef.current.cover;
    if (coverObj && song.cover) {
      coverObj
        .setSrc(song.cover, { crossOrigin: "anonymous" })
        .then(() => {
          if (cancelled || !fabricRef.current) return;
          const scale = 300 / (coverObj.width || 300);
          coverObj.set({ scaleX: scale, scaleY: scale });
          fabricRef.current.renderAll();
        })
        .catch(() => {
          // 封面拉取失败保留上一张，海报仍可编辑
        });
    }

    canvas.renderAll();
    return () => {
      cancelled = true;
    };
  }, [song.title, song.artist, song.cover]);

  // Bi-directional Binding (Store -> Canvas)
  // We use multiple useEffects to watch specific store slices
  useEffect(() => {
    if (!fabricRef.current || isUpdatingFromCanvas.current) return;
    const obj = objectsRef.current.cover;
    if (obj) {
      obj.set({
        left: coverTransform.x !== 0 ? coverTransform.x : obj.left,
        top: coverTransform.y !== 0 ? coverTransform.y : obj.top,
        scaleX: coverTransform.scaleX !== 1 ? coverTransform.scaleX : obj.scaleX,
        scaleY: coverTransform.scaleY !== 1 ? coverTransform.scaleY : obj.scaleY,
      });
      fabricRef.current.requestRenderAll();
    }
  }, [coverTransform]);

  useEffect(() => {
    if (!fabricRef.current || isUpdatingFromCanvas.current) return;
    const obj = objectsRef.current.title;
    if (obj) {
      obj.set({
        left: titleTransform.x !== 0 ? titleTransform.x : obj.left,
        top: titleTransform.y !== 0 ? titleTransform.y : obj.top,
        scaleX: titleTransform.scaleX !== 1 ? titleTransform.scaleX : obj.scaleX,
        scaleY: titleTransform.scaleY !== 1 ? titleTransform.scaleY : obj.scaleY,
      });
      fabricRef.current.requestRenderAll();
    }
  }, [titleTransform]);

  useEffect(() => {
    if (!fabricRef.current || isUpdatingFromCanvas.current) return;
    const obj = objectsRef.current.artist;
    if (obj) {
      obj.set({
        left: artistTransform.x !== 0 ? artistTransform.x : obj.left,
        top: artistTransform.y !== 0 ? artistTransform.y : obj.top,
        scaleX: artistTransform.scaleX !== 1 ? artistTransform.scaleX : obj.scaleX,
        scaleY: artistTransform.scaleY !== 1 ? artistTransform.scaleY : obj.scaleY,
      });
      fabricRef.current.requestRenderAll();
    }
  }, [artistTransform]);

  // Global appearance syncing
  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.backgroundColor = primaryColor;
    // Update dimensions based on aspect ratio
    const width = 600;
    const height = width / aspectRatio;
    fabricRef.current.setDimensions({ width, height });

    // Update Lyric appearance
    if (objectsRef.current.lyrics) {
      objectsRef.current.lyrics.set({
        fill: lyricColor,
        textAlign: lyricAlignment,
        lineHeight: lineSpacing,
        fontFamily:
          lyricFont === "sans" ? "sans-serif" : lyricFont === "serif" ? "serif" : "monospace",
      });
    }

    fabricRef.current.requestRenderAll();
  }, [aspectRatio, primaryColor, lyricColor, lyricAlignment, lineSpacing, lyricFont]);

  // Export Logic
  const handleExport = useCallback(
    (isCopy: boolean) => {
      if (!fabricRef.current) return;

      // 1. Deselect objects so bounding boxes don't render in final image
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();

      // 2. Generate Data URL (4K resolution implies a multiplier)
      // Canvas is 600px wide. 4K is 3840px wide. Multiplier = 3840 / 600 = 6.4
      try {
        const dataUrl = fabricRef.current.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 4, // Use 4x for good balance of size/quality (2400px width)
        });
        onExportComplete(dataUrl, isCopy);
      } catch (e) {
        console.error(e);
        onExportComplete("", isCopy);
      }
    },
    [onExportComplete]
  );

  useEffect(() => {
    if (exportTrigger > 0) handleExport(false);
  }, [exportTrigger, handleExport]);

  useEffect(() => {
    if (copyTrigger > 0) handleExport(true);
  }, [copyTrigger, handleExport]);

  return (
    <div className="w-full h-full flex items-center justify-center relative shadow-[0_0_100px_rgba(0,0,0,0.5)]">
      <div
        className="rounded-[32px] overflow-hidden border border-white/10"
        style={{
          boxShadow: "0 40px 100px -20px rgba(0,0,0,1)",
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
