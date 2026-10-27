"use client";

import { useEffect, useLayoutEffect } from "react";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";

// Avoid the server-render warning while keeping the pre-paint update on the client.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Bridges persisted visual settings into CSS custom properties.
 *
 * Kept as its own null-rendering component so blur/animation updates only
 * re-render this node instead of the whole page shell (and never rebuild the
 * global style sheet that used to interpolate these values).
 */
export function VisualTokens() {
  const blurIntensity = useVisualSettingsStore((state) => state.blurIntensity);
  const animationSpeed = useVisualSettingsStore((state) => state.animationSpeed);

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--blur-intensity", `${blurIntensity}px`);
    root.style.setProperty("--animation-speed", `${animationSpeed}s`);
  }, [blurIntensity, animationSpeed]);

  return null;
}
