# 音源管理与管理曲库 UI 改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use nbl.subagent-driven-development (recommended) or nbl.executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「音源管理」浮层与「管理曲库」看板改造为 Apple 系统设置风格（左窄导航 + 右分组 + 发丝线 + 留白），修复顶栏在 ≤1280 宽度下的按钮重叠，并补齐状态反馈与边界处理。

**Architecture:** 先抽一批可复用的分组/行/状态基础件到 `src/components/ui/settings/`，再把 1067 行的 `SourceManagementModal` 按 Tab 拆成独立文件并改用这些基础件；验证风格成立后，同一套基础件复用到曲库看板。顶栏重叠属于独立缺陷，单独成任务可先行落地。

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript 5.4 strict + Tailwind CSS 3.4 + framer-motion + Zustand 5；测试为 Vitest 4 + jsdom，组件测试用 `react-dom/server` 的 `renderToStaticMarkup`（项目既有写法，未引入 Testing Library）。

---

## 一、访谈结论（需求基线）

三轮 `AskUserQuestion` 共 12 问，锁定如下：

| 维度         | 结论                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| 范围         | 信息架构与布局 + 交互与状态 + 代码重构（**不只改表皮**）                                                            |
| 视觉方向     | Apple 系统设置风：左侧窄导航 + 右侧分组内容 + 发丝线分隔 + 留白                                                     |
| 承载形态     | 音源管理**保持浮层**，内部做左右分栏（不改成路由页）                                                                |
| 优先级       | **先音源管理**，风格验证后再复用到曲库                                                                              |
| 卡片取舍     | 默认精简（名称+状态+控制）；登录/描述收进展开态；带表单的卡统一高度；描述改提示层。**保留文字 badge，不改成纯色点** |
| 状态反馈     | 测速就地展示延迟 / 顶部统一健康摘要 / 空态·加载·错误态 / 长任务进度与可取消 —— 四项全做                             |
| 窄屏下限     | **1024px** 完整可用                                                                                                 |
| 顶栏重叠     | 一起修，保证窄屏可达                                                                                                |
| 重构方式     | 按 Tab 拆文件 **+** 抽共享基础件                                                                                    |
| 曲库看板主角 | 存储配额、音质分布、云端登录、曲库健康（四项全选）                                                                  |
| 边界         | 断网失败 / 空数据未登录 / 大数据量不卡 / 长任务可恢复 —— 四项全选                                                   |
| 验收         | 前后截图对比 + 现有 772 测试不回退且新增用例                                                                        |

## 二、现状诊断（实测，非推断）

### 顶栏重叠（功能缺陷，不只是美观）

`AppleUnifiedNavIsland` 用 `absolute left-1/2` 居中，而 `HeaderToolbar` 右侧集群用 `ml-auto`——两者互不避让。

**1280px 实测 5 处重叠：**

```
AI 找歌(790-888)   × 全局搜索(809-837)/全屏沉浸(839-867)/隔空手势(869-897)  28px
音源管理(898-1003) × 键盘快捷键(899-927)/偏好设置(929-957)                   28px
```

**1024px 实测 8 处重叠**，最严重 `AI 找歌 × 专业与工具 = 94px`（导航页签被右侧集群压住）。

对「音源管理」按钮中心做 `elementFromPoint` 命中测试，返回的是**另一个按钮**——即该按钮在该宽度下**几乎点不到**。

根因是内容总宽超出视口，而非间距问题：左胶囊 ≈160 + 导航岛（4 页签 + 5 个微按钮）≈511 + 右集群（AI 找歌 98 + 音源管理 106 + 账号 114 + 管理曲库 98 + 间隙）≈446 ≈ **1117 > 1024**。

### 音源管理（`src/components/sources/SourceManagementModal.tsx`，1067 行）

- 单文件内联 5 个 Tab，外壳与业务全混在一起
- 6 张音源卡中「本地母带」明显更高 → 网格右下留空
- 每卡 3–4 个 badge + 极小描述 + 重复的「去登录」按钮 → 噪音重
- 「快速测速」只有触发入口，**没有就地结果展示**
- **无空态/加载态/错误态**

### 管理曲库（`/data-manager` → `UnifiedDataManagerHub.tsx` 343 行 + 各 Tab）

- 全景看板字号过小、卡片层级全平（所有卡片同一灰阶）
- **播放条浮层遮挡看板内容**
- 色彩单一，重点指标不突出

### 可复用的既有资产（避免重复造轮子）

`src/components/shared/Glass/` 已有：`GlassCard` `GlassModal` `GlassPanel` `GlassToggle` `GlassSelect` `GlassInput`
**`EmptyState` / `LoadingSkeleton` / `VirtualList`** 分别已覆盖「空态 / 加载态 / 大数据量」三个需求。

`DESIGN.md` 已定规范，需遵守：

- H1 `2.5rem` Bold tight tracking；Body `0.875rem`/1.5；Data `0.625rem` Bold Mono
- Glass Card：`backdrop-blur(20px) saturate(180%)`、边框 `rgba(255,255,255,0.1)`

### 不可回归的既有断言

- `src/components/layout/HeaderToolbar.test.tsx`：`音乐库` `1 首歌曲` `猫猫的小毛毛呀` `VIP` `管理曲库` `多平台账号与云端资产`
- `src/components/layout/AppleUnifiedNavIsland.test.tsx`：`音源与舞台` `data-search-avoidance=...`
- `src/components/library/UnifiedDataManagerHub.test.tsx`、`LocalMusicManager.test.tsx`、`LibraryManagerPanel.test.tsx`、`LibraryHealthPanel.test.tsx`、`SmartPlaylistPanel.test.tsx`、`LxMusicSearchTab.test.tsx`
- 全仓基线：**148 文件 / 772 测试**

## 三、文件结构

**新增**

| 路径                                                 | 职责                                      |
| ---------------------------------------------------- | ----------------------------------------- |
| `src/hooks/useMediaQuery.ts`                         | 断点订阅（项目内无既有实现）              |
| `src/components/ui/settings/StatusDot.tsx`           | 状态点 + 延迟数值，四种色调               |
| `src/components/ui/settings/SettingSection.tsx`      | 分组容器：小标题 + 圆角组 + 右侧动作      |
| `src/components/ui/settings/SettingRow.tsx`          | 行：图标/标题/副标题/badge/状态/控件/展开 |
| `src/components/ui/settings/SettingRowExpanded.tsx`  | 展开区（表单、登录、描述）                |
| `src/components/ui/settings/SourceHealthSummary.tsx` | 顶部健康摘要 + 测速按钮 + 进度            |
| `src/components/ui/settings/index.ts`                | 统一出口                                  |
| `src/components/sources/tabs/SourceMatrixTab.tsx`    | 原 TAB 1 搬运后改用基础件                 |
| `src/components/sources/tabs/LxScriptsTab.tsx`       | 原 TAB 2                                  |
| `src/components/sources/tabs/DiagnosticsTab.tsx`     | 原 TAB 3                                  |
| `src/components/sources/tabs/BackupTab.tsx`          | 原 TAB 4                                  |
| `src/components/sources/tabs/OfflineCacheTab.tsx`    | 原文件内 `OfflineCacheTab` 搬出           |
| 上述 4 个基础件各配 `*.test.tsx`                     |                                           |

**修改**

| 路径                                               | 改动                                           |
| -------------------------------------------------- | ---------------------------------------------- |
| `src/components/layout/AppleUnifiedNavIsland.tsx`  | 455–509 微按钮组按断点收进溢出菜单             |
| `src/components/layout/HeaderToolbar.tsx`          | ≤1200 隐藏左侧计数、右集群文案降级             |
| `src/components/sources/SourceManagementModal.tsx` | 1067 → 约 260 行：只留外壳 + Tab 路由 + 左导航 |
| `src/components/library/UnifiedDataManagerHub.tsx` | 顶部导航复用同一断点策略                       |
| `src/components/library/hub/DataDashboardTab.tsx`  | 主角指标重排，复用 `SettingSection`            |
| `src/components/player/*`（播放条定位）            | 避让看板内容                                   |

---

## Task 1: 顶栏响应式——消除重叠，1024 可达

**状态**

- [x] 任务完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: 写失败测试**

