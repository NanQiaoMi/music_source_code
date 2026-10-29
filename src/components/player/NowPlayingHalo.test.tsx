import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

describe("NowPlayingHalo", () => {
  beforeEach(async () => {
    localStorage.clear();
    const { usePlayerSkinStore } = await import("@/store/playerSkinStore");
    const { visualRuntime } = await import("@/runtime/visualRuntime");

    usePlayerSkinStore.setState({ activeHaloId: "vinyl" });
    // S6-8c：halo 读取 performanceV8Store 的 runtime 档位投影；high = 60 FPS。
    visualRuntime.setQuality("high");
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
