import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBackupRestoreStore } from "@/store/backupRestoreStore";
import backupV5 from "@/store/__fixtures__/backup-v5.json";
import { BackupRestorePanel } from "./BackupRestorePanel";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          React.createElement(tag, props, children);
        Component.displayName = "motion." + tag;
        return Component;
      },
    }
  ),
}));

const LEGACY_BODY = {
  version: "4.0.0",
  createdAt: 1700000000000,
  type: "full",
  settings: {
    audio: JSON.stringify({ state: { volume: 0.8 }, version: 1 }),
    visual: JSON.stringify({ state: { themeMode: "dark" }, version: 1 }),
    gesture: null,
    sleep: JSON.stringify({ state: { minutes: 30 }, version: 1 }),
  },
  playlists: {
    playlist: JSON.stringify({ state: { items: [] }, version: 1 }),
    playlistGroups: JSON.stringify({ state: { groups: [] }, version: 1 }),
    queue: JSON.stringify({ state: { queue: [] }, version: 1 }),
    recommendation: JSON.stringify({ state: { items: [] }, version: 1 }),
  },
  library: { library: JSON.stringify({ state: { songs: [] }, version: 1 }) },
  lyrics: JSON.stringify({ state: { covers: {} }, version: 1 }),
};

function resetState(): void {
  localStorage.clear();
  sessionStorage.clear();
  useBackupRestoreStore.setState({
    backups: [],
    currentBackup: null,
    isBackingUp: false,
    isRestoring: false,
    backupProgress: 0,
    restoreProgress: 0,
    restoreError: null,
    restoreReport: null,
    schedules: [],
  });
}

function registerBackup(id: string, name: string, version: string, body: unknown): void {
  localStorage.setItem("backup-data-" + id, JSON.stringify(body));
  useBackupRestoreStore.setState((state) => ({
    backups: [
      ...state.backups,
      {
        id,
        name,
        type: "full",
        createdAt: 1700000000000,
        size: JSON.stringify(body).length,
        version,
      },
    ],
  }));
}

describe("BackupRestorePanel (S1-2b)", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(resetState);

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    vi.unstubAllGlobals();
  });

  async function renderPanel(): Promise<HTMLDivElement> {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<BackupRestorePanel isOpen onClose={() => undefined} />);
    });
    return container;
  }

  async function clickButton(label: string): Promise<void> {
    if (!container) throw new Error("panel not rendered");
    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      (candidate.textContent ?? "").includes(label)
    );
    if (!button) throw new Error("button not found: " + label);
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  }

  it("shows unsupported legacy slots in preview instead of silently restoring them", async () => {
    registerBackup("legacy", "旧版本备份", "4.0.0", LEGACY_BODY);
    const element = await renderPanel();

    await clickButton("恢复数据");
    await clickButton("旧版本备份");

    expect(element.textContent).toContain("旧版本槽位不会恢复");
    expect(element.textContent).toContain("sleep-timer-store");
    expect(element.textContent).toContain("playlist-store");
  });

  it("does not render dead keys for a v5 backup preview", async () => {
    registerBackup("modern", "新备份", "5.0.0", backupV5);
    const element = await renderPanel();

    await clickButton("恢复数据");
    await clickButton("新备份");

    expect(element.textContent).toContain("audio-store-v4");
    expect(element.textContent).toContain("queue-store-v5");
    expect(element.textContent).not.toContain("gesture-store");
    expect(element.textContent).not.toContain("sleep-timer-store");
    expect(element.textContent).not.toContain("playlist-store");
  });

  it("shows the restore report and reload action after a restore", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    useBackupRestoreStore.setState({
      restoreReport: {
        restored: ["audio-store-v4", "queue-store-v5"],
        skipped: [{ key: "sleep-timer-store", reason: "unsupported" }],
        failed: [],
      },
    });

    const element = await renderPanel();
    await clickButton("恢复数据");

    expect(element.textContent).toContain("已恢复 2 项");
    expect(element.textContent).toContain("1 项未恢复");
    expect(element.textContent).toContain("sleep-timer-store");
    expect(element.textContent).toContain("立即刷新");

    await clickButton("立即刷新");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
