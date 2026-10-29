/** S6-5: one-way migration of deprecated audio-store-v4 EQ fields into eq-store v2. */
import { DEFAULT_EQ_PRESETS, type EQPresetId, type EQState } from "./types";

export const EQ_STORE_KEY = "eq-store";
export const EQ_STORE_VERSION = 2;
const LEGACY_AUDIO_STORE_KEY = "audio-store-v4";

type LegacyEQ = Partial<
  Pick<EQState, "eqBands" | "isEQEnabled" | "currentEQPreset" | "customEQPresets">
>;

/** Read EQ values from the old audioStore envelope; eq-store values always win in migrate. */
export function readLegacyAudioStoreEQ(): LegacyEQ {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_AUDIO_STORE_KEY);
    if (!raw) return {};
    const state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state;
    if (!state) return {};
    const legacy: LegacyEQ = {};
    if (Array.isArray(state.eqBands)) legacy.eqBands = state.eqBands.map(Number);
    if (typeof state.isEQEnabled === "boolean") legacy.isEQEnabled = state.isEQEnabled;
    if (
      typeof state.currentEQPreset === "string" &&
      Object.prototype.hasOwnProperty.call(DEFAULT_EQ_PRESETS, state.currentEQPreset)
    ) {
      legacy.currentEQPreset = state.currentEQPreset as EQPresetId;
    }
    if (state.customEQPresets && typeof state.customEQPresets === "object") {
      legacy.customEQPresets = state.customEQPresets as Record<string, number[]>;
    }
    return legacy;
  } catch {
    return {};
  }
}

export function migrateEQState(persisted: unknown, version: number): EQState {
  if (version >= EQ_STORE_VERSION) return persisted as EQState;
  const merged: Record<string, unknown> = { ...readLegacyAudioStoreEQ() };
  for (const [key, value] of Object.entries((persisted ?? {}) as Record<string, unknown>)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as unknown as EQState;
}
