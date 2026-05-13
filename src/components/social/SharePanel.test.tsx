import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: any) => unknown) =>
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

    expect(html).toContain("Quick workflow");
    expect(html).toContain("Story");
    expect(html).toContain("Feed");
    expect(html).toContain("Export");
    expect(html).toContain("Checks");
    expect(html).toContain("Cover");
    expect(html).toContain("Resolution");
  });
});
