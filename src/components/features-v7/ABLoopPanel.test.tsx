import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ABLoopPanel } from "./ABLoopPanel";

const storeState = vi.hoisted(() => ({
  state: {
    isEnabled: false,
    pointA: null as number | null,
    pointB: null as number | null,
    isSettingPointA: false,
    isSettingPointB: false,
    loopCount: 0,
    toggleLoop: vi.fn(),
    setPointA: vi.fn(),
    setPointB: vi.fn(),
    clearPointA: vi.fn(),
    clearPointB: vi.fn(),
    clearBothPoints: vi.fn(),
    startSettingPointA: vi.fn(),
    startSettingPointB: vi.fn(),
    stopSettingPoint: vi.fn(),
  },
}));

vi.mock("@/store/abLoopStore", () => ({
  useABLoopStore: () => storeState.state,
}));

describe("ABLoopPanel", () => {
  beforeEach(() => {
    storeState.state.isEnabled = false;
    storeState.state.pointA = null;
    storeState.state.pointB = null;
    storeState.state.isSettingPointA = false;
    storeState.state.isSettingPointB = false;
    storeState.state.loopCount = 0;
  });

  it("renders readable controls for setting and clearing loop points", () => {
    storeState.state.pointA = 12;
    storeState.state.pointB = 36;

    const html = renderToStaticMarkup(
      <ABLoopPanel
        isOpen={true}
        onClose={() => undefined}
        currentTime={24}
        duration={60}
        seekTo={vi.fn()}
      />
    );

    expect(html).toContain("A-B Loop");
    expect(html).toContain("Enable loop");
    expect(html).toContain("Point A");
    expect(html).toContain("Point B");
    expect(html).toContain("Mark start");
    expect(html).toContain("Mark end");
    expect(html).toContain("Use current position");
    expect(html).toContain("Jump to A");
    expect(html).toContain("Jump to B");
    expect(html).toContain("Clear all markers");
  });

  it("shows active loop count in readable copy", () => {
    storeState.state.isEnabled = true;
    storeState.state.pointA = 10;
    storeState.state.pointB = 40;
    storeState.state.loopCount = 3;

    const html = renderToStaticMarkup(
      <ABLoopPanel
        isOpen={true}
        onClose={() => undefined}
        currentTime={24}
        duration={60}
        seekTo={vi.fn()}
      />
    );

    expect(html).toContain("Looping");
    expect(html).toContain("Looped");
    expect(html).toContain("3");
    expect(html).toContain("times");
  });
});
