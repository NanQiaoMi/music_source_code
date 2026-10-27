"use client";

import React, { useEffect, useRef } from "react";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { useUIStore } from "@/store/uiStore";
import { useGestureSession } from "@/hooks/useGestureSession";
import { GestureHUD } from "@/components/interaction/GestureHUD";
import { VirtualCursor } from "@/components/widgets/VirtualCursor";

const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox'], [role='searchbox']";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest(EDITABLE_SELECTOR) !== null;
}

/**
 * 隔空手势的全局入口。
 *
 * 职责被刻意收窄为三件事：
 * 1. 在 enabled 时启动 / 关闭 useGestureSession；
 * 2. 挂载 HUD 与虚拟光标；
 * 3. 处理手势模式自身的快捷键（ESC/G 关闭、C 预览、S 骨骼），且输入框内不拦截。
 *
 * 摄像头、识别、事件派发、反馈全部在独立模块中，显示开关变化不会重启摄像头。
 */
export const GestureController: React.FC = () => {
  const enabled = useGestureSettingsStore((state) => state.enabled);
  const showCursor = useGestureSettingsStore((state) => state.showCursor);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const openPanel = useUIStore((state) => state.openPanel);
  const { retry } = useGestureSession({ videoRef, canvasRef });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "escape" || key === "g") {
        event.preventDefault();
        useGestureSettingsStore.getState().setEnabled(false);
        return;
      }
      if (key === "c") {
        event.preventDefault();
        const settings = useGestureSettingsStore.getState();
        settings.update({ showPreview: !settings.showPreview });
        return;
      }
      if (key === "s") {
        event.preventDefault();
        const settings = useGestureSettingsStore.getState();
        settings.update({ showSkeleton: !settings.showSkeleton });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <GestureHUD
        videoRef={videoRef}
        canvasRef={canvasRef}
        onRetry={retry}
        onOpenSettings={() => openPanel("gestureSettings")}
      />
      {showCursor && <VirtualCursor />}
    </>
  );
};