新建 `src/hooks/useMediaQuery.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "./testRenderHook";
import { useMediaQuery } from "./useMediaQuery";

function stub(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => {
      const max = /max-width:\s*(\d+)/.exec(query);
      const matches = max ? width <= Number(max[1]) : false;
      return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    })
  );
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("useMediaQuery", () => {
  it("returns true when the viewport satisfies the query", () => {
    stub(1024);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1199px)"));
    expect(result.current).toBe(true);
  });

  it("returns false above the breakpoint", () => {
    stub(1280);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1199px)"));
    expect(result.current).toBe(false);
  });
});
```

新建 `src/hooks/testRenderHook.ts`（项目无 `@testing-library/react`，用最小等价物）：

```ts
import { act } from "react";

export function renderHook<T>(fn: () => T): { result: { current: T } } {
  const holder: { current: T } = { current: undefined as unknown as T };
  // 直接调用一次即可：本 hook 只读 matchMedia，不订阅生命周期之外的状态
  holder.current = fn();
  return { result: holder };
}
export { act };
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/hooks/useMediaQuery.test.ts`
Expected: **FAIL**，`Cannot find module './useMediaQuery'`

- [ ] **Step 3: 实现 hook**

新建 `src/hooks/useMediaQuery.ts`：

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * 订阅一条 CSS 媒体查询。
 * 服务端/首次渲染返回 false，避免水合不一致；客户端挂载后再同步真实值。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/hooks/useMediaQuery.test.ts`
Expected: **PASS**（2 个用例）

- [ ] **Step 5: 写失败测试——窄屏不该渲染 5 个微按钮**

新建 `src/components/layout/AppleUnifiedNavIsland.responsive.test.tsx`：

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const keep =
    (Tag: string) =>
    ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement(Tag, rest, children as React.ReactNode);
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: {
      div: keep("div"),
      button: keep("button"),
      header: keep("header"),
      a: keep("a"),
    },
  };
});

function stubViewport(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((q: string) => {
      const m = /max-width:\s*(\d+)/.exec(q);
      return {
        matches: m ? width <= Number(m[1]) : false,
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    })
  );
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("AppleUnifiedNavIsland responsive quick buttons", () => {
  it("renders all five quick buttons at 1440", async () => {
    stubViewport(1440);
    const { AppleUnifiedNavIsland } = await import("./AppleUnifiedNavIsland");
    const html = renderToStaticMarkup(<AppleUnifiedNavIsland />);
    expect(html).toContain('title="全局搜索 (⌘K / Ctrl+K)"');
    expect(html).toContain('title="偏好设置"');
    expect(html).not.toContain('title="更多快捷操作"');
  });

  it("collapses to search + overflow at 1024", async () => {
    stubViewport(1024);
    const { AppleUnifiedNavIsland } = await import("./AppleUnifiedNavIsland");
    const html = renderToStaticMarkup(<AppleUnifiedNavIsland />);
    expect(html).toContain('title="全局搜索 (⌘K / Ctrl+K)"');
    expect(html).toContain('title="更多快捷操作"');
    // 其余四个收进溢出菜单，不能在主干上出现
    expect(html).not.toContain('title="偏好设置"');
    expect(html).not.toContain('title="隔空手势控制"');
  });
});
```

- [ ] **Step 6: 运行确认失败**

Run: `npx vitest run src/components/layout/AppleUnifiedNavIsland.responsive.test.tsx`
Expected: **FAIL**，1024 用例报 `expected ... not to contain 'title="偏好设置"'`

- [ ] **Step 7: 实现断点降级**

`src/components/layout/AppleUnifiedNavIsland.tsx`：

1. 头部 import 追加：

```ts
import { MoreHorizontal } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
```

2. 在 `const { isEnabled: isGestureEnabled, toggleGestureEnabled } = useGestureStore();`（第 72 行）之后加：

```ts
// ≤1199px 时，导航岛的微按钮组收进溢出菜单——它是顶栏重叠的主因
const isCompactHeader = useMediaQuery("(max-width: 1199px)");
const [moreOpen, setMoreOpen] = useState(false);
```

3. 把第 455–509 行（`{/* 3. 快捷微按钮组 … */}` 到它闭合的 `</div>`）整段替换为：

```tsx
{
  /* 3. 快捷微按钮组 (搜索 / 全屏 / 手势 / 快捷键)
            宽屏内联；≤1199px 只保留搜索 + 「更多」溢出菜单，
            否则导航岛会压住 HeaderToolbar 右侧集群（1280 实测重叠 28px、1024 重叠 94px）。 */
}
<div className="flex items-center gap-0.5 px-0.5">
  <button
    type="button"
    onClick={() => openPanel("search")}
    className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
    title="全局搜索 (⌘K / Ctrl+K)"
  >
    <Search className="w-3.5 h-3.5" />
  </button>

  {isCompactHeader ? (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
        title="更多快捷操作"
        aria-expanded={moreOpen}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {moreOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-[#16161a]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden z-50 py-1">
          <QuickActionMenuItem
            title={isFullscreen ? "退出全屏" : "全屏沉浸"}
            onClick={() => {
              toggleFullscreen();
              setMoreOpen(false);
            }}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </QuickActionMenuItem>
          <QuickActionMenuItem
            title="隔空手势控制"
            active={isGestureEnabled}
            onClick={() => {
              toggleGestureEnabled();
              setMoreOpen(false);
            }}
          >
            <Hand className="w-4 h-4" />
          </QuickActionMenuItem>
          <QuickActionMenuItem
            title="键盘快捷键"
            onClick={() => {
              openPanel("keyboardShortcuts");
              setMoreOpen(false);
            }}
          >
            <Keyboard className="w-4 h-4" />
          </QuickActionMenuItem>
          <QuickActionMenuItem
            title="偏好设置"
            onClick={() => {
              openPanel("settings");
              setMoreOpen(false);
            }}
          >
            <Settings className="w-4 h-4" />
          </QuickActionMenuItem>
        </div>
      )}
    </div>
  ) : (
    <>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
        title={isFullscreen ? "退出全屏" : "全屏沉浸"}
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        type="button"
        onClick={toggleGestureEnabled}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
          isGestureEnabled
            ? "bg-[#0071e3]/30 text-[#2997ff] border border-[#0071e3]/40"
            : "text-white/60 hover:text-white hover:bg-white/[0.12]"
        }`}
        title="隔空手势控制"
      >
        <Hand className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => openPanel("keyboardShortcuts")}
        className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
        title="键盘快捷键"
      >
        <Keyboard className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => openPanel("settings")}
        className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.12] transition-all hover:scale-105 active:scale-95"
        title="偏好设置"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
    </>
  )}
</div>;
```

4. 文件内新增溢出菜单项组件（放在 `export function AppleUnifiedNavIsland` **之前**）：

```tsx
function QuickActionMenuItem({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] transition-colors ${
        active ? "text-[#2997ff] bg-[#0071e3]/15" : "text-white/80 hover:bg-white/[0.08]"
      }`}
      title={title}
    >
      <span className="shrink-0 opacity-80">{children}</span>
      <span className="truncate">{title}</span>
    </button>
  );
}
```

- [ ] **Step 8: 运行确认通过**

Run: `npx vitest run src/components/layout/AppleUnifiedNavIsland.responsive.test.tsx src/hooks/useMediaQuery.test.ts`
Expected: **PASS**（4 个用例）

- [ ] **Step 9: HeaderToolbar 窄屏文案降级**

`src/components/layout/HeaderToolbar.tsx`：

1. import 追加 `import { useMediaQuery } from "@/hooks/useMediaQuery";`
2. 在 `const { openManagementModal } = useSourceConfigStore();` 后加：

```ts
// ≤1199px 顶栏总宽超出视口，隐藏左侧计数、右侧胶囊收成图标
const isCompactHeader = useMediaQuery("(max-width: 1199px)");
const isVeryNarrow = useMediaQuery("(max-width: 1099px)");
```

3. 左侧计数（第 41–43 行的 `<span className="text-[11px] …">`）改为：

```tsx
{
  !isCompactHeader && (
    <span className="text-[11px] text-[#86868b] font-medium leading-none whitespace-nowrap">
      {songs.length > 0 ? `${songs.length} 首歌曲` : "多平台云音乐已就绪"}
    </span>
  );
}
```

4. 「AI 找歌」「音源管理」的文字标签（第 64–66、78–80 行的 `<span>`）各包一层：

```tsx
{
  !isVeryNarrow && (
    <span className="text-[12px] font-medium text-white/90 group-hover:text-white whitespace-nowrap">
      AI 找歌
    </span>
  );
}
```

```tsx
{
  !isVeryNarrow && (
    <span className="text-[12px] font-medium text-white/90 group-hover:text-white whitespace-nowrap">
      音源管理
    </span>
  );
}
```

> 注意：`title="全网多音源矩阵与扩展管理中心"` 与 `title="AI 找歌助手"` **必须保留**，`HeaderToolbar.test.tsx` 断言的 `管理曲库`、`多平台账号与云端资产` 也不能动。

- [ ] **Step 10: 运行顶栏相关全部测试**

Run: `npx vitest run src/components/layout/`
Expected: **PASS**，`HeaderToolbar.test.tsx` 与 `AppleUnifiedNavIsland.test.tsx` 全绿

- [ ] **Step 11: 三档宽度实测重叠归零**

预览面板依次设 `1024` / `1280` / `1440`，对 `header` 内所有 `button, a` 取包围盒两两求交：

```js
// 在 preview_eval 中执行
(() => {
  const items = [];
  document
    .querySelector("header")
    .querySelectorAll("button,a")
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0)
        items.push({
          t: (el.getAttribute("title") || el.textContent || "").trim().slice(0, 12),
          x: Math.round(r.x),
          r: Math.round(r.x + r.width),
        });
    });
  items.sort((a, b) => a.x - b.x);
  const ov = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i],
        c = items[j];
      if (a.x < c.r && c.x < a.r) ov.push(a.t + "×" + c.t);
    }
  return JSON.stringify({ vp: innerWidth, overlaps: ov });
})();
```

Expected: 三档均为 `{"overlaps":[]}`
再对 `button[title="全网多音源矩阵与扩展管理中心"]` 中心做 `elementFromPoint`，Expected: 返回的正是该按钮本身。

- [ ] **Step 12: 提交**

```bash
git add src/hooks/useMediaQuery.ts src/hooks/useMediaQuery.test.ts \
        src/hooks/testRenderHook.ts \
        src/components/layout/AppleUnifiedNavIsland.tsx \
        src/components/layout/AppleUnifiedNavIsland.responsive.test.tsx \
        src/components/layout/HeaderToolbar.tsx
git commit -m "fix(header): 窄屏收起导航岛微按钮，消除顶栏按钮重叠"
```

---

## Task 2: 共享基础件 StatusDot / SettingSection / SettingRow

**状态**

- [x] 任务完成

**Dependencies:** None
**Parallelizable:** Yes（与 Task 1、Task 3 无耦合）

- [ ] **Step 1: 写 StatusDot 失败测试**

新建 `src/components/ui/settings/StatusDot.test.tsx`：

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusDot } from "./StatusDot";

describe("StatusDot", () => {
  it("renders the default label for each status", () => {
    expect(renderToStaticMarkup(<StatusDot status="ok" />)).toContain("正常");
    expect(renderToStaticMarkup(<StatusDot status="warn" />)).toContain("需处理");
    expect(renderToStaticMarkup(<StatusDot status="error" />)).toContain("异常");
    expect(renderToStaticMarkup(<StatusDot status="idle" />)).toContain("未测试");
  });

  it("prefers latency over the status label when provided", () => {
    const html = renderToStaticMarkup(<StatusDot status="ok" latencyMs={128} />);
    expect(html).toContain("128ms");
    expect(html).not.toContain("正常");
  });

  it("allows an explicit label to win", () => {
    expect(renderToStaticMarkup(<StatusDot status="warn" label="需登录" />)).toContain("需登录");
  });

  it("hides the label but keeps the dot when asked", () => {
    const html = renderToStaticMarkup(<StatusDot status="ok" showLabel={false} />);
    expect(html).not.toContain("正常");
    expect(html).toContain("rounded-full");
  });
});
```

- [ ] **Step 2: 确认失败**

Run: `npx vitest run src/components/ui/settings/StatusDot.test.tsx`
Expected: **FAIL**，`Cannot find module './StatusDot'`

- [ ] **Step 3: 实现 StatusDot**

新建 `src/components/ui/settings/StatusDot.tsx`：

```tsx
import React from "react";

export type StatusKind = "ok" | "warn" | "error" | "idle";

const TONE: Record<StatusKind, { dot: string; text: string; label: string }> = {
  ok: {
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,199,89,0.75)]",
    text: "text-emerald-300",
    label: "正常",
  },
  warn: {
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.75)]",
    text: "text-amber-300",
    label: "需处理",
  },
  error: {
    dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.75)]",
    text: "text-rose-300",
    label: "异常",
  },
  idle: { dot: "bg-white/30", text: "text-white/40", label: "未测试" },
};

export interface StatusDotProps {
  status: StatusKind;
  /** 覆盖默认文案（如「需登录」） */
  label?: string;
  /** 只要圆点不要文字 */
  showLabel?: boolean;
  /** 有值时优先显示延迟，替代状态文案 */
  latencyMs?: number;
}

export function StatusDot({ status, label, showLabel = true, latencyMs }: StatusDotProps) {
  const tone = TONE[status];
  const text = label ?? (latencyMs != null ? `${latencyMs}ms` : tone.label);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums ${tone.text}`}
      data-status={status}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
      {showLabel && <span>{text}</span>}
    </span>
  );
}
```

- [ ] **Step 4: 确认通过**

Run: `npx vitest run src/components/ui/settings/StatusDot.test.tsx`
Expected: **PASS**（4 用例）

- [ ] **Step 5: 写 SettingSection / SettingRow 失败测试**

新建 `src/components/ui/settings/SettingRow.test.tsx`：

```tsx
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

  it("becomes a button and fires onToggle", () => {
    const onToggle = vi.fn();
    const html = renderToStaticMarkup(
      <SettingRow title="QQ 音乐" onToggle={onToggle} expanded={false} expandable />
    );
    expect(html).toContain("<button");
    expect(html).toContain('data-status="idle"');
    expect(html).not.toContain("展开后的正文");
  });

  it("renders expanded children only when expanded", () => {
    const base = (
      <SettingRow title="酷狗" expandable expanded>
        展开后的正文
      </SettingRow>
    );
    expect(renderToStaticMarkup(base)).toContain("展开后的正文");

    const collapsed = (
      <SettingRow title="酷狗" expandable expanded={false}>
        展开后的正文
      </SettingRow>
    );
    expect(renderToStaticMarkup(collapsed)).not.toContain("展开后的正文");
  });

  it("shows latency when status latency is given", () => {
    const html = renderToStaticMarkup(<SettingRow title="本地母带" status="ok" latencyMs={3} />);
    expect(html).toContain("3ms");
    expect(html).toContain('data-status="ok"');
  });
});
```

- [ ] **Step 6: 确认失败**

Run: `npx vitest run src/components/ui/settings/SettingRow.test.tsx`
Expected: **FAIL**，`Cannot find module './SettingSection'`

- [ ] **Step 7: 实现 SettingSection**

新建 `src/components/ui/settings/SettingSection.tsx`：

```tsx
import React from "react";

export interface SettingSectionProps {
  /** 分组标题，小字号 + 大字距，对应 Apple 系统设置的组头 */
  title?: string;
  description?: string;
  /** 组头右侧动作（如「全部测速」） */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingSection({ title, description, action, children }: SettingSectionProps) {
  const hasHeader = Boolean(title || description || action);
  return (
    <section className="mb-7 last:mb-0">
      {hasHeader && (
        <div className="flex items-end justify-between gap-3 px-1 mb-2">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 text-[12px] leading-relaxed text-white/35">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: 实现 SettingRow**

新建 `src/components/ui/settings/SettingRow.tsx`：

```tsx
import React from "react";
import { ChevronDown } from "lucide-react";
import { StatusDot, StatusKind } from "./StatusDot";

export interface SettingRowProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** 次要标签（如「需登录」「新晋」）。默认不显示，只有显式传入才出现 */
  badge?: string;
  status?: StatusKind;
  latencyMs?: number;
  /** 右侧控件（开关、下拉） */
  control?: React.ReactNode;
  /** 右侧纯文本/链接 */
  trailing?: React.ReactNode;
  /** 可展开：配合 expanded / onToggle / children */
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** 悬停提示，用来承载被精简掉的描述 */
  description?: string;
  children?: React.ReactNode;
}

