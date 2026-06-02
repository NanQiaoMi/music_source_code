"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAllEffects } from "@/components/visualization-v8/effects";
import { initAllEffects } from "@/components/visualization-v8/effects/initEffects";
import {
  AudioData,
  EffectParameterMap,
  EffectParameterSet,
  EffectParameterValue,
  EffectPlugin,
  RenderContext,
} from "@/lib/visualization/types";
import { getAudioAnalyser } from "./useAudioPlayer";

interface VisualizationV8InitialState {
  effects: EffectPlugin[];
  currentEffectId: string;
  effectParams: EffectParameterSet;
}

const createInitialState = (): VisualizationV8InitialState => {
  initAllEffects();
  const allEffects = getAllEffects();
  const effectParams: EffectParameterSet = {};

  allEffects.forEach((effect) => {
    effectParams[effect.id] = effect.parameters.reduce<EffectParameterMap>(
      (acc, param) => ({
        ...acc,
        [param.id]: param.default,
      }),
      {}
    );
  });

  return {
    effects: allEffects,
    currentEffectId: allEffects[0]?.id ?? "spectrum-v8",
    effectParams,
  };
};

export function useVisualizationV8() {
  const [initialState] = useState(createInitialState);
  const [currentEffectId, setCurrentEffectId] = useState<string>(initialState.currentEffectId);
  const [effectParams, setEffectParams] = useState<EffectParameterSet>(initialState.effectParams);
  const effects = initialState.effects;
  const isInitialized = effects.length > 0;

  const currentEffectRef = useRef<EffectPlugin | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bufferLengthRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!isInitialized) return;

    const analyser = getAudioAnalyser();
    if (analyser) {
      analyser.fftSize = 256;
      bufferLengthRef.current = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLengthRef.current);
      analyserRef.current = analyser;
    }
  }, [isInitialized]);

  const currentEffect = effects.find((effect) => effect.id === currentEffectId);

  const updateParam = useCallback(
    (effectId: string, paramId: string, value: EffectParameterValue) => {
      setEffectParams((prev) => ({
        ...prev,
        [effectId]: {
          ...prev[effectId],
          [paramId]: value,
        },
      }));
    },
    []
  );

  const getAudioData = useCallback((): AudioData => {
    let frequencyData = new Uint8Array(256);
    let waveformData = new Uint8Array(256);

    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
      frequencyData = new Uint8Array(dataArrayRef.current);

      analyserRef.current.getByteTimeDomainData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
      waveformData = new Uint8Array(dataArrayRef.current);
    }

    let bass = 0,
      mid = 0,
      treble = 0,
      full = 0;

    if (frequencyData.length > 0) {
      const bassEnd = Math.floor(frequencyData.length * 0.1);
      const midStart = bassEnd;
      const midEnd = Math.floor(frequencyData.length * 0.5);
      const trebleStart = midEnd;

      for (let i = 0; i < bassEnd; i++) bass += frequencyData[i];
      bass = bass / bassEnd / 255;

      for (let i = midStart; i < midEnd; i++) mid += frequencyData[i];
      mid = mid / (midEnd - midStart) / 255;

      for (let i = trebleStart; i < frequencyData.length; i++) treble += frequencyData[i];
      treble = treble / (frequencyData.length - trebleStart) / 255;

      for (let i = 0; i < frequencyData.length; i++) full += frequencyData[i];
      full = full / frequencyData.length / 255;
    }

    return {
      frequencyData,
      waveformData,
      bass,
      mid,
      treble,
      full,
      isBeat: full > 0.7,
      bpm: 120,
    };
  }, []);

  const renderEffect = useCallback(
    (ctx: RenderContext, _audioDataParam: AudioData, params: EffectParameterMap) => {
      const audioData = getAudioData();

      if (currentEffect) {
        if (currentEffectRef.current !== currentEffect) {
          currentEffectRef.current?.destroy?.();
          currentEffect.init?.(ctx);
          currentEffectRef.current = currentEffect;
        }

        currentEffect.render(ctx, audioData, params);
      }
    },
    [currentEffect, getAudioData]
  );

  const getCurrentParams = useCallback((): EffectParameterMap => {
    return effectParams[currentEffectId] || {};
  }, [effectParams, currentEffectId]);

  useEffect(() => {
    return () => {
      currentEffectRef.current?.destroy?.();
    };
  }, []);

  const handleResize = useCallback(
    (width: number, height: number) => {
      currentEffect?.resize?.(width, height);
    },
    [currentEffect]
  );

  return {
    effects,
    currentEffectId,
    currentEffect,
    effectParams,
    setCurrentEffectId,
    updateParam,
    renderEffect,
    getCurrentParams,
    handleResize,
    isInitialized,
  };
}
