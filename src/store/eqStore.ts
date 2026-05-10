import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface EQPreset {
  id: string;
  name: string;
  bands: number[];
}

interface EQState {
  isEQEnabled: boolean;
  eqBands: number[];
  eqPresets: EQPreset[];
  selectedPresetId: string | null;

  setEQEnabled: (enabled: boolean) => void;
  toggleEQ: () => void;
  setEQBands: (bands: number[]) => void;
  setEQBand: (index: number, value: number) => void;
  resetEQ: () => void;
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
}

const DEFAULT_BANDS = new Array(30).fill(0);

export const useEQStore = create<EQState>()(
  persist(
    (set, get) => ({
      isEQEnabled: true,
      eqBands: [...DEFAULT_BANDS],
      eqPresets: [],
      selectedPresetId: null,

      setEQEnabled: (enabled) => set({ isEQEnabled: enabled }),
      toggleEQ: () => set((state) => ({ isEQEnabled: !state.isEQEnabled })),
      setEQBands: (bands) => set({ eqBands: bands }),
      setEQBand: (index, value) => {
        const bands = [...get().eqBands];
        bands[index] = value;
        set({ eqBands: bands });
      },
      resetEQ: () => set({ eqBands: [...DEFAULT_BANDS] }),
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
      name: "eq-store",
      partialize: (state) => ({
        isEQEnabled: state.isEQEnabled,
        eqBands: state.eqBands,
        eqPresets: state.eqPresets,
        selectedPresetId: state.selectedPresetId,
      }),
    }
  )
);