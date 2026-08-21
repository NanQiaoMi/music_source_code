import { describe, expect, it } from "vitest";
import { getLibraryHealthNextAction, getLibraryHealthStatus } from "./libraryHealthActions";

describe("libraryHealthActions", () => {
  it("classifies visible health states", () => {
    expect(getLibraryHealthStatus({ songsCount: 0, hasScanned: false, totalIssues: 0 })).toBe(
      "empty"
    );
    expect(getLibraryHealthStatus({ songsCount: 3, hasScanned: false, totalIssues: 0 })).toBe(
      "ready"
    );
    expect(getLibraryHealthStatus({ songsCount: 3, hasScanned: true, totalIssues: 0 })).toBe(
      "healthy"
    );
    expect(getLibraryHealthStatus({ songsCount: 3, hasScanned: true, totalIssues: 2 })).toBe(
      "issues"
    );
  });

  it("points empty, ready, and healthy states at scan actions", () => {
    expect(
      getLibraryHealthNextAction({ songsCount: 0, hasScanned: false, totalIssues: 0 })
    ).toEqual({ status: "empty", label: "Scan folder", target: "scan" });
    expect(
      getLibraryHealthNextAction({ songsCount: 4, hasScanned: false, totalIssues: 0 })
    ).toEqual({ status: "ready", label: "Scan folder", target: "scan" });
    expect(getLibraryHealthNextAction({ songsCount: 4, hasScanned: true, totalIssues: 0 })).toEqual(
      { status: "healthy", label: "Run weekly check", target: "scan" }
    );
  });

  it("prioritizes broken paths before generic issue review", () => {
    expect(
      getLibraryHealthNextAction({
        songsCount: 4,
        hasScanned: true,
        totalIssues: 5,
        missingFileCount: 3,
      })
    ).toEqual({ status: "issues", label: "Resolve 3 broken paths", target: "results" });
    expect(getLibraryHealthNextAction({ songsCount: 4, hasScanned: true, totalIssues: 1 })).toEqual(
      { status: "issues", label: "Review 1 active issue", target: "results" }
    );
  });
});
