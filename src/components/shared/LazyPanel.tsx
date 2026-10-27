"use client";

import React, { Suspense, lazy, ComponentType } from "react";
import { PanelErrorBoundary } from "./PanelErrorBoundary";
import { PanelKeepAlive, PanelLifecycleProvider, usePanelRetained } from "./panelLifecycle";

type PanelComponent = ComponentType<LegacyAny>;
type PanelFactory = () => Promise<{ default: PanelComponent }>;

export type LazyPanelComponent = React.LazyExoticComponent<PanelComponent>;

interface LazyPanelProps {
  name: string;
  isOpen: boolean;
  onClose: () => void;
  component: LazyPanelComponent;
  extraProps?: Record<string, unknown>;
  keepAlive?: PanelKeepAlive;
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
  keepAlive = "lru",
}: LazyPanelProps) {
  const [hasMounted, setHasMounted] = React.useState(isOpen);
  const retained = usePanelRetained(name, keepAlive);

  React.useEffect(() => {
    if (isOpen) {
      // 记录面板打开过；关闭后是否继续挂载由 keepAlive 档位与 LRU 保留集决定
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasMounted(true);
    }
  }, [isOpen]);

  // never 关闭即卸载；lru 仅保留最近打开的面板；always 始终保留
  if (!isOpen && !(hasMounted && retained)) return null;

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
        <PanelLifecycleProvider active={isOpen} name={name}>
          <LazyComponent isOpen={isOpen} onClose={onClose} {...extraProps} />
        </PanelLifecycleProvider>
      </Suspense>
    </PanelErrorBoundary>
  );
}
