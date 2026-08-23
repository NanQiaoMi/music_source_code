"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { AchievementToastContainer } from "@/components/shared/AchievementToast";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useElectron } from "@/hooks/useElectron";
import { compactExistingStorage } from "@/lib/storage/safeStorage";

const FloatingPlayer = dynamic(
  () => import("@/components/player/FloatingPlayer").then((mod) => mod.FloatingPlayer),
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

  // 应用初始化时自动自愈清理历史膨胀存储
  useEffect(() => {
    compactExistingStorage();
  }, []);

  return (
    <>
      <TopEdgeSearchTrigger />
      <FloatingPlayer />
      <AchievementToastContainer />
      <GlassToastContainer />
      <GestureController />
      <GestureFeedback />
      <AILinerNotes />
      <SourceManagementModal />
    </>
  );
}
