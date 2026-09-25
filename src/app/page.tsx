"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { useDynamicTheme } from "@/hooks/useDynamicTheme";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

import dynamic from "next/dynamic";

// Core Layout Modules (Static for fast initial paint)
import { HomeView } from "@/components/layout/HomeView";
import { Apple3DQueueDrawer } from "@/components/player/Apple3DQueueDrawer";
import { PanelOrchestrator } from "@/components/layout/PanelOrchestrator";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";

// Heavy Views & Dynamic Ambient (Lazy Loaded)
const AmbientFluidMeshBackground = dynamic(
  () =>
    import("@/components/layout/AmbientFluidMeshBackground").then(
      (m) => m.AmbientFluidMeshBackground
    ),
  { ssr: false }
);
const PlayerView = dynamic(
  () => import("@/components/layout/PlayerView").then((m) => m.PlayerView),
  { ssr: false }
);
const VisualizationView = dynamic(
  () => import("@/components/visualization/VisualizationView").then((m) => m.VisualizationView),
  { ssr: false }
);

// Global Features & Feedback (Lazy Loaded)
const FeatureButtonsContainer = dynamic(
  () =>
    import("@/components/features-v7/FeatureButtonsContainer").then(
      (m) => m.FeatureButtonsContainer
    ),
  { ssr: false }
);
const DesktopLyrics = dynamic(
  () => import("@/components/features-v7/DesktopLyrics").then((m) => m.DesktopLyrics),
  { ssr: false }
);
const VirtualCursor = dynamic(
  () => import("@/components/widgets/VirtualCursor").then((m) => m.VirtualCursor),
  { ssr: false }
);
const GlassToastContainer = dynamic(
  () => import("@/components/shared/GlassToast").then((m) => m.GlassToastContainer),
  { ssr: false }
);
const GlassRadarWidget = dynamic(
  () => import("@/components/widgets/GlassRadarWidget").then((m) => m.GlassRadarWidget),
  { ssr: false }
);
const MusicLibrarySyncProvider = dynamic(
  () =>
    import("@/components/library/MusicLibrarySyncProvider").then((m) => m.MusicLibrarySyncProvider),
  { ssr: false }
);
const MusicBackstory = dynamic(
  () => import("@/components/widgets/MusicBackstory").then((m) => m.MusicBackstory),
  { ssr: false }
);

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

  // Initialize Global Services & Hooks
  useDynamicTheme();
  useKeyboardShortcuts();

  useEffect(() => {
    useUIStore.getState().restorePersistedView();
    bootstrapApp().then(() => {
      // Prefetch heavy views in background after core is ready
      import("@/components/layout/PlayerView");
      import("@/components/visualization/VisualizationView");
      import("@/components/features-v7/FeatureButtonsContainer");
    });
  }, []);

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
          --theme-gradient: linear-gradient(
            135deg,
            var(--theme-primary),
            var(--theme-secondary),
            var(--theme-accent)
          );
          --blur-intensity: ${blurIntensity}px;
          --animation-speed: ${animationSpeed}s;
          --theme-border: rgba(255, 255, 255, 0.1);
          --theme-text-primary: #ffffff;
          --theme-text-secondary: rgba(255, 255, 255, 0.5);
          --theme-accent-pink: #ec4899;
        }
      `}</style>

      {/* ─── Global Dynamic Adaptive Ambient Background ───────────── */}
      <PanelErrorBoundary panelName="Ambient Background">
        <AmbientFluidMeshBackground />
      </PanelErrorBoundary>

      {/* ─── Primary View Content ─────────────────────────────────── */}
      <HomeView />
      <PlayerView />

      {/* ─── Global Visualization & HUD ───────────────────────────── */}
      {/* 常驻挂载，由 VisualizationView 内部用透明度 / 可见性切换。
          条件挂载会让每次切入都整块重建画布、粒子与特效初始化，切换时必然卡一下。 */}
      <PanelErrorBoundary panelName="3D Visualization Engine">
        <VisualizationView />
      </PanelErrorBoundary>
      <DesktopLyrics />
      {currentView === "player" && (
        <PanelErrorBoundary panelName="Player HUD Overlay">
          <FeatureButtonsContainer />
          <GlassRadarWidget />
          <MusicBackstory />
        </PanelErrorBoundary>
      )}
      <VirtualCursor />
      <GlassToastContainer />
      <MusicLibrarySyncProvider />
      <Apple3DQueueDrawer />

      {/* ─── Feature Panels Orchestration ──────────────────────────── */}
      <PanelOrchestrator />

      {/* ─── Transition Overlay ───────────────────────────────────── */}
      {isTransitioning && (
        <div className="absolute inset-0 bg-black/25 z-30 pointer-events-none transition-opacity duration-150 opacity-100" />
      )}
    </main>
  );
}
