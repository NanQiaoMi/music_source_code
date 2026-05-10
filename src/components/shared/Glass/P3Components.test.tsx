import { describe, it, expect } from "vitest";
import React from "react";

describe("GlassInput", () => {
  it("exports a component", async () => {
    const mod = await import("./GlassInput");
    expect(mod.GlassInput).toBeDefined();
  });
});

describe("GlassSelect", () => {
  it("exports a component", async () => {
    const mod = await import("./GlassSelect");
    expect(mod.GlassSelect).toBeDefined();
  });
});

describe("GlassToggle", () => {
  it("exports a component", async () => {
    const mod = await import("./GlassToggle");
    expect(mod.GlassToggle).toBeDefined();
  });
});

describe("EmptyState", () => {
  it("exports a component", async () => {
    const mod = await import("./EmptyState");
    expect(mod.EmptyState).toBeDefined();
  });
});

describe("LoadingSkeleton", () => {
  it("exports a component", async () => {
    const mod = await import("./LoadingSkeleton");
    expect(mod.LoadingSkeleton).toBeDefined();
  });
});

describe("VirtualList", () => {
  it("exports a component", async () => {
    const mod = await import("./VirtualList");
    expect(mod.VirtualList).toBeDefined();
  });
});

describe("KeyboardShortcutsStore", () => {
  it("stores default shortcuts", async () => {
    const { useKeyboardShortcutsStore } = await import("@/store/keyboardShortcutsStore");
    const state = useKeyboardShortcutsStore.getState();
    expect(state.defaults.length).toBeGreaterThan(20);
    expect(state.getBinding("play-pause")).toEqual(["Space"]);
  });

  it("allows overriding a shortcut", async () => {
    const mod = await import("@/store/keyboardShortcutsStore");
    const result = mod.useKeyboardShortcutsStore.getState().setBinding("play-pause", ["Ctrl", "P"]);
    expect(result.success).toBe(true);
    const keys = mod.useKeyboardShortcutsStore.getState().getBinding("play-pause");
    expect(keys).toEqual(["Ctrl", "P"]);
  });

  it("detects conflicts", async () => {
    const mod = await import("@/store/keyboardShortcutsStore");
    const result = mod.useKeyboardShortcutsStore.getState().setBinding("prev-song", ["Ctrl", "P"]);
    expect(result.success).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("resets binding to default", async () => {
    const mod = await import("@/store/keyboardShortcutsStore");
    mod.useKeyboardShortcutsStore.getState().resetBinding("play-pause");
    expect(mod.useKeyboardShortcutsStore.getState().getBinding("play-pause")).toEqual(["Space"]);
  });

  it("resets all overrides", async () => {
    const mod = await import("@/store/keyboardShortcutsStore");
    mod.useKeyboardShortcutsStore.getState().setBinding("play-pause", ["Ctrl", "P"]);
    mod.useKeyboardShortcutsStore.getState().resetAll();
    expect(mod.useKeyboardShortcutsStore.getState().overrides.length).toBe(0);
  });
});

describe("Playlist format generators", () => {
  it("generates PLS format", async () => {
    const mod = await import("@/store/smartPlaylistStore");
    const songs = [
      { id: "1", title: "Song A", artist: "Artist X", duration: 200 } as any,
      { id: "2", title: "Song B", artist: "Artist Y", duration: 180 } as any,
    ];
    const output = mod.useSmartPlaylistStore.getState().exportPlaylist(songs, "pls");
    expect(output).toContain("[playlist]");
    expect(output).toContain("NumberOfEntries=2");
    expect(output).toContain("File1=1.mp3");
    expect(output).toContain("Title2=Artist Y - Song B");
    expect(output).toContain("Version=2");
  });

  it("generates XSPF format", async () => {
    const mod = await import("@/store/smartPlaylistStore");
    const songs = [
      { id: "1", title: "Song A", artist: "Artist X", album: "Album 1", duration: 200 } as any,
    ];
    const output = mod.useSmartPlaylistStore.getState().exportPlaylist(songs, "xspf");
    expect(output).toContain('<?xml version="1.0"');
    expect(output).toContain('<playlist version="1"');
    expect(output).toContain("<title>Song A</title>");
    expect(output).toContain("<creator>Artist X</creator>");
    expect(output).toContain("<album>Album 1</album>");
  });

  it("generates WPL format", async () => {
    const mod = await import("@/store/smartPlaylistStore");
    const songs = [
      { id: "1", title: "Song A", artist: "Artist X", duration: 200 } as any,
    ];
    const output = mod.useSmartPlaylistStore.getState().exportPlaylist(songs, "wpl");
    expect(output).toContain("<smil>");
    expect(output).toContain('<media src="1.mp3"');
    expect(output).toContain('title="Song A"');
  });
});