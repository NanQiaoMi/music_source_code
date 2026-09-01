"use client";

import React, { Suspense, lazy, ComponentType } from "react";
import { PanelErrorBoundary } from "./PanelErrorBoundary";

type PanelComponent = ComponentType<LegacyAny>;
type PanelFactory = () => Promise<{ default: PanelComponent }>;

export type LazyPanelComponent = React.LazyExoticComponent<PanelComponent>;

interface LazyPanelProps {
  name: string;
  isOpen: boolean;
  onClose: () => void;
  component: LazyPanelComponent;
  extraProps?: Record<string, unknown>;
}

const componentCache = new Map<string, LazyPanelComponent>();
const prefetchTracker = new Set<string>();

export function prefetchPanel(name: string, factory: PanelFactory) {
  if (!prefetchTracker.has(name)) {
    prefetchTracker.add(name);
    factory();
    if (!componentCache.has(name)) {
      componentCache.set(name, lazy(factory));
    }
  }
}

function getOrCreateLazy(name: string, factory: PanelFactory) {
  if (!componentCache.has(name)) {
    componentCache.set(name, lazy(factory));
  }
  return componentCache.get(name)!;
}

export function createLazyPanelComponent(name: string, factory: PanelFactory) {
  return getOrCreateLazy(name, factory);
}

export function LazyPanel({
  name,
  isOpen,
  onClose,
  component: LazyComponent,
  extraProps = {},
}: LazyPanelProps) {
  const [hasMounted, setHasMounted] = React.useState(isOpen);

  React.useEffect(() => {
    if (isOpen) {
      setHasMounted(true);
    }
  }, [isOpen]);

  if (!isOpen && !hasMounted) return null;

  return (
    <PanelErrorBoundary panelName={name} onClose={onClose}>
      <Suspense
        fallback={
          isOpen ? (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                <span className="text-white/40 text-xs uppercase tracking-widest font-bold">
                  Loading...
                </span>
              </div>
            </div>
          ) : null
        }
      >
        <LazyComponent isOpen={isOpen} onClose={onClose} {...extraProps} />
      </Suspense>
    </PanelErrorBoundary>
  );
}
