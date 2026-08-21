import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

describe("NowPlayingHalo", () => {
  beforeEach(async () => {
    localStorage.clear();
    const { usePlayerSkinStore } = await import("@/store/playerSkinStore");
    const { usePerformanceV8Store } = await import("@/store/performanceV8Store");

    usePlayerSkinStore.setState({ activeHaloId: "vinyl" });
    usePerformanceV8Store.setState({
      config: {
        level: "high",
        targetFPS: 60,
        maxParticles: 8000,
        postProcessing: true,
        webglQuality: "high",
      },
    });
  });

  it("renders the persisted now-playing halo skin around cover art", async () => {
    const { NowPlayingHalo } = await import("./NowPlayingHalo");

    const html = renderToStaticMarkup(
      <NowPlayingHalo currentTime={12} isPlaying={true} level={0.7} size={72} />
    );

    expect(html).toContain("Vinyl now playing halo");
    expect(html).toContain("data-halo-skin");
    expect(html).toContain("vinyl");
    expect(html).toContain("data-halo-render-mode");
    expect(html).toContain("animated");
    expect(html).toContain("width");
    expect(html).toContain("72");
  });
});
