"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AchievementToastContainer } from "@/components/shared/AchievementToast";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useElectron } from "@/hooks/useElectron";
import { bootstrapApp } from "@/lib/bootstrap";
import { compactExistingStorage } from "@/lib/storage/safeStorage";

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
import { SourceManagementModal } from "@/components/sources/SourceManagementModal";
import { GlassToastContainer } from "@/components/shared/GlassToast";

export function GlobalClientComponents() {
  useAudioPlayer();
  useMediaSession();
  useElectron();
  const pathname = usePathname();
  const isDataManagerRoute =
    pathname === "/data-manager" ||
    pathname === "/data-manager/" ||
    pathname?.startsWith("/data-manager/");

  // 应用初始化时自动自愈清理历史膨胀存储
  useEffect(() => {
    compactExistingStorage();
    void bootstrapApp();
  }, []);

  return (
    <>
      <TopEdgeSearchTrigger />
      {isDataManagerRoute ? <DataManagerPlayerDock /> : <FloatingPlayer />}
      <AchievementToastContainer />
      <GlassToastContainer />
      <GestureController />
      <GestureFeedback />
      <AILinerNotes />
      <SourceManagementModal />
    </>
  );
}
