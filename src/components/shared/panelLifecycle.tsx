"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Panel lifecycle tier (S3-6).
 * - always: keep the instance mounted after close (expensive init / long-lived resources)
 * - lru: keep the most recently opened panels warm, then unmount (default)
 * - never: unmount as soon as the panel closes
 */
export type PanelKeepAlive = "never" | "lru" | "always";

/** Number of recently opened lru panels kept mounted after they close. */
export const PANEL_LRU_CAPACITY = 2;

interface PanelLifecycleValue {
  active: boolean;
  name: string;
}

const PanelLifecycleContext = createContext<PanelLifecycleValue>({
  active: true,
  name: "",
});

/**
 * Publishes whether a panel is currently open. Heavy panels can read this with
 * usePanelLifecycle and pause timers / render loops while they stay mounted for
 * their keepAlive tier.
 */
export function PanelLifecycleProvider({
  active,
  name,
  children,
}: PanelLifecycleValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ active, name }), [active, name]);
  return <PanelLifecycleContext.Provider value={value}>{children}</PanelLifecycleContext.Provider>;
}

export function usePanelLifecycle(): PanelLifecycleValue {
  return useContext(PanelLifecycleContext);
}

/**
 * Runs the callback once each time the panel deactivates (isOpen -> false).
 * Use it to clear intervals / debounce timers that must stop while the panel is
 * retained by the always or lru tier.
 */
export function usePanelDeactivate(callback: () => void) {
  const { active } = usePanelLifecycle();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) callbackRef.current();
  }, [active]);
}

const PanelRetentionContext = createContext<ReadonlySet<string> | null>(null);

interface PanelRetentionProviderProps {
  /** Currently open panels whose keepAlive tier is "lru". */
  lruPanels: readonly string[];
  capacity?: number;
  children: React.ReactNode;
}

/**
 * Keeps the last-opened lru panels mounted after close. Only open panels are
 * passed in; closing does not change the order, so the most recently opened
 * panels stay warm and older ones fall out of the retained set.
 */
export function PanelRetentionProvider({
  lruPanels,
  capacity = PANEL_LRU_CAPACITY,
  children,
}: PanelRetentionProviderProps) {
  const [order, setOrder] = useState<readonly string[]>([]);
  const previousOpenRef = useRef<ReadonlySet<string> | null>(null);

  useEffect(() => {
    const previousOpen = previousOpenRef.current;
    previousOpenRef.current = new Set(lruPanels);
    const newlyOpened = lruPanels.filter((name) => !previousOpen?.has(name));
    if (newlyOpened.length === 0) return;

    setOrder((current) => {
      const moved = newlyOpened.slice().reverse();
      return [...moved, ...current.filter((name) => !moved.includes(name))].slice(0, capacity);
    });
  }, [lruPanels, capacity]);

  const retained = useMemo(() => new Set(order.slice(0, capacity)), [order, capacity]);

  return (
    <PanelRetentionContext.Provider value={retained}>{children}</PanelRetentionContext.Provider>
  );
}

/**
 * Whether a closed panel should stay mounted. Without a PanelRetentionProvider
 * (standalone LazyPanel usage) only the always tier is retained.
 */
export function usePanelRetained(name: string, keepAlive: PanelKeepAlive = "lru"): boolean {
  const retained = useContext(PanelRetentionContext);

  if (keepAlive === "always") return true;
  if (keepAlive === "never") return false;

  return retained ? retained.has(name) : false;
}
