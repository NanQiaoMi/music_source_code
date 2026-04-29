"use client";

import dynamic from "next/dynamic";
import { AchievementToastContainer } from "@/components/shared/AchievementToast";

const FloatingPlayer = dynamic(
  () => import("@/components/FloatingPlayer").then((mod) => mod.FloatingPlayer),
  { ssr: false }
);

export function GlobalClientComponents() {
  return (
    <>
      <FloatingPlayer />
      <AchievementToastContainer />
    </>
  );
}
