import { afterEach, describe, expect, it, vi } from "vitest";

async function loadFlags() {
  vi.resetModules();
  const { featureFlags } = await import("./featureFlags");
  return featureFlags;
}

describe("featureFlags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to the documented on/off values", async () => {
    for (const key of [
      "NEXT_PUBLIC_VL_QUEUE",
      "NEXT_PUBLIC_VL_SEARCH",
      "NEXT_PUBLIC_COVER_IMAGE_V2",
      "NEXT_PUBLIC_VISUAL_RUNTIME",
      "NEXT_PUBLIC_EFFECT_PLUGINS",
    ]) {
      vi.stubEnv(key, undefined);
    }
    expect(await loadFlags()).toEqual({
      virtualListQueue: true,
      virtualListSearch: true,
      coverImageV2: true,
      visualRuntime: true,
      effectPlugins: false,
    });
  });

  it("turns a flag off with NEXT_PUBLIC_VL_QUEUE=off", async () => {
    vi.stubEnv("NEXT_PUBLIC_VL_QUEUE", "off");
    expect((await loadFlags()).virtualListQueue).toBe(false);
  });

  it('does not treat "0" as off', async () => {
    vi.stubEnv("NEXT_PUBLIC_VL_QUEUE", "0");
    expect((await loadFlags()).virtualListQueue).toBe(true);
  });

  it("turns an off-by-default flag on with on/true", async () => {
    vi.stubEnv("NEXT_PUBLIC_EFFECT_PLUGINS", "true");
    expect((await loadFlags()).effectPlugins).toBe(true);
  });
});
