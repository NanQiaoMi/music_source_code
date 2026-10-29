/** S6-5: EQ types and preset tables split from eqStore.ts to keep its line ratchet. */
export interface EQPreset {
  id: string;
  name: string;
  bands: number[];
}

/** Built-in preset ids; moved here from audioStore when eqStore became the only EQ owner. */
export type EQPresetId =
  | "flat"
  | "pop"
  | "rock"
  | "classical"
  | "jazz"
  | "vocal"
  | "light"
  | "bass"
  | "treble"
  | "custom1"
  | "custom2"
  | "custom3";

export const DEFAULT_EQ_PRESETS: Record<EQPresetId, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [2, 1, 0, -1, -1, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock: [
    4, 3, 1, 0, -1, -1, 0, 2, 3, 4, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  classical: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  jazz: [1, 1, 1, 0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  vocal: [
    -2, -1, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  light: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  bass: [5, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  treble: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  custom1: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  custom2: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  custom3: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
};

export const getDefaultEQPreset = (preset: EQPresetId): number[] =>
  DEFAULT_EQ_PRESETS[preset] ?? DEFAULT_EQ_PRESETS.flat;

export const DEFAULT_BANDS: number[] = new Array(30).fill(0);

export interface EQState {
  isEQEnabled: boolean;
  eqBands: number[];
  /** S6-5: selected built-in preset (formerly audioStore.currentEQPreset). */
  currentEQPreset: EQPresetId;
  /** S6-5: user-saved band maps (formerly audioStore.customEQPresets). */
  customEQPresets: Record<string, number[]>;
  eqPresets: EQPreset[];
  selectedPresetId: string | null;

  setEQEnabled: (enabled: boolean) => void;
  toggleEQ: () => void;
  setEQBands: (bands: number[]) => void;
  setEQBand: (index: number, value: number) => void;
  resetEQ: () => void;
  setCurrentEQPreset: (preset: EQPresetId) => void;
  loadEQPreset: (preset: EQPresetId) => void;
  saveCustomEQPreset: (name: string, bands: number[]) => void;
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
}

export const EQ_DEFAULTS: Pick<
  EQState,
  | "isEQEnabled"
  | "eqBands"
  | "currentEQPreset"
  | "customEQPresets"
  | "eqPresets"
  | "selectedPresetId"
> = {
  isEQEnabled: true,
  eqBands: [...DEFAULT_BANDS],
  currentEQPreset: "flat",
  customEQPresets: {},
  eqPresets: [],
  selectedPresetId: null,
};
