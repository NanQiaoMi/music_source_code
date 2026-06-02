import { act } from "react";
import type { ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaylistStore } from "@/store/playlistStore";

type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
};

const mocks = vi.hoisted(() => ({
  getAllStoredMusic: vi.fn(),
  saveMusicFile: vi.fn(),
  deleteStoredMusic: vi.fn(),
  clearAllStoredMusic: vi.fn(),
  associateLyricsWithAudioFiles: vi.fn(),
  readTags: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, ...props }: MockImageProps) => <img {...props} />,
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLElement>;
    className?: string;
    style?: React.CSSProperties;
  } & Record<string, unknown>;

  const MotionDiv = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    ...props
  }: MotionProps) => React.createElement("div", props);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: {
      div: MotionDiv,
    },
  };
});

vi.mock("@/services/localMusicStorage", () => ({
  getAllStoredMusic: mocks.getAllStoredMusic,
  saveMusicFile: mocks.saveMusicFile,
  deleteStoredMusic: mocks.deleteStoredMusic,
  clearAllStoredMusic: mocks.clearAllStoredMusic,
}));

vi.mock("@/services/coverCache", () => ({
  getCoverFromCache: vi.fn().mockResolvedValue(null),
  saveCoverToCache: vi.fn().mockResolvedValue(undefined),
  deleteCoverFromCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/lyricsService", () => ({
  associateLyricsWithAudioFiles: mocks.associateLyricsWithAudioFiles,
}));

vi.mock("jsmediatags", () => ({
  default: {
    read: mocks.readTags,
  },
}));

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as unknown as FileList;

  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, {
      configurable: true,
      enumerable: true,
      value: file,
    });
  });

  return fileList;
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: createFileList(files),
  });
}

const playlistInitialState = usePlaylistStore.getInitialState();

describe("LocalMusicManager", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useRealTimers();
    mocks.getAllStoredMusic.mockReset().mockResolvedValue([]);
    mocks.saveMusicFile.mockReset().mockResolvedValue(undefined);
    mocks.deleteStoredMusic.mockReset().mockResolvedValue(undefined);
    mocks.clearAllStoredMusic.mockReset().mockResolvedValue(undefined);
    mocks.associateLyricsWithAudioFiles.mockReset().mockResolvedValue(new Map());
    mocks.readTags.mockReset().mockImplementation((_file, handlers) => handlers.onError());
    usePlaylistStore.setState(playlistInitialState, true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("shows a clear error when selected files contain no supported audio", async () => {
    const { LocalMusicManager } = await import("./LocalMusicManager");

    await act(async () => {
      root.render(<LocalMusicManager />);
    });

    const fileInput = container.querySelector('input[accept*=".mp3"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);

    setInputFiles(fileInput as HTMLInputElement, [
      new File(["not music"], "notes.txt", { type: "text/plain" }),
    ]);

    await act(async () => {
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain(
      "\u672a\u627e\u5230\u652f\u6301\u7684\u97f3\u9891\u6587\u4ef6"
    );
    expect(container.textContent).toContain("notes.txt");
    expect(mocks.saveMusicFile).not.toHaveBeenCalled();
  });
});
