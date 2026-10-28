import { act } from "react";
import type { ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoverImageProps } from "./CoverImage";

type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  blurDataURL?: string;
  placeholder?: string;
};

vi.mock("next/image", () => ({
  default: ({
    fill,
    priority: _priority,
    unoptimized,
    blurDataURL,
    placeholder,
    ...props
  }: MockImageProps) => (
    <img
      {...props}
      data-fill={String(Boolean(fill))}
      data-unoptimized={String(Boolean(unoptimized))}
      data-placeholder={placeholder}
      data-blur={blurDataURL}
    />
  ),
}));

import { CoverImage, DEFAULT_COVER_SRC } from "./CoverImage";

describe("CoverImage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderCover(props: Partial<CoverImageProps> = {}) {
    await act(async () => {
      root.render(<CoverImage alt="cover" {...props} />);
    });
    const img = container.querySelector("img");
    if (!img) throw new Error("CoverImage did not render an img");
    return img;
  }

  it("falls back to the default cover when src is empty", async () => {
    expect((await renderCover({ src: "" })).getAttribute("src")).toBe(DEFAULT_COVER_SRC);
    expect((await renderCover({ src: null })).getAttribute("src")).toBe(DEFAULT_COVER_SRC);
  });

  it("uses cachedSrc over src", async () => {
    const img = await renderCover({
      src: "https://example.com/cover.jpg",
      cachedSrc: "/cached/cover.jpg",
    });
    expect(img.getAttribute("src")).toBe("/cached/cover.jpg");
  });

  it("is lazy by default and eager with high fetch priority when priority", async () => {
    const lazy = await renderCover({ src: "/cover.jpg", size: "lg" });
    expect(lazy.getAttribute("loading")).toBe("lazy");
    expect(lazy.getAttribute("fetchpriority")).toBe("auto");
    expect(lazy.getAttribute("decoding")).toBe("async");
    expect(lazy.getAttribute("sizes")).toBe("360px");
    expect(lazy.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(lazy.getAttribute("data-fill")).toBe("true");

    const eager = await renderCover({ src: "/cover.jpg", priority: true });
    expect(eager.getAttribute("loading")).toBe("eager");
    expect(eager.getAttribute("fetchpriority")).toBe("high");
  });

  it("disables next/image optimization only for data and blob URLs", async () => {
    expect(
      (await renderCover({ src: "data:image/png;base64,abc" })).getAttribute("data-unoptimized")
    ).toBe("true");
    expect(
      (await renderCover({ src: "blob:https://app/cover" })).getAttribute("data-unoptimized")
    ).toBe("true");
    expect(
      (await renderCover({ src: "https://example.com/cover.jpg" })).getAttribute("data-unoptimized")
    ).toBe("false");
  });

  it("falls back to the default cover once when the source fails", async () => {
    const img = await renderCover({ src: "https://example.com/broken.jpg" });
    expect(img.getAttribute("src")).toBe("https://example.com/broken.jpg");

    await act(async () => {
      img.dispatchEvent(new Event("error"));
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(DEFAULT_COVER_SRC);

    await act(async () => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(DEFAULT_COVER_SRC);
  });

  it("uses a blur placeholder only when blurDataURL is provided", async () => {
    const plain = await renderCover({ src: "/cover.jpg" });
    expect(plain.getAttribute("data-placeholder")).toBe("empty");

    const blurred = await renderCover({
      src: "/cover.jpg",
      blurDataURL: "data:image/png;base64,preview",
    });
    expect(blurred.getAttribute("data-placeholder")).toBe("blur");
    expect(blurred.getAttribute("data-blur")).toBe("data:image/png;base64,preview");
  });
});
