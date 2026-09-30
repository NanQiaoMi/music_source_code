# 资料库中枢视觉统一与连续播放实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 nbl.subagent-driven-development（推荐）或 nbl.parallel-subagent-driven-development 按任务执行。每项任务使用复选框追踪。

**Goal:** 统一音源管理弹窗与资料库资产管理中枢的玻璃拟态设计，并确保应用内进入资料库时播放会话、进度和队列保持连续同步。

**Architecture:** 两个主页面入口改用 Next.js 客户端导航；根布局继续唯一挂载音频 hook，只切换播放器的 UI 呈现。资料库路由使用新的紧凑底部播放栏并预留滚动空间；七个分区统一内容壳，总览和聚搜做重点信息层级与状态优化；音源管理弹窗沿用现有五个 Tab 和设置组件，只调整视觉样式与窄屏布局。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Zustand、Framer Motion、Tailwind CSS、Vitest/jsdom。

---

## 1. 文件职责与范围

| 路径                                                         | 变更职责                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| src/components/layout/HeaderToolbar.tsx                      | 主工具栏资料库入口改为 Next Link。                                                                                       |
| src/components/layout/HeaderToolbar.test.tsx                 | 固定资料库入口仍有正确 href，保持图标和窄屏标题语义。                                                                    |
| src/components/layout/AppleUnifiedNavIsland.tsx              | 导航岛资料库动作改为 App Router push。                                                                                   |
| src/components/layout/AppleUnifiedNavIsland.test.tsx         | 验证点击“音乐库管理器”会执行客户端 push。                                                                                |
| src/components/layout/GlobalClientComponents.tsx             | 保持 useAudioPlayer/useMediaSession/useElectron 在根布局持续挂载；根据 pathname 在 FloatingPlayer 与管理页播放栏间切换。 |
| src/components/player/DataManagerPlayerDock.tsx              | 新建资料库专用底部播放栏，从现有 audio/player/queue store 读取和修改状态，不创建音频元素。                               |
| src/components/player/DataManagerPlayerDock.test.tsx         | 验证当前曲目、进度、播放状态、队列计数、无曲目状态和明确的用户控制操作。                                                 |
| src/components/library/UnifiedDataManagerHub.tsx             | 七个分区使用一致的内容宽度、窄屏导航和底部安全空间。                                                                     |
| src/components/library/UnifiedDataManagerHub.test.tsx        | 验证统一的最大宽度、standalone 安全空间和七个分区入口。                                                                  |
| src/components/library/hub/DataDashboardTab.tsx              | 统一存储、音质、账号、健康指标的卡片层级与青蓝玻璃强调。                                                                 |
| src/components/library/hub/DataDashboardTab.test.tsx         | 固定四类指标结构和窄屏适配标记，保留既有数据口径。                                                                       |
| src/components/library/hub/LxMusicSearchTab.tsx              | 优化搜索控件分组与间距；分别呈现锁定、空结果、加载和请求失败状态。                                                       |
| src/components/library/hub/LxMusicSearchTab.test.tsx         | 覆盖搜索成功、空结果、未登录和请求失败后的重试入口。                                                                     |
| src/components/sources/SourceManagementModal.tsx             | 保留五个 Tab 和所有业务动作，统一标题、选中态、卡片表面、焦点与窄屏边距。                                                |
| src/components/sources/SourceManagementModal.states.test.tsx | 保留同步错误测试，并覆盖弹窗语义和 Tab 可访问状态。                                                                      |
| docs/nbl/CHANGELOG.md                                        | 记录本轮已实现并验证的 UI 与播放导航改动。                                                                               |

不修改 Home View、Player View、全屏歌词核心视图；不修改音频解析、认证、搜索接口、队列持久化或 localStorage/IndexedDB 数据格式。不把第二个 HTMLAudioElement 引入资料库页。

## 2. 实施任务

### Task 1：把两个资料库入口改成应用内导航

**状态**

- [ ] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1：固定工具栏入口的导航契约**