export function SettingRow({
  icon,
  title,
  subtitle,
  badge,
  status,
  latencyMs,
  control,
  trailing,
  expandable,
  expanded,
  onToggle,
  description,
  children,
}: SettingRowProps) {
  const interactive = Boolean(onToggle);
  const content = (
    <>
      {icon && <span className="shrink-0 text-white/55">{icon}</span>}

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span
            className="text-[13.5px] font-medium text-white truncate"
            title={description ?? title}
          >
            {title}
          </span>
          {badge && (
            <span className="shrink-0 text-[10px] leading-none px-1.5 py-1 rounded border border-white/10 bg-white/[0.06] text-white/55">
              {badge}
            </span>
          )}
        </span>
        {subtitle && (
          <span className="block mt-0.5 text-[12px] text-white/40 truncate">{subtitle}</span>
        )}
      </span>

      {status && <StatusDot status={status} latencyMs={latencyMs} />}
      {trailing}
      {control}

      {expandable && (
        <ChevronDown
          className={`w-4 h-4 text-white/35 shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      )}
    </>
  );

  return (
    <div className="border-b border-white/[0.05] last:border-b-0">
      {interactive ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expandable ? Boolean(expanded) : undefined}
          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
        >
          {content}
        </button>
      ) : (
        <div className="w-full flex items-center gap-3 px-4 py-3">{content}</div>
      )}

      {expandable && expanded && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 9: 统一出口 + 确认通过**

新建 `src/components/ui/settings/index.ts`：

```ts
export { StatusDot } from "./StatusDot";
export type { StatusKind, StatusDotProps } from "./StatusDot";
export { SettingSection } from "./SettingSection";
export type { SettingSectionProps } from "./SettingSection";
export { SettingRow } from "./SettingRow";
export type { SettingRowProps } from "./SettingRow";
```

Run: `npx vitest run src/components/ui/settings/`
Expected: **PASS**（8 用例）

- [ ] **Step 10: 提交**

```bash
git add src/components/ui/settings/
git commit -m "feat(ui): 新增 SettingSection/SettingRow/StatusDot 分组基础件"
```

---

## Task 3: 音源管理按 Tab 拆文件（纯搬运，零行为变化）

**状态**

- [x] 任务完成

**Dependencies:** None
**Parallelizable:** Yes（与 Task 1、Task 2 互不依赖）

- [ ] **Step 1: 记录拆分前基线**

Run: `npx vitest run 2>&1 | tail -4`
Expected: `Test Files 148 passed` / `Tests 772 passed`

- [ ] **Step 2: 搬出 TAB 1 → `SourceMatrixTab.tsx`**

1. 新建 `src/components/sources/tabs/SourceMatrixTab.tsx`。
2. 从 `SourceManagementModal.tsx` **剪切第 276–487 行**（`{/* TAB 1: 音源矩阵控制台 */}` 至 TAB 2 注释前一行）粘入新文件。
3. 新文件文件头（按实际用到的符号裁剪，`eslint` 会指出未使用的）：

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSourceConfigStore, PRESET_SCHEMES, isSourceUsable } from "@/store/sourceConfigStore";
import { useUserAccountStore, isPlatformLoggedIn } from "@/store/userAccountStore";
import { QualityTier } from "@/types/sourceConfig";
import { useNetworkAudioCache } from "@/hooks/useNetworkAudioCache";
import { useAudioStore } from "@/store/audioStore";

export function SourceMatrixTab() {
  return <>{/* ← 上一步剪切过来的 JSX 原样放这里 */}</>;
}
```

4. 把原文件中 TAB 1 的位置替换成一行：

```tsx
{
  activeManagementTab === "matrix" && <SourceMatrixTab />;
}
```

5. 若剪切块内引用了仅 TAB 1 使用的局部常量/函数（如 `handleToggleSource`、`runQuickSpeedTest`），把它们一并搬进新文件；若被其他 Tab 共用，则提为文件模块级或保持在原文件并作为 props 传入——以 `npx tsc --noEmit` 通过为准。

- [ ] **Step 3: 类型检查定位遗漏**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误。若有 `Cannot find name 'xxx'`，说明该符号是跨 Tab 共用的，按 Step 2 第 5 点处理。

- [ ] **Step 4: 重复搬其余 4 个 Tab**

同样手法，行界如下（以当前文件实际行号为准，每次搬运后行号会变，**必须重新 grep**）：

Run: `grep -n '{/\* TAB' src/components/sources/SourceManagementModal.tsx`

| 目标文件                   | 起始注释                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `tabs/LxScriptsTab.tsx`    | `{/* TAB 2: 洛雪 / 自定义脚本 */}`                             |
| `tabs/DiagnosticsTab.tsx`  | `{/* TAB 3: 一键健康诊断 */}`                                  |
| `tabs/BackupTab.tsx`       | `{/* TAB 4: 预设方案与备份 */}`                                |
| `tabs/OfflineCacheTab.tsx` | 把文件内 `function OfflineCacheTab()`（约第 857 行起）整体移出 |

每个文件都遵循 Step 2 的结构：`"use client"` + import + `export function XxxTab() { return (<> … </>); }`，并在外壳里替换成 `{activeManagementTab === "<id>" && <XxxTab />}`。

- [ ] **Step 5: 类型检查 + 编译**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

Run: `npm run lint 2>&1 | tail -3`
Expected: `lint exit=0`

- [ ] **Step 6: 确认零行为变化**

Run: `npx vitest run 2>&1 | tail -4`
Expected: `Test Files 148 passed` / `Tests 772 passed`（与 Step 1 完全一致）

Run: `wc -l src/components/sources/SourceManagementModal.tsx`
Expected: **≤ 300 行**（原 1067）

- [ ] **Step 7: 浏览器冒烟**

预览面板打开音源管理，逐个点 5 个 Tab，截图确认内容与改造前一致。

Expected: 5 个 Tab 均可打开、内容无丢失；控制台无 error。

- [ ] **Step 8: 提交**

```bash
git add src/components/sources/
git commit -m "refactor(sources): 按 Tab 拆分 SourceManagementModal，零行为变化"
```

---

## Task 4: 音源列表改用 SettingRow（默认精简 + 展开态 + 统一高度）

**状态**

- [ ] 任务完成

**Dependencies:** Task 2, Task 3
**Parallelizable:** No（需先有基础件与拆分后的 Tab 文件）

- [ ] **Step 1: 写失败测试**

新建 `src/components/sources/tabs/SourceMatrixTab.test.tsx`：

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

describe("SourceMatrixTab 行级信息精简", () => {
  beforeEach(() => {
    localStorage.clear();
    useSourceConfigStore.setState({
      sources: {
        ...useSourceConfigStore.getState().sources,
        netease: {
          ...useSourceConfigStore.getState().sources.netease,
          enabled: true,
          description: "官方全网主流曲库，支持 WeAPI 扫码与 Cookie 绑定",
        },
      },
    });
  });

  it("默认不渲染音源描述（收进展开态）", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(<SourceMatrixTab />);
    expect(html).not.toContain("官方全网主流曲库，支持 WeAPI 扫码与 Cookie 绑定");
  });

  it("默认态每行都有状态点", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(<SourceMatrixTab />);
    expect(html).toContain("data-status=");
    expect((html.match(/data-status=/g) || []).length).toBeGreaterThanOrEqual(6);
  });
});
```

- [ ] **Step 2: 确认失败**

Run: `npx vitest run src/components/sources/tabs/SourceMatrixTab.test.tsx`
Expected: **FAIL**（描述仍被渲染，或尚无 `data-status`）

- [ ] **Step 3: 实现**

`src/components/sources/tabs/SourceMatrixTab.tsx`：把现有 6 张音源卡的渲染替换为分组结构。核心结构如下（具体图标/文案沿用原有映射表）：

```tsx
import { SettingSection, SettingRow, StatusKind } from "@/components/ui/settings";
import { GlassToggle } from "@/components/shared/Glass";

// 原有数据不变，仅换渲染
const OFFICIAL: MusicSourceId[] = ["netease", "qq", "kugou", "kuwo", "qishui"];
const EXTENDED: MusicSourceId[] = ["local", "lx_custom"];

function statusOf(id: MusicSourceId): StatusKind {
  if (!isSourceUsable(id)) return "idle";
  return sources[id].health?.status === "normal" ? "ok" : "warn";
}

return (
  <>
    <SettingSection title="官方音源" description="需要登录后才能解码的平台">
      {OFFICIAL.map((id) => (
        <SettingRow
          key={id}
          title={sources[id].name}
          badge={isPlatformLoggedIn(id) ? undefined : "需登录"}
          status={statusOf(id)}
          latencyMs={sources[id].health?.latencyMs}
          description={sources[id].description}
          control={
            <GlassToggle
              checked={sources[id].enabled}
              onChange={() => toggleSource(id)}
              aria-label={`${sources[id].name} 开关`}
            />
          }
          expandable
          expanded={expandedId === id}
          onToggle={() => setExpandedId((v) => (v === id ? null : id))}
        >
          {/* 展开态才出现：原描述 + 登录入口 + 表单 */}
          <p className="text-[12px] leading-relaxed text-white/50 mb-3">
            {sources[id].description}
          </p>
          <div className="flex items-center gap-2">
            {!isPlatformLoggedIn(id) && <button className="...">去登录</button>}
            {/* local / lx_custom 的表单（音质偏好、轮询优先级、自定义 API）放这里 */}
          </div>
        </SettingRow>
      ))}
    </SettingSection>

    <SettingSection title="扩展" description="本地母带与洛雪自定义脚本">
      {EXTENDED.map((id) => (
        <SettingRow key={id} /* 同上 */ />
      ))}
    </SettingSection>
  </>
);
```

关键约束（对应访谈结论）：

- **默认态只显示** 名称 + badge + 状态点 + 开关 → 描述与登录按钮**只在 `expanded` 时渲染**
- **所有行等高**：`SettingRow` 统一 `py-3`，原「本地母带」的表单移入展开区，网格不再有高低差
- badge **保留文字**（访谈明确不改纯色点），但由每卡 3–4 个降为至多 1 个
- 描述通过 `description` 传入 → 变成行的 `title` 提示

- [ ] **Step 4: 确认通过**

Run: `npx vitest run src/components/sources/tabs/SourceMatrixTab.test.tsx`
Expected: **PASS**（2 用例）

- [ ] **Step 5: 全量回归**

Run: `npx vitest run 2>&1 | tail -4`
Expected: `Test Files 149 passed` / `Tests 774 passed`

- [ ] **Step 6: 提交**

```bash
git add src/components/sources/tabs/SourceMatrixTab.tsx \
        src/components/sources/tabs/SourceMatrixTab.test.tsx
git commit -m "feat(sources): 音源列表改用分组行，描述与登录收进展开态"
```

---

## Task 5: 顶部健康摘要 + 测速就地展示延迟

**状态**

- [ ] 任务完成

**Dependencies:** Task 2, Task 3
**Parallelizable:** Yes（与 Task 4、6、7 并行）

- [ ] **Step 1: 写失败测试**

新建 `src/components/ui/settings/SourceHealthSummary.test.tsx`：

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceHealthSummary } from "./SourceHealthSummary";

const base = [
  { id: "netease", name: "网易云音乐", status: "ok", latencyMs: 88 },
  { id: "qq", name: "QQ 音乐", status: "warn", latencyMs: null },
  { id: "kuwo", name: "酷我音乐", status: "error", latencyMs: null },
];

describe("SourceHealthSummary", () => {
  it("aggregates counts into one line", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary sources={base} onRunDiagnostics={() => undefined} />
    );
    expect(html).toContain("1 在线");
    expect(html).toContain("1 需处理");
    expect(html).toContain("1 异常");
  });

  it("renders per-source latency inline", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary sources={base} onRunDiagnostics={() => undefined} />
    );
    expect(html).toContain("88ms");
  });

  it("shows a running state while probing", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary sources={base} probing onRunDiagnostics={() => undefined} />
    );
    expect(html).toContain("测速中");
  });

  it("shows an idle hint when nothing has been probed", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary
        sources={[{ id: "netease", name: "网易云音乐", status: "idle", latencyMs: null }]}
        onRunDiagnostics={() => undefined}
      />
    );
    expect(html).toContain("尚未测速");
  });
});
```

- [ ] **Step 2: 确认失败**

Run: `npx vitest run src/components/ui/settings/SourceHealthSummary.test.tsx`
Expected: **FAIL**，`Cannot find module './SourceHealthSummary'`

- [ ] **Step 3: 实现**

新建 `src/components/ui/settings/SourceHealthSummary.tsx`：

```tsx
import React from "react";
import { Activity, Loader2 } from "lucide-react";
import { StatusDot, StatusKind } from "./StatusDot";

export interface HealthRow {
  id: string;
  name: string;
  status: StatusKind;
  latencyMs: number | null;
}

export interface SourceHealthSummaryProps {
  sources: HealthRow[];
  probing?: boolean;
  onRunDiagnostics: () => void;
}

export function SourceHealthSummary({
  sources,
  probing = false,
  onRunDiagnostics,
}: SourceHealthSummaryProps) {
  const count = (s: StatusKind) => sources.filter((x) => x.status === s).length;
  const ok = count("ok");
  const warn = count("warn");
  const err = count("error");
  const idle = count("idle");
  const probed = ok + warn + err;

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-3 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          <span className="text-white/45">音源健康</span>
          {probed === 0 && !probing && <span className="text-white/35">尚未测速</span>}
          {probing && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <Loader2 className="w-3 h-3 animate-spin" />
              测速中
            </span>
          )}
          {ok > 0 && <span className="text-emerald-300">{ok} 在线</span>}
          {warn > 0 && <span className="text-amber-300">{warn} 需处理</span>}
          {err > 0 && <span className="text-rose-300">{err} 异常</span>}
          {idle > 0 && <span className="text-white/35">{idle} 未测</span>}
        </div>

        <button
          type="button"
          onClick={onRunDiagnostics}
          disabled={probing}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[12px] text-white/80 disabled:opacity-50 transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          {probing ? "测速中…" : "快速测速"}
        </button>
      </div>

      {probed > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex flex-wrap gap-x-5 gap-y-1.5">
          {sources.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] text-white/55">
              <span className="truncate max-w-[120px]">{s.name}</span>
              <StatusDot status={s.status} latencyMs={s.latencyMs ?? undefined} showLabel />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 接进 Tab**

`src/components/sources/tabs/SourceMatrixTab.tsx` 顶部（在 `<SettingSection>` 之前）插入：

```tsx
import { SourceHealthSummary, HealthRow } from "@/components/ui/settings/SourceHealthSummary";

const healthRows: HealthRow[] = [...OFFICIAL, ...EXTENDED].map((id) => ({
  id,
  name: sources[id].name,
  status: statusOf(id),
  latencyMs: sources[id].health?.latencyMs ?? null,
}));

<SourceHealthSummary
  sources={healthRows}
  probing={isProbing}
  onRunDiagnostics={runQuickSpeedTest}
/>;
```

并把 `src/components/ui/settings/index.ts` 补上 `export { SourceHealthSummary } from "./SourceHealthSummary";`。

- [ ] **Step 5: 确认通过**

Run: `npx vitest run src/components/ui/settings/SourceHealthSummary.test.tsx`
Expected: **PASS**（4 用例）

- [ ] **Step 6: 全量回归**

Run: `npx vitest run 2>&1 | tail -4`
Expected: 测试数 778（774 + 4），全绿

- [ ] **Step 7: 提交**

```bash
git add src/components/ui/settings/ src/components/sources/tabs/SourceMatrixTab.tsx
git commit -m "feat(sources): 顶部健康摘要 + 测速延迟就地展示"
```

---

## Task 6: 空态 / 加载态 / 错误态接入

**状态**

- [ ] 任务完成

**Dependencies:** Task 2, Task 3
**Parallelizable:** Yes（与 Task 4、5、7 并行）

- [ ] **Step 1: 确认既有基础件的 API**

Run: `sed -n '1,60p' src/components/shared/Glass/EmptyState.tsx` 与 `LoadingSkeleton.tsx`
目的：拿到真实 props 名，避免下面的调用对不上。

- [ ] **Step 2: 写失败测试**

新建 `src/components/sources/tabs/SourceMatrixTab.states.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

describe("SourceMatrixTab 状态", () => {
  beforeEach(() => localStorage.clear());

  it("无任何音源时渲染空态与引导动作", async () => {
    useSourceConfigStore.setState({ sources: {} as never });
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(<SourceMatrixTab />);
    expect(html).toContain("还没有可用音源");
    expect(html).toContain("恢复默认");
  });

  it("加载中渲染骨架而非空白", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(<SourceMatrixTab loading />);
    expect(html).toContain("data-skeleton");
  });

  it("加载失败渲染错误态与重试", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(
      <SourceMatrixTab error="上游配置拉取失败" onRetry={() => undefined} />
    );
    expect(html).toContain("上游配置拉取失败");
    expect(html).toContain("重试");
  });
});
```

- [ ] **Step 3: 确认失败**

Run: `npx vitest run src/components/sources/tabs/SourceMatrixTab.states.test.tsx`
Expected: **FAIL**（组件尚无 `loading` / `error` / `onRetry` props）

- [ ] **Step 4: 实现**

`src/components/sources/tabs/SourceMatrixTab.tsx`：

1. 签名扩为：

```tsx
export interface SourceMatrixTabProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function SourceMatrixTab({ loading = false, error = null, onRetry }: SourceMatrixTabProps = {}) {
```

2. 在函数体最前加分派：

```tsx
const sourceIds = [...OFFICIAL, ...EXTENDED];

if (loading) {
  return (
    <div data-skeleton="true" className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <LoadingSkeleton key={i} height="56px" />
      ))}
    </div>
  );
}

