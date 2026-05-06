"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useDynamicTheme } from "@/hooks/useDynamicTheme";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

import dynamic from "next/dynamic";

// Core Layout Modules (Static for fast initial paint)
import { HomeView } from "@/components/layout/HomeView";
import { PanelOrchestrator } from "@/components/layout/PanelOrchestrator";

// Heavy Views (Lazy Loaded)
const PlayerView = dynamic(() => import("@/components/layout/PlayerView").then(m => m.PlayerView), { ssr: false });
const VisualizationView = dynamic(() => import("@/components/visualization/VisualizationView").then(m => m.VisualizationView), { ssr: false });

// Global Features & Feedback (Lazy Loaded)
const FeatureButtonsContainer = dynamic(() => import("@/components/features-v7/FeatureButtonsContainer").then(m => m.FeatureButtonsContainer), { ssr: false });
const DesktopLyrics = dynamic(() => import("@/components/features-v7/DesktopLyrics").then(m => m.DesktopLyrics), { ssr: false });
const VirtualCursor = dynamic(() => import("@/components/widgets/VirtualCursor").then(m => m.VirtualCursor), { ssr: false });
const GlassToastContainer = dynamic(() => import("@/components/shared/GlassToast").then(m => m.GlassToastContainer), { ssr: false });
const GlassRadarWidget = dynamic(() => import("@/components/widgets/GlassRadarWidget").then(m => m.GlassRadarWidget), { ssr: false });
const MusicLibrarySyncProvider = dynamic(() => import("@/components/library/MusicLibrarySyncProvider").then(m => m.MusicLibrarySyncProvider), { ssr: false });
const MusicBackstory = dynamic(() => import("@/components/widgets/MusicBackstory").then(m => m.MusicBackstory), { ssr: false });


import { bootstrapApp } from "@/lib/bootstrap";

/**
 * Main Application Entry Point - mimimusic
 * 
 * Refactored to a modular architecture where page.tsx acts only as a 
 * layout skeleton and orchestration layer.
 * 
 * Architecture:
 * - uiStore: Central source of truth for panel visibility and view navigation.
 * - PanelOrchestrator: Manages lazy-loading and error-isolation for all 32+ feature panels.
 * - HomeView / PlayerView: Decoupled UI modules for different application states.
 */
export default function Home() {
  const { currentView, isTransitioning } = useUIStore();
  const { blurIntensity, animationSpeed } = useVisualSettingsStore();
  const [mounted, setMounted] = useState(false);

  // Initialize Global Services & Hooks
  useDynamicTheme();
  useKeyboardShortcuts();

  useEffect(() => {
    setMounted(true);
    bootstrapApp().then(() => {
      // Prefetch heavy views in background after core is ready
      import("@/components/layout/PlayerView");
      import("@/components/visualization/VisualizationView");
      import("@/components/features-v7/FeatureButtonsContainer");
    });
  }, []);

  if (!mounted) return null;

  return (
    <main className="relative w-full h-full overflow-hidden bg-black fixed inset-0">
      {/* Design System Tokens */}
      <style jsx global>{`
        :root {
          --theme-primary: rgb(147, 51, 234);
          --theme-secondary: rgb(59, 130, 246);
          --theme-accent: rgb(236, 72, 153);
          --theme-complementary: rgb(72, 236, 153);
          --theme-background: rgb(15, 15, 35);
          --theme-surface: rgb(30, 30, 60);
          --theme-gradient: linear-gradient(135deg, var(--theme-primary), var(--theme-secondary), var(--theme-accent));
          --blur-intensity: ${blurIntensity}px;
          --animation-speed: ${animationSpeed}s;
          --theme-border: rgba(255, 255, 255, 0.1);
          --theme-text-primary: #ffffff;
          --theme-text-secondary: rgba(255, 255, 255, 0.5);
          --theme-accent-pink: #ec4899;
        }
      `}</style>

      {/* ─── Global Background Layer ──────────────────────────────── */}
      <div
        className="absolute inset-0 transition-all pointer-events-none"
        style={{
          background: "linear-gradient(135deg, var(--theme-background) 0%, rgba(0,0,0,0.8) 50%, var(--theme-surface) 100%)",
          transitionDuration: `${animationSpeed * 800}ms`,
          backdropFilter: `blur(${blurIntensity}px)`,
        }}
      />
      
      {/* Dynamic radial gradients */}
      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top, var(--theme-primary) 0%, transparent 60%)",
          opacity: 0.15,
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at bottom right, var(--theme-secondary) 0%, transparent 50%)",
          opacity: 0.1,
        }}
      />
      <div
        className="absolute inset-0 transition-all duration-[800ms] ease-out pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, var(--theme-complementary) 0%, transparent 50%),
            radial-gradient(ellipse 80% 40% at 50% 0%, var(--theme-complementary) 0%, transparent 40%)
          `,
          opacity: 0.25,
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, var(--theme-accent) 0%, transparent 70%)",
          opacity: 0.05,
        }}
      />

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* ─── Primary View Content ─────────────────────────────────── */}
      <HomeView />
      <PlayerView />
      
      {/* ─── Global Visualization & HUD ───────────────────────────── */}
      <VisualizationView />
      <DesktopLyrics />
      <FeatureButtonsContainer />
      <VirtualCursor />
      <GlassToastContainer />
      <GlassRadarWidget />
      <MusicLibrarySyncProvider />
      <MusicBackstory />

      {/* ─── Feature Panels Orchestration ──────────────────────────── */}
      <PanelOrchestrator />

      {/* ─── Apple-style hint ─────────────────────────────────────── */}
      {currentView === "home" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none"
        >
          点击卡片播放音乐
        </motion.div>
      )}

      {/* ─── Transition Overlay ───────────────────────────────────── */}
      {isTransitioning && (
        <div className="absolute inset-0 bg-black/25 z-30 pointer-events-none transition-opacity duration-150 opacity-100" />
      )}
    </main>
  );
}
