import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VisualTokens } from "./VisualTokens";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";

const rootStyle = () => document.documentElement.style;

describe("VisualTokens", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    useVisualSettingsStore.setState({ blurIntensity: 18, animationSpeed: 1.5 });
    rootStyle().removeProperty("--blur-intensity");
    rootStyle().removeProperty("--animation-speed");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      const mountedRoot = root;
      root = null;
      await act(async () => mountedRoot.unmount());
    }
    container.remove();
    rootStyle().removeProperty("--blur-intensity");
    rootStyle().removeProperty("--animation-speed");
    useVisualSettingsStore.setState(useVisualSettingsStore.getInitialState(), true);
  });

  it("renders nothing and writes both CSS variables", async () => {
    await act(async () => root?.render(<VisualTokens />));

    expect(container.innerHTML).toBe("");
    expect(rootStyle().getPropertyValue("--blur-intensity")).toBe("18px");
    expect(rootStyle().getPropertyValue("--animation-speed")).toBe("1.5s");
  });

  it("writes each variable once when the settings change", async () => {
    await act(async () => root?.render(<VisualTokens />));
    const setProperty = vi.spyOn(rootStyle(), "setProperty");

    await act(async () => {
      useVisualSettingsStore.setState({ blurIntensity: 24, animationSpeed: 0.75 });
    });

    expect(setProperty).toHaveBeenCalledTimes(2);
    expect(setProperty).toHaveBeenCalledWith("--blur-intensity", "24px");
    expect(setProperty).toHaveBeenCalledWith("--animation-speed", "0.75s");
    setProperty.mockRestore();
  });

  it("stops writing CSS variables after unmount", async () => {
    await act(async () => root?.render(<VisualTokens />));
    const mountedRoot = root;
    root = null;
    await act(async () => mountedRoot?.unmount());

    const setProperty = vi.spyOn(rootStyle(), "setProperty");
    await act(async () => {
      useVisualSettingsStore.setState({ blurIntensity: 30, animationSpeed: 2 });
    });

    expect(setProperty).not.toHaveBeenCalled();
    setProperty.mockRestore();
  });
});