在 src/components/layout/HeaderToolbar.test.tsx 的首个渲染测试旁增加 next/link mock，让 mock 链接输出 data-client-link="true"，再断言：

```tsx
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: import("react").ReactNode }) => (
    <a href={href} data-client-link="true">
      {children}
    </a>
  ),
}));
```

```tsx
it("keeps the library manager as an in-app route link", () => {
  const html = renderToStaticMarkup(<HeaderToolbar />);

  expect(html).toContain('data-client-link="true"');
  expect(html).toContain('href="/data-manager"');
  expect(html).toContain("管理曲库");
});
```

运行：npx vitest run src/components/layout/HeaderToolbar.test.tsx
预期：当前实现已含 href；此测试作为入口结构回归保护，随后同任务验证链接仍由 Next Link 渲染。

- [ ] **Step 2：固定导航岛点击使用 router.push**

在 src/components/layout/AppleUnifiedNavIsland.test.tsx 中 mock next/navigation 的 useRouter，挂载导航岛，打开“曲库与发现”菜单并点击“音乐库管理器”，断言 push 只以 /data-manager 调用一次。测试不得 stub 或断言 window.location.href。

```tsx
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
```

运行：npx vitest run src/components/layout/AppleUnifiedNavIsland.test.tsx
预期：现有静态渲染用例继续通过；新交互用例在旧实现中失败，因为旧实现直接写 window.location.href。

- [ ] **Step 3：实现客户端导航**

HeaderToolbar.tsx 将 motion.a 改为 Next Link，保留 href、title、图标、可见文字和现有胶囊样式；用 Tailwind hover/active transform 保留轻交互。AppleUnifiedNavIsland.tsx 调用 useRouter，并将该 hub item 的 action 改为 router.push("/data-manager")。

```tsx
import Link from "next/link";

// 资料库主入口
<Link
  href="/data-manager"
  title="导入与管理曲库"
  className={
    isVeryNarrow
      ? "h-[36px] rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white text-[12px] font-medium flex items-center transition-all shadow-sm whitespace-nowrap shrink-0 active:scale-[0.98] w-9 justify-center px-0"
      : "h-[36px] rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white text-[12px] font-medium flex items-center transition-all shadow-sm whitespace-nowrap shrink-0 active:scale-[0.98] px-3.5 gap-1.5"
  }
>
  <Plus className="w-3.5 h-3.5" />
  {!isVeryNarrow && <span>管理曲库</span>}
</Link>;
```

```tsx
const router = useRouter();

// libraryManager hub item
action: () => router.push("/data-manager"),
```

验收：两个入口只触发客户端路由；原首页视图、工具栏布局与入口可访问名称不变。

- [ ] **Step 4：重跑入口测试并提交**

运行：npx vitest run src/components/layout/HeaderToolbar.test.tsx src/components/layout/AppleUnifiedNavIsland.test.tsx
预期：两个文件全部通过。提交：fix(navigation): preserve player session when opening library。

### Task 2：为资料库路由加入紧凑播放栏并保持音频所有者不变

**状态**

- [ ] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1：先写播放栏状态测试**

新增 src/components/player/DataManagerPlayerDock.test.tsx，使用现有 Zustand stores 设置一首歌曲、currentTime=42、duration=180、isPlaying=true 和两首队列；验证标题、时间、队列入口和播放按钮状态来自 stores。再分别验证没有 currentSong 时返回 null，点击播放/暂停、进度和队列控件只调用现有 store action。

```tsx
useAudioStore.setState({
  currentSong: {
    id: "track-1",
    title: "测试曲目",
    artist: "测试歌手",
    duration: 180,
    source: "local",
  },
  currentTime: 42,
  duration: 180,
  isPlaying: true,
  isLoading: false,
  error: null,
});
useQueueStore.setState({ queue: [trackOne, trackTwo], currentIndex: 0 });
```

运行：npx vitest run src/components/player/DataManagerPlayerDock.test.tsx
预期：因组件尚不存在而失败。

