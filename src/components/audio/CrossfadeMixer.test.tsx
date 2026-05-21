import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";

const songs: Song[] = [
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
  usePlaylistStore: () => ({ songs }),
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
  beforeEach(async () => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.resetModules();
    mocks.renderCrossfadePreview.mockReset();
    mocks.resolveAudioSourceBlob.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
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
});
