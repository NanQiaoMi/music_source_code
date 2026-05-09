"use client";

import React, { Suspense, lazy, ComponentType } from "react";
import { PanelErrorBoundary } from "./PanelErrorBoundary";
import { PanelName } from "@/store/uiStore";

interface LazyPanelProps {
  /** The panel name for error reporting and store binding */
  name: PanelName;
  /** Whether the panel is currently open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Dynamic import function, e.g. () => import("@/components/MyPanel") */
  factory: () => Promise<{ default: ComponentType<any> }>;
  /** Optional extra props to pass to the panel component */
  extraProps?: Record<string, any>;
}

// Cache for lazily loaded components so we don't re-create them on every render
const componentCache = new Map<string, React.LazyExoticComponent<ComponentType<any>>>();
// Tracker for which factories have already been prefetched
const prefetchTracker = new Set<string>();

/**
 * Prefetch a panel's code in the background
 */
export function prefetchPanel(
  name: string,
  factory: () => Promise<{ default: ComponentType<any> }>
) {
  if (!prefetchTracker.has(name)) {
    prefetchTracker.add(name);
    // Trigger the dynamic import
    factory();
    // Also warm up the lazy component
    if (!componentCache.has(name)) {
      componentCache.set(name, lazy(factory));
    }
  }
}

function getOrCreateLazy(name: string, factory: () => Promise<{ default: ComponentType<any> }>) {
  if (!componentCache.has(name)) {
    componentCache.set(name, lazy(factory));
  }
  return componentCache.get(name)!;
}

/**
 * LazyPanel - A wrapper that combines:
 * 1. React.lazy() for code splitting (panel JS only loads when opened)
 * 2. Suspense for loading states
 * 3. PanelErrorBoundary for crash isolation
 *
 * Usage:
 * <LazyPanel
 *   name="formatConverter"
 *   isOpen={panels.formatConverter}
 *   onClose={() => closePanel("formatConverter")}
 *   factory={() => import("@/components/FormatConverter")}
 * />
 */
export function LazyPanel({ name, isOpen, onClose, factory, extraProps = {} }: LazyPanelProps) {
  // Don't render anything if the panel is closed — saves memory
  // However, we still want to keep the lazy component reference if it was created
  const LazyComponent = getOrCreateLazy(name, factory);

  if (!isOpen) return null;

  return (
    <PanelErrorBoundary panelName={name} onClose={onClose}>
      <Suspense
        fallback={
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              <span className="text-white/40 text-xs uppercase tracking-widest font-bold">
                加载模块中...
              </span>
            </div>
          </div>
        }
      >
        <LazyComponent isOpen={isOpen} onClose={onClose} {...extraProps} />
      </Suspense>
    </PanelErrorBoundary>
  );
}
