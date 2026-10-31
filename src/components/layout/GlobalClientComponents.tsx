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
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { useUIStore } from "@/store/uiStore";

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
  const currentView = useUIStore((state) => state.currentView);
  const isDataManagerRoute =
    pathname === "/data-manager" ||
    pathname === "/data-manager/" ||
    pathname?.startsWith("/data-manager/");
  const isImmersiveVisualization = !isDataManagerRoute && currentView === "visualization";

  // 应用初始化时自动自愈清理历史膨胀存储
  useEffect(() => {
    compactExistingStorage();
    void bootstrapApp();
  }, []);

  // 浏览器原生手势解锁 AudioContext：在用户首次点击/交互时同步唤醒音频硬件，防止起播静音或被阻止
  useEffect(() => {
    const unlockAudio = () => {
      AudioEngine.getInstance()
        .resume()
        .catch(() => {});
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
    window.addEventListener("keydown", unlockAudio, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // 持续拦截与清理来自外部浏览器扩展注入（如币安钱包/Web3扩展）的未捕获错误遮罩
  useEffect(() => {
    const cleanupExtensionOverlay = () => {
      try {
        const portals = document.querySelectorAll("nextjs-portal");
        portals.forEach((portal) => {
          const root = portal.shadowRoot;
          if (root) {
            const text = root.textContent || "";
            if (
              text.includes("sseError") ||
              text.includes("cadiboklkpojfamcoggejbbdjcoiljjk") ||
              text.includes("chrome-extension://") ||
              text.includes("inpage.js")
            ) {
              (portal as HTMLElement).style.display = "none";
              const closeBtn =
                root.querySelector<HTMLButtonElement>('button[aria-label="Close"]') ||
                root.querySelector<HTMLButtonElement>("button[data-nextjs-dialog-header-close]") ||
                root.querySelector<HTMLButtonElement>("[data-nextjs-toast-close]");
              if (closeBtn) closeBtn.click();
              portal.remove();
            }
          }
        });
      } catch {
        // 静默降级
      }
    };

    cleanupExtensionOverlay();
    const observer = new MutationObserver(cleanupExtensionOverlay);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <TopEdgeSearchTrigger />
      {isDataManagerRoute ? (
        <DataManagerPlayerDock />
      ) : (
        <div hidden={isImmersiveVisualization}>
          <FloatingPlayer />
        </div>
      )}
      <AchievementToastContainer />
      <GlassToastContainer />
      <GestureController />
      <GestureFeedback />
      {!isImmersiveVisualization && <AILinerNotes />}
      <SourceManagementModal />
    </>
  );
}
