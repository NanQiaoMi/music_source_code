"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AudioEngine } from "@/lib/audio/AudioEngine";

interface DualBreathingAuraRaysProps {
  primary?: string;
  secondary?: string;
  accent?: string;
  isPlaying?: boolean;
  className?: string;
}

export const DualBreathingAuraRays: React.FC<DualBreathingAuraRaysProps> = memo(
  ({
    primary = "#8b5cf6",
    secondary = "#3b82f6",
    accent = "#ec4899",
    isPlaying = false,
    className = "",
  }) => {
    const shouldReduceMotion = useReducedMotion();
    const [audioEnergy, setAudioEnergy] = useState<number>(0);
    const rafRef = useRef<number | null>(null);
    const smoothedEnergyRef = useRef<number>(0);

    // 智能采样 Web Audio 低频能量，为呼吸光注入极弱、丝滑的有机律动（完全不晃眼）
    useEffect(() => {
      if (!isPlaying || shouldReduceMotion) {
        setAudioEnergy(0);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        return;
      }

      let active = true;
      const sampleAudio = () => {
        if (!active) return;
        try {
          const analyser = AudioEngine.getInstance().getAnalyser();
          if (analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);

            // 取 20Hz ~ 150Hz 重低频频段（前 8 个频点）
            let sum = 0;
            const sampleCount = Math.min(8, dataArray.length);
            for (let i = 0; i < sampleCount; i++) {
              sum += dataArray[i];
            }
            const rawEnergy = sampleCount > 0 ? sum / (sampleCount * 255) : 0;

            // 一阶低通滤波平滑处理（避免突变或闪烁）
            smoothedEnergyRef.current += (rawEnergy - smoothedEnergyRef.current) * 0.08;
            setAudioEnergy(smoothedEnergyRef.current);
          }
        } catch {
          // 降级使用纯缓动呼吸
        }
        rafRef.current = requestAnimationFrame(sampleAudio);
      };

      rafRef.current = requestAnimationFrame(sampleAudio);

      return () => {
        active = false;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, [isPlaying, shouldReduceMotion]);

    // 基础参数配置
    const ray1BaseOpacity = 0.09 + audioEnergy * 0.05;
    const ray2BaseOpacity = 0.07 + audioEnergy * 0.04;
    const audioScaleBoost = 1 + audioEnergy * 0.04;

    return (
      <div
        className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none transform-gpu z-[1] ${className}`}
        aria-hidden="true"
      >
        {/* ─── 第一条：左上方轻倾流光弧 (Primary + Accent 柔雾流线) ─── */}
        <motion.div
          className="absolute -top-[5%] -left-[10%] w-[75vw] max-w-[960px] h-[340px] rounded-[100%] mix-blend-screen transform-gpu origin-top-left"
          style={{
            background: `radial-gradient(ellipse 75% 55% at 48% 45%, ${primary} 0%, ${accent} 45%, transparent 75%)`,
            filter: "blur(75px)",
            rotate: -22,
          }}
          animate={
            shouldReduceMotion
              ? { opacity: 0.08, scale: 1 }
              : isPlaying
                ? {
                    opacity: [ray1BaseOpacity * 0.6, ray1BaseOpacity * 1.35, ray1BaseOpacity * 0.6],
                    scale: [audioScaleBoost * 0.96, audioScaleBoost * 1.05, audioScaleBoost * 0.96],
                    x: [0, 18, 0],
                    y: [0, -10, 0],
                  }
                : {
                    opacity: [0.05, 0.09, 0.05],
                    scale: [0.98, 1.02, 0.98],
                    x: [0, 8, 0],
                    y: [0, -5, 0],
                  }
          }
          transition={{
            repeat: Infinity,
            duration: isPlaying ? 5.2 : 7.0,
            ease: [0.42, 0, 0.58, 1], // 丝滑平缓正弦拟态
          }}
        />

        {/* ─── 第二条：右下方呼应流光弧 (Secondary + Primary 深邃柔光) ─── */}
        <motion.div
          className="absolute -bottom-[8%] -right-[8%] w-[80vw] max-w-[1050px] h-[360px] rounded-[100%] mix-blend-screen transform-gpu origin-bottom-right"
          style={{
            background: `radial-gradient(ellipse 80% 55% at 52% 52%, ${secondary} 0%, ${primary} 50%, transparent 75%)`,
            filter: "blur(85px)",
            rotate: 24,
          }}
          animate={
            shouldReduceMotion
              ? { opacity: 0.06, scale: 1 }
              : isPlaying
                ? {
                    opacity: [ray2BaseOpacity * 0.55, ray2BaseOpacity * 1.3, ray2BaseOpacity * 0.55],
                    scale: [audioScaleBoost * 0.95, audioScaleBoost * 1.04, audioScaleBoost * 0.95],
                    x: [0, -20, 0],
                    y: [0, 12, 0],
                  }
                : {
                    opacity: [0.04, 0.07, 0.04],
                    scale: [0.98, 1.02, 0.98],
                    x: [0, -8, 0],
                    y: [0, 5, 0],
                  }
          }
          transition={{
            repeat: Infinity,
            duration: isPlaying ? 5.8 : 7.6,
            delay: 2.3, // 相位错落交错呼吸
            ease: [0.42, 0, 0.58, 1],
          }}
        />
      </div>
    );
  }
);

DualBreathingAuraRays.displayName = "DualBreathingAuraRays";
