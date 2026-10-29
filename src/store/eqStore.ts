import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_BANDS,
  EQ_DEFAULTS,
  getDefaultEQPreset,
  type EQPreset,
  type EQState,
} from "./eq/types";
import { EQ_STORE_KEY, EQ_STORE_VERSION, migrateEQState } from "./eq/legacyEQMigration";

export type { EQPreset, EQPresetId } from "./eq/types";
export { DEFAULT_EQ_PRESETS, getDefaultEQPreset } from "./eq/types";

export const useEQStore = create<EQState>()(
  persist(
    (set, get) => ({
      ...EQ_DEFAULTS,

      setEQEnabled: (enabled) => set({ isEQEnabled: enabled }),
      toggleEQ: () => set((state) => ({ isEQEnabled: !state.isEQEnabled })),
      setEQBands: (bands) =>
        set((state) => ({
          eqBands: bands,
          currentEQPreset:
            bands === getDefaultEQPreset(state.currentEQPreset) ? state.currentEQPreset : "custom1",
        })),
      setEQBand: (index, value) => {
        const bands = [...get().eqBands];
        bands[index] = value;
        set({ eqBands: bands });
      },
      resetEQ: () => set({ eqBands: [...DEFAULT_BANDS] }),
      setCurrentEQPreset: (preset) => get().loadEQPreset(preset),
      loadEQPreset: (preset) =>
        set({ eqBands: getDefaultEQPreset(preset), currentEQPreset: preset }),
      saveCustomEQPreset: (name, bands) =>
        set((state) => ({ customEQPresets: { ...state.customEQPresets, [name]: bands } })),
      savePreset: (name) => {
        const preset: EQPreset = {
          id: `eq-${Date.now()}`,
          name,
          bands: [...get().eqBands],
        };
        set((state) => ({
          eqPresets: [...state.eqPresets, preset],
          selectedPresetId: preset.id,
        }));
      },
      loadPreset: (presetId) => {
        const preset = get().eqPresets.find((p) => p.id === presetId);
        if (preset) {
          set({ eqBands: [...preset.bands], selectedPresetId: presetId });
        }
      },
      deletePreset: (presetId) => {
        set((state) => ({
          eqPresets: state.eqPresets.filter((p) => p.id !== presetId),
          selectedPresetId: state.selectedPresetId === presetId ? null : state.selectedPresetId,
        }));
      },
    }),
    {
      skipHydration: true,
      name: EQ_STORE_KEY,
      version: EQ_STORE_VERSION,
      migrate: migrateEQState,
      partialize: (state) => ({
        isEQEnabled: state.isEQEnabled,
        eqBands: state.eqBands,
        currentEQPreset: state.currentEQPreset,
        customEQPresets: state.customEQPresets,
        eqPresets: state.eqPresets,
        selectedPresetId: state.selectedPresetId,
      }),
    }
  )
);
