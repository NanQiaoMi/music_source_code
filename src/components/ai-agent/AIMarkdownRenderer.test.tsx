import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AIMarkdownRenderer } from "./AIMarkdownRenderer";

describe("AIMarkdownRenderer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("renders bold text, inline code, and song title tags correctly", async () => {
    const content = "推荐这首《**七里香**》和 `320k` 无损音频";
    await act(async () => {
      root.render(<AIMarkdownRenderer content={content} />);
    });

    expect(container.textContent).toContain("七里香");
    expect(container.textContent).toContain("320k");
    expect(container.querySelector("strong")?.textContent).toBe("七里香");
    expect(container.querySelector("code")?.textContent).toBe("320k");
  });

  it("renders markdown tables cleanly without crashing or raw unparsed syntax", async () => {
    const tableMd = `
| 歌曲 | 歌手 | 特点 |
|---|---|---|
| 晴天 | 周杰伦 | 经典流行 |
| 起风了 | 买辣椒也用券 | 治愈感动 |
`;
    await act(async () => {
      root.render(<AIMarkdownRenderer content={tableMd} />);
    });

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.textContent).toContain("晴天");
    expect(container.textContent).toContain("周杰伦");
    expect(container.textContent).toContain("起风了");
  });

  it("renders bullet lists and ordered lists", async () => {
    const listMd = `
- 轻松可爱 -> 推荐《学猫叫》
- 深情治愈 -> 推荐《猫》
`;
    await act(async () => {
      root.render(<AIMarkdownRenderer content={listMd} />);
    });

    expect(container.textContent).toContain("轻松可爱");
    expect(container.textContent).toContain("深情治愈");
    expect(container.querySelectorAll("li").length).toBe(2);
  });

  it("renders headers and blockquotes", async () => {
    const md = `
## 发现推荐
> 这是一段氛围介绍
`;
    await act(async () => {
      root.render(<AIMarkdownRenderer content={md} />);
    });

    expect(container.textContent).toContain("发现推荐");
    expect(container.textContent).toContain("这是一段氛围介绍");
  });
});