if (error) {
  return (
    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-6">
      <p className="text-[13px] text-rose-200">{error}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="h-8 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[12.5px] text-white transition-colors"
        >
          重试
        </button>
        <button
          type="button"
          onClick={() => resetToDefaults?.()}
          className="h-8 px-3.5 rounded-full bg-white/[0.06] hover:bg-white/12 text-[12.5px] text-white/70 transition-colors"
        >
          恢复默认
        </button>
      </div>
    </div>
  );
}

if (sourceIds.length === 0) {
  return (
    <EmptyState
      title="还没有可用音源"
      description="导入或恢复默认配置后即可管理 7 大平台通道"
      actionLabel="恢复默认"
      onAction={() => resetToDefaults?.()}
    />
  );
}
```

3. import 追加：

```tsx
import { EmptyState, LoadingSkeleton } from "@/components/shared/Glass";
```

> `EmptyState` / `LoadingSkeleton` 的实际 props 以 Step 1 读到的为准；若名称不同（如 `onAction` 叫 `action`），按实况调整，测试断言保持「文案 + 动作按钮」即可。

- [ ] **Step 5: 确认通过**

Run: `npx vitest run src/components/sources/tabs/`
Expected: **PASS**

- [ ] **Step 6: 同法接入其余 Tab**

对 `LxScriptsTab`、`DiagnosticsTab`、`BackupTab`、`OfflineCacheTab` 施加同样的三分支（loading / error / empty），每个文件各补 2 条用例（空态 + 加载态），追加到各自的 `*.test.tsx`：

```tsx
it("renders empty state when there is nothing yet", async () => {
  const { XxxTab } = await import("./XxxTab");
  const html = renderToStaticMarkup(<XxxTab />);
  expect(html.length).toBeGreaterThan(0);
  expect(html).toContain("还没有");
});

