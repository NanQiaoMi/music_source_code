"use client";

import React, { useEffect } from "react";
import { usePresetStore } from "@/store/presetStore";
import { useVisualizationV8 } from "@/hooks/useVisualizationV8";
import { Star, Download, Upload, Trash2, Save } from "lucide-react";

interface PresetManagerPanelProps {
  onClose: () => void;
}

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
    ? presets.filter((p) => p.effectId === currentEffect.id)
    : [];

  const favorites = filteredPresets.filter((p) => p.isFavorite);
  const others = filteredPresets.filter((p) => !p.isFavorite);

  const handleSaveCurrent = () => {
    if (!currentEffect || !currentEffectId) return;

    const currentParams = effectParams[currentEffectId] || {};

    const preset = {
      id: crypto.randomUUID(),
      name: `${currentEffect.name} - 自定义`,
      effectId: currentEffect.id,
      tags: ["自定义"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSystem: false,
      isFavorite: false,
      parameters: { ...currentParams },
    };

    addPreset(preset);
  };

  const handleApplyPreset = (preset: any) => {
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
    const a = document.createElement("a");
    a.href = url;
    a.download = `preset-${presetId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const preset = importPreset(event.target?.result as string);
          if (preset) {
            handleApplyPreset(preset);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const renderPresetCard = (preset: any) => (
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
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(preset.id);
            }}
            className="text-yellow-400 hover:text-yellow-300"
          >
            <Star size={16} fill={preset.isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExport(preset.id);
            }}
            className="text-blue-400 hover:text-blue-300"
          >
            <Download size={16} />
          </button>
          {!preset.isSystem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deletePreset(preset.id);
              }}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {preset.description && <p className="text-gray-400 text-xs mb-2">{preset.description}</p>}
      <div className="flex flex-wrap gap-1">
        {preset.tags.map((tag: string) => (
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
          <h2 className="text-xl font-bold text-white">预设管理</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveCurrent}
              disabled={!currentEffect}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm"
            >
              <Save size={16} />
              保存当前
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
            >
              <Upload size={16} />
              导入
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 min-h-0">
          {!currentEffect ? (
            <div className="text-center text-gray-400 py-12">请先选择一个可视化效果</div>
          ) : filteredPresets.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              暂无预设，点击"保存当前"创建第一个
            </div>
          ) : (
            <>
              {favorites.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Star size={16} className="text-yellow-400" />
                    收藏
                  </h3>
                  <div className="space-y-2">{favorites.map(renderPresetCard)}</div>
                </div>
              )}

              {others.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3">
                    {favorites.length > 0 ? "其他" : "预设"}
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
