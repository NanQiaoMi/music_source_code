"use client";

import React from "react";
import { motion } from "framer-motion";
import { useHiResStore, AudioQuality } from "@/store/hiresStore";
import { Star, Award, Activity, Music } from "lucide-react";

interface HiResBadgeProps {
  className?: string;
}

interface HiResMiniBadgeProps {
  song?: Song | null;
  size?: "sm" | "md";
  className?: string;
}

interface Song {
  id?: string;
  format?: string;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  bitrate?: number;
}

export const HiResMiniBadge: React.FC<HiResMiniBadgeProps> = ({
  song,
  size = "sm",
  className = "",
}) => {
  const { detectQuality, getQualityBadge, getQualityColor } = useHiResStore();

  if (!song) return null;

  const sampleRate = song.sampleRate || 44100;
  const bitDepth = song.bitDepth || 16;
  const channels = song.channels || 2;
  const format = song.format || "FLAC";

  const quality = detectQuality(sampleRate, bitDepth, channels);
  const color = getQualityColor(quality);
  const badge = getQualityBadge(quality);

  const isHighRes = ["Hi-Res", "DSD", "MQA", "DXD"].includes(quality);
  if (!isHighRes) return null;

  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-xs";

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className={`inline-flex items-center gap-1 rounded ${sizeClasses} ${className}`}
      style={{
        background: `${color}30`,
        border: `1px solid ${color}`,
        color: color,
      }}
    >
      <Award className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      <span className="font-bold">{badge}</span>
    </motion.div>
  );
};

export const HiResBadge: React.FC<HiResBadgeProps> = ({ className = "" }) => {
  const { currentQuality, showQualityBadge, getQualityBadge, getQualityColor } = useHiResStore();

  if (!showQualityBadge || !currentQuality) {
    return null;
  }

  const quality = currentQuality.quality;
  const color = getQualityColor(quality);
  const badge = getQualityBadge(quality);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${className}`}
      style={{
        background: `${color}20`,
        border: `1px solid ${color}`,
        color: color,
      }}
    >
      <Award className="w-4 h-4" />
      <span className="font-semibold text-sm">{badge}</span>
    </motion.div>
  );
};

interface AudioQualityDisplayProps {
  className?: string;
}

export const AudioQualityDisplay: React.FC<AudioQualityDisplayProps> = ({ className = "" }) => {
  const { currentQuality, showDetailedInfo } = useHiResStore();

  if (!showDetailedInfo || !currentQuality) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 ${className}`}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">格式</div>
          <div className="text-white font-semibold">{currentQuality.format}</div>
        </div>

        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">采样率</div>
          <div className="text-white font-semibold">
            {currentQuality.sampleRate >= 1000
              ? `${(currentQuality.sampleRate / 1000).toFixed(1)}k`
              : currentQuality.sampleRate}{" "}
            Hz
          </div>
        </div>

        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">位深</div>
          <div className="text-white font-semibold">{currentQuality.bitDepth}bit</div>
        </div>

        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">码率</div>
          <div className="text-white font-semibold">{currentQuality.bitrate} kbps</div>
        </div>

        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">声道</div>
          <div className="text-white font-semibold">{currentQuality.channels}</div>
        </div>

        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">无损</div>
          <div
            className={`font-semibold ${currentQuality.isLossless ? "text-emerald-400" : "text-white/60"}`}
          >
            {currentQuality.isLossless ? "是" : "否"}
          </div>
        </div>

        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">Hi-Res</div>
          <div
            className={`font-semibold ${currentQuality.isHighRes ? "text-amber-400" : "text-white/60"}`}
          >
            {currentQuality.isHighRes ? "是" : "否"}
          </div>
        </div>

        <div className="text-center">
          <div className="text-white/60 text-xs mb-1">质量</div>
          <div className="text-white font-semibold">{currentQuality.quality}</div>
        </div>
      </div>
    </motion.div>
  );
};

interface QualityIndicatorProps {
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  format?: string;
  className?: string;
}

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  sampleRate,
  bitDepth,
  channels = 2,
  format = "FLAC",
  className = "",
}) => {
  const { setAudioQuality, detectQuality, getQualityBadge, getQualityColor } = useHiResStore();

  React.useEffect(() => {
    if (sampleRate && bitDepth) {
      const quality = detectQuality(sampleRate, bitDepth, channels);
      const qualityInfo = {
        format: format.toUpperCase(),
        sampleRate,
        bitDepth,
        channels,
        bitrate: Math.floor((sampleRate * bitDepth * channels) / 1000),
        quality,
        isLossless: ["FLAC", "ALAC", "WAV", "AIFF", "DSD"].includes(format.toUpperCase()),
        isHighRes: ["Hi-Res", "DSD", "MQA", "DXD"].includes(quality),
      };
      setAudioQuality(qualityInfo);
    }
  }, [sampleRate, bitDepth, channels, format, setAudioQuality, detectQuality]);

  if (!sampleRate || !bitDepth) {
    return null;
  }

  const quality = detectQuality(sampleRate, bitDepth, channels);
  const color = getQualityColor(quality);
  const badge = getQualityBadge(quality);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{
          background: `${color}20`,
          border: `1px solid ${color}`,
        }}
      >
        <Star className="w-3 h-3" style={{ color }} />
        <span className="font-medium text-xs" style={{ color }}>
          {badge}
        </span>
      </motion.div>

      <div className="text-white/40 text-xs">
        {sampleRate >= 1000 ? `${(sampleRate / 1000).toFixed(1)}k` : sampleRate}Hz / {bitDepth}bit
      </div>
    </div>
  );
};
