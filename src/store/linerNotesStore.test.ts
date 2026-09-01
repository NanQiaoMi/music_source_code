import { describe, it, expect, beforeEach, vi } from "vitest";
import { useLinerNotesStore } from "./linerNotesStore";
import { useAIStore } from "./aiStore";

describe("linerNotesStore", () => {
  beforeEach(() => {
    useLinerNotesStore.getState().clearCache();
    useAIStore.getState().setEnabled(true);
    vi.restoreAllMocks();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "琉璃光晕在温暖的微风中摇曳生姿",
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("generates notes successfully with AI", async () => {
    const note = await useLinerNotesStore
      .getState()
      .getNotes("周杰伦", "晴天", "故事的小黄花 从出生那年就飘着", { x: 0.5, y: 0.5 });

    expect(note).toBeTruthy();
    expect(typeof note).toBe("string");
    expect(note).toBe("琉璃光晕在温暖的微风中摇曳生姿");
  });

  it("caches generated notes and returns cached version on subsequent calls", async () => {
    const note1 = await useLinerNotesStore
      .getState()
      .getNotes("周杰伦", "七里香", "窗外的麻雀 在电线杆上多嘴");

    const note2 = await useLinerNotesStore
      .getState()
      .getNotes("周杰伦", "七里香", "窗外的麻雀 在电线杆上多嘴");

    expect(note1).toBe(note2);
  });

  it("supports forceRefresh to regenerate notes", async () => {
    const note1 = await useLinerNotesStore.getState().getNotes("Taylor Swift", "Cardigan");
    expect(note1).toBeTruthy();

    const note2 = await useLinerNotesStore
      .getState()
      .getNotes("Taylor Swift", "Cardigan", undefined, undefined, true);
    expect(note2).toBeTruthy();
  });
});
