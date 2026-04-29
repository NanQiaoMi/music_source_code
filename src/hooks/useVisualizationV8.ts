"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAllEffects, getEffectById } from "@/components/visualization-v8/effects";
import { initAllEffects } from "@/components/visualization-v8/effects/initEffects";
import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";
import { getAudioAnalyser } from "./useAudioPlayer";

export function useVisualizationV8() {
  const [effects, setEffects] = useState<EffectPlugin[]>([]);
  const [currentEffectId, setCurrentEffectId] = useState<string>("spectrum-v8");
  const [effectParams, setEffectParams] = useState<Record<string, Record<string, any>>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  
  const currentEffectRef = useRef<EffectPlugin | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bufferLengthRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    initAllEffects();
    const allEffects = getAllEffects();
    setEffects(allEffects);
    
    const initialParams: Record<string, Record<string, any>> = {};
    allEffects.forEach(effect => {
      initialParams[effect.id] = effect.parameters.reduce((acc, param) => ({
        ...acc,
        [param.id]: param.default
      }), {});
    });
    setEffectParams(initialParams);
    
    setIsInitialized(true);
    
    if (allEffects.length > 0) {
      setCurrentEffectId(allEffects[0].id);
    }
  }, []);

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

  const currentEffect = getEffectById(currentEffectId);

  const updateParam = useCallback((effectId: string, paramId: string, value: any) => {
    setEffectParams(prev => ({
      ...prev,
      [effectId]: {
        ...prev[effectId],
        [paramId]: value
      }
    }));
  }, []);

  const getAudioData = useCallback((): AudioData => {
    let frequencyData = new Uint8Array(256);
    let waveformData = new Uint8Array(256);
    
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
      frequencyData = new Uint8Array(dataArrayRef.current);
      
      analyserRef.current.getByteTimeDomainData(dataArrayRef.current as any);
      waveformData = new Uint8Array(dataArrayRef.current);
    }

    let bass = 0, mid = 0, treble = 0, full = 0;
    
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
      bpm: 120
    };
  }, []);

  const renderEffect = useCallback((ctx: RenderContext, audioDataParam: AudioData, params: Record<string, any>) => {
    const audioData = getAudioData();
    
    if (currentEffect) {
      if (currentEffectRef.current !== currentEffect) {
        currentEffectRef.current?.destroy?.();
        currentEffect.init?.(ctx);
        currentEffectRef.current = currentEffect;
      }
      
      currentEffect.render(ctx, audioData, params);
    }
  }, [currentEffect, getAudioData]);
  
  const getCurrentParams = useCallback((): Record<string, any> => {
    return effectParams[currentEffectId] || {};
  }, [effectParams, currentEffectId]);

  useEffect(() => {
    return () => {
      currentEffectRef.current?.destroy?.();
    };
  }, []);

  const handleResize = useCallback((width: number, height: number) => {
    currentEffect?.resize?.(width, height);
  }, [currentEffect]);

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
    isInitialized
  };
}
