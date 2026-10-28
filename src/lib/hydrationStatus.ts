"use client";

/**
 * Client-side hydration status for persisted stores (S6-2b).
 *
 * A ~40-line external store instead of a dependency: `hydrateStores()` owns the
 * idle -> hydrating -> ready|error transitions and components gate on the hook.
 */
import { useSyncExternalStore } from "react";

export const HYDRATION_STATUSES = ["idle", "hydrating", "ready", "error"] as const;
export type HydrationStatus = (typeof HYDRATION_STATUSES)[number];

const listeners = new Set<() => void>();
let status: HydrationStatus = "idle";

export function getHydrationStatus(): HydrationStatus {
  return status;
}

export function subscribeHydrationStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Internal: hydration transitions are driven by `hydrateStores()` only. */
export function setHydrationStatus(next: HydrationStatus): void {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

// SSR/prerender never touches localStorage, so the server snapshot stays idle.
const getServerSnapshot = (): HydrationStatus => "idle";

export function useHydrationStatus(): HydrationStatus {
  return useSyncExternalStore(subscribeHydrationStatus, getHydrationStatus, getServerSnapshot);
}
