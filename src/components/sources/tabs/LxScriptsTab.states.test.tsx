import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

describe("LxScriptsTab 状态", () => {
  beforeEach(() => {
    localStorage.clear();
    useSourceConfigStore.setState({ lxScripts: [] });
  });

  it("还没有脚本时渲染空态与引导动作", async () => {
    const { LxScriptsTab } = await import("./LxScriptsTab");
    const html = renderToStaticMarkup(<LxScriptsTab />);
    expect(html).toContain("还没有");
    expect(html).toContain("添加扩展源");
  });

  it("加载中渲染骨架而非空白", async () => {
    const { LxScriptsTab } = await import("./LxScriptsTab");
    const html = renderToStaticMarkup(<LxScriptsTab loading />);
    expect(html).toContain("data-skeleton");
  });

  it("加载失败渲染错误态与重试", async () => {
    const { LxScriptsTab } = await import("./LxScriptsTab");
    const html = renderToStaticMarkup(
      <LxScriptsTab error="洛雪脚本拉取失败" onRetry={() => undefined} />
    );
    expect(html).toContain("洛雪脚本拉取失败");
    expect(html).toContain("重试");
  });

  it("默认（无三态 props）渲染不变", async () => {
    const { LxScriptsTab } = await import("./LxScriptsTab");
    useSourceConfigStore.getState().resetToDefaults();
    const html = renderToStaticMarkup(<LxScriptsTab />);
    expect(html).not.toContain("data-skeleton");
    expect(html).not.toContain("重试");
    expect(html).toContain("洛雪 / 自定义 JS 脚本扩展引擎");
  });

  it("新建脚本表单在窄屏堆叠前两项并保留键盘焦点样式", async () => {
    const { LxScriptsTab } = await import("./LxScriptsTab");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(<LxScriptsTab />));

      const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.includes("添加扩展源")
      );
      expect(addButton).toBeDefined();
      await act(async () => addButton?.click());

      const nameInput = container.querySelector<HTMLInputElement>(
        'input[placeholder="例如: 六音无损源 v2"]'
      );
      const formGrid = nameInput?.parentElement?.parentElement;
      expect(formGrid?.className).toContain("grid-cols-1");
      expect(formGrid?.className).toContain("sm:grid-cols-2");
      expect(nameInput?.className).toContain("focus-visible:ring-2");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