it("renders skeleton while loading", async () => {
  const { XxxTab } = await import("./XxxTab");
  expect(renderToStaticMarkup(<XxxTab loading />)).toContain("data-skeleton");
});
```

Run: `npx vitest run src/components/sources/`
Expected: 全绿，用例数较 Task 5 基线 +8

- [ ] **Step 7: 提交**

```bash
git add src/components/sources/tabs/
git commit -m "feat(sources): 补齐空态/加载态/错误态与重试入口"
```

---

## Task 7: 长任务进度与可取消

**状态**

- [ ] 任务完成

**Dependencies:** Task 3
**Parallelizable:** Yes（与 Task 4、5、6 并行）

- [ ] **Step 1: 定位长任务**

Run: `grep -rn "for (const\|Promise.all\|for await" src/components/sources/tabs/*.tsx | head -20`
重点：批量测速循环、离线缓存清理/预取、洛雪脚本批量拉取。

- [ ] **Step 2: 写失败测试**

新建 `src/components/ui/settings/useCancellableTask.test.ts`：

```ts
import { describe, it, expect, vi } from "vitest";
import { createCancellableTask } from "./useCancellableTask";

describe("createCancellableTask", () => {
  it("reports progress for each unit and completes", async () => {
    const seen: number[] = [];
    const task = createCancellableTask(
      3,
      async (i, report) => {
        report(i + 1);
      },
      { onProgress: (done, total) => seen.push(done / total) }
    );
    const result = await task.run();
    expect(result.status).toBe("done");
    expect(seen).toEqual([1 / 3, 2 / 3, 1]);
  });

  it("stops as soon as cancel is called", async () => {
    let processed = 0;
    const task = createCancellableTask(10, async (_i, report) => {
      processed += 1;
      report(processed);
    });
    const promise = task.run();
    task.cancel();
    const result = await promise;
    expect(result.status).toBe("cancelled");
    expect(processed).toBeLessThan(10);
  });

  it("surfaces a failure without aborting the caller", async () => {
    const task = createCancellableTask(2, async (i) => {
      if (i === 1) throw new Error("boom");
    });
    const result = await task.run();
    expect(result.status).toBe("error");
    expect(result.error).toBe("boom");
  });
});
```

- [ ] **Step 3: 确认失败**

Run: `npx vitest run src/components/ui/settings/useCancellableTask.test.ts`
Expected: **FAIL**，`Cannot find module './useCancellableTask'`

- [ ] **Step 4: 实现**

新建 `src/components/ui/settings/useCancellableTask.ts`：

```ts
export type TaskStatus = "idle" | "running" | "done" | "cancelled" | "error";

export interface TaskResult {
  status: TaskStatus;
  error?: string;
}

export interface CancellableTask {
  run: () => Promise<TaskResult>;
  cancel: () => void;
  readonly status: TaskStatus;
}

/**
 * 逐单元执行、可上报进度、可中途取消的批量任务。
 * 用于测速、离线缓存清理、脚本批量拉取这类会卡住 UI 的长循环。
 */
export function createCancellableTask(
  total: number,
  unit: (index: number, report: (done: number) => void) => Promise<void> | void,
  options: { onProgress?: (done: number, total: number) => void } = {}
): CancellableTask {
  let cancelled = false;
  let status: TaskStatus = "idle";

  const cancel = () => {
    if (status === "running") {
      cancelled = true;
      status = "cancelled";
    }
  };

  const run = async (): Promise<TaskResult> => {
    status = "running";
    try {
      for (let i = 0; i < total; i++) {
        if (cancelled) return { status: "cancelled" };
        await unit(i, (done) => options.onProgress?.(done, total));
        if (cancelled) return { status: "cancelled" };
        options.onProgress?.(i + 1, total);
      }
      status = "done";
      return { status: "done" };
    } catch (e) {
      status = "error";
      return { status: "error", error: e instanceof Error ? e.message : String(e) };
    }
  };

  return {
    run,
    cancel,
    get status() {
      return status;
    },
  };
}
```

并导出一个 React hook 包装（同文件底部）：

```ts
import { useCallback, useRef, useState } from "react";

export function useCancellableTask(
  total: number,
  unit: (index: number, report: (done: number) => void) => Promise<void> | void
) {
  const taskRef = useRef<ReturnType<typeof createCancellableTask> | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<TaskStatus>("idle");

  const start = useCallback(async () => {
    const task = createCancellableTask(total, unit, {
      onProgress: (done, all) => setProgress(all === 0 ? 0 : done / all),
    });
    taskRef.current = task;
    setStatus("running");
    const res = await task.run();
    setStatus(res.status);
    return res;
  }, [total, unit]);

  const cancel = useCallback(() => taskRef.current?.cancel(), []);

  return { start, cancel, progress, status };
}
```

- [ ] **Step 5: 确认通过**

Run: `npx vitest run src/components/ui/settings/useCancellableTask.test.ts`
Expected: **PASS**（3 用例）

- [ ] **Step 6: 接到批量测速上**

`src/components/sources/tabs/DiagnosticsTab.tsx`（或 `SourceMatrixTab` 的 `runQuickSpeedTest`）：

```tsx
import { useCancellableTask } from "@/components/ui/settings/useCancellableTask";

const { start, cancel, progress, status } = useCancellableTask(
  sourceIds.length,
  async (i, report) => {
    await probeOne(sourceIds[i]); // 沿用既有单源测速
    report(i + 1);
  }
);

// 渲染：进度条 + 取消
{
  status === "running" && (
    <div className="flex items-center gap-3 mt-3">
      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-[#2997ff] transition-[width] duration-200"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-white/55">{Math.round(progress * 100)}%</span>
      <button
        type="button"
        onClick={cancel}
        className="text-[12px] text-white/60 hover:text-white transition-colors"
      >
        取消
      </button>
    </div>
  );
}
```

- [ ] **Step 7: 全量回归**

Run: `npx vitest run 2>&1 | tail -4`
Expected: 全绿，用例数 +3

- [ ] **Step 8: 提交**

```bash
git add src/components/ui/settings/useCancellableTask.ts \
        src/components/ui/settings/useCancellableTask.test.ts \
        src/components/sources/tabs/
git commit -m "feat(sources): 长任务进度与可取消"
```

---

## Task 8: 曲库看板复用基础件 + 主角指标重排

**状态**

- [x] 任务完成

**Dependencies:** Task 2
**Parallelizable:** Yes（可与 Task 4–7 并行；依赖 Task 2 的基础件）

- [ ] **Step 1: 记录基线并截图**

Run: `npx vitest run src/components/library/ 2>&1 | tail -4`
Expected: `LibraryManagerPanel` `UnifiedDataManagerHub` `LocalMusicManager` `LibraryHealthPanel` `SmartPlaylistPanel` `LxMusicSearchTab` 全绿。

预览面板打开 `/data-manager`，**保存改造前截图**（验收用）。

- [ ] **Step 2: 写失败测试**

新建 `src/components/library/hub/DataDashboardTab.test.tsx`：

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("DataDashboardTab 主角指标", () => {
  it("把存储配额做成首屏主角（含单位与配额上限）", async () => {
    const { DataDashboardTab } = await import("./DataDashboardTab");
    const html = renderToStaticMarkup(<DataDashboardTab />);
    expect(html).toContain("已用存储");
    expect(html).toMatch(/\d+(\.\d+)?\s*(KB|MB|GB)/);
    expect(html).toContain("配额");
  });

  it("四类主角指标各自成组，不再平铺同级", async () => {
    const { DataDashboardTab } = await import("./DataDashboardTab");
    const html = renderToStaticMarkup(<DataDashboardTab />);
    // 四个分组标题都必须出现，说明用的是 SettingSection 分组
    for (const t of ["存储与配额", "音质与编码", "云端账号", "曲库健康"]) {
      expect(html).toContain(t);
    }
  });

  it("分组标题使用统一的组头样式", async () => {
    const { DataDashboardTab } = await import("./DataDashboardTab");
    const html = renderToStaticMarkup(<DataDashboardTab />);
    expect(html).toContain("tracking-[0.14em]");
  });
});
```

- [ ] **Step 3: 确认失败**

Run: `npx vitest run src/components/library/hub/DataDashboardTab.test.tsx`
Expected: **FAIL**（当前无 `tracking-[0.14em]` 组头，也无四个分组标题）

- [ ] **Step 4: 实现**

`src/components/library/hub/DataDashboardTab.tsx`：

1. import：

```tsx
import { SettingSection, SettingRow, StatusDot } from "@/components/ui/settings";
```

2. 把现有平铺卡片改为四个 `SettingSection`：

```tsx
<SettingSection
  title="存储与配额"
  description="本地数据卷与配额占用"
  action={<span className="text-[11px] text-white/40 tabular-nums">{`${usedText} / ${quotaText}`}</span>}
>
  {/* 现有 LiquidStorageGauge + 数字，原样迁入组内 */}
</SettingSection>

<SettingSection title="音质与编码" description="按码率分档统计曲目数量">
  {/* 现有 QualityDistributionChart */}
</SettingSection>

<SettingSection title="云端账号" description="与音源管理同源的登录状态">
  {platforms.map((p) => (
    <SettingRow
      key={p.id}
      title={p.name}
      status={p.loggedIn ? "ok" : "idle"}
      trailing={<span className="text-[12px] text-white/45">{p.loggedIn ? p.nickname : "未登录"}</span>}
    />
  ))}
</SettingSection>

<SettingSection title="曲库健康" description="总数、缺失封面、无法解析">
  {healthItems.map((h) => (
    <SettingRow key={h.label} title={h.label} status={h.tone}
      trailing={<span className="text-[12.5px] font-semibold tabular-nums text-white/85">{h.value}</span>} />
  ))}
</SettingSection>
```

3. 组内间距由 `SettingSection` 的 `mb-7` 统一接管，去掉原卡片各自的 `mb-4`/`gap-4`。

- [ ] **Step 5: 确认通过**

Run: `npx vitest run src/components/library/hub/DataDashboardTab.test.tsx`
Expected: **PASS**（3 用例）

- [ ] **Step 6: 播放条避让**

现状：播放条浮层挡住看板内容。修法是给看板根容器加底部内边距，使滚动内容不落在播放条之下。

`src/components/library/hub/DataDashboardTab.tsx` 最外层容器：

```tsx
// 播放条固定在底部，给内容留出避让高度；standalone 页面没有播放条时不加
<div className="pb-[104px]">{/* 原内容 */}</div>
```

若播放条高度不是 104px，实测后替换：预览面板取 `.fixed.bottom-0` 播放条的 `getBoundingClientRect().height`。

- [ ] **Step 7: 三档宽度 + 全量回归**

Run: `npx vitest run 2>&1 | tail -4`
Expected: 全绿，用例数 +3

预览面板设 `1024` / `1280` / `1440`，打开 `/data-manager`，确认：

- 四个分组依次排列，无横向溢出（`document.documentElement.scrollWidth <= innerWidth`）
- 播放条不再遮挡滚动内容

- [ ] **Step 8: 提交**

```bash
git add src/components/library/hub/DataDashboardTab.tsx \
        src/components/library/hub/DataDashboardTab.test.tsx
git commit -m "feat(library): 看板改用分组行，四类主角指标重排并避让播放条"
```

---

## Task 9: 三档宽度实测 + 前后截图 + 全量回归

**状态**

- [ ] 任务完成

**Dependencies:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8
**Parallelizable:** No（依赖全部前置任务）

- [ ] **Step 1: 全量测试**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `Test Files` 全 passed；用例总数 ≥ 786（基线 772 + 本计划新增 14+）

- [ ] **Step 2: 静态检查**

Run: `npm run lint 2>&1 | tail -2` → `lint exit=0`
Run: `npx tsc --noEmit 2>&1 | tail -2` → `tsc exit=0`
Run: `npx prettier --check "src/**/*.{ts,tsx,css,json}" 2>&1 | tail -2` → `All matched files use Prettier code style!`

- [ ] **Step 3: 三档宽度顶栏重叠归零**

对 `1024` / `1280` / `1440` 各执行 Task 1 Step 11 的求交脚本。
Expected: 三档 `overlaps` 均为空数组。

- [ ] **Step 4: 两屏三档截图存档**

对每个宽度各截两张：音源管理浮层、`/data-manager` 全景看板。
存入 `docs/nbl/plans/screenshots/`，命名 `source-1024.png`、`library-1440.png` 等。

并与 Task 8 Step 1 保存的改造前截图并排比对，逐项核对：

- [ ] 分组标题、发丝线、留白符合 Apple 设置风
- [ ] 音源行默认不含描述与登录按钮，展开后才出现
- [ ] 本地母带不再高出其他行，网格无空洞
- [ ] 健康摘要显示 N 在线 / M 需处理 / K 异常，测速后就地显示延迟
- [ ] 看板四组主角指标层级明显高于次要信息
- [ ] 播放条不再遮挡看板内容

- [ ] **Step 5: 提交**

```bash
git add docs/nbl/plans/screenshots/
git commit -m "docs: 音源管理与曲库看板改造前后截图存档"
```

---

## 四、自检

**1. 规格覆盖**

| 访谈结论              | 落在哪个 Task                                                                     |
| --------------------- | --------------------------------------------------------------------------------- |
| 信息架构与布局        | Task 3（拆分）、Task 4（分组）、Task 8（看板重排）                                |
| 交互与状态            | Task 5（测速就地/摘要）、Task 6（三态）、Task 7（进度可取消）                     |
| 代码层重构            | Task 2（基础件）、Task 3（拆文件）                                                |
| Apple 设置风          | Task 2 定义组头/行样式，Task 4、8 落地                                            |
| 保持浮层形态          | Task 3 仅拆内部，外壳与入口不动                                                   |
| 卡片精简 + 展开态     | Task 4                                                                            |
| 统一高度              | Task 4（表单移入展开区）                                                          |
| 描述改提示层          | Task 4（`description` → 行 `title`）                                              |
| 保留文字 badge        | Task 4（badge 保留但降为至多 1 个）                                               |
| 顶栏重叠 + 1024       | Task 1、Task 9                                                                    |
| 先音源管理后曲库      | Task 1–7 → Task 8 的顺序依赖                                                      |
| 看板四主角            | Task 8                                                                            |
| 四类边界              | Task 6（断网/空数据）、Task 7（长任务）、Task 8（大数据量复用既有 `VirtualList`） |
| 前后截图 + 不回退测试 | Task 9                                                                            |

**2. 占位符扫描**：无 TBD/TODO/「类似 Task N」；所有代码步骤均给出完整代码或精确行界与替换内容。

**3. 类型一致性**：`StatusKind` 统一在 `StatusDot.tsx` 定义、由 `index.ts` 再导出；`SettingRowProps` / `SettingSectionProps` / `SourceHealthSummaryProps` / `HealthRow` 在 Task 2、5 定义后，Task 4、5、8 的引用名与字段一致（`status` / `latencyMs` / `expandable` / `expanded` / `onToggle` / `description`）。

---

**Execution Mode:** parallel

---

## 五、执行勘误（写完计划后复核发现，以本节为准）

### 5.1 Task 1 Step 1/3 修正：`useMediaQuery` 的实现与测试

**原实现的问题**：`useState(false)` + effect 里再同步，会导致
(a) `renderToStaticMarkup` 不执行 effect，测试里永远读到 `false`，宽度断言无法生效；
(b) SSR 渲染 `false`、客户端首帧 `true` → React 水合不匹配告警（本项目验收要求控制台 0 error）。

**修正后的实现**（替换原 Step 3 的 `src/hooks/useMediaQuery.ts` 全文）：

```ts
"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string) {
  return (onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

/**
 * 订阅一条 CSS 媒体查询。
 * 用 useSyncExternalStore 而非 useState+effect：
 *  - getServerSnapshot 返回 false，水合时与服务端一致，不会产生不匹配告警；
 *  - 水合完成后 React 会静默重渲染成真实值。
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () =>
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false
  );
}
```

**修正后的测试**（替换原 Step 1 的 `src/hooks/useMediaQuery.test.ts` 全文；
因 `getServerSnapshot` 恒为 false，必须真实渲染 + `act`，项目已有先例 `AISettingsPanel.test.tsx`）：

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useMediaQuery } from "./useMediaQuery";