- [ ] **Step 2：实现新的管理页播放栏**

新增 DataManagerPlayerDock.tsx。组件订阅 audioStore 的 currentSong、isPlaying、isLoading、currentTime、duration、error；订阅 queueStore 的 queue/currentIndex；使用 audioStore 的 setIsPlaying、prevSong、nextSong、seekTo，并用 useUIStore 的 openPanel("queue") 打开已有 QueuePanel。currentSong 为空时不渲染。失败时显示 error.message；路由进入本身不得调用播放、暂停、load、seek、切歌或自动重试动作。播放栏需有曲名、歌手、播放状态、上一首/播放暂停/下一首、进度 input、队列按钮与清楚的 aria-label。

播放按钮按如下方式连接到现有 store：

```tsx
const handleTogglePlay = () => {
  useAudioStore.getState().setIsPlaying(!isPlaying);
};
```

进度输入只在用户变更时 seek：

```tsx
<input
  type="range"
  min={0}
  max={duration || 0}
  value={duration > 0 ? Math.min(currentTime, duration) : 0}
  disabled={duration <= 0 || isLoading}
  aria-label="播放进度"
  onChange={(event) => useAudioStore.getState().seekTo(Number(event.currentTarget.value))}
/>
```

播放栏 fixed 在页面底部，居中、max-width 与主内容一致；玻璃底板采用深碳色、轻透明边框和青蓝进度强调。窄于 768px 时曲目信息允许截断，控制按钮保持可点击，不出现横向溢出。

- [ ] **Step 3：按 pathname 切换 UI，不卸载播放 hook**

GlobalClientComponents.tsx 中调用 usePathname。用精确路径段判断 /data-manager 与其子路径。useAudioPlayer/useMediaSession/useElectron 继续在 GlobalClientComponents 顶层无条件调用，只有播放器呈现二选一：

```tsx
const pathname = usePathname();
const isDataManagerRoute = pathname === "/data-manager" || pathname.startsWith("/data-manager/");

// 根级音频 hook 保持挂载
useAudioPlayer();
useMediaSession();
useElectron();

return (
  <>
    <TopEdgeSearchTrigger />
    {isDataManagerRoute ? <DataManagerPlayerDock /> : <FloatingPlayer />}
    {/* 其余全局组件保持原挂载结构 */}
  </>
);
```

不得在 GlobalClientComponents 内按路由条件调用 hooks，不得创建 Audio 或更改当前曲目。

- [ ] **Step 4：给 standalone 管理页预留底部空间**

UnifiedDataManagerHub.tsx 的主滚动区在 isStandalonePage 时增加至少 6rem 底部 padding；嵌入式面板保持原高度规则，避免主页浮窗外观或 Home View 布局变化。保留 overflow-y-auto，并让主区及卡片具备 min-w-0。用固定 Tailwind 类名分支：standalone 使用 pb-28，embedded 使用 pb-6 md:pb-8。

```tsx
const bottomPadding = isStandalonePage ? "pb-28" : "pb-6 md:pb-8";

<main
  data-testid="hub-content"
  className={bottomPadding}
>
```

- [ ] **Step 5：运行播放栏、hub 和相关单测**

运行：npx vitest run src/components/player/DataManagerPlayerDock.test.tsx src/components/library/UnifiedDataManagerHub.test.tsx
预期：播放栏 store 联动测试、无歌曲隐藏测试、hub 最大宽度与底部预留测试全部通过。另检查 GlobalClientComponents 的 hooks 仍处于组件顶层，并且 Audio singleton 初始化只存在于 useAudioPlayer 模块。

- [ ] **Step 6：提交播放连续性改动**

提交：fix(player): keep playback state in the library hub。

### Task 3：统一七个分区的页面壳与内容宽度

**状态**

- [ ] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1：扩展 hub 布局测试**

