import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EffectPlugin, ParameterMode } from "@/lib/visualization/types";

const mockEffect: EffectPlugin = {
  id: "spectrum-modern",
  name: "Spectrum Modern",
  category: "spectrum",
  description: "Test spectrum effect",
  preferredEngine: "canvas",
  parameters: [],
  init: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
};

let visualizationParameterMode: ParameterMode = "basic";
const setVisualizationParameterMode = vi.fn((mode: ParameterMode) => {
  visualizationParameterMode = mode;
});

vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    currentView: "visualization",
    setCurrentView: vi.fn(),
    isTransitioning: false,
    setIsTransitioning: vi.fn(),
  }),
}));

vi.mock("@/store/visualizationV8Store", () => ({
  useVisualizationV8Store: (selector?: (state: LegacyAny) => unknown) => {
    const state = {
      parameterMode: visualizationParameterMode,
      setParameterMode: setVisualizationParameterMode,
    };

    return selector ? selector(state) : state;
  },
}));

vi.mock("@/hooks/useAudioPlayer", () => ({
  useAudioPlayer: () => ({
    seek: vi.fn(),
  }),
}));

vi.mock("@/hooks/useVisualizationV8", () => ({
  useVisualizationV8: () => ({
    effects: [mockEffect],
    currentEffectId: mockEffect.id,
    currentEffect: mockEffect,
    effectParams: {},
    setCurrentEffectId: vi.fn(),
    updateParam: vi.fn(),
    renderEffect: vi.fn(),
    getCurrentParams: () => ({}),
    isInitialized: true,
  }),
}));

vi.mock("./engines/RenderEngineManager", () => ({
  RenderEngineManager: () => <canvas data-testid="render-engine" />,
}));

vi.mock("./ResonanceTotemLayer", () => ({
  ResonanceTotemLayer: () => <div data-testid="totem-layer" />,
}));

vi.mock("./shared/VisualControlDrawer", () => ({
  VisualControlDrawer: ({ parameterMode }: { parameterMode: string }) => (
    <div data-parameter-mode={parameterMode}>parameter mode: {parameterMode}</div>
  ),
}));

describe("VisualizationViewV8", () => {
  it("uses persisted visualization parameter mode for the control drawer", async () => {
    const { VisualizationViewV8 } = await import("./VisualizationViewV8");
    visualizationParameterMode = "expert";

    const html = renderToStaticMarkup(<VisualizationViewV8 />);

    expect(html).toContain("parameter mode: expert");
  });
});
