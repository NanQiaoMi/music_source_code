import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppleDateTime } from "./AppleDateTime";

describe("AppleDateTime", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("renders stable server markup before the client clock starts", () => {
    vi.setSystemTime(new Date(2026, 4, 25, 9, 7, 0));
    const first = renderToStaticMarkup(<AppleDateTime />);

    vi.setSystemTime(new Date(2026, 4, 25, 9, 8, 0));
    const second = renderToStaticMarkup(<AppleDateTime />);

    expect(first).toBe(second);
    expect(first).toContain("--");
  });

  it("renders readable Chinese date text after mounting", async () => {
    vi.setSystemTime(new Date(2026, 4, 25, 9, 7, 0));

    await act(async () => {
      root.render(<AppleDateTime />);
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(container.textContent).toContain("09");
    expect(container.textContent).toContain("07");
    expect(container.textContent).toContain("5月25日");
  });
});
