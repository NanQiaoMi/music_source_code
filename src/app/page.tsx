"use client";

import { useEffect } from "react";
import { useUiShellStore } from "@/store/uiShellStore";
import { useDynamicTheme } from "@/hooks/useDynamicTheme";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRestoreAfterHydration } from "@/hooks/useRestoreAfterHydration";

import dynamic from "next/dynamic";

// Core Layout Modules (Static for fast initial paint)
import { HomeView } from "@/components/layout/HomeView";
import { Apple3DQueueDrawer } from "@/components/player/Apple3DQueueDrawer";
import { PanelOrchestrator } from "@/components/layout/PanelOrchestrator";
import { VisualTokens } from "@/components/layout/VisualTokens";
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
import { hydrateStores } from "@/lib/bootstrapStores";
import { getHydrationStatus } from "@/lib/hydrationStatus";

/**
 * Main Application Entry Point - mimimusic
 *
 * Refactored to a modular architecture where page.tsx acts only as a
 * layout skeleton and orchestration layer.
 *
 * Architecture:
 * - uiShellStore: Central source of truth for view navigation (S6-6c).
 * - PanelOrchestrator: Manages lazy-loading and error-isolation for all 32+ feature panels.
 * - HomeView / PlayerView: Decoupled UI modules for different application states.
 */
export default function Home() {
  const currentView = useUiShellStore((state) => state.currentView);
  const isTransitioning = useUiShellStore((state) => state.isTransitioning);

  // Initialize Global Services & Hooks
  useDynamicTheme();
  useKeyboardShortcuts();

  // S6-2c: 只启动一次显式 hydrate。恢复/初始化由 useRestoreAfterHydration 在
  // status 变为 ready 后触发；idle/hydrating 保持默认 UI，error 时跳过恢复但页面
  // 仍可用（绝不在 hydrate 完成前读取持久化视图而覆盖 store 默认值）。
  useEffect(() => {
    if (getHydrationStatus() !== "idle") return;
    void hydrateStores().catch((error: unknown) => {
      console.error("[Bootstrap] Persisted store hydration failed; keeping default UI.", error);
    });
  }, []);

  useRestoreAfterHydration(() => {
    // S6-6c: currentView 由 ui-store-v2 persist hydrate 直接同步到 uiShellStore，
    // 不再读 mimimusic_active_view 双通道。重视图由上方 next/dynamic 声明按需加载；
    // 此处不再重复预取（S3-9）。
    void bootstrapApp();
  });

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
          --theme-border: rgba(255, 255, 255, 0.1);
          --theme-text-primary: #ffffff;
          --theme-text-secondary: rgba(255, 255, 255, 0.5);
          --theme-accent-pink: #ec4899;
        }
      `}</style>
      <VisualTokens />

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