在 UnifiedDataManagerHub.test.tsx 验证唯一主滚动区具有 max-width 1720px、min-width 0，standalone 下为播放栏保留底部空间；嵌入模式不得额外切换全屏播放器或导航行为。保留七个分区入口断言。

```tsx
const content = container.querySelector('[data-testid="hub-content"]');
expect(content?.className).toContain("max-w-[1720px]");
expect(content?.className).toContain("min-w-0");
```

运行：npx vitest run src/components/library/UnifiedDataManagerHub.test.tsx
预期：新断言先失败，因为总览/歌单/本地/体检目前仍使用 max-w-7xl。

- [ ] **Step 2：统一内容区样式**

让七个分区共用单一主滚动容器：宽度 100%、max-width 1720px、水平 padding 随视口缩小、min-width 0、overflow-y-auto；standalone 与 embedded 的底部 padding 分开定义。不要给每个 Tab 再加相互冲突的 max-width。保留现有 keep-alive Tab 切换及 activeHubTab 状态。

- [ ] **Step 3：修正标题、导航和窄屏收缩**

保持 1400px 顶部导航与次级横向导航的既有切换规则；每个可收缩 flex/grid 子项补 min-w-0，避免中文标题逐字竖排；主按钮保留清楚焦点态和足够点击区。总内容不产生横向滚动。

- [ ] **Step 4：验证和提交**

运行：npx vitest run src/components/library/UnifiedDataManagerHub.test.tsx
预期：页面结构、七个 Tab 和宽度测试通过。提交：style(library): unify management hub layout。

### Task 4：优化全景看板视觉层级

**状态**

- [ ] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1：保留并锁定四组指标结构**

在 DataDashboardTab.test.tsx 保留当前四组标题测试，并新增 section landmark、存储主指标、百分比和使用量/配额仍来自原 analytics store 的断言。不得改变统计计算。

运行：npx vitest run src/components/library/hub/DataDashboardTab.test.tsx
预期：当前结构测试通过；新增语义断言针对实现中的真实文本与区域标记。

- [ ] **Step 2：统一主次卡片层级**

DataDashboardTab.tsx 用主玻璃卡突出存储空间和配额；在同一信息组内排列使用率、已用/总配额；将音质分布、云端账号、曲库健康放在次级卡片组。复用现有 SettingSection、SettingRow、StatusDot 和 chart；以 cyan/blue 表达可操作状态，紫色只作辅助。图表值、账号状态和健康结果仍读取原 store。

- [ ] **Step 3：检查窄屏结构和提交**

在 1024px 页面宽度下让两列指标折为单列，操作按钮可见，数值不与标签重叠。运行 DataDashboardTab 定向测试，提交：style(library): refine storage dashboard hierarchy。

### Task 5：优化聚搜布局并补齐失败状态

**状态**

- [ ] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1：增加空结果与请求失败的区分测试**

在 LxMusicSearchTab.test.tsx 增加两组测试：已登录且搜索成功但无匹配结果时显示“未检索到”；resolver/fetch reject 或非成功响应时显示可见错误和“重试搜索”操作；未登录仍显示锁定原因和账号入口。重试操作复用当前关键词、平台和歌曲/歌单模式。

运行：npx vitest run src/components/library/hub/LxMusicSearchTab.test.tsx
预期：空数据测试通过；失败状态测试在当前 catch 将失败吞成空结果的实现中失败。

- [ ] **Step 2：实现独立请求错误状态**

LxMusicSearchTab.tsx 增加 searchError: string | null；每次发起请求前清除旧错误，在 catch 中写入错误并清空对应结果，finally 结束 loading。非 ok HTTP 响应也进入错误状态。渲染优先级固定为 loading → 登录锁定 → request error → no results → results；request error 的按钮再次调用当前搜索参数，不改认证逻辑。不同搜索模式清空各自结果，避免上一模式结果泄漏。

错误状态最小实现模式如下：

```tsx
setSearchError(error instanceof Error ? error.message : "搜索失败，请重试");
setSongResults([]);
setPlaylistResults([]);
```

