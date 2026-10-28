/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（framer-motion/next-image mock）用宽松类型是刻意的
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BatchMetadataEditor } from "./BatchMetadataEditor";
import { usePlaylistStore } from "@/store/playlistStore";
import { useMetadataEditorStore } from "@/store/metadataEditorStore";
import type { Song } from "@/types/song";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, ...props }: any) => React.createElement(prop, props, children);
      },
    }
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    sizes: _sizes,
    unoptimized: _unoptimized,
    blurDataURL: _blurDataURL,
    placeholder: _placeholder,
    ...props
  }: any) => <img {...props} alt={props.alt || ""} />,
}));

const VIEWPORT_HEIGHT = 384;
// Must match SONG_ROW_HEIGHT in BatchMetadataEditor.tsx (72px row + 8px gap).
const SONG_ROW_HEIGHT = 80;

const makeSongs = (count: number): Song[] =>
  Array.from({ length: count }, (_, index) => ({
    id: "song-" + index,
    title: "Track " + index,
    artist: "Artist " + index,
    duration: 200,
    source: "local",
  }));

describe("BatchMetadataEditor", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalClientHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    localStorage.clear();
    originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => VIEWPORT_HEIGHT,
    });

    usePlaylistStore.setState({ songs: makeSongs(500) });
    useMetadataEditorStore.setState(useMetadataEditorStore.getInitialState(), true);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
    localStorage.clear();
  });

  const renderEditor = async () => {
    await act(async () => {
      root.render(<BatchMetadataEditor />);
    });
  };

  it("renders a bounded DOM window for 500 library songs", async () => {
    await renderEditor();

    const rows = container.querySelectorAll("[data-song-index]");
    // 384px / 80px = 4 viewport rows + 5 overscan; the other ~491 rows stay unmounted.
    expect(rows).toHaveLength(10);
    expect(rows.length).toBeLessThan(100);
    expect(container.textContent).toContain("Track 0");
    expect(container.textContent).not.toContain("Track 400");
  });

  it("renders the correct rows after scrolling the source list to the end", async () => {
    await renderEditor();

    const list = container.querySelector<HTMLElement>("[data-virtual-list]");
    expect(list).not.toBeNull();
    list!.scrollTop = 499 * SONG_ROW_HEIGHT;
    await act(async () => {
      list!.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(container.textContent).toContain("Track 499");
    expect(container.textContent).not.toContain("Track 0");
    const indices = Array.from(container.querySelectorAll("[data-song-index]")).map((el) =>
      Number(el.getAttribute("data-song-index"))
    );
    expect(indices).toContain(499);
    expect(Math.min(...indices)).toBeGreaterThan(480);
  });

  it("toggles selection for the clicked row at its original index", async () => {
    await renderEditor();

    const row = container.querySelector('[data-song-index="3"]');
    expect(row).not.toBeNull();
    await act(async () => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useMetadataEditorStore.getState().selectedSongs.map((song) => song.id)).toEqual([
      "song-3",
    ]);
    expect(container.textContent).toContain("Select Songs (1)");
    expect(container.querySelector('[data-song-index="3"]')?.getAttribute("data-selected")).toBe(
      "true"
    );
  });

  it("keeps select-all applying to the full 500-song library", async () => {
    await renderEditor();

    const selectAll = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Select all")
    );
    expect(selectAll).toBeDefined();
    await act(async () => {
      selectAll?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useMetadataEditorStore.getState().selectedSongs).toHaveLength(500);
    expect(container.textContent).toContain("Select Songs (500)");
  });
});
