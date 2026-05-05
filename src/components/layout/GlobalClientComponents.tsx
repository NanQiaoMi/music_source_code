"use client";

import dynamic from "next/dynamic";
import { AchievementToastContainer } from "@/components/shared/AchievementToast";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useElectron } from "@/hooks/useElectron";

const FloatingPlayer = dynamic(
  () => import("@/components/player/FloatingPlayer").then((mod) => mod.FloatingPlayer),
  { ssr: false }
);

import { GestureController } from "@/components/interaction/GestureController";
import { GestureFeedback } from "@/components/interaction/GestureFeedback";

export function GlobalClientComponents() {
  useAudioPlayer();
  useMediaSession();
  useElectron();

  return (
    <>
      <FloatingPlayer />
      <AchievementToastContainer />
      <GestureController />
      <GestureFeedback />
    </>
  );
}
