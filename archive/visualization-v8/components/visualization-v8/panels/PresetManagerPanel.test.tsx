import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EffectPlugin } from "@/lib/visualization/types";

const storeState = vi.hoisted(() => ({
  presets: [] as Array<{
    id: string;
    name: string;
    effectId: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
    isSystem: boolean;
    isFavorite: boolean;
    parameters: Record<string, unknown>;
  }>,
}));

const mockEffect: EffectPlugin = {
  id: "spectrum-v8",
  name: "Spectrum",
  category: "spectrum",
  description: "Spectrum test effect",
  preferredEngine: "canvas",
  parameters: [],
  init: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
};

let currentEffect: EffectPlugin | undefined = undefined;

vi.mock("@/store/presetStore", () => ({
  usePresetStore: () => ({
    presets: storeState.presets,
    currentPresetId: null,
    loadSystemPresets: vi.fn(),
    addPreset: vi.fn(),
    setCurrentPreset: vi.fn(),
    toggleFavorite: vi.fn(),
    deletePreset: vi.fn(),
    exportPreset: vi.fn(() => ""),
    importPreset: vi.fn(() => null),
  }),
}));

vi.mock("@/hooks/useVisualizationV8", () => ({
  useVisualizationV8: () => ({
    currentEffect,
    currentEffectId: currentEffect?.id,
    effectParams: {},
    updateParam: vi.fn(),
  }),
}));

describe("PresetManagerPanel", () => {
  it("renders readable empty state when no effect is selected", async () => {
    const { PresetManagerPanel } = await import("./PresetManagerPanel");
    currentEffect = undefined;
    storeState.presets = [];

    const html = renderToStaticMarkup(<PresetManagerPanel onClose={() => undefined} />);

    expect(html).toContain("预设管理");
    expect(html).toContain("请先选择一个可视化效果");
    expect(html).toContain("保存当前");
    expect(html).toContain("导入");
  });

  it("renders readable empty state when the selected effect has no presets", async () => {
    const { PresetManagerPanel } = await import("./PresetManagerPanel");
    currentEffect = mockEffect;
    storeState.presets = [];

    const html = renderToStaticMarkup(<PresetManagerPanel onClose={() => undefined} />);

    expect(html).toContain("暂无预设，点击“保存当前”创建第一个");
  });
});
