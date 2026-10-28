import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";

const baseSongs: Song[] = [
  {
    id: "from-song",
    title: "Intro Track",
    artist: "Test Artist",
    album: "Mix Source",
    duration: 180,
    source: "local",
    audioUrl: "stored://from-song",
    format: "mp3",
  },
  {
    id: "to-song",
    title: "Next Track",
    artist: "Test Artist",
    album: "Mix Source",
    duration: 180,
    source: "local",
    audioUrl: "stored://to-song",
    format: "mp3",
  },
];

// Mutable so windowing tests can swap in a 500-song library without remocking.
let songs: Song[] = baseSongs;

const makeSongs = (count: number): Song[] =>
  Array.from({ length: count }, (_, index) => ({
    id: "song-" + index,
    title: "Track " + index,
    artist: "Artist " + index,
    duration: 200,
    source: "local",
  }));

const VIEWPORT_HEIGHT = 256;
// Must match CROSSFADE_SONG_ROW_HEIGHT in CrossfadeMixer.tsx (64px row + 8px gap).
const CROSSFADE_SONG_ROW_HEIGHT = 72;

const mocks = vi.hoisted(() => ({
  renderCrossfadePreview: vi.fn(),
  resolveAudioSourceBlob: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: "div",
  },
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: (selector: (state: { songs: typeof songs }) => unknown) => selector({ songs }),
}));

vi.mock("@/lib/audio/audioSource", () => ({
  resolveAudioSourceBlob: mocks.resolveAudioSourceBlob,
}));

vi.mock("@/lib/audio/crossfadeRenderer", () => ({
  renderCrossfadePreview: mocks.renderCrossfadePreview,
}));

function clickButton(button: Element | undefined) {
  if (!button) throw new Error("Missing button");
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function renderMixer() {
  const { default: CrossfadeMixer } = await import("./CrossfadeMixer");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<CrossfadeMixer isOpen={true} onClose={() => undefined} />);
  });

  return { container, root };
}

async function seedPendingCrossfadeTask() {
  const { useCrossfadeStore } = await import("@/store/crossfadeStore");
  useCrossfadeStore.getState().addToQueue("from-song", "to-song", 120, 122);
  return useCrossfadeStore;
}

describe("CrossfadeMixer", () => {
  let originalClientHeight: PropertyDescriptor | undefined;

  beforeEach(async () => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.resetModules();
    songs = baseSongs;
    mocks.renderCrossfadePreview.mockReset();
    mocks.resolveAudioSourceBlob.mockReset();
    originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => VIEWPORT_HEIGHT,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
  });

  it("marks queued tasks preview-only when local crossfade rendering is unavailable", async () => {
    const useCrossfadeStore = await seedPendingCrossfadeTask();
    const { container, root } = await renderMixer();

    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () => clickButton(buttons[2]));
    const queueButtons = Array.from(container.querySelectorAll("button"));
    await act(async () => clickButton(queueButtons[4]));

    const task = useCrossfadeStore.getState().queue[0];
    expect(task.status).toBe("preview-only");
    expect(task.outputBlob).toBeUndefined();
    expect(task.error).toContain("Local crossfade rendering is not available");
    expect(mocks.resolveAudioSourceBlob).not.toHaveBeenCalled();
    expect(mocks.renderCrossfadePreview).not.toHaveBeenCalled();
    expect(useCrossfadeStore.getState().totalProcessed).toBe(1);

    await act(async () => root.unmount());
  });

  it("renders a real WAV preview blob when local crossfade rendering is available", async () => {
    vi.stubGlobal("OfflineAudioContext", function OfflineAudioContext() {});
    const outputBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
    const fromBlob = new Blob([new Uint8Array([4])], { type: "audio/mp3" });
    const toBlob = new Blob([new Uint8Array([5])], { type: "audio/mp3" });
    mocks.resolveAudioSourceBlob
      .mockResolvedValueOnce({ blob: fromBlob, sourceLabel: "from.mp3", inferredFormat: "mp3" })
      .mockResolvedValueOnce({ blob: toBlob, sourceLabel: "to.mp3", inferredFormat: "mp3" });
    mocks.renderCrossfadePreview.mockImplementation(async ({ onProgress }) => {
      onProgress?.(55);
      return outputBlob;
    });

    const useCrossfadeStore = await seedPendingCrossfadeTask();
    const { container, root } = await renderMixer();

    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () => clickButton(buttons[2]));
    const queueButtons = Array.from(container.querySelectorAll("button"));
    await act(async () => clickButton(queueButtons[4]));

    expect(mocks.resolveAudioSourceBlob).toHaveBeenCalledWith(songs[0]);
    expect(mocks.resolveAudioSourceBlob).toHaveBeenCalledWith(songs[1]);
    expect(mocks.renderCrossfadePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlob,
        toBlob,
        durationSeconds: 5,
        curveType: "s-curve",
      })
    );
    const task = useCrossfadeStore.getState().queue[0];
    expect(task.status).toBe("completed");
    expect(task.progress).toBe(100);
    expect(task.outputBlob).toBe(outputBlob);
    expect(useCrossfadeStore.getState().totalProcessed).toBe(1);

    await act(async () => root.unmount());
  });

  it("renders a bounded DOM window for a 500-song BPM list", async () => {
    songs = makeSongs(500);
    const { container, root } = await renderMixer();

    const rows = container.querySelectorAll("[data-crossfade-index]");
    // 256px / 72px = 4 viewport rows + 5 overscan; the other ~491 rows stay unmounted.
    expect(rows).toHaveLength(9);
    expect(rows.length).toBeLessThan(100);
    expect(container.textContent).toContain("Track 0");
    expect(container.textContent).not.toContain("Track 400");

    await act(async () => root.unmount());
  });

  it("renders the correct rows after scrolling the BPM list to the end", async () => {
    songs = makeSongs(500);
    const { container, root } = await renderMixer();

    const list = container.querySelector<HTMLElement>("[data-virtual-list]");
    expect(list).not.toBeNull();
    list!.scrollTop = 499 * CROSSFADE_SONG_ROW_HEIGHT;
    await act(async () => {
      list!.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(container.textContent).toContain("Track 499");
    expect(container.textContent).not.toContain("Track 0");
    const indices = Array.from(container.querySelectorAll("[data-crossfade-index]")).map((el) =>
      Number(el.getAttribute("data-crossfade-index"))
    );
    expect(indices).toContain(499);
    expect(Math.min(...indices)).toBeGreaterThan(480);

    await act(async () => root.unmount());
  });

  it("selects the clicked row at its original index and keeps select-all working", async () => {
    songs = makeSongs(500);
    const { container, root } = await renderMixer();

    const row = container.querySelector('[data-crossfade-index="7"]');
    expect(row).not.toBeNull();
    await act(async () => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toMatch(/已选择\s*1\s*首歌曲/);
    expect(
      container.querySelector('[data-crossfade-index="7"]')?.getAttribute("data-selected")
    ).toBe("true");

    const selectAll = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "全选"
    );
    expect(selectAll).toBeDefined();
    await act(async () => {
      selectAll?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toMatch(/已选择\s*500\s*首歌曲/);

    await act(async () => root.unmount());
  });
});
