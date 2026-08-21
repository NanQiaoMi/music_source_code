export interface EffectCompressorSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}

export interface EffectPreset {
  id: string;
  name: string;
  eq: number[];
  reverb: number;
  compressor: EffectCompressorSettings;
  stereoWidth: number;
}

export const EQ_BAND_COUNT = 10;

const FLAT_COMPRESSOR: EffectCompressorSettings = {
  threshold: -24,
  ratio: 2,
  attack: 0.01,
  release: 0.18,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeEq(eq: number[]): number[] {
  return Array.from({ length: EQ_BAND_COUNT }, (_, index) => clamp(eq[index] ?? 0, -12, 12));
}

function normalizePreset(preset: EffectPreset): EffectPreset {
  return {
    ...preset,
    eq: normalizeEq(preset.eq),
    reverb: clamp(preset.reverb, 0, 1),
    compressor: {
      threshold: clamp(preset.compressor.threshold, -60, 0),
      ratio: clamp(preset.compressor.ratio, 1, 20),
      attack: clamp(preset.compressor.attack, 0, 1),
      release: clamp(preset.compressor.release, 0, 2),
    },
    stereoWidth: clamp(preset.stereoWidth, 0, 2),
  };
}

export const BUILT_IN_EFFECT_PRESETS: EffectPreset[] = [
  normalizePreset({
    id: "flat",
    name: "Flat",
    eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    reverb: 0,
    compressor: FLAT_COMPRESSOR,
    stereoWidth: 1,
  }),
  normalizePreset({
    id: "vocal-focus",
    name: "Vocal Focus",
    eq: [-2, -1, 0, 2, 4, 3, 2, 0, -1, -2],
    reverb: 0.18,
    compressor: { threshold: -28, ratio: 3.2, attack: 0.008, release: 0.2 },
    stereoWidth: 0.9,
  }),
  normalizePreset({
    id: "live-room",
    name: "Live Room",
    eq: [1, 2, 1, 0, 0, 1, 2, 2, 1, 0],
    reverb: 0.62,
    compressor: { threshold: -22, ratio: 2.4, attack: 0.015, release: 0.32 },
    stereoWidth: 1.35,
  }),
  normalizePreset({
    id: "late-night",
    name: "Late Night",
    eq: [-4, -3, -2, 0, 1, 1, 0, -2, -4, -5],
    reverb: 0.12,
    compressor: { threshold: -34, ratio: 4.5, attack: 0.006, release: 0.28 },
    stereoWidth: 0.82,
  }),
  normalizePreset({
    id: "bass-room",
    name: "Bass Room",
    eq: [6, 5, 4, 2, 0, -1, -1, 0, 1, 2],
    reverb: 0.28,
    compressor: { threshold: -20, ratio: 3.8, attack: 0.012, release: 0.24 },
    stereoWidth: 1.12,
  }),
  normalizePreset({
    id: "clarity-boost",
    name: "Clarity Boost",
    eq: [-1, -1, 0, 1, 2, 3, 4, 3, 2, 1],
    reverb: 0.08,
    compressor: { threshold: -26, ratio: 2.8, attack: 0.004, release: 0.16 },
    stereoWidth: 1.18,
  }),
];

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function morph(from: EffectPreset, to: EffectPreset, t: number): EffectPreset {
  const a = normalizePreset(from);
  const b = normalizePreset(to);
  const nextT = clamp(t, 0, 1);

  return normalizePreset({
    id: nextT >= 1 ? b.id : `${a.id}-to-${b.id}`,
    name: nextT >= 1 ? b.name : `${a.name} -> ${b.name}`,
    eq: a.eq.map((gain, index) => lerp(gain, b.eq[index] ?? 0, nextT)),
    reverb: lerp(a.reverb, b.reverb, nextT),
    compressor: {
      threshold: lerp(a.compressor.threshold, b.compressor.threshold, nextT),
      ratio: lerp(a.compressor.ratio, b.compressor.ratio, nextT),
      attack: lerp(a.compressor.attack, b.compressor.attack, nextT),
      release: lerp(a.compressor.release, b.compressor.release, nextT),
    },
    stereoWidth: lerp(a.stereoWidth, b.stereoWidth, nextT),
  });
}

export function getBuiltInEffectPreset(id: string): EffectPreset | undefined {
  return BUILT_IN_EFFECT_PRESETS.find((preset) => preset.id === id);
}
