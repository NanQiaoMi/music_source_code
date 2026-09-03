import { describe, it, expect, beforeEach, vi } from "vitest";
import { useLinerNotesStore, isOldRepetitiveFallback } from "./linerNotesStore";
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

  it("identifies old repetitive fallback templates correctly", () => {
    expect(
      isOldRepetitiveFallback("沉入深海三千米处的静止气压，任由《GOODNESS(FUNK)》的幽蓝微沙将一切应激情绪吞没。")
    ).toBe(true);
    expect(isOldRepetitiveFallback("沉入深海三千米处的静止气压，任由《晴天》的幽蓝潮汐将一切喧嚣悄然吞没。")).toBe(true);
    expect(isOldRepetitiveFallback("暗金色的融化蜜糖裹着暖风")).toBe(false);
  });

  it("bypasses cache and re-fetches from AI when cached note is an old repetitive fallback", async () => {
    // 模拟之前持久化存入的旧版本雷同模板
    useLinerNotesStore.setState({
      notes: {
        "周杰伦-晴天": "沉入深海三千米处的静止气压，任由《晴天》的幽蓝潮汐将一切喧嚣悄然吞没。",
      },
    });

    const note = await useLinerNotesStore.getState().getNotes("周杰伦", "晴天");
    // 应该跳过旧版重复模板，重新通过 AI 获取
    expect(note).toBe("琉璃光晕在温暖的微风中摇曳生姿");
  });
});
