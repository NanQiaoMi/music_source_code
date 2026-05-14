"use client";

import React from "react";
import { Music, QrCode } from "lucide-react";
import type { Song } from "@/types/song";
import type { PosterConfig } from "@/utils/posterWorkshop";

const RENDER_WIDTH = 800;

export const parseLyrics = (lyricString?: string): string[] => {
  if (!lyricString) return [];
  const lines = lyricString.split("\n");
  const textLines = lines
    .map((line) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
    .filter((line) => line.length > 0);
  return Array.from(new Set(textLines));
};

export const PosterPreview = ({
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