落地时将 catch/finally 放进当前 handleSearch，不替换其现有搜索分支。

- [ ] **Step 3：整理聚搜工具条和结果容器**

将关键词输入、搜索模式、平台来源、音质过滤、热门词和批量操作按可扫读的分组排列；保留所有现有按钮和搜索语义。容器随主内容收缩，主搜索区在笔记本宽度下换行而非溢出；主要结果卡统一深色玻璃表面和青蓝焦点强调。

- [ ] **Step 4：运行测试和提交**

运行：npx vitest run src/components/library/hub/LxMusicSearchTab.test.tsx
预期：锁定、加载、失败、重试、空结果与成功结果均可区分。提交：fix(search): surface library search request failures。

### Task 6：统一音源管理弹窗的玻璃语言与窄屏操作

**状态**

- [ ] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1：扩展弹窗视觉语义测试**

在 SourceManagementModal.states.test.tsx 固定弹窗标题、五个 Tab、选中态/aria-selected 或等价状态、关闭按钮可访问名称以及同步失败重试功能。已有 loading/error behavior 必须继续通过。

运行：npx vitest run src/components/sources/SourceManagementModal.states.test.tsx
预期：当前同步状态测试通过；新增的关闭按钮名称测试在改动前提示缺少 aria-label。

- [ ] **Step 2：统一弹窗结构表面**

SourceManagementModal.tsx 调整为响应式宽度 w-full max-w-5xl、max-h-[90dvh]、标题区与 Tab 区边界统一、主体 min-h-0 overflow-y-auto；窄屏减少左右 padding。选中 Tab 使用青蓝渐变/轻内阴影，未选项保持透明玻璃底；保留原有五个 Tab、源同步、诊断、关闭和键盘行为。

- [ ] **Step 3：检查五个 Tab 的表单收缩**

只对 SourceMatrixTab 与 LxScriptsTab 中造成窄屏溢出的固定两列表单做 grid-cols-1 sm:grid-cols-2；输入、登录按钮和错误重试宽度适配容器。其余 Tab 复用现有 SettingSection/SettingRow，不改数据字段与音源行为。

- [ ] **Step 4：运行测试和提交**

运行：npx vitest run src/components/sources/SourceManagementModal.states.test.tsx src/components/sources/tabs/SourceMatrixTab.test.tsx src/components/sources/tabs/LxScriptsTab.states.test.tsx
预期：Tab 导航、同步错误、配置字段与原操作都通过。提交：style(sources): align source manager with glass design。

### Task 7：整体验收、文档与分支交付

**状态**

- [ ] 完成

**Dependencies:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6
**Parallelizable:** No（需合并全部改动后做全量回归）

- [ ] **Step 1：运行本计划列出的定向测试**

运行：

```powershell
npx vitest run src/components/layout/HeaderToolbar.test.tsx src/components/layout/AppleUnifiedNavIsland.test.tsx src/components/player/DataManagerPlayerDock.test.tsx src/components/library/UnifiedDataManagerHub.test.tsx src/components/library/hub/DataDashboardTab.test.tsx src/components/library/hub/LxMusicSearchTab.test.tsx src/components/sources/SourceManagementModal.states.test.tsx src/components/sources/tabs/SourceMatrixTab.test.tsx src/components/sources/tabs/LxScriptsTab.states.test.tsx
```

预期：所有列出的 Vitest 用例通过；失败项逐一确认是本分支引入还是基线已有。

- [ ] **Step 2：运行类型、Lint 和生产构建**

运行：

```powershell
npx tsc --noEmit --incremental false --pretty false
npx eslint src/components/layout/HeaderToolbar.tsx src/components/layout/AppleUnifiedNavIsland.tsx src/components/layout/GlobalClientComponents.tsx src/components/player/DataManagerPlayerDock.tsx src/components/library/UnifiedDataManagerHub.tsx src/components/library/hub/DataDashboardTab.tsx src/components/library/hub/LxMusicSearchTab.tsx src/components/sources/SourceManagementModal.tsx src/components/sources/tabs/SourceMatrixTab.tsx src/components/sources/tabs/LxScriptsTab.tsx --max-warnings 100
npm run build
```

