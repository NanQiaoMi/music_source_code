"use client";

import React, { useEffect } from "react";
import { usePresetStore } from "@/store/presetStore";
import { useVisualizationV8 } from "@/hooks/useVisualizationV8";
import type { EffectPreset } from "@/lib/visualization/types";
import { Star, Download, Upload, Trash2, Save, X } from "lucide-react";

interface PresetManagerPanelProps {
  onClose: () => void;
}

const PRESET_COPY = {
  title: "\u9884\u8bbe\u7ba1\u7406",
  saveCurrent: "\u4fdd\u5b58\u5f53\u524d",
  import: "\u5bfc\u5165",
  close: "\u5173\u95ed",
  chooseEffect: "\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u53ef\u89c6\u5316\u6548\u679c",
  noPresets:
    "\u6682\u65e0\u9884\u8bbe\uff0c\u70b9\u51fb\u201c\u4fdd\u5b58\u5f53\u524d\u201d\u521b\u5efa\u7b2c\u4e00\u4e2a",
  favorites: "\u6536\u85cf",
  other: "\u5176\u4ed6",
  presets: "\u9884\u8bbe",
};

export function PresetManagerPanel({ onClose }: PresetManagerPanelProps) {
  const {
    presets,
    currentPresetId,
    loadSystemPresets,
    addPreset,
    setCurrentPreset,
    toggleFavorite,
    deletePreset,
    exportPreset,
    importPreset,
  } = usePresetStore();

  const { currentEffect, effectParams, currentEffectId, updateParam } = useVisualizationV8();

  useEffect(() => {
    if (presets.length === 0) {
      loadSystemPresets();
    }
  }, [presets.length, loadSystemPresets]);

  const filteredPresets = currentEffect
    ? presets.filter((preset) => preset.effectId === currentEffect.id)
    : [];

  const favorites = filteredPresets.filter((preset) => preset.isFavorite);
  const others = filteredPresets.filter((preset) => !preset.isFavorite);

  const handleSaveCurrent = () => {
    if (!currentEffect || !currentEffectId) return;

    const currentParams = effectParams[currentEffectId] || {};

    const preset: EffectPreset = {
      id: crypto.randomUUID(),
      name: `${currentEffect.name} - Custom`,
      effectId: currentEffect.id,
      tags: ["custom"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSystem: false,
      isFavorite: false,
      parameters: { ...currentParams },
    };

    addPreset(preset);
  };

  const handleApplyPreset = (preset: EffectPreset) => {
    if (!currentEffectId) return;

    setCurrentPreset(preset.id);

    Object.entries(preset.parameters).forEach(([key, value]) => {
      updateParam(currentEffectId, key, value);
    });
  };

  const handleExport = (presetId: string) => {
    const json = exportPreset(presetId);
    if (!json) return;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `preset-${presetId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (event: Event) => {
      const fileInput = event.currentTarget as HTMLInputElement;
      const file = fileInput.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const result = readerEvent.target?.result;
        if (typeof result !== "string") return;

        const preset = importPreset(result);
        if (preset) {
          handleApplyPreset(preset);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const renderPresetCard = (preset: EffectPreset) => (
    <div
      key={preset.id}
      className={`p-4 rounded-lg cursor-pointer transition-all ${
        currentPresetId === preset.id
          ? "bg-purple-500/30 border border-purple-500"
          : "bg-white/5 border border-white/10 hover:bg-white/10"
      }`}
      onClick={() => handleApplyPreset(preset)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-medium text-sm">{preset.name}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(preset.id);
            }}
            className="text-yellow-400 hover:text-yellow-300"
            aria-label="Toggle favorite preset"
          >
            <Star size={16} fill={preset.isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleExport(preset.id);
            }}
            className="text-blue-400 hover:text-blue-300"
            aria-label="Export preset"
          >
            <Download size={16} />
          </button>
          {!preset.isSystem && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                deletePreset(preset.id);
              }}
              className="text-red-400 hover:text-red-300"
              aria-label="Delete preset"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {preset.description && <p className="text-gray-400 text-xs mb-2">{preset.description}</p>}
      <div className="flex flex-wrap gap-1">
        {preset.tags.map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-300">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 rounded-xl border border-white/20 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{PRESET_COPY.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveCurrent}
              disabled={!currentEffect}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm"
            >
              <Save size={16} />
              {PRESET_COPY.saveCurrent}
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
            >
              <Upload size={16} />
              {PRESET_COPY.import}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
              aria-label={PRESET_COPY.close}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 min-h-0">
          {!currentEffect ? (
            <div className="text-center text-gray-400 py-12">{PRESET_COPY.chooseEffect}</div>
          ) : filteredPresets.length === 0 ? (
            <div className="text-center text-gray-400 py-12">{PRESET_COPY.noPresets}</div>
          ) : (
            <>
              {favorites.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Star size={16} className="text-yellow-400" />
                    {PRESET_COPY.favorites}
                  </h3>
                  <div className="space-y-2">{favorites.map(renderPresetCard)}</div>
                </div>
              )}

              {others.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3">
                    {favorites.length > 0 ? PRESET_COPY.other : PRESET_COPY.presets}
                  </h3>
                  <div className="space-y-2">{others.map(renderPresetCard)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
