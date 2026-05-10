import { describe, it, expect, beforeEach } from "vitest";
import { useHealthCheckStore } from "./healthCheckStore";
import { usePlaylistStore } from "./playlistStore";

describe("healthCheckStore", () => {
  beforeEach(() => {
    useHealthCheckStore.setState({
      isRunning: false,
      progress: 0,
      issues: [],
      selectedIssues: new Set(),
      lastCheckTime: null,
      totalSongsScanned: 0,
    });
  });

  it("should have issues after startCheck when songs exist", async () => {
    usePlaylistStore.setState({
      songs: [
        {
          id: "test-1",
          title: "",
          artist: "",
          cover: "",
          duration: 180,
          source: "local",
        },
        {
          id: "test-2",
          title: "Song",
          artist: "Artist",
          cover: "/default-cover.png",
          duration: 200,
          lyrics: "",
          source: "local",
        },
      ],
    });

    await useHealthCheckStore.getState().startCheck();

    const state = useHealthCheckStore.getState();
    expect(state.issues.length).toBeGreaterThan(0);
    expect(state.lastCheckTime).not.toBeNull();
  });

  it("should set totalSongsScanned correctly", async () => {
    usePlaylistStore.setState({
      songs: [
        {
          id: "t1",
          title: "A",
          artist: "B",
          cover: "https://c.com",
          duration: 100,
          source: "local",
        },
      ],
    });

    await useHealthCheckStore.getState().startCheck();

    expect(useHealthCheckStore.getState().totalSongsScanned).toBe(1);
  });

  it("should toggle issue selection", () => {
    useHealthCheckStore.setState({
      issues: [
        {
          id: "issue-1",
          type: "missing_metadata",
          songId: "s1",
          title: "T",
          artist: "A",
          filePath: "/p",
          severity: "low",
          description: "d",
          canAutoFix: true,
        },
      ],
    });

    useHealthCheckStore.getState().selectIssue("issue-1");
    expect(useHealthCheckStore.getState().selectedIssues.has("issue-1")).toBe(true);

    useHealthCheckStore.getState().selectIssue("issue-1");
    expect(useHealthCheckStore.getState().selectedIssues.has("issue-1")).toBe(false);
  });

  it("should select all issues", () => {
    useHealthCheckStore.setState({
      issues: [
        {
          id: "i1",
          type: "missing_metadata",
          songId: "s1",
          title: "T",
          artist: "A",
          filePath: "/p",
          severity: "low",
          description: "d",
          canAutoFix: true,
        },
        {
          id: "i2",
          type: "duplicate",
          songId: "s2",
          title: "T2",
          artist: "A2",
          filePath: "/p2",
          severity: "medium",
          description: "d2",
          canAutoFix: true,
        },
      ],
    });

    useHealthCheckStore.getState().selectAllIssues();
    expect(useHealthCheckStore.getState().selectedIssues.size).toBe(2);

    useHealthCheckStore.getState().deselectAllIssues();
    expect(useHealthCheckStore.getState().selectedIssues.size).toBe(0);
  });
});
