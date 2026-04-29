"use client";

import { registerEffect } from "./index";
import { SpectrumV8Effect } from "./SpectrumV8";
import { ParticleNebulaV8 } from "./ParticleNebulaV8";
import { WaveformV8Effect } from "./WaveformV8";

export function initAllEffects() {
  registerEffect(SpectrumV8Effect);
  registerEffect(ParticleNebulaV8);
  registerEffect(WaveformV8Effect);

  console.log("V8.0 Effects initialized:", [
    SpectrumV8Effect.name,
    ParticleNebulaV8.name,
    WaveformV8Effect.name,
  ]);
}