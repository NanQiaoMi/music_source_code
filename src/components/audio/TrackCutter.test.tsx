import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedCUE } from "@/lib/audio/cueParser";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: "div",
  },
}));

function setInputFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    value: [file],
    configurable: true,
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function flushFileInput() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderTrackCutter() {
  const { default: TrackCutter } = await import("./TrackCutter");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<TrackCutter isOpen={true} onClose={() => undefined} />);
  });

  return { container, root };
}

const parsedCue: ParsedCUE = {
  title: "Live Album",
  performer: "Test Artist",
  file: "album.wav",
  totalDuration: 360,
  tracks: [
    {
      number: 1,
      type: "AUDIO",
      title: "Intro",
      performer: "Test Artist",
      indices: [{ number: 1, minutes: 0, seconds: 0, frames: 0 }],
    },
    {
      number: 2,
      type: "AUDIO",
      title: "Finale",
      performer: "Test Artist",
      indices: [{ number: 1, minutes: 3, seconds: 0, frames: 0 }],
    },
  ],
};

describe("TrackCutter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows invalid CUE feedback inside the panel instead of using a blocking alert", async () => {
    const { container, root } = await renderTrackCutter();
    const cueInput = container.querySelector('input[accept=".cue"]') as HTMLInputElement;

    await act(async () => {
      setInputFile(cueInput, new File([""], "empty.cue", { type: "text/plain" }));
      await flushFileInput();
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(container.textContent).toContain("CUE \u6587\u4ef6\u65e0\u6548");
    expect(container.textContent).toContain("CUE file is empty");

    await act(async () => root.unmount());
  });

  it("keeps the no-selected-tracks state visible next to the disabled cut action", async () => {
    const { container, root } = await renderTrackCutter();
    const audioInput = container.querySelector('input[accept="audio/*"]') as HTMLInputElement;

    await act(async () => {
      setInputFile(
        audioInput,
        new File([new Uint8Array([1, 2, 3])], "album.wav", {
          type: "audio/wav",
        })
      );
      await flushFileInput();
    });

    const { useTrackCuttingStore } = await import("@/store/trackCuttingStore");
    const taskId = useTrackCuttingStore.getState().tasks[0]?.id;
    expect(taskId).toBeDefined();

    await act(async () => {
      useTrackCuttingStore.getState().setParsedCUE(taskId, parsedCue);
      useTrackCuttingStore.getState().deselectAllTracks(taskId);
    });

    expect(container.textContent).toContain("0 / 2 \u5df2\u9009\u62e9");
    expect(container.textContent).toContain(
      "\u8bf7\u9009\u62e9\u81f3\u5c11\u4e00\u4e2a\u8981\u5207\u5272\u7684\u97f3\u8f68"
    );

    await act(async () => root.unmount());
  });
});
