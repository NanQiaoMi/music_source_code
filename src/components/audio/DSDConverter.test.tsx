import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";

const songs: Song[] = [
  {
    id: "dsd-song",
    title: "Native DSD",
    artist: "Test Artist",
    album: "Source Album",
    duration: 180,
    source: "local",
    audioUrl: "stored://dsd-song",
    format: "DSD128",
  },
];

const mocks = vi.hoisted(() => ({
  reportUsage: vi.fn(),
  resolveDSDSourceBlob: vi.fn(),
}));

type WorkerListener = (event: MessageEvent) => void;

class MockWorker {
  static instances: MockWorker[] = [];

  postMessage = vi.fn();
  terminate = vi.fn();
  private listeners = new Set<WorkerListener>();

  constructor(_url: URL) {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, listener: WorkerListener) {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: WorkerListener) {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  emit(data: unknown) {
    const event = { data } as MessageEvent;
    this.listeners.forEach((listener) => listener(event));
  }
}

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: "div",
  },
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: () => ({ songs }),
}));

vi.mock("@/store/statsAchievementsStore", () => ({
  useStatsAchievementsStore: (
    selector: (state: { reportProToolsUsage: typeof mocks.reportUsage }) => unknown
  ) => selector({ reportProToolsUsage: mocks.reportUsage }),
}));

vi.mock("@/lib/audio/dsdSource", () => ({
  resolveDSDSourceBlob: mocks.resolveDSDSourceBlob,
}));

beforeEach(async () => {
  localStorage.clear();
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
  mocks.reportUsage.mockReset();
  mocks.resolveDSDSourceBlob.mockReset();
  mocks.resolveDSDSourceBlob.mockResolvedValue({
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/dsd" }),
    sourceLabel: "demo.dsf",
  });

  const { useDSDProcessingStore } = await import("@/store/dsdProcessingStore");
  useDSDProcessingStore.setState({
    tasks: [],
    currentTaskId: null,
    totalProcessed: 0,
    totalFailed: 0,
    settings: {
      outputMode: "pcm",
      targetSampleRate: 352800,
      dsdQuality: "high",
      filterType: "sharp",
      volumeNormalization: false,
      dithering: true,
    },
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("DSDConverter", () => {
  it("converts a queued DSD task with the resolved source blob", async () => {
    const { default: DSDConverter } = await import("./DSDConverter");
    const { useDSDProcessingStore } = await import("@/store/dsdProcessingStore");
    useDSDProcessingStore.getState().addTask("dsd-song", "Native DSD", "dsd128");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<DSDConverter isOpen={true} onClose={() => undefined} />);
    });

    const getButtons = () => Array.from(container.querySelectorAll("button"));
    const queueTab = getButtons()[2];
    expect(queueTab).toBeDefined();

    await act(async () => {
      queueTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const startButton = getButtons()[4];
    expect(startButton).toBeDefined();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const worker = MockWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "convertDSD",
        data: expect.objectContaining({
          sourceRate: "dsd128",
          targetSampleRate: 352800,
          outputMode: "pcm",
        }),
      })
    );
    expect(worker.postMessage.mock.calls[0][0].data.fileBlob.size).toBe(4);
    expect(mocks.resolveDSDSourceBlob).toHaveBeenCalledWith(
      expect.objectContaining({ id: "dsd-song", audioUrl: "stored://dsd-song" })
    );

    await act(async () => {
      worker.emit({ type: "progress", data: { progress: 42 } });
    });

    expect(useDSDProcessingStore.getState().tasks[0].progress).toBe(42);

    const outputBlob = new Blob([new Uint8Array([9])], { type: "audio/wav" });
    await act(async () => {
      worker.emit({ type: "complete", data: { outputBlob } });
    });

    const task = useDSDProcessingStore.getState().tasks[0];
    expect(task.status).toBe("completed");
    expect(task.outputBlob).toBe(outputBlob);
    expect(useDSDProcessingStore.getState().totalProcessed).toBe(1);
    expect(mocks.reportUsage).toHaveBeenCalledWith("dsd_conv");

    await act(async () => {
      root.unmount();
    });
  });
});
