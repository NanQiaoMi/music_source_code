import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openPanel: vi.fn(),
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (state: { openPanel: typeof mocks.openPanel }) => unknown) =>
    selector({ openPanel: mocks.openPanel }),
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("ListeningJournalCard", () => {
  beforeEach(async () => {
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
    mocks.openPanel.mockClear();
    localStorage.clear();
    const { useListeningJournalStore } = await import("@/store/listeningJournalStore");
    useListeningJournalStore.setState({
      selectedDate: "2026-05-20",
      days: {
        "2026-05-18": {
          date: "2026-05-18",
          totalMinutes: 18,
          topSongIds: ["song-18"],
          dominantMood: "focus",
        },
        "2026-05-20": {
          date: "2026-05-20",
          totalMinutes: 42,
          topSongIds: ["song-20"],
          dominantMood: "calm",
        },
      },
    });
  });

  it("renders the seven-day ribbon as a semantic list and opens selected days", async () => {
    const { ListeningJournalCard } = await import("./ListeningJournalCard");
    const { useListeningJournalStore } = await import("@/store/listeningJournalStore");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ListeningJournalCard />);
    });

    const ribbon = container.querySelector(
      '[role="list"][aria-label="Seven-day listening journal"]'
    );
    expect(ribbon).not.toBeNull();
    expect(ribbon?.querySelectorAll("button")).toHaveLength(7);
    expect(container.textContent).toContain("2/7 active");
    expect(container.textContent).toContain("60 min this week");

    const todayButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("aria-label")?.startsWith("2026-05-20:")
    );

    await act(async () => {
      todayButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useListeningJournalStore.getState().selectedDate).toBe("2026-05-20");
    expect(mocks.openPanel).toHaveBeenCalledWith("listeningJournal");

    await act(async () => {
      root.unmount();
    });
  });
});
