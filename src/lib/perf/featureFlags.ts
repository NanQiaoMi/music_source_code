/**
 * Client feature flags (S4-1a).
 *
 * Values are NEXT_PUBLIC_* and are inlined by Next at build time, so reading them
 * costs nothing at runtime. "off"/"false" opts out to the previous path, "on"/"true"
 * opts in, and any other value (including "0") keeps the default below.
 */
function readFlag(raw: string | undefined, defaultValue: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === "off" || value === "false") return false;
  if (value === "on" || value === "true") return true;
  return defaultValue;
}

export const featureFlags = {
  /** S4-5: QueuePanel renders through VirtualList. */
  virtualListQueue: readFlag(process.env.NEXT_PUBLIC_VL_QUEUE, true),
  /** S4-6: SearchPanel renders results through VirtualList. */
  virtualListSearch: readFlag(process.env.NEXT_PUBLIC_VL_SEARCH, true),
  /** S4-6: batch tool song lists render through VirtualList. */
  virtualListBatch: readFlag(process.env.NEXT_PUBLIC_VL_BATCH, true),
  /** S4-4: unified CoverImage component. */
  coverImageV2: readFlag(process.env.NEXT_PUBLIC_COVER_IMAGE_V2, true),
  /** S5-2/S5-3: shared visual runtime. */
  visualRuntime: readFlag(process.env.NEXT_PUBLIC_VISUAL_RUNTIME, true),
  /** S5-4: effect plugin registry (legacy dispatch until rolled out). */
  effectPlugins: readFlag(process.env.NEXT_PUBLIC_EFFECT_PLUGINS, false),
} as const;

export type FeatureFlags = typeof featureFlags;
