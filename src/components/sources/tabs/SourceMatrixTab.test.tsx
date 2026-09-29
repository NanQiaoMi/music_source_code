import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

const DESC = "官方全网主流曲库，支持 WeAPI 扫码与 Cookie 绑定";

/** 组件依赖父级注入的 sourceList / isDiagnosing / onRunDiagnose，这里从 store 现取 */
async function renderTab() {
  const { SourceMatrixTab } = await import("./SourceMatrixTab");
  return renderToStaticMarkup(
    <SourceMatrixTab
      sourceList={Object.values(useSourceConfigStore.getState().sources)}
      isDiagnosing={false}
      onRunDiagnose={() => undefined}
    />
  );
}

describe("SourceMatrixTab 行级信息精简", () => {
  beforeEach(() => {
    localStorage.clear();
    const s = useSourceConfigStore.getState();
    useSourceConfigStore.setState({
      sources: {
        ...s.sources,
        netease: {
          ...s.sources.netease,
          enabled: true,
          description: DESC,
        },
      },
    });
  });

  it("默认不渲染音源描述（收进展开态）", async () => {
    const html = await renderTab();
    // 需求基线：描述通过 SettingRow 的 description 传入，变成行标题的 title 悬停提示
    // （不占高度、不渲染为正文）。所以先剥掉这类纯属性提示，再断言描述没有以可见内容出现。
    const withoutTitleHints = html.replace(/\stitle="[^"]*"/g, "");
    expect(withoutTitleHints).not.toContain(DESC);
    // 正文里也不能残留描述段落
    expect(html).not.toMatch(/<p[^>]*>[^<]*官方全网主流曲库/);
  });

  it("默认态每行都有状态点", async () => {
    const html = await renderTab();
    expect(html).toContain("data-status=");
    expect((html.match(/data-status=/g) || []).length).toBeGreaterThanOrEqual(6);
  });

  it("展开后才出现描述与登录入口", async () => {
    const collapsed = await renderTab();
    // 展开由组件内部 expandedId state 驱动，renderToStaticMarkup 无法点击，
    // 因此只断言折叠态：描述正文与登录入口都不出现，且每行标记为收起。
    expect(collapsed).not.toMatch(/<p[^>]*>[^<]*官方全网主流曲库/);
    expect(collapsed).not.toContain("去登录");
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed.length).toBeGreaterThan(0);
  });
});
