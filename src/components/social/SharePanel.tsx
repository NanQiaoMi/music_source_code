"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Clipboard, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore, Song } from "@/store/audioStore";
import {
  X,
  Share2,
  Music,
  Download,
  RefreshCw,
  Type,
  Palette,
  ImagePlus,
  Eye,
  Edit3,
  Box,
  LayoutTemplate,
  Activity,
  QrCode,
  Disc3,
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "@/components/shared/GlassToast";

interface SharePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export type PosterTemplate =
  | "apple"
  | "spotify"
  | "vinyl"
  | "minimal"
  | "cassette"
  | "gradient"
  | "aura"
  | "cyberpunk";

export interface PosterConfig {
  template: PosterTemplate;
  coverScale: number;
  coverYOffset: number;
  coverRadius: number;
  titleSize: number;
  titleYOffset: number;
  artistOpacity: number;
  lyricSize: number;
  blurIntensity: number;
  noiseOpacity: number;
  overlayDepth: number;
  aspectRatio: number;
  showWaveform: boolean;
  showQRCode: boolean;
  primaryColor: string;
  lyricAlignment: "left" | "center" | "right";
  lineSpacing: number;
  maxLyricLines: number;
  lyricColor: string;
  lyricFont: "sans" | "serif" | "mono" | "cursive";
  textEffect: "none" | "shadow" | "glow" | "neon" | "stroke";
}

const DEFAULT_CONFIG: PosterConfig = {
  template: "apple",
  coverScale: 1.05,
  coverYOffset: 0,
  coverRadius: 0.15,
  titleSize: 1.0,
  titleYOffset: 0,
  artistOpacity: 0.7,
  lyricSize: 1.0,
  blurIntensity: 1.2,
  noiseOpacity: 0.2,
  overlayDepth: 0.4,
  aspectRatio: 0.5625, // 9:16
  showWaveform: true,
  showQRCode: true,
  primaryColor: "#fa2d48",
  lyricAlignment: "center",
  lineSpacing: 1.5,
  maxLyricLines: 5,
  lyricColor: "rgba(255,255,255,0.9)",
  lyricFont: "sans",
  textEffect: "shadow",
};

const ASPECT_RATIO_PRESETS = [
  { name: "1:1 正方形", value: 1 },
  { name: "4:5 Ins图", value: 0.8 },
  { name: "9:16 手机屏", value: 0.5625 },
  { name: "3:4 竖图", value: 0.75 },
];

const RESOLUTION_PRESETS = [
  { pixelRatio: 1, label: "标清" },
  { pixelRatio: 2, label: "高清 (推荐)" },
  { pixelRatio: 3, label: "超清" },
];

const THEME_COLORS = [
  "#fa2d48",
  "#1DB954",
  "#0a84ff",
  "#bf5af2",
  "#ff9f0a",
  "#1c1c1e",
  "#F5F5dc",
  "#8B4513",
];

const parseLyrics = (lyricString?: string): string[] => {
  if (!lyricString) return [];
  const lines = lyricString.split("\n");
  const textLines = lines
    .map((line) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
    .filter((line) => line.length > 0);
  return Array.from(new Set(textLines));
};

const RENDER_WIDTH = 800;

const PosterPreview = ({
  song,
  lyric,
  config,
  posterRef,
  renderHeight,
}: {
  song: Song;
  lyric?: string;
  config: PosterConfig;
  posterRef: React.RefObject<HTMLDivElement | null>;
  renderHeight: number;
}) => {
  const W = RENDER_WIDTH; // 800
  const H = renderHeight;
  const isLandscape = config.aspectRatio > 1.2;
  const isSquare = config.aspectRatio > 0.9 && config.aspectRatio < 1.1;

  // Adaptive sizing based on canvas area
  const coverSize = Math.min(W * 0.42, H * 0.32);
  const coverRadiusPx = config.coverRadius * (coverSize * 0.5);
  const titlePx = Math.max(24, Math.min(56, W * 0.055 * config.titleSize));
  // derived lyric styling
  const lyricAlignment = config.lyricAlignment;
  const lyricLineHeight = config.lineSpacing;
  const lyricColor = config.lyricColor;

  const getFontFamily = (font: string) => {
    switch (font) {
      case "serif":
        return "Georgia, 'Times New Roman', serif";
      case "mono":
        return "'Courier New', Courier, monospace";
      case "cursive":
        return "'Comic Sans MS', cursive, sans-serif";
      default:
        return "system-ui, -apple-system, sans-serif";
    }
  };
  const lyricFontFamily = getFontFamily(config.lyricFont);

  const getTextShadow = (effect: string, color: string) => {
    switch (effect) {
      case "shadow":
        return "0 4px 12px rgba(0,0,0,0.5)";
      case "glow":
        return `0 0 15px ${color}, 0 0 30px ${color}`;
      case "neon":
        return `0 0 5px #fff, 0 0 10px #fff, 0 0 20px ${color}, 0 0 40px ${color}`;
      case "stroke":
        return "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
      default:
        return "none";
    }
  };
  const lyricTextShadow = getTextShadow(config.textEffect, config.primaryColor);

  const artistPx = Math.max(14, titlePx * 0.52);
  const lyricPx = Math.max(16, Math.min(42, W * 0.04 * config.lyricSize));
  const pad = Math.round(W * 0.06);

  // noise SVG data URI (shared)
  const noiseSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
  const waveHeights = [10, 18, 26, 20, 30, 16, 22, 12, 24, 14];

  // --- APPLE TEMPLATE ---
  if (config.template === "apple") {
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#000",
          borderRadius: 32,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -30,
            backgroundImage: `url(${song.cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: `blur(${config.blurIntensity * 40}px)`,
            transform: "scale(1.15)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, rgba(0,0,0,${config.overlayDepth * 0.25}) 0%, rgba(0,0,0,${config.overlayDepth * 0.5}) 50%, rgba(0,0,0,${config.overlayDepth * 1.1}) 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity,
            backgroundImage: noiseSvg,
            mixBlendMode: "overlay",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 10,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: pad,
            boxSizing: "border-box",
          }}
        >
          {/* Centered cover */}
          <div
            style={{
              marginTop: pad * 0.4,
              width: coverSize,
              height: coverSize,
              flexShrink: 0,
              borderRadius: coverRadiusPx,
              transform: `translateY(${config.coverYOffset * 30}px) scale(${config.coverScale})`,
              boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <img
              src={song.cover}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          {/* Title + Artist centered */}
          <div style={{ textAlign: "center", marginTop: pad * 0.6, width: "100%" }}>
            <h3
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: titlePx,
                lineHeight: 1.15,
                margin: 0,
                transform: `translateY(${config.titleYOffset * 16}px)`,
                letterSpacing: "-0.01em",
              }}
            >
              {song.title}
            </h3>
            <p
              style={{
                color: "#fff",
                fontWeight: 500,
                fontSize: artistPx,
                opacity: config.artistOpacity,
                margin: `${Math.round(artistPx * 0.5)}px 0 0`,
                letterSpacing: "0.04em",
              }}
            >
              {song.artist}
            </p>
          </div>
          {/* Lyric centered */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: `0 ${pad}px`,
              width: "100%",
            }}
          >
            {lyric && (
              <p
                style={{
                  color: lyricColor,
                  fontFamily: lyricFontFamily,
                  textShadow: lyricTextShadow,
                  fontWeight: 600,
                  fontSize: lyricPx,
                  lineHeight: lyricLineHeight,
                  textAlign: lyricAlignment,
                  margin: 0,
                  opacity: 0.9,
                  maxWidth: W * 0.85,
                  whiteSpace: "pre-wrap",
                }}
              >
                {lyric}
              </p>
            )}
          </div>
          {/* Bottom bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              opacity: 0.7,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Music color="#fff" size={20} />
              <span
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                mimimusic
              </span>
            </div>
            {config.showWaveform && (
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", opacity: 0.5 }}>
                {waveHeights.map((h, i) => (
                  <div
                    key={i}
                    style={{ width: 3, height: h, backgroundColor: "#fff", borderRadius: 2 }}
                  />
                ))}
              </div>
            )}
            {config.showQRCode && (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <QrCode color="#fff" size={20} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- SPOTIFY TEMPLATE ---
  if (config.template === "spotify") {
    const spotCover = Math.min(W * 0.3, H * 0.2);
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          background: `linear-gradient(150deg, ${config.primaryColor} 0%, #0d0d0d 100%)`,
          borderRadius: 32,
          display: "flex",
          flexDirection: "column",
          padding: pad,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity * 2,
            backgroundImage: noiseSvg,
            mixBlendMode: "overlay",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: 0.8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Music color="#000" size={14} />
            </div>
            <span
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Now Playing
            </span>
          </div>
          {config.showQRCode && <QrCode color="#fff" size={28} style={{ opacity: 0.7 }} />}
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            paddingBottom: pad * 0.3,
          }}
        >
          {lyric && (
            <h2
              style={{
                color: lyricColor,
                fontFamily: lyricFontFamily,
                textShadow: lyricTextShadow,
                fontWeight: 900,
                fontSize: Math.min(lyricPx * 1.2, 48),
                lineHeight: lyricLineHeight,
                textAlign: lyricAlignment,
                marginBottom: pad,
                whiteSpace: "pre-wrap",
              }}
            >
              {lyric}
            </h2>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: pad }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: titlePx,
                  margin: "0 0 8px",
                  lineHeight: 1.15,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  transform: `translateY(${config.titleYOffset * 16}px)`,
                }}
              >
                {song.title}
              </h3>
              <p
                style={{
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: artistPx,
                  opacity: config.artistOpacity,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {song.artist}
              </p>
            </div>
            <div
              style={{
                width: spotCover,
                height: spotCover,
                flexShrink: 0,
                borderRadius: coverRadiusPx,
                transform: `translateY(${config.coverYOffset * 30}px) scale(${config.coverScale}) rotate(-3deg)`,
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
                overflow: "hidden",
              }}
            >
              <img
                src={song.cover}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          </div>
          {config.showWaveform && (
            <div
              style={{
                marginTop: pad * 0.7,
                display: "flex",
                gap: 5,
                alignItems: "flex-end",
                opacity: 0.4,
              }}
            >
              {waveHeights.concat([16, 22, 10, 26, 14]).map((h, i) => (
                <div
                  key={i}
                  style={{ width: 5, height: h, backgroundColor: "#fff", borderRadius: 4 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VINYL TEMPLATE ---
  if (config.template === "vinyl") {
    const discSize = Math.min(W * 0.4, H * 0.28);
    const labelSize = discSize * 0.4;
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#EAE5D9",
          borderRadius: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: pad,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity * 1.5,
            backgroundImage: noiseSvg,
            mixBlendMode: "multiply",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 10,
            marginTop: pad * 0.5,
            transform: `scale(${config.coverScale}) translateY(${config.coverYOffset * 30}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: discSize,
              height: discSize,
              borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.15)",
              filter: "blur(20px)",
              transform: "translate(16px, 24px)",
            }}
          />
          <div
            style={{
              position: "relative",
              width: discSize,
              height: discSize,
              borderRadius: "50%",
              backgroundColor: "#111",
              border: "6px solid #222",
              boxShadow: "inset 0 0 30px rgba(0,0,0,1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 10,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 30,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 50,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            />
            <div
              style={{
                position: "relative",
                width: labelSize,
                height: labelSize,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.1)",
              }}
            >
              <img
                src={song.cover}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  margin: "auto",
                  width: 12,
                  height: 12,
                  backgroundColor: "#EAE5D9",
                  borderRadius: "50%",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
                  border: "1px solid rgba(0,0,0,0.3)",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.06) 48%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 52%, transparent 60%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            textAlign: "center",
            marginTop: pad * 0.8,
          }}
        >
          <h3
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: titlePx,
              color: config.primaryColor,
              margin: "0 0 12px",
              lineHeight: 1.15,
              transform: `translateY(${config.titleYOffset * 16}px)`,
            }}
          >
            {song.title}
          </h3>
          <p
            style={{
              fontFamily: "sans-serif",
              fontWeight: 600,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontSize: artistPx * 0.85,
              color: "#1a1a1a",
              opacity: config.artistOpacity,
              margin: 0,
            }}
          >
            {song.artist}
          </p>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: `${pad * 0.5}px 0`,
              width: "100%",
            }}
          >
            {lyric && (
              <p
                style={{
                  fontFamily: lyricFontFamily,
                  fontStyle: "italic",
                  textShadow: lyricTextShadow,
                  fontSize: lyricPx,
                  color: lyricColor,
                  lineHeight: lyricLineHeight,
                  textAlign: lyricAlignment,
                  borderTop: "1px solid rgba(0,0,0,0.1)",
                  borderBottom: "1px solid rgba(0,0,0,0.1)",
                  padding: `${pad * 0.4}px 0`,
                  width: "100%",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                "{lyric}"
              </p>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "2px solid rgba(0,0,0,0.08)",
              paddingTop: pad * 0.4,
              opacity: 0.6,
            }}
          >
            <span
              style={{
                fontSize: 12,
                letterSpacing: "0.2em",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#000",
              }}
            >
              Vinyl Collection
            </span>
            {config.showWaveform && (
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
                {[8, 16, 12, 20, 10, 14].map((h, i) => (
                  <div
                    key={i}
                    style={{ width: 3, height: h, backgroundColor: "#000", borderRadius: 2 }}
                  />
                ))}
              </div>
            )}
            {config.showQRCode && <QrCode color="#000" size={22} />}
          </div>
        </div>
      </div>
    );
  }

  // --- CASSETTE TEMPLATE ---
  if (config.template === "cassette") {
    const reelSize = Math.min(80, H * 0.06);
    const infoCover = Math.min(120, H * 0.1);
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#2A2A2A",
          borderRadius: 32,
          display: "flex",
          flexDirection: "column",
          padding: pad * 0.8,
          boxSizing: "border-box",
          border: "1px solid #444",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            mixBlendMode: "overlay",
          }}
        />

        {/* Cassette Shell */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#1c1c1c",
            borderRadius: 24,
            border: "4px solid #333",
            position: "relative",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            boxShadow:
              "inset 0 10px 20px rgba(255,255,255,0.05), inset 0 -10px 20px rgba(0,0,0,0.5), 0 20px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Top Screws */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#000",
              border: "2px solid #444",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#000",
              border: "2px solid #444",
            }}
          />

          {/* Sticker Area */}
          <div
            style={{
              flex: 1,
              backgroundColor: config.primaryColor,
              borderRadius: 12,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              border: "2px solid #000",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.1,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Header */}
            <div
              style={{
                height: 48,
                backgroundColor: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
                justifyContent: "space-between",
                borderBottom: "4px solid #000",
              }}
            >
              <span
                style={{ color: "#000", fontWeight: 900, fontFamily: "monospace", fontSize: 20 }}
              >
                A-SIDE
              </span>
              <span
                style={{ color: "#000", fontWeight: 900, fontFamily: "monospace", fontSize: 20 }}
              >
                90 MIN
              </span>
            </div>

            {/* Middle Reels Section */}
            <div
              style={{
                padding: "32px 0",
                backgroundColor: "#EAE5D9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: "rgba(0,0,0,0.1)",
                  transform: "translateY(-50%)",
                }}
              />

              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  border: "4px solid #000",
                  backgroundColor: "#fff",
                  marginLeft: 48,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    border: "4px solid #000",
                    backgroundColor: "#2A2A2A",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      margin: "auto",
                      width: "100%",
                      height: 8,
                      backgroundColor: "#000",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      margin: "auto",
                      width: 8,
                      height: "100%",
                      backgroundColor: "#000",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  border: "4px solid #000",
                  backgroundColor: "#fff",
                  marginRight: 48,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    border: "4px solid #000",
                    backgroundColor: "#2A2A2A",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      margin: "auto",
                      width: "100%",
                      height: 8,
                      backgroundColor: "#000",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      margin: "auto",
                      width: 8,
                      height: "100%",
                      backgroundColor: "#000",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div
              style={{
                flex: 1,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                backgroundColor: "rgba(255,255,255,0.9)",
                borderTop: "4px solid #000",
              }}
            >
              <div style={{ display: "flex", gap: 24, flex: 1 }}>
                <div
                  style={{
                    width: 140,
                    height: 140,
                    border: "4px solid #000",
                    borderRadius: 8,
                    overflow: "hidden",
                    flexShrink: 0,
                    transform: `scale(${config.coverScale}) translateY(${config.coverYOffset * 10}px)`,
                  }}
                >
                  <img
                    src={song.cover}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      color: "#000",
                      fontFamily: "sans-serif",
                      fontWeight: 900,
                      fontSize: titlePx * 0.9,
                      lineHeight: 1.1,
                      textTransform: "uppercase",
                    }}
                  >
                    {song.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#444",
                      fontFamily: "sans-serif",
                      fontWeight: 700,
                      fontSize: artistPx * 0.9,
                      opacity: config.artistOpacity * 1.5,
                    }}
                  >
                    {song.artist}
                  </p>

                  {lyric && (
                    <div
                      style={{ marginTop: "auto", borderTop: "2px dashed #000", paddingTop: 16 }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: lyricColor,
                          fontFamily: lyricFontFamily,
                          textShadow: lyricTextShadow,
                          fontStyle: "italic",
                          fontSize: lyricPx * 0.8,
                          fontWeight: 700,
                          lineHeight: lyricLineHeight,
                          textAlign: lyricAlignment,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        "{lyric}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom section of shell */}
          <div style={{ height: 60, marginTop: 24, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: "60%",
                height: "100%",
                backgroundColor: "#2A2A2A",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                border: "2px solid #111",
                borderBottom: "none",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 32px",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "#000",
                  border: "2px solid #333",
                }}
              />
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "#000",
                  border: "2px solid #333",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- GRADIENT TEMPLATE ---
  if (config.template === "gradient") {
    const gradCover = Math.min(W * 0.35, H * 0.25);
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          borderRadius: 32,
          background: `linear-gradient(135deg, ${config.primaryColor} 0%, #1a0533 40%, #0a1628 70%, #000 100%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity * 1.5,
            backgroundImage: noiseSvg,
            mixBlendMode: "overlay",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "-10%",
            width: W * 0.6,
            height: W * 0.6,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${config.primaryColor}44 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "5%",
            left: "-5%",
            width: W * 0.4,
            height: W * 0.4,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 10,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: pad * 1.5,
            boxSizing: "border-box",
            gap: pad * 0.8,
          }}
        >
          <div
            style={{
              width: gradCover,
              height: gradCover,
              borderRadius: coverRadiusPx * 2,
              transform: `scale(${config.coverScale})`,
              boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 80px ${config.primaryColor}33`,
              overflow: "hidden",
            }}
          >
            <img
              src={song.cover}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div style={{ textAlign: "center", width: "100%" }}>
            <h3
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: titlePx * 1.1,
                lineHeight: 1.15,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {song.title}
            </h3>
            <p
              style={{
                color: "#fff",
                fontWeight: 500,
                fontSize: artistPx,
                opacity: config.artistOpacity,
                margin: `${artistPx * 0.4}px 0 0`,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {song.artist}
            </p>
          </div>
          {lyric && (
            <p
              style={{
                color: lyricColor,
                fontFamily: lyricFontFamily,
                textShadow: lyricTextShadow,
                fontWeight: 500,
                fontSize: lyricPx * 0.9,
                lineHeight: lyricLineHeight,
                textAlign: lyricAlignment,
                margin: 0,
                maxWidth: W * 0.8,
                whiteSpace: "pre-wrap",
              }}
            >
              {lyric}
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: 0.5,
              marginTop: "auto",
            }}
          >
            <Music color="#fff" size={16} />
            <span
              style={{
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              mimimusic
            </span>
            {config.showWaveform && (
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", marginLeft: 8 }}>
                {waveHeights.map((h, i) => (
                  <div
                    key={i}
                    style={{ width: 2, height: h * 0.7, backgroundColor: "#fff", borderRadius: 2 }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- MINIMAL TEMPLATE ---
  if (config.template === "minimal") {
    const minCover = Math.min(W - pad * 2.4, H * 0.42);
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          padding: pad * 1.2,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity * 0.5,
            backgroundImage: noiseSvg,
            mixBlendMode: "multiply",
          }}
        />

        <div
          style={{
            width: minCover,
            height: minCover,
            borderRadius: coverRadiusPx,
            transform: `translateY(${config.coverYOffset * 30}px) scale(${config.coverScale})`,
            overflow: "hidden",
            boxShadow: "0 32px 64px rgba(0,0,0,0.12)",
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
            alignSelf: "center",
          }}
        >
          <img
            src={song.cover}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            paddingTop: pad,
            position: "relative",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              borderBottom: "3px solid #111",
              paddingBottom: pad * 0.5,
              marginBottom: pad * 0.5,
            }}
          >
            <div style={{ flex: 1, paddingRight: 24 }}>
              <h3
                style={{
                  color: "#111",
                  fontWeight: 900,
                  fontSize: titlePx * 1.1,
                  margin: "0 0 8px 0",
                  lineHeight: 1.1,
                  transform: `translateY(${config.titleYOffset * 16}px)`,
                }}
              >
                {song.title}
              </h3>
              <p
                style={{
                  color: "#888",
                  fontWeight: 600,
                  fontSize: artistPx,
                  opacity: config.artistOpacity,
                  margin: 0,
                  letterSpacing: "0.03em",
                }}
              >
                {song.artist}
              </p>
            </div>
            {config.showQRCode && <QrCode color="#111" size={48} style={{ flexShrink: 0 }} />}
          </div>

          {lyric && (
            <p
              style={{
                color: lyricColor,
                fontFamily: lyricFontFamily,
                textShadow: lyricTextShadow,
                fontWeight: 500,
                fontSize: lyricPx * 0.85,
                lineHeight: lyricLineHeight,
                textAlign: lyricAlignment,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {lyric}
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- AURA TEMPLATE ---
  if (config.template === "aura") {
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#0f0f13",
          borderRadius: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: pad,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity * 1.5,
            backgroundImage: noiseSvg,
            mixBlendMode: "overlay",
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "10%",
            width: "60%",
            height: "60%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${config.primaryColor} 0%, transparent 70%)`,
            filter: "blur(60px)",
            opacity: 0.7,
            mixBlendMode: "screen",
            animation: "pulse 10s infinite alternate",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "10%",
            width: "50%",
            height: "50%",
            borderRadius: "50%",
            background: `radial-gradient(circle, #8a2be2 0%, transparent 70%)`,
            filter: "blur(60px)",
            opacity: 0.5,
            mixBlendMode: "screen",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            height: "100%",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            flexDirection: "column",
            padding: pad,
            boxSizing: "border-box",
            boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: coverRadiusPx * 0.5,
                overflow: "hidden",
                flexShrink: 0,
                transform: `scale(${config.coverScale}) translateY(${config.coverYOffset * 10}px)`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <img
                src={song.cover}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div>
              <h3
                style={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: titlePx * 0.8,
                  margin: "0 0 4px 0",
                  lineHeight: 1.2,
                  transform: `translateY(${config.titleYOffset * 10}px)`,
                }}
              >
                {song.title}
              </h3>
              <p
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: 500,
                  fontSize: artistPx * 0.9,
                  margin: 0,
                  opacity: config.artistOpacity,
                }}
              >
                {song.artist}
              </p>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: `${pad}px 0`,
            }}
          >
            {lyric && (
              <h2
                style={{
                  color: lyricColor,
                  fontFamily: lyricFontFamily,
                  textShadow: lyricTextShadow,
                  fontWeight: 700,
                  fontSize: lyricPx * 1.1,
                  lineHeight: lyricLineHeight,
                  textAlign: lyricAlignment,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  width: "100%",
                }}
              >
                {lyric}
              </h2>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: 0.5,
            }}
          >
            <span
              style={{
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Aura Edition
            </span>
            {config.showQRCode && <QrCode color="#fff" size={32} />}
          </div>
        </div>
      </div>
    );
  }

  // --- CYBERPUNK TEMPLATE ---
  if (config.template === "cyberpunk") {
    return (
      <div
        ref={posterRef}
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#09090b",
          borderRadius: 32,
          display: "flex",
          flexDirection: "column",
          padding: pad,
          boxSizing: "border-box",
          border: `2px solid ${config.primaryColor}`,
          boxShadow: `inset 0 0 40px ${config.primaryColor}40`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: config.noiseOpacity * 2,
            backgroundImage: noiseSvg,
            mixBlendMode: "color-dodge",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: `1px solid ${config.primaryColor}80`,
            paddingBottom: pad * 0.5,
            marginBottom: pad * 0.5,
            position: "relative",
            zIndex: 10,
          }}
        >
          <div>
            <h3
              style={{
                color: config.primaryColor,
                fontFamily: "'Courier New', monospace",
                fontWeight: 900,
                fontSize: titlePx * 0.8,
                margin: "0 0 4px 0",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                transform: `translateY(${config.titleYOffset * 10}px)`,
                textShadow: `2px 2px 0 #f0f, -2px -2px 0 #0ff`,
              }}
            >
              {song.title}
            </h3>
            <p
              style={{
                color: "#fff",
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
                fontSize: artistPx * 0.8,
                margin: 0,
                opacity: config.artistOpacity,
              }}
            >
              // {song.artist}
            </p>
          </div>
          <div
            style={{
              padding: "4px 8px",
              backgroundColor: config.primaryColor,
              color: "#000",
              fontFamily: "monospace",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            SYS.ACTIVE
          </div>
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 10,
            alignSelf: "center",
            width: "100%",
            maxWidth: W * 0.6,
            aspectRatio: "1/1",
            marginTop: pad * 0.5,
            marginBottom: pad * 0.5,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              border: `2px solid #fff`,
              transform: `scale(${config.coverScale}) translateY(${config.coverYOffset * 10}px)`,
              position: "relative",
              overflow: "hidden",
              clipPath: "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
            }}
          >
            <img
              src={song.cover}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.2) saturate(1.5)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(45deg, ${config.primaryColor}40, transparent)`,
                mixBlendMode: "overlay",
              }}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            zIndex: 10,
          }}
        >
          {lyric && (
            <p
              style={{
                color: lyricColor,
                fontFamily: lyricFontFamily,
                textShadow:
                  lyricTextShadow !== "none"
                    ? lyricTextShadow
                    : `2px 2px 0 rgba(255,0,255,0.5), -2px -2px 0 rgba(0,255,255,0.5)`,
                fontWeight: 800,
                fontSize: lyricPx,
                lineHeight: lyricLineHeight,
                textAlign: lyricAlignment,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {lyric}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            position: "relative",
            zIndex: 10,
            marginTop: pad,
          }}
        >
          {config.showWaveform && (
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", opacity: 0.8 }}>
              {waveHeights.map((h, i) => (
                <div
                  key={i}
                  style={{ width: 4, height: h * 1.5, backgroundColor: config.primaryColor }}
                />
              ))}
            </div>
          )}
          {config.showQRCode && (
            <QrCode
              color={config.primaryColor}
              size={40}
              style={{ filter: `drop-shadow(0 0 10px ${config.primaryColor})` }}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
};

const ControlGroup = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-white/70 text-sm font-medium border-b border-white/5 pb-2">
      <Icon className="w-4 h-4" />
      {title}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const GlassSlider = React.memo(({ value, min, max, step, onChange, label, icon: Icon }: any) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value)),
    [onChange]
  );
  const progress = useMemo(() => {
    if (value == null || min == null || max == null || max === min) return 0;
    return ((value - min) / (max - min)) * 100;
  }, [value, min, max]);

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>{label}</span>
          <span className="font-mono">{value != null ? value.toFixed(2) : "0.00"}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-4 h-4 text-white/40" />}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value != null ? value : min}
          onChange={handleChange}
          className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.5) ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
          }}
        />
      </div>
    </div>
  );
});

export const SharePanel: React.FC<SharePanelProps> = ({ isOpen, onClose }) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedLyric, setSelectedLyric] = useState<string>("");
  const [customLyric, setCustomLyric] = useState<string>("");
  const [isEditingLyric, setIsEditingLyric] = useState(false);
  const [selectedLyricLines, setSelectedLyricLines] = useState<string[]>([]);
  const [config, setConfig] = useState<PosterConfig>(DEFAULT_CONFIG);
  const [resolution, setResolution] = useState<number>(2);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const renderHeight = RENDER_WIDTH / config.aspectRatio;

  useEffect(() => {
    if (!isOpen) return;
    const container = previewContainerRef.current;
    if (!container) return;

    const updateScale = () => {
      const { width, height } = container.getBoundingClientRect();
      const padding = 48; // safe padding
      const availableWidth = width - padding;
      const availableHeight = height - padding;

      const scaleX = availableWidth / RENDER_WIDTH;
      const scaleY = availableHeight / renderHeight;
      setPreviewScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [renderHeight, isOpen]);

  const parsedLyrics = useMemo(() => {
    return currentSong?.lyrics
      ? parseLyrics(currentSong.lyrics)
      : ["在这美好的时光里", "让音乐治愈你的心灵", "每一个音符都是故事", "聆听内心的声音"];
  }, [currentSong]);

  const updateConfig = useCallback((key: keyof PosterConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveImage = async () => {
    if (!posterRef.current || !currentSong) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        quality: 1.0,
        pixelRatio: resolution,
        // Since we scale the container via CSS transform, the actual DOM node remains unscaled (800xH).
        // html-to-image captures the unscaled node, achieving high quality!
      });
      const link = document.createElement("a");
      link.download = `${currentSong.title} - ${config.template} - Share.png`;
      link.href = dataUrl;
      link.click();
      toast.success("海报已保存！");
    } catch (error) {
      console.error("Failed to generate poster:", error);
      toast.error("生成海报失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleLyricLine = useCallback(
    (line: string) => {
      setSelectedLyricLines((prev) => {
        if (prev.includes(line)) return prev.filter((l) => l !== line);
        if (prev.length >= config.maxLyricLines) return prev;
        return [...prev, line];
      });
    },
    [config.maxLyricLines]
  );

  const displayLyric = isEditingLyric
    ? customLyric
    : selectedLyricLines.length > 0
      ? selectedLyricLines.slice(0, config.maxLyricLines).join("\n")
      : selectedLyric;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1300px] max-h-[90vh] bg-[#1c1c1e]/95 backdrop-blur-[40px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold tracking-wide">海报工坊</h2>
              <p className="text-white/50 text-xs">生成专属音乐卡片</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentSong ? (
          <div className="flex flex-1 min-h-0">
            {/* PREVIEW AREA */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-black/40">
              <div className="absolute top-4 left-4 z-20 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10">
                <Eye className="w-4 h-4 text-white/70" />
                <span className="text-white/70 text-xs font-medium tracking-widest uppercase">
                  {config.template} PREVIEW
                </span>
              </div>

              <div
                ref={previewContainerRef}
                className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative"
              >
                <div
                  style={{
                    width: RENDER_WIDTH,
                    height: renderHeight,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "center center",
                    boxShadow: "0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
                    borderRadius: 32,
                    willChange: "transform",
                  }}
                >
                  <PosterPreview
                    song={currentSong}
                    lyric={displayLyric}
                    config={config}
                    posterRef={posterRef}
                    renderHeight={renderHeight}
                  />
                </div>
              </div>
            </div>

            {/* CONTROLS AREA */}
            <div className="w-[440px] bg-white/5 border-l border-white/10 flex flex-col shrink-0 shadow-2xl z-10">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 min-h-0">
                {/* TEMPLATE SELECTION */}
                <ControlGroup title="模板风格" icon={LayoutTemplate}>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        id: "apple",
                        name: "Apple Glass",
                        icon: "🍏",
                        colors: "from-blue-500 to-purple-500",
                      },
                      {
                        id: "spotify",
                        name: "Spotify Vibrant",
                        icon: "🎧",
                        colors: "from-green-400 to-emerald-600",
                      },
                      {
                        id: "gradient",
                        name: "渐变星空",
                        icon: "🌌",
                        colors: "from-purple-600 to-blue-900",
                      },
                      {
                        id: "vinyl",
                        name: "Classic Vinyl",
                        icon: "💿",
                        colors: "from-[#d5cebc] to-[#c2ba9e]",
                      },
                      {
                        id: "cassette",
                        name: "Retro Cassette",
                        icon: "📼",
                        colors: "from-gray-700 to-gray-900",
                      },
                      {
                        id: "minimal",
                        name: "Minimal White",
                        icon: "📄",
                        colors: "from-gray-100 to-gray-300",
                      },
                      {
                        id: "aura",
                        name: "梦幻光晕",
                        icon: "✨",
                        colors: "from-violet-500 to-fuchsia-500",
                      },
                      {
                        id: "cyberpunk",
                        name: "赛博朋克",
                        icon: "🦾",
                        colors: "from-cyan-500 to-yellow-500",
                      },
                    ].map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => updateConfig("template", tpl.id as PosterTemplate)}
                        className={`relative overflow-hidden rounded-xl p-3 flex flex-col items-start gap-2 transition-all border ${
                          config.template === tpl.id
                            ? "border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] bg-white/10"
                            : "border-white/10 hover:border-white/30 bg-black/20 hover:bg-white/5"
                        }`}
                      >
                        <div
                          className={`w-full h-10 rounded-lg bg-gradient-to-br ${tpl.colors} opacity-80 flex items-center justify-center text-xl`}
                        >
                          {tpl.icon}
                        </div>
                        <span
                          className={`text-xs font-semibold ${config.template === tpl.id ? "text-white" : "text-white/70"}`}
                        >
                          {tpl.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </ControlGroup>

                {/* THEME COLOR */}
                {(config.template === "spotify" ||
                  config.template === "vinyl" ||
                  config.template === "cassette" ||
                  config.template === "gradient" ||
                  config.template === "aura" ||
                  config.template === "cyberpunk") && (
                  <ControlGroup title="主题色彩" icon={Palette}>
                    <div className="flex gap-3 flex-wrap">
                      {THEME_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateConfig("primaryColor", color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${config.primaryColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/30 opacity-80 hover:opacity-100 transition-opacity">
                        <input
                          type="color"
                          value={config.primaryColor}
                          onChange={(e) => updateConfig("primaryColor", e.target.value)}
                          className="absolute inset-[-10px] w-12 h-12 cursor-pointer border-0 p-0"
                        />
                      </div>
                    </div>
                  </ControlGroup>
                )}

                {/* IMAGE CONTROLS */}
                <ControlGroup title="封面构图" icon={ImagePlus}>
                  <GlassSlider
                    label="封面缩放"
                    value={config.coverScale}
                    min={0.3}
                    max={2.5}
                    step={0.01}
                    onChange={(v: number) => updateConfig("coverScale", v)}
                  />
                  <GlassSlider
                    label="垂直位移"
                    value={config.coverYOffset}
                    min={-4}
                    max={4}
                    step={0.01}
                    onChange={(v: number) => updateConfig("coverYOffset", v)}
                  />
                  <GlassSlider
                    label="圆角半径"
                    value={config.coverRadius}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(v: number) => updateConfig("coverRadius", v)}
                  />
                </ControlGroup>

                {/* TYPOGRAPHY */}
                <ControlGroup title="文字排版" icon={Type}>
                  <GlassSlider
                    label="标题大小"
                    value={config.titleSize}
                    min={0.1}
                    max={3}
                    step={0.01}
                    onChange={(v: number) => updateConfig("titleSize", v)}
                  />
                  <GlassSlider
                    label="标题垂直位移"
                    value={config.titleYOffset}
                    min={-3}
                    max={3}
                    step={0.01}
                    onChange={(v: number) => updateConfig("titleYOffset", v)}
                  />
                  <GlassSlider
                    label="歌手名透明度"
                    value={config.artistOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v: number) => updateConfig("artistOpacity", v)}
                  />
                  <GlassSlider
                    label="歌词字号"
                    value={config.lyricSize}
                    min={0.2}
                    max={3}
                    step={0.01}
                    onChange={(v: number) => updateConfig("lyricSize", v)}
                  />
                  <ControlGroup title="歌词排版" icon={Type}>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={config.lyricAlignment}
                        onChange={(e) => updateConfig("lyricAlignment", e.target.value as any)}
                        className="bg-black/30 text-white/80 text-sm rounded-lg p-2 border border-white/10 outline-none"
                      >
                        <option value="left">左对齐</option>
                        <option value="center">居中对齐</option>
                        <option value="right">右对齐</option>
                      </select>
                      <select
                        value={config.lyricFont}
                        onChange={(e) => updateConfig("lyricFont", e.target.value as any)}
                        className="bg-black/30 text-white/80 text-sm rounded-lg p-2 border border-white/10 outline-none"
                      >
                        <option value="sans">黑体 (无衬线)</option>
                        <option value="serif">宋体 (衬线)</option>
                        <option value="mono">等宽字体</option>
                        <option value="cursive">手写体</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={config.textEffect}
                        onChange={(e) => updateConfig("textEffect", e.target.value as any)}
                        className="bg-black/30 text-white/80 text-sm rounded-lg p-2 border border-white/10 outline-none"
                      >
                        <option value="none">无文字特效</option>
                        <option value="shadow">基础阴影</option>
                        <option value="glow">发光 (Glow)</option>
                        <option value="neon">霓虹 (Neon)</option>
                        <option value="stroke">描边 (Stroke)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 text-xs whitespace-nowrap">颜色</span>
                        <input
                          type="color"
                          value={config.lyricColor}
                          onChange={(e) => updateConfig("lyricColor", e.target.value)}
                          className="w-full h-8 rounded border-none p-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    <GlassSlider
                      label="行间距"
                      value={config.lineSpacing}
                      min={0.8}
                      max={2.5}
                      step={0.05}
                      onChange={(v: number) => updateConfig("lineSpacing", v)}
                    />
                    <GlassSlider
                      label="最大行数"
                      value={config.maxLyricLines}
                      min={1}
                      max={10}
                      step={1}
                      onChange={(v: number) => updateConfig("maxLyricLines", v)}
                    />
                  </ControlGroup>
                </ControlGroup>

                {/* ATMOSPHERE */}
                {config.template === "apple" && (
                  <ControlGroup title="滤镜与氛围" icon={Activity}>
                    <GlassSlider
                      label="背景模糊"
                      value={config.blurIntensity}
                      min={0}
                      max={3}
                      step={0.01}
                      onChange={(v: number) => updateConfig("blurIntensity", v)}
                    />
                    <GlassSlider
                      label="暗角与遮罩"
                      value={config.overlayDepth}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v: number) => updateConfig("overlayDepth", v)}
                    />
                  </ControlGroup>
                )}

                <ControlGroup title="胶片材质" icon={Disc3}>
                  <GlassSlider
                    label="噪点纹理透明度"
                    value={config.noiseOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v: number) => updateConfig("noiseOpacity", v)}
                  />
                </ControlGroup>

                {/* DECORATIONS */}
                <ControlGroup title="装饰元素" icon={Box}>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.showWaveform}
                        onChange={(e) => updateConfig("showWaveform", e.target.checked)}
                        className="rounded border-white/20 bg-black/20 text-pink-500 focus:ring-pink-500"
                      />
                      显示音频波形
                    </label>
                    <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.showQRCode}
                        onChange={(e) => updateConfig("showQRCode", e.target.checked)}
                        className="rounded border-white/20 bg-black/20 text-pink-500 focus:ring-pink-500"
                      />
                      显示二维码徽标
                    </label>
                  </div>
                </ControlGroup>

                {/* LYRICS MULTI-SELECT */}
                <ControlGroup title="歌词摘录" icon={Edit3}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">
                        {isEditingLyric
                          ? "手动输入"
                          : `已选 ${selectedLyricLines.length}/${config.maxLyricLines} 行`}
                      </span>
                      <button
                        onClick={() => setIsEditingLyric(!isEditingLyric)}
                        className="text-xs text-pink-400 hover:text-pink-300 transition-colors"
                      >
                        {isEditingLyric ? "切换多选模式" : "切换自定义输入"}
                      </button>
                    </div>

                    {isEditingLyric ? (
                      <textarea
                        value={customLyric}
                        onChange={(e) => setCustomLyric(e.target.value)}
                        placeholder="输入打动你的金句，每行一句..."
                        className="w-full h-28 p-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-pink-500 resize-none custom-scrollbar"
                      />
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-1.5">
                        {parsedLyrics.length > 0 ? (
                          parsedLyrics.map((line, index) => {
                            const isSelected = selectedLyricLines.includes(line);
                            const isDisabled =
                              !isSelected && selectedLyricLines.length >= config.maxLyricLines;
                            return (
                              <label
                                key={index}
                                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all text-left ${
                                  isSelected
                                    ? "bg-pink-500/15 border border-pink-500/40"
                                    : isDisabled
                                      ? "opacity-40 cursor-not-allowed border border-transparent"
                                      : "hover:bg-white/5 border border-transparent hover:border-white/10"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() => toggleLyricLine(line)}
                                  className="mt-0.5 rounded border-white/20 bg-black/20 text-pink-500 focus:ring-pink-500 shrink-0"
                                />
                                <span
                                  className={`text-xs leading-relaxed ${isSelected ? "text-pink-300" : "text-white/70"}`}
                                >
                                  {line}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="text-white/40 text-sm italic py-2">
                            当前歌曲没有可用的内置歌词
                          </p>
                        )}
                      </div>
                    )}

                    {selectedLyricLines.length > 0 && !isEditingLyric && (
                      <button
                        onClick={() => setSelectedLyricLines([])}
                        className="text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        清空已选歌词
                      </button>
                    )}
                  </div>
                </ControlGroup>

                {/* EXPORT SETTINGS */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex gap-2">
                    {ASPECT_RATIO_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => updateConfig("aspectRatio", preset.value)}
                        className={`px-2 py-2 rounded-lg text-xs transition-all flex-1 ${
                          Math.abs(config.aspectRatio - preset.value) < 0.01
                            ? "bg-white/20 text-white font-medium"
                            : "bg-black/20 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {RESOLUTION_PRESETS.map((preset) => (
                      <button
                        key={preset.pixelRatio}
                        onClick={() => setResolution(preset.pixelRatio)}
                        className={`px-2 py-2 rounded-lg text-xs transition-all flex-1 ${
                          resolution === preset.pixelRatio
                            ? "bg-white/20 text-white font-medium shadow-lg"
                            : "bg-black/20 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="p-6 border-t border-white/10 bg-white/5 shrink-0 space-y-3">
                <button
                  onClick={() => setConfig(DEFAULT_CONFIG)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  恢复默认参数
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!posterRef.current || !currentSong) return;
                      try {
                        const dataUrl = await toPng(posterRef.current, {
                          cacheBust: true,
                          quality: 1.0,
                          pixelRatio: resolution,
                        });
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                        setCopied(true);
                        toast.success("已复制到剪贴板！");
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        toast.error("复制失败，请使用下载按钮");
                      }
                    }}
                    className="flex-1 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold tracking-wide transition-all flex items-center justify-center gap-2 border border-white/10"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 text-green-400" /> 已复制
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-5 h-5" /> 复制
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSaveImage}
                    disabled={isGenerating}
                    className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                        生成中...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" /> 导出海报
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Music className="w-16 h-16 text-white/20 mb-4" />
            <h3 className="text-white font-medium text-lg">暂无音乐</h3>
            <p className="text-white/40 text-sm mt-2">请先播放一首你喜欢的音乐，再来生成专属卡片</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