预期：命令均退出码 0；记录任何构建基线问题和涉及文件，不把既存失败写成通过。

- [ ] **Step 3：浏览器手动验证**

在 1024、1280、1440、1780 CSS 像素宽度下检查七个分区；搜索区不被播放器遮挡；播放栏固定在资料库底部且内容可滚到底。使用同一首可播放曲目：

1. 播放中分别从 HeaderToolbar、导航岛进入资料库，确认音频不断、曲目一致、currentTime 连续增长、队列条目一致。
2. 暂停后进入，确认仍暂停且进度不变。
3. 处于加载或失败状态时进入，确认没有额外 play/load/seek/next；错误状态仍可见。
4. 在管理页用播放栏明确操作暂停/播放、进度和队列；返回首页确认浮窗播放器恢复原有位置与样式。
5. 窄屏滚动至聚搜结果末尾和离线列表末尾，确认底部播放栏不遮住最后一项。
6. 音源弹窗切换五个 Tab 并操作登录、脚本配置、诊断和重试。

如本机没有可用账号或可播放来源，准确记录未执行的播放手动检查及原因，不以 DOM 测试代替连续播放证据。

- [ ] **Step 4：完成项目交付文档**

更新 docs/nbl/CHANGELOG.md，记录已验证的导航、底部播放栏、七区统一、搜索失败态和音源弹窗改动。运行 docs/nbl/checklists/existing-feature-release-checklist.md 中适用于本轮的队列、播放同步、搜索与交付条目；无关的歌词、可视化与备份项标为不适用，不虚报通过。

- [ ] **Step 5：提交、合并和回归**

检查 git status --short，只暂存本计划变更文件，不包含密钥、本地配置、IDE 缓存或构建产物。确认所有分支改动已提交后，切回创建本分支时的稳定分支 master，执行 git merge --no-ff fix/library-hub-playback-ui。合并后重跑 Task 7 Step 1 与 npm run build，确认 master 无本轮未提交改动。若有冲突，在功能分支解决并重新验证后再合并；不改写共享历史。

## 3. 依赖关系与执行分组

- 并行组 A：Task 1（两个导航入口）与 Task 6（音源弹窗样式）。
- 并行组 B：Task 2（根播放器展示切换与新播放栏）、Task 3（资料库页面壳）、Task 4（总览）、Task 5（聚搜）。各任务只修改职责表中各自文件；Task 7 在所有分支改动整合后执行。
- Task 7 串行收尾，负责整体验证、浏览器验收、变更记录和合并回归。

## 4. 规格覆盖与自审

- 客户端导航和共享音频生命周期：Task 1、Task 2。
- 播放中/暂停/加载/失败/无曲目边界：Task 2、Task 7。
- 队列、歌曲与进度同步：Task 2、Task 7。
- 管理页底部播放栏、内容留白和主页浮窗保持原样：Task 2、Task 3、Task 7。
- 七个分区 1720px 内容壳和 1024px 窄屏可操作性：Task 3、Task 7。
- 总览和聚搜重点优化：Task 4、Task 5。
- 聚搜锁定、空、加载、请求错误与重试：Task 5。
- 音源弹窗五个 Tab 的视觉统一与配置行为保护：Task 6。
- 格式、边界和数据持久化不变：各任务及 Task 7 检查。
- 不修改 Home View、Player View 与全屏歌词核心：文件范围未包含这些视图。
- 文档与交付回归：Task 7。

自审结果：无未定义的 store action；播放栏使用 audioStore、queueStore 和现有 queue panel API；路由检测位于根布局全局组件且 hooks 无条件挂载；规格中每类状态都有实现任务和验收项；计划未引入新依赖或持久化字段。

---

**Execution Mode:** parallel
