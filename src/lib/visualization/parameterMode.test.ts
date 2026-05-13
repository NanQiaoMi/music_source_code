import { describe, expect, it } from "vitest";
import { shouldShowParameterMode } from "./parameterMode";

describe("shouldShowParameterMode", () => {
  it("shows only basic parameters in basic mode", () => {
    expect(shouldShowParameterMode("basic", "basic")).toBe(true);
    expect(shouldShowParameterMode("professional", "basic")).toBe(false);
    expect(shouldShowParameterMode("expert", "basic")).toBe(false);
  });

  it("shows basic and professional parameters in professional mode", () => {
    expect(shouldShowParameterMode("basic", "professional")).toBe(true);
    expect(shouldShowParameterMode("professional", "professional")).toBe(true);
    expect(shouldShowParameterMode("expert", "professional")).toBe(false);
  });

  it("shows every parameter in expert mode", () => {
    expect(shouldShowParameterMode("basic", "expert")).toBe(true);
    expect(shouldShowParameterMode("professional", "expert")).toBe(true);
    expect(shouldShowParameterMode("expert", "expert")).toBe(true);
  });
});
