import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VirtualList, type VirtualListHandle } from "./VirtualList";

const VIEWPORT = 480;
const ITEM_HEIGHT = 48;
const ITEM_COUNT = 500;

interface Item {
  id: number;
  label: string;
}

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({ id: index, label: "Item " + index }));

describe("VirtualList", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalClientHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    // jsdom has no layout: pin every element's measured height to the viewport we assert against.
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => VIEWPORT,
    });
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
  });

  const getList = (): HTMLElement => {
    const list = container.querySelector<HTMLElement>("[data-virtual-list]");
    expect(list).not.toBeNull();
    return list as HTMLElement;
  };

  const getRowTexts = (): (string | null)[] =>
    Array.from(container.querySelectorAll("[data-virtual-item]")).map((el) => el.textContent);

  const scrollTo = async (top: number): Promise<void> => {
    const list = getList();
    list.scrollTop = top;
    await act(async () => {
      list.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
  };

  const renderList = async (
    props: Partial<React.ComponentProps<typeof VirtualList<Item>>> = {}
  ): Promise<void> => {
    await act(async () => {
      root.render(
        <VirtualList<Item>
          items={makeItems(ITEM_COUNT)}
          itemHeight={ITEM_HEIGHT}
          renderItem={(item) => <span>{item.label}</span>}
          {...props}
        />
      );
    });
  };

  it("mounts only the visible window plus overscan for 500 items", async () => {
    await renderList();

    const texts = getRowTexts();
    // 480 / 48 = 10 visible rows + 5 overscan; nowhere near 500 DOM rows.
    expect(texts).toHaveLength(15);
    expect(texts.length).toBeLessThan(100);
    expect(texts[0]).toBe("Item 0");
    expect(texts).not.toContain("Item 300");
  });

  it("renders the correct items after scrolling deep into the list", async () => {
    await renderList();

    await scrollTo(300 * ITEM_HEIGHT);

    const texts = getRowTexts();
    expect(texts).toContain("Item 300");
    expect(texts[0]).toBe("Item 295");
    expect(texts).not.toContain("Item 0");
    expect(texts.length).toBeLessThan(100);
  });

  it("scrollToIndex centers the target row and scrollToTop resets the window", async () => {
    const handle = React.createRef<VirtualListHandle>();
    await renderList({ handleRef: handle });

    await act(async () => {
      handle.current?.scrollToIndex(200, { align: "center" });
    });

    expect(getList().scrollTop).toBe(200 * ITEM_HEIGHT - (VIEWPORT - ITEM_HEIGHT) / 2);
    expect(getRowTexts()).toContain("Item 200");

    await act(async () => {
      handle.current?.scrollToIndex(10, { align: "start" });
    });
    expect(getList().scrollTop).toBe(10 * ITEM_HEIGHT);

    await act(async () => {
      handle.current?.scrollToTop();
    });
    expect(getList().scrollTop).toBe(0);
    expect(getRowTexts()).toContain("Item 0");
  });

  it("applies initialIndex on mount before any scroll event", async () => {
    await renderList({ initialIndex: 100 });

    expect(getList().scrollTop).toBe(100 * ITEM_HEIGHT);
    const texts = getRowTexts();
    expect(texts[0]).toBe("Item 95");
    expect(texts).toContain("Item 100");
  });

  it("fires onScrollEnd once per approach to the bottom", async () => {
    const onScrollEnd = vi.fn();
    await renderList({ onScrollEnd });

    const list = getList();
    Object.defineProperty(list, "scrollHeight", {
      configurable: true,
      get: () => ITEM_COUNT * ITEM_HEIGHT,
    });

    await scrollTo(ITEM_COUNT * ITEM_HEIGHT - VIEWPORT - 10);
    expect(onScrollEnd).toHaveBeenCalledTimes(1);

    await scrollTo(ITEM_COUNT * ITEM_HEIGHT - VIEWPORT - 5);
    expect(onScrollEnd).toHaveBeenCalledTimes(1);

    await scrollTo(0);
    await scrollTo(ITEM_COUNT * ITEM_HEIGHT - VIEWPORT);
    expect(onScrollEnd).toHaveBeenCalledTimes(2);
  });
});