function stubViewport(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => {
      const max = /max-width:\s*(\d+)/.exec(query);
      const matches = max ? width <= Number(max[1]) : false;
      return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    })
  );
}

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span data-matches={String(matches)} />;
}

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
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("is true when the viewport satisfies a max-width query", async () => {
    stubViewport(1024);
    await act(async () => root.render(<Probe query="(max-width: 1199px)" />));
    expect(container.querySelector("[data-matches]")?.getAttribute("data-matches")).toBe("true");
  });

  it("is false above the breakpoint", async () => {
    stubViewport(1280);
    await act(async () => root.render(<Probe query="(max-width: 1199px)" />));
    expect(container.querySelector("[data-matches]")?.getAttribute("data-matches")).toBe("false");
  });
});
```

**连带影响**：原 Step 1 里的 `src/hooks/testRenderHook.ts` **不再需要，不要创建**。
原 Step 5 的 `AppleUnifiedNavIsland.responsive.test.tsx` 同理不能用
`renderToStaticMarkup`，必须改成 `createRoot` + `act` + `vi.mock("framer-motion")`
（`motion.*` 降级为同名原生标签，参照 `AISettingsPanel.test.tsx` 的写法），
断言改为对 `container.innerHTML` 做 `toContain`。

### 5.2 浏览器验证的位置（覆盖 Task 1 Step 11、Task 8 Step 7、Task 9）

并行执行采用隔离 worktree。**dev server 固定跑在主工作树的 3025 端口**
（`useOfflineDownloadStore.ts` 与后端 CORS 均硬编码 3025，无法另开端口），
因此**任何 worktree 里的改动预览面板都看不到**。

规则：

- Task 1–8 的子代理**只做代码与测试**，遇到计划里的「浏览器实测/截图」步骤直接跳过并在报告中标注 `DEFERRED`
- 所有浏览器验证（三档宽度重叠归零、两屏前后截图、播放条避让）统一收口到 **Task 9**，
  由主协调者在**主工作树** `D:\26project\music_source_code_V1.1_full\music_source_code` 执行
- Task 9 的前置条件因此变为：所有任务已合并回 merge 分支 → 合并回主工作树 → 再做浏览器验证

### 5.3 执行环境

- merge worktree：`.worktrees/source-manager-library-ui-merge`（分支 `feature/source-manager-library-ui-merge`）
- 任务 worktree：`.worktrees/source-manager-library-ui-task{N}`（分支 `feature/source-manager-library-ui-task{N}`，父为 merge 分支）
- **无需 link `node_modules`**：`.worktrees/` 位于仓库内，Node 模块解析会向上找到根目录的 `node_modules`；
  已实测在 worktree 内 `npx vitest run src/hooks` → 14 passed
- 每个 worktree 需补拷 `.env.local`（未被 git 跟踪，新建 worktree 拿不到）
- 本项目的 `using-git-worktrees` / `subagent-driven-development` skill **只有 SKILL.md、无配套脚本与 prompt 模板**，
  因此 worktree 增删改用原生命令，implementer prompt 由协调者按 skill 明示的契约撰写


---

## 六、执行进展与已知偏差（执行中追加）

### 进度

| Task | 状态 | 关键数字 |
| --- | --- | --- |
| 1 顶栏响应式 | 完成并合并 | 测试 +4（772→776）；`useMediaQuery` 改用 `useSyncExternalStore`，测试改 `createRoot` + `act` |
| 2 分组基础件 | 完成并合并 | 新增 2 文件 / 11 用例（772→783） |
| 3 按 Tab 拆文件 | 完成并合并 | `SourceManagementModal` 1067→**174** 行；测试 **152/788 逐字一致** |
| 8 看板主角指标 | 完成并合并 | 新增 1 文件 / 3 用例（788→791） |
| 合并态 | — | **153 文件 / 791 测试**，tsc / lint / prettier 全绿 |

待办：Task 4 / 5 / 6 / 7（均依赖 Task 2 + Task 3，已就绪）、Task 9 收口。

### 已知偏差（Task 9 或后续需处理）

1. **Tab 本地 state 现在随切 Tab 卸载而重置**（Task 3 顾虑，属计划 Step 2/4「局部 state 一并搬进」的必然结果）

   - 影响：`BackupTab` 的导入 JSON 文本、`LxScriptsTab` 的新增脚本表单与脚本测试结果，切走再回来会清空
   - 拆分前这些 state 活在外壳，切走再切回仍在
   - 单 Tab 内的渲染与交互完全不变；测试数逐字一致即证
   - 若要求跨 Tab 保持 → 需把这几个 state 提回外壳再 props 下传（Task 4–7 触碰 `SourceMatrixTab`，届时一并评估）

2. **`pb-[104px]` 的前提存疑**（Task 8）

   - 计划假设播放条是固定底栏，但实际 `FloatingPlayer` 是 `left:28 / top:280` 的**可拖拽浮层**，不是 fixed bottom bar
   - 子代理在 `FloatingPlayer`、`floating/*`、`Player3D`、`layout/` 均未找到可引用的高度常量
   - Task 9 必须实测：确认遮挡是否真实存在 → 存在则用实测值或改用别的避让方式（z-index / 内容外边距），不存在则撤掉这段 padding

3. **`DataDashboardTab` 未接 standalone 分支**

   - 该组件没有 `isStandalonePage` prop，接线要改 `UnifiedDataManagerHub`（超出 Task 8「只改一个文件」范围）
   - 当前 `/data-manager` 也带 104px padding；`FloatingPlayer` 是浮层，standalone 下多余 padding 影响很小
   - Task 9 若要求区分，需父级传参

4. **计划原文的三处笔误（已按实测纠正）**

   - Task 1 Step 1 文件名写成 `.ts`，但该测试含 JSX，esbuild/oxc 不解析 → 实际用 `.tsx`
   - Task 2 Step 10 期望数字算错：实际产出 2 个测试文件 / 计划内 10 用例 + 1 条守卫 = 11
   - 各 Task Step 1 的「148 / 772」基线已过期 → 派发时按当时的实测值下发

5. **顶栏修复中补的两处**（子代理按范围刻意未扩改，由协调者在合并前处理）

   - 溢出菜单原先无法用外部点击 / Esc 收起：既有 effect 只清 `activeHubId`、依赖也只有它
   - `subscribe(query)` 每次渲染新建导致 `useSyncExternalStore` 退订重订 → 用 `useMemo` 按 `query` 记住
   - 两项均补了测试；摘掉修复后该用例 `1 failed | 2 passed`，恢复后 `3 passed`
