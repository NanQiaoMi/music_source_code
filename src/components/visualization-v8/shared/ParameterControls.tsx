"use client";

import React from "react";
import { EffectParameterDefinition, ParameterMode } from "@/lib/visualization/types";

interface ParameterControlProps {
  param: EffectParameterDefinition;
  value: any;
  onChange: (value: any) => void;
  currentMode: ParameterMode;
}

function shouldShowParameter(
  param: EffectParameterDefinition,
  currentMode: ParameterMode
): boolean {
  const modeOrder: ParameterMode[] = ["basic", "professional", "expert"];
  const currentIndex = modeOrder.indexOf(currentMode);
  const paramIndex = modeOrder.indexOf(param.mode);
  return paramIndex <= currentIndex;
}

export function NumberParameter({ param, value, onChange }: ParameterControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-white/80">{param.name}</label>
      <input
        type="range"
        min={param.min ?? 0}
        max={param.max ?? 100}
        step={param.step ?? 1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <span className="text-xs text-white/50">{value}</span>
    </div>
  );
}

export function ColorParameter({ param, value, onChange }: ParameterControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-white/80">{param.name}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded cursor-pointer"
        />
        <span className="text-xs text-white/50 self-center">{value}</span>
      </div>
    </div>
  );
}

export function BooleanParameter({ param, value, onChange }: ParameterControlProps) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-white/80">{param.name}</label>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-all ${value ? "bg-pink-500" : "bg-white/20"}`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function SelectParameter({ param, value, onChange }: ParameterControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-white/80">{param.name}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
      >
        {param.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ParameterControl({ param, value, onChange, currentMode }: ParameterControlProps) {
  if (!shouldShowParameter(param, currentMode)) {
    return null;
  }

  switch (param.type) {
    case "number":
      return (
        <NumberParameter
          param={param}
          value={value}
          onChange={onChange}
          currentMode={currentMode}
        />
      );
    case "color":
      return (
        <ColorParameter param={param} value={value} onChange={onChange} currentMode={currentMode} />
      );
    case "boolean":
      return (
        <BooleanParameter
          param={param}
          value={value}
          onChange={onChange}
          currentMode={currentMode}
        />
      );
    case "select":
      return (
        <SelectParameter
          param={param}
          value={value}
          onChange={onChange}
          currentMode={currentMode}
        />
      );
    default:
      return null;
  }
}

interface ParameterPanelProps {
  parameters: EffectParameterDefinition[];
  values: Record<string, any>;
  onChange: (paramId: string, value: any) => void;
  currentMode: ParameterMode;
}

export function ParameterPanel({ parameters, values, onChange, currentMode }: ParameterPanelProps) {
  return (
    <div className="space-y-4">
      {parameters.map((param) => (
        <ParameterControl
          key={param.id}
          param={param}
          value={values[param.id] ?? param.default}
          onChange={(value) => onChange(param.id, value)}
          currentMode={currentMode}
        />
      ))}
    </div>
  );
}
