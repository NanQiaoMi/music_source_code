import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  LiquidGlassFilter,
  MINERADIO_DISPERSION_FILTER_ID,
  MINERADIO_LIQUID_GLASS_SHADOW,
  MINERADIO_LIQUID_GLASS_SHADOW_LAYERS,
  MINERADIO_LIQUID_GLASS_CLASS,
  MINERADIO_LIQUID_GLASS_STYLE,
} from "./LiquidGlassFilter";

describe("LiquidGlassFilter & Mineradio Liquid Glass Engine", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
  });

  it("exports valid 8-layer physical mimetic shadow constants and CSS class names", () => {
    expect(MINERADIO_LIQUID_GLASS_CLASS).toBe("mineradio-liquid-glass");
    expect(MINERADIO_DISPERSION_FILTER_ID).toBe("mineradio-liquid-glass-filter");

    // Verify 8 distinct shadow layers
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS.length).toBe(8);

    // Layer 1: Top edge specular rim
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[0]).toBe("inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.65)");
    // Layer 2: Internal caustic glow
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[1]).toBe("inset 0 0 24px 2px rgba(255, 255, 255, 0.14)");
    // Layer 3: Bottom ambient bounce
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[2]).toBe("inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.20)");
    // Layer 4: Deep inner occlusion
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[3]).toBe("inset 0 12px 28px -10px rgba(0, 0, 0, 0.18)");
    // Layer 5: Contact base shadow
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[4]).toBe("0 2px 4px 0 rgba(0, 0, 0, 0.12)");
    // Layer 6: Near-field atmospheric dispersion
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[5]).toBe("0 10px 20px -2px rgba(0, 0, 0, 0.18)");
    // Layer 7: Mid-field volumetric drop
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[6]).toBe("0 24px 48px -6px rgba(0, 0, 0, 0.25)");
    // Layer 8: Far-field ambient dark halo
    expect(MINERADIO_LIQUID_GLASS_SHADOW_LAYERS[7]).toBe("0 40px 80px -12px rgba(0, 0, 0, 0.35)");

    expect(MINERADIO_LIQUID_GLASS_STYLE.backdropFilter).toContain("blur(48px)");
    expect(MINERADIO_LIQUID_GLASS_STYLE.boxShadow).toBe(MINERADIO_LIQUID_GLASS_SHADOW);
  });

  it("renders SVG displacement filter with 3-channel chromatic dispersion (Red: 180, Green: 170, Blue: 160)", () => {
    const markup = renderToStaticMarkup(<LiquidGlassFilter />);

    // SVG Defs
    expect(markup).toContain('id="svg-mineradio-liquid-glass-filter"');
    expect(markup).toContain('id="mineradio-liquid-glass-filter"');

    // Turbulence & Displacement Map
    expect(markup).toContain("feTurbulence");
    expect(markup).toContain("feDisplacementMap");

    // 3-Channel scales
    expect(markup).toContain('scale="180"'); // Red scale
    expect(markup).toContain('scale="170"'); // Green scale
    expect(markup).toContain('scale="160"'); // Blue scale

    // Chromatic dispersion color matrices
    expect(markup).toContain('result="dispRed"');
    expect(markup).toContain('result="dispGreen"');
    expect(markup).toContain('result="dispBlue"');
    expect(markup).toContain('result="redPass"');
    expect(markup).toContain('result="greenPass"');
    expect(markup).toContain('result="bluePass"');
    expect(markup).toContain('result="chromaticDispersion"');

    // Specular lighting & Glint
    expect(markup).toContain("feSpecularLighting");
    expect(markup).toContain('result="specularRefraction"');
  });

  it("supports custom filterId and dispersion scale overrides", () => {
    const markup = renderToStaticMarkup(
      <LiquidGlassFilter
        filterId="custom-liquid-filter"
        redScale={200}
        greenScale={190}
        blueScale={180}
        centerOffset={-60}
      />
    );

    expect(markup).toContain('id="custom-liquid-filter"');
    expect(markup).toContain('scale="200"');
    expect(markup).toContain('scale="190"');
    expect(markup).toContain('scale="180"');
    expect(markup).toContain('dx="-2"'); // -60 / 30 = -2
  });

  it("mounts in DOM tree cleanly without layout displacement", () => {
    act(() => {
      root?.render(<LiquidGlassFilter />);
    });

    const svg = container?.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.style.position).toBe("absolute");
    expect(svg?.style.width).toBe("0px");
    expect(svg?.style.height).toBe("0px");
  });
});
