import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingSection } from "./SettingSection";
import { SettingRow } from "./SettingRow";

describe("SettingSection", () => {
  it("renders group title and description", () => {
    const html = renderToStaticMarkup(
      <SettingSection title="官方音源" description="需要登录才能解码的平台">
        <div>child</div>
      </SettingSection>
    );
    expect(html).toContain("官方音源");
    expect(html).toContain("需要登录才能解码的平台");
    expect(html).toContain("child");
  });

  it("renders the section action and omits an empty header", () => {
    const html = renderToStaticMarkup(
      <SettingSection action={<button>全部测速</button>}>
        <div>child</div>
      </SettingSection>
    );
    expect(html).toContain("全部测速");
    expect(html).not.toContain("<h3");
  });
});

describe("SettingRow", () => {
  it("renders title, subtitle and badge", () => {
    const html = renderToStaticMarkup(
      <SettingRow title="网易云音乐" subtitle="官方全网曲库" badge="需登录" />
    );
    expect(html).toContain("网易云音乐");
    expect(html).toContain("官方全网曲库");
    expect(html).toContain("需登录");
    // 未提供 onToggle 时是纯展示容器，不是 button
    expect(html).not.toContain("<button");
  });

  it("becomes a button when onToggle is provided", () => {
    const onToggle = vi.fn();
    const html = renderToStaticMarkup(
      <SettingRow title="QQ 音乐" onToggle={onToggle} expandable expanded={false} />
    );
    expect(html).toContain("<button");
    expect(html).toContain('data-status="idle"');
    expect(html).not.toContain("展开后的正文");
  });

  it("renders expanded children only when expanded", () => {
    const open = (
      <SettingRow title="酷狗" expandable expanded>
        展开后的正文
      </SettingRow>
    );
    expect(renderToStaticMarkup(open)).toContain("展开后的正文");

    const closed = (
      <SettingRow title="酷狗" expandable expanded={false}>
        展开后的正文
      </SettingRow>
    );
    expect(renderToStaticMarkup(closed)).not.toContain("展开后的正文");
  });

  it("shows latency when provided", () => {
    const html = renderToStaticMarkup(<SettingRow title="本地母带" status="ok" latencyMs={3} />);
    expect(html).toContain("3ms");
    expect(html).toContain('data-status="ok"');
  });

  it("keeps the control out of the row button", () => {
    const html = renderToStaticMarkup(
      <SettingRow title="QQ 音乐" onToggle={vi.fn()} control={<button>开关</button>} />
    );
    // 控件自身是 button：嵌进整行 button 会触发 React 的嵌套告警，且点开关会连带展开整行。
    // 同级时第一个 </button> 一定出现在第二个 <button> 之前。
    const firstClose = html.indexOf("</button>");
    expect(firstClose).toBeGreaterThan(-1);
    expect(html.indexOf("<button", firstClose)).toBeGreaterThan(-1);
  });
});
