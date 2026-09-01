import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AILinerNotes } from "./AILinerNotes";
import { useAudioStore } from "@/store/audioStore";
import { useLinerNotesStore } from "@/store/linerNotesStore";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, ...props }: any) => React.createElement(prop, props, children);
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("AILinerNotes Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useLinerNotesStore.getState().clearCache();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders null when there is no currentSong", async () => {
    useAudioStore.setState({ currentSong: null });

    await act(async () => {
      root.render(<AILinerNotes />);
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders AI情感洞察 card when currentSong exists", async () => {
    useAudioStore.setState({
      currentSong: {
        id: "song-1",
        title: "晴天",
        artist: "周杰伦",
        duration: 240,
        source: "netease",
      },
    });

    await act(async () => {
      root.render(<AILinerNotes />);
    });

    expect(container.textContent).toContain("AI 情感洞察");
  });
});
