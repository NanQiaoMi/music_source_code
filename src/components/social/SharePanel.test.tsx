import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: LegacyAny) => unknown) =>
    selector({
      currentSong: {
        id: "song-1",
        title: "Poster Song",
        artist: "Poster Artist",
        album: "Poster Album",
        duration: 180,
        cover: "/default-cover.png",
        audioUrl: "/demo.mp3",
        lyrics: "[00:01.00]First line\n[00:02.00]Second line",
      },
    }),
}));

vi.mock("@/components/shared/GlassToast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SharePanel", () => {
  it("renders poster workflow presets and quality checks", async () => {
    const { SharePanel } = await import("./SharePanel");

    const html = renderToStaticMarkup(<SharePanel isOpen={true} onClose={() => undefined} />);

    // Quick presets section
    expect(html).toContain("\u5feb\u901f\u9884\u8bbe");
    expect(html).toContain("\u52a8\u6001");
    expect(html).toContain("\u5bfc\u51fa"); // 瀵煎嚭
    expect(html).toContain("\u8d28\u91cf"); // 璐ㄩ噺
    expect(html).toContain("\u68c0\u67e5");
    expect(html).toContain("\u5c01\u9762"); // 灏侀潰
    expect(html).toContain("\u5206\u8fa8\u7387");
  });
});
