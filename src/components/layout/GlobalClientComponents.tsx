"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AchievementToastContainer } from "@/components/shared/AchievementToast";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useElectron } from "@/hooks/useElectron";
import { useStorageDegradedToast } from "@/hooks/useStorageDegradedToast";
import { bootstrapApp } from "@/lib/bootstrap";
import { compactExistingStorage } from "@/lib/storage/safeStorage";
import { useUiShellStore } from "@/store/uiShellStore";

const FloatingPlayer = dynamic(
  () => import("@/components/player/FloatingPlayer").then((mod) => mod.FloatingPlayer),
  { ssr: false }
);

const DataManagerPlayerDock = dynamic(
  () =>
    import("@/components/player/DataManagerPlayerDock").then((mod) => mod.DataManagerPlayerDock),
  { ssr: false }
);

import { GestureController } from "@/components/interaction/GestureController";
import { GestureFeedback } from "@/components/interaction/GestureFeedback";
import { AILinerNotes } from "@/components/widgets/AILinerNotes";
import { TopEdgeSearchTrigger } from "@/components/layout/TopEdgeSearchTrigger";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";
import { SourceManagementModal } from "@/components/sources/SourceManagementModal";
import { GlassToastContainer } from "@/components/shared/GlassToast";

export function GlobalClientComponents() {
  useAudioPlayer();
  useMediaSession();
  useElectron();
  useStorageDegradedToast();
  const pathname = usePathname();
  const currentView = useUiShellStore((state) => state.currentView);
  const isDataManagerRoute =
    pathname === "/data-manager" ||
    pathname === "/data-manager/" ||
    pathname?.startsWith("/data-manager/");
  const isImmersiveVisualization = !isDataManagerRoute && currentView === "visualization";
  // 浮动层门控：全屏可视化/可视化视图下 DOM 只是 hidden（display:none），
  // 浏览器不会因此停止 JS 循环，需要把 active=false 透传给画布循环显式停表。
  const floatingActive = !isImmersiveVisualization && currentView !== "visualization";

  // 应用初始化时自动自愈清理历史膨胀存储
  useEffect(() => {
    compactExistingStorage();
    void bootstrapApp();
  }, []);

  return (
    <>
      <TopEdgeSearchTrigger />
      {isDataManagerRoute ? (
        <DataManagerPlayerDock />
      ) : (
        <div hidden={isImmersiveVisualization}>
          <FloatingPlayer active={floatingActive} />
        </div>
      )}
      <AchievementToastContainer />
      {/* 全局唯一 toast 宿主（layout 级，覆盖 / 与 /data-manager 等全部路由）。
          toast 是非必要 UI：崩溃时静默降级，绝不拖垮主界面与播放。 */}
      <div data-global-host="toast">
        <PanelErrorBoundary panelName="Toast Overlay" silent>
          <GlassToastContainer />
        </PanelErrorBoundary>
      </div>
      <GestureController />
      <GestureFeedback />
      {!isImmersiveVisualization && <AILinerNotes />}
      {/* 全局唯一音源管理宿主：开合由 sourceConfigStore.isManagementModalOpen 守护。 */}
      <div data-global-host="source-modal">
        <SourceManagementModal />
      </div>
    </>
  );
}
