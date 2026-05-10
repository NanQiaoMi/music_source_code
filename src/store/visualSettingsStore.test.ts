import { describe, it, expect, beforeEach } from "vitest";
import { useVisualSettingsStore } from "./visualSettingsStore";

describe("visualSettingsStore - Theme Import/Export", () => {
  beforeEach(() => {
    useVisualSettingsStore.setState({
      customThemes: [],
      currentTheme: "dark",
      customTheme: undefined,
      blurIntensity: 20,
      shadowDepth: 15,
      animationSpeed: 1.0,
      perspectiveIntensity: 800,
      visualMode: "light",
      backgroundImage: undefined,
      backgroundBlur: 20,
      backgroundOpacity: 0.8,
      followSystemTheme: false,
      autoDayNight: false,
    });
  });

  it("exportCurrentTheme returns valid JSON", () => {
    const json = useVisualSettingsStore.getState().exportCurrentTheme("测试主题");
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("测试主题");
    expect(parsed.version).toBe("1.0");
    expect(parsed.colors).toBeDefined();
    expect(parsed.colors.primary).toBeDefined();
    expect(parsed.colors.secondary).toBeDefined();
    expect(parsed.colors.accent).toBeDefined();
    expect(parsed.colors.background).toBeDefined();
    expect(parsed.colors.surface).toBeDefined();
    expect(parsed.colors.text).toBeDefined();
  });

  it("exportCurrentTheme saves to customThemes", () => {
    useVisualSettingsStore.getState().exportCurrentTheme("保存的主题");
    const themes = useVisualSettingsStore.getState().customThemes;
    expect(themes.length).toBe(1);
    expect(themes[0].name).toBe("保存的主题");
  });

  it("importTheme restores settings from valid JSON", () => {
    const testColors = {
      primary: "#ff0000",
      secondary: "#00ff00",
      accent: "#0000ff",
      background: "#111111",
      surface: "#222222",
      text: "#ffffff",
    };
    const json = JSON.stringify({ name: "测试导入", version: "1.0", colors: testColors });
    const result = useVisualSettingsStore.getState().importTheme(json);
    expect(result).toBe(true);
    const state = useVisualSettingsStore.getState();
    expect(state.currentTheme).toBe("custom");
    expect(state.customTheme).toEqual(testColors);
  });

  it("importTheme returns false for invalid JSON", () => {
    const result = useVisualSettingsStore.getState().importTheme("not-json");
    expect(result).toBe(false);
  });

  it("importTheme returns false for JSON missing required fields", () => {
    const result = useVisualSettingsStore
      .getState()
      .importTheme(JSON.stringify({ name: "bad", version: "1.0" }));
    expect(result).toBe(false);
  });

  it("importTheme returns false when colors missing required keys", () => {
    const result = useVisualSettingsStore
      .getState()
      .importTheme(JSON.stringify({ name: "bad", version: "1.0", colors: { primary: "#fff" } }));
    expect(result).toBe(false);
  });

  it("getBuiltInThemes returns at least 3 themes", () => {
    const themes = useVisualSettingsStore.getState().getBuiltInThemes();
    expect(themes.length).toBeGreaterThanOrEqual(3);
    themes.forEach((theme) => {
      expect(theme.name).toBeDefined();
      expect(theme.colors.primary).toBeDefined();
    });
  });

  it("applyTheme sets custom theme colors", () => {
    const theme = {
      name: "测试",
      version: "1.0",
      colors: {
        primary: "#aa0000",
        secondary: "#bb0000",
        accent: "#cc0000",
        background: "#000000",
        surface: "#111111",
        text: "#ffffff",
      },
    };
    useVisualSettingsStore.getState().applyTheme(theme);
    const state = useVisualSettingsStore.getState();
    expect(state.currentTheme).toBe("custom");
    expect(state.customTheme?.primary).toBe("#aa0000");
  });

  it("deleteCustomTheme removes theme from customThemes", () => {
    useVisualSettingsStore.getState().exportCurrentTheme("待删除主题");
    expect(useVisualSettingsStore.getState().customThemes.length).toBe(1);
    useVisualSettingsStore.getState().deleteCustomTheme("待删除主题");
    expect(useVisualSettingsStore.getState().customThemes.length).toBe(0);
  });
});
