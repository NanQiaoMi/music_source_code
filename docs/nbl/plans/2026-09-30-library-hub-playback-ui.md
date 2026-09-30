# 资料库中枢视觉统一与连续播放实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 nbl.subagent-driven-development（推荐）或 nbl.parallel-subagent-driven-development 按任务执行。每项任务使用复选框追踪。

**Goal:** 统一音源管理弹窗与资料库资产管理中枢的玻璃拟态设计，并确保应用内进入资料库时播放会话、进度和队列保持连续同步。

**Architecture:** 两个主页面入口改用 Next.js 客户端导航；根布局继续唯一挂载音频 hook，只切换播放器的 UI 呈现。资料库路由使用新的紧凑底部播放栏并预留滚动空间，同时在管理页挂载现有播放队列面板；七个分区统一内容壳，总览和聚搜做重点信息层级与状态优化；音源管理弹窗沿用现有五个 Tab 和设置组件，统一视觉、窄屏布局与系统减少动态效果偏好。搜索结果只允许最新请求更新结果、错误和 loading 状态。

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
| src/app/data-manager/page.tsx                                | 管理页路由托管现有 QueuePanel；队列可见性由共享 uiStore 控制。                                                           |
| src/app/data-manager/page.test.tsx                           | 验证管理页能打开队列面板，并在关闭后复位共享面板状态。                                                                   |
| src/components/player/DataManagerPlayerDock.tsx              | 新建资料库专用底部播放栏，从现有 audio/player/queue store 读取和修改状态，不创建音频元素。                               |
| src/components/player/DataManagerPlayerDock.test.tsx         | 验证当前曲目、进度、播放状态、队列计数、无曲目状态、队列索引边界和明确的用户控制操作。                                   |
| src/app/api/playlist/search/route.ts                         | provider 已实际尝试且全部失败时返回 503；成功空结果及部分成功行为保持不变。                                              |
| src/app/api/playlist/search/route.test.ts                    | 固定全失败、部分成功空结果、无来源可尝试时的 HTTP 状态与成功响应行为。                                                   |
| src/components/library/UnifiedDataManagerHub.tsx             | 七个分区使用一致的内容宽度、窄屏导航和底部安全空间。                                                                     |
| src/components/library/UnifiedDataManagerHub.test.tsx        | 验证统一的最大宽度、standalone 安全空间、七个分区入口和持久化分区恢复后的首屏挂载。                                      |
| src/components/library/hub/DataDashboardTab.tsx              | 统一存储、音质、账号、健康指标的卡片层级与青蓝玻璃强调。                                                                 |
| src/components/library/hub/DataDashboardTab.test.tsx         | 固定四类指标结构和窄屏适配标记，保留既有数据口径。                                                                       |
| src/components/library/hub/LxMusicSearchTab.tsx              | 优化搜索控件分组与间距；分别呈现锁定、空结果、加载和请求失败状态，并丢弃过期请求结果。                                   |
| src/components/library/hub/LxMusicSearchTab.test.tsx         | 覆盖搜索成功、空结果、未登录、请求失败重试及旧请求 resolve/reject/finally 竞态。                                         |
| src/services/MultiSourceResolver.ts                          | 仅当至少一个来源被实际尝试且全部失败时报告聚合搜索错误，保留部分成功和无可用来源的空结果。                               |
| src/services/MultiSourceResolver.test.ts                     | 验证全部失败、部分成功空结果、无可尝试来源和空结果 LX 脚本边界。                                                         |
| src/lib/sources/lxRunner.ts                                  | 内置搜索 fallback 的所有 API 均失败时抛错；脚本成功返回空数组仍视为正常结果。                                            |
| src/lib/sources/lxRunner.test.ts                             | 验证 fallback 全失败、部分成功以及脚本成功空结果。                                                                       |
| src/components/sources/SourceManagementModal.tsx             | 保留五个 Tab 和所有业务动作，统一标题、选中态、卡片表面、焦点与窄屏边距。                                                |
| src/components/sources/SourceManagementModal.states.test.tsx | 保留同步错误测试，并覆盖弹窗语义、Tab 可访问状态和 reduced-motion 动效边界。                                             |
| src/components/sources/tabs/LxScriptsTab.tsx                 | 窄屏下脚本卡片将说明与操作垂直堆叠，为名称和作者保留可读文本宽度。                                                       |
| src/components/sources/tabs/LxScriptsTab.states.test.tsx     | 验证窄屏文本列可收缩，脚本名称与元信息可换行。                                                                           |
| src/components/player/QueuePanel.tsx 与 QueuePanel.test.tsx  | 播放队列按当前索引标记重复歌曲，并让单行移除只删除该队列项。                                                             |
| src/store/queueStore.ts 与 queueStore.test.ts                | 单项移除按索引删除，并保持剩余队列的 currentIndex 合法。                                                                 |
| docs/nbl/CHANGELOG.md                                        | 记录本轮已实现并验证的 UI 与播放导航改动。                                                                               |

不修改 Home View、Player View、全屏歌词核心视图；不改变音频解析、认证、搜索 API 路由/请求参数/成功响应 schema、队列持久化或 localStorage/IndexedDB 数据格式。内部聚合搜索仅将“有尝试且全部来源失败”改为可捕获 rejection；歌单路由此时返回 503，而成功空结果、部分成功和没有可尝试来源仍保持空结果语义。不得把第二个 HTMLAudioElement 引入资料库页。

## 2. 实施任务

### Task 1：把两个资料库入口改成应用内导航

**状态**

- [x] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [x] **Step 1：固定工具栏入口的导航契约**

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

- [x] **Step 2：固定导航岛点击使用 router.push**

在 src/components/layout/AppleUnifiedNavIsland.test.tsx 中 mock next/navigation 的 useRouter，挂载导航岛，打开“曲库与发现”菜单并点击“音乐库管理器”，断言 push 只以 /data-manager 调用一次。测试不得 stub 或断言 window.location.href。

```tsx
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
```

运行：npx vitest run src/components/layout/AppleUnifiedNavIsland.test.tsx
预期：现有静态渲染用例继续通过；新交互用例在旧实现中失败，因为旧实现直接写 window.location.href。

- [x] **Step 3：实现客户端导航**

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

- [x] **Step 4：重跑入口测试并提交**

运行：npx vitest run src/components/layout/HeaderToolbar.test.tsx src/components/layout/AppleUnifiedNavIsland.test.tsx
预期：两个文件全部通过。提交：fix(navigation): preserve player session when opening library。

### Task 2：为资料库路由加入紧凑播放栏并保持音频所有者不变

**状态**

- [x] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [x] **Step 1：先写播放栏状态测试**

新增 src/components/player/DataManagerPlayerDock.test.tsx，使用现有 Zustand stores 设置一首歌曲、currentTime=42、duration=180、isPlaying=true 和队列；验证标题、时间、队列入口和播放按钮状态来自 stores。再分别验证没有 currentSong 时返回 null，点击播放/暂停与进度只调用现有 store action；加入 PlayerStore-only 曲目回退、当前歌曲 ID 与 QueueStore currentIndex 分叉、当前歌曲已从队列移除后的上一首/下一首、单候选队列和随机模式用例。在 src/app/data-manager/page.test.tsx 验证管理页挂载的 QueuePanel 能按共享 panels.queue 状态打开，并可通过关闭按钮复位该状态。

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

- [x] **Step 2：实现新的管理页播放栏**

新增 DataManagerPlayerDock.tsx。组件订阅 audioStore 的 currentSong、isPlaying、isLoading、currentTime、duration、error；订阅 queueStore 的 queue/currentIndex；显示曲目遵循主页 FloatingPlayer 的 AudioStore → PlayerStore 回退语义。用户明确点击上一首/下一首时按当前歌曲 ID 校准队列索引；若当前播放歌曲已从 QueueStore 移除，下一首选择 currentIndex 指向的候选，上一首选择其前一项；重复歌曲使用匹配的 currentIndex 保留实际播放项；仍调用既有 AudioStore 切歌动作以保留循环/随机模式。空队列不触发切歌；当前歌曲不在队列但仍有候选时，控制保持可用。播放栏的队列按钮通过 useUIStore.openPanel("queue") 打开面板，src/app/data-manager/page.tsx 为管理页托管现有 QueuePanel；面板重复项按索引高亮，单行移除只删除该项并同步索引。没有曲目时不渲染。失败时显示 error.message；路由进入本身不得调用播放、暂停、load、seek、切歌或自动重试动作。播放栏需有曲名、歌手、播放状态、上一首/播放暂停/下一首、进度 input、队列按钮与清楚的 aria-label。

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

- [x] **Step 3：按 pathname 切换 UI，不卸载播放 hook**

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

- [x] **Step 4：给 standalone 管理页预留底部空间**

UnifiedDataManagerHub.tsx 的主滚动区在 isStandalonePage 时增加至少 6rem 底部 padding；嵌入式面板保持原高度规则，避免主页浮窗外观或 Home View 布局变化。保留 overflow-y-auto，并让主区及卡片具备 min-w-0。用固定 Tailwind 类名分支：standalone 使用 pb-28，embedded 使用 pb-6 md:pb-8。

```tsx
const bottomPadding = isStandalonePage ? "pb-28" : "pb-6 md:pb-8";

<main
  data-testid="hub-content"
  className={bottomPadding}
>
```

- [x] **Step 5：运行播放栏、hub 和相关单测**

运行：npx vitest run src/components/player/DataManagerPlayerDock.test.tsx src/app/data-manager/page.test.tsx src/components/library/UnifiedDataManagerHub.test.tsx
预期：播放栏 store 联动与队列索引边界测试、无歌曲隐藏、管理页 QueuePanel 打开/关闭、hub 最大宽度与底部预留测试全部通过。另检查 GlobalClientComponents 的 hooks 仍处于组件顶层，并且 Audio singleton 初始化只存在于 useAudioPlayer 模块。

- [x] **Step 6：提交播放连续性改动**

提交：fix(player): keep playback state in the library hub。

### Task 3：统一七个分区的页面壳与内容宽度

**状态**

- [x] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [x] **Step 1：扩展 hub 布局测试**

在 UnifiedDataManagerHub.test.tsx 验证唯一主滚动区具有 max-width 1720px、min-width 0，standalone 下为播放栏保留底部空间；嵌入模式不得额外切换全屏播放器或导航行为。保留七个分区入口断言，并模拟 Zustand 持久化水合在首次 render 后恢复非默认分区，确认对应分区立即挂载。

```tsx
const content = container.querySelector('[data-testid="hub-content"]');
expect(content?.className).toContain("max-w-[1720px]");
expect(content?.className).toContain("min-w-0");
```

运行：npx vitest run src/components/library/UnifiedDataManagerHub.test.tsx
预期：新断言先失败，因为总览/歌单/本地/体检目前仍使用 max-w-7xl。

- [x] **Step 2：统一内容区样式**

让七个分区共用单一主滚动容器：宽度 100%、max-width 1720px、水平 padding 随视口缩小、min-width 0、overflow-y-auto；standalone 与 embedded 的底部 padding 分开定义。不要给每个 Tab 再加相互冲突的 max-width。保留现有 keep-alive Tab 切换及 activeHubTab 状态。

- [x] **Step 3：修正标题、导航和窄屏收缩**

保持 1400px 顶部导航与次级横向导航的既有切换规则；每个可收缩 flex/grid 子项补 min-w-0，避免中文标题逐字竖排；主按钮保留清楚焦点态和足够点击区。总内容不产生横向滚动。

- [x] **Step 4：验证和提交**

运行：npx vitest run src/components/library/UnifiedDataManagerHub.test.tsx
预期：页面结构、七个 Tab 和宽度测试通过。提交：style(library): unify management hub layout。

### Task 4：优化全景看板视觉层级

**状态**

- [x] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [x] **Step 1：保留并锁定四组指标结构**

在 DataDashboardTab.test.tsx 保留当前四组标题测试，并新增 section landmark、存储主指标、百分比和使用量/配额仍来自原 analytics store 的断言。不得改变统计计算。

运行：npx vitest run src/components/library/hub/DataDashboardTab.test.tsx
预期：当前结构测试通过；新增语义断言针对实现中的真实文本与区域标记。

- [x] **Step 2：统一主次卡片层级**

DataDashboardTab.tsx 用主玻璃卡突出存储空间和配额；在同一信息组内排列使用率、已用/总配额；将音质分布、云端账号、曲库健康放在次级卡片组。复用现有 SettingSection、SettingRow、StatusDot 和 chart；以 cyan/blue 表达可操作状态，紫色只作辅助。图表值、账号状态和健康结果仍读取原 store。

- [x] **Step 3：检查窄屏结构和提交**

在 1024px 页面宽度下让两列指标折为单列，操作按钮可见，数值不与标签重叠。运行 DataDashboardTab 定向测试，提交：style(library): refine storage dashboard hierarchy。

### Task 5：优化聚搜布局并补齐失败状态

**状态**

- [x] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [x] **Step 1：增加空结果与请求失败的区分测试**

在 LxMusicSearchTab.test.tsx 增加测试：已登录且搜索成功但无匹配结果时显示“未检索到”；resolver/fetch reject 或非成功响应时显示可见错误和“重试搜索”操作；未登录仍显示锁定原因和账号入口。增加 deferred promise 用例，证明旧请求迟到的成功、失败和 finally、输入/清空关键词及组件卸载都不能覆盖新搜索状态。

运行：npx vitest run src/components/library/hub/LxMusicSearchTab.test.tsx

预期：空数据测试通过；失败状态测试在当前 catch 将失败吞成空结果的实现中失败。

- [x] **Step 2：实现独立请求错误状态**

LxMusicSearchTab.tsx 增加 searchError: string | null 和单调递增的请求序号；只有当前序号可写歌曲/歌单结果、错误及 loading。关键词编辑/清空、切换来源/模式、来源锁定、命中缓存或组件卸载时终结旧请求，避免迟到响应覆盖当前视图或卸载后写共享 store。非 ok HTTP 响应也进入错误状态。渲染优先级固定为 loading → 登录锁定 → request error → no results → results；request error 的按钮再次调用当前搜索参数，不改认证逻辑。不同搜索模式清空各自结果，避免上一模式结果泄漏。

实现检查发现聚合服务原本会将每个来源的网络异常吞成空数组，导致“全部来源都失败”误显示为空结果。为满足上述状态区分，MultiSourceResolver 仅在至少有一个来源被尝试且成功来源数为零时 reject；来源部分成功（即使成功响应为空）、没有可尝试来源、或 LX 脚本成功返回空数组时仍返回正常空结果。LXRunner 的内置 fallback 在所有 fallback API 均失败时 reject；搜索 store 和 AI 工具已有失败捕获路径，资料库页面显示该错误并提供重试。

歌单搜索路由也需保留 provider 失败信号：已尝试来源且全部失败时返回 503，触发现有页面错误/重试状态；至少一个 provider 成功（包括成功空结果）或没有可尝试 provider 时继续返回成功响应。请求参数与成功 JSON schema 不变。

错误状态最小实现模式如下：

```tsx
setSearchError(error instanceof Error ? error.message : "搜索失败，请重试");
setSongResults([]);
setPlaylistResults([]);
```

落地时将 catch/finally 放进当前 handleSearch，不替换其现有搜索分支。

- [x] **Step 3：整理聚搜工具条和结果容器**

将关键词输入、搜索模式、平台来源、音质过滤、热门词和批量操作按可扫读的分组排列；保留所有现有按钮和搜索语义。容器随主内容收缩，主搜索区在笔记本宽度下换行而非溢出；主要结果卡统一深色玻璃表面和青蓝焦点强调。

- [x] **Step 4：运行测试和提交**

运行：npx vitest run src/components/library/hub/LxMusicSearchTab.test.tsx src/app/api/playlist/search/route.test.ts
预期：锁定、加载、失败、重试、空结果与成功结果均可区分；旧请求成功、失败、finally、输入/清空关键词及卸载不影响新请求；provider 已尝试且全失败回 503，部分成功空结果和无来源可尝试保持 200。提交：fix(search): surface library search request failures，并以单独提交修复过期请求竞态。

### Task 6：统一音源管理弹窗的玻璃语言与窄屏操作

**状态**

- [x] 完成

**Dependencies:** None
**Parallelizable:** Yes

- [x] **Step 1：扩展弹窗视觉语义测试**

在 SourceManagementModal.states.test.tsx 固定弹窗标题、五个 Tab、选中态/aria-selected 或等价状态、关闭按钮可访问名称以及同步失败重试功能。已有 loading/error behavior 必须继续通过。

运行：npx vitest run src/components/sources/SourceManagementModal.states.test.tsx
预期：当前同步状态测试通过；新增的关闭按钮名称测试在改动前提示缺少 aria-label。

- [x] **Step 2：统一弹窗结构表面**

SourceManagementModal.tsx 保持响应式宽度 w-full max-w-4xl、max-h-[90dvh]，统一标题区与 Tab 区边界，主体使用 min-h-0 overflow-y-auto；窄屏减少左右 padding。选中 Tab 使用青蓝渐变/轻内阴影，未选项保持透明玻璃底；保留原有五个 Tab、源同步、诊断、关闭和键盘行为。

- [x] **Step 3：检查五个 Tab 的表单收缩**

只对 SourceMatrixTab 与 LxScriptsTab 中造成窄屏溢出的固定两列表单做 grid-cols-1 sm:grid-cols-2；输入、登录按钮和错误重试宽度适配容器。脚本卡片窄屏改为上下布局，名称和作者元信息允许换行，右侧开关/删除控件保持独立可点击。其余 Tab 复用现有 SettingSection/SettingRow，不改数据字段与音源行为。

- [x] **Step 4：运行测试和提交**

运行：npx vitest run src/components/sources/SourceManagementModal.states.test.tsx src/components/sources/tabs/SourceMatrixTab.test.tsx src/components/sources/tabs/LxScriptsTab.states.test.tsx
预期：Tab 导航、同步错误、配置字段与原操作都通过；系统减少动态效果开启时弹窗不缩放/位移，内部开关、transition 和 spinner 动效在弹窗范围内被压低，不影响主页其他界面；320px 窄屏脚本标题与作者可读换行。提交：style(sources): align source manager with glass design，并单独提交 reduced-motion 修复。

### Task 7：整体验收、文档与分支交付

**状态**

- [x] 完成

**Dependencies:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6
**Parallelizable:** No（需合并全部改动后做全量回归）

- [x] **Step 1：运行本计划列出的定向测试**

运行：

```powershell
npx vitest run src/components/layout/HeaderToolbar.test.tsx src/components/layout/AppleUnifiedNavIsland.test.tsx src/components/layout/GlobalClientComponents.test.tsx src/components/player/DataManagerPlayerDock.test.tsx src/components/player/DataManagerPlayerDock.fallback.test.tsx src/components/player/QueuePanel.test.tsx src/app/data-manager/page.test.tsx src/components/library/UnifiedDataManagerHub.test.tsx src/components/library/hub/DataDashboardTab.test.tsx src/components/library/hub/LxMusicSearchTab.test.tsx src/services/MultiSourceResolver.test.ts src/lib/sources/lxRunner.test.ts src/app/api/playlist/search/route.test.ts src/components/sources/SourceManagementModal.states.test.tsx src/components/sources/tabs/SourceMatrixTab.test.tsx src/components/sources/tabs/SourceMatrixTab.states.test.tsx src/components/sources/tabs/LxScriptsTab.states.test.tsx src/store/queueStore.test.ts src/store/searchStore.test.ts src/utils/listeningInsights.test.ts
```

预期：所有列出的 Vitest 用例通过；搜索覆盖输入/清空和卸载后旧请求，队列覆盖重复曲目索引与单项移除，弹窗覆盖 reduced-motion，懒加载面板按条件完成等待，资料库中枢覆盖持久化选中分区水合后挂载；失败项逐一确认是本分支引入还是基线已有。

- [x] **Step 2：运行类型、Lint 和生产构建**

运行：

```powershell
npx tsc --noEmit --incremental false --pretty false
npx eslint src/app/api/playlist/search/route.ts src/components/layout/HeaderToolbar.tsx src/components/layout/AppleUnifiedNavIsland.tsx src/components/layout/GlobalClientComponents.tsx src/components/player/DataManagerPlayerDock.tsx src/components/library/UnifiedDataManagerHub.tsx src/components/library/hub/DataDashboardTab.tsx src/components/library/hub/LxMusicSearchTab.tsx src/services/MultiSourceResolver.ts src/lib/sources/lxRunner.ts src/components/sources/SourceManagementModal.tsx src/components/sources/tabs/SourceMatrixTab.tsx src/components/sources/tabs/LxScriptsTab.tsx --max-warnings 100
$changedTsFiles = git diff --name-only fix/library-hub-playback-ui..HEAD | Where-Object { $_ -match '\.(tsx?|jsx?)$' }
npx eslint @changedTsFiles --max-warnings 100
$changedFiles = git diff --name-only fix/library-hub-playback-ui..HEAD
npx prettier --check @changedFiles
git diff --check
npm run build
```

预期：命令均退出码 0；记录任何构建基线问题和涉及文件，不把既存失败写成通过。

- [x] **Step 3：浏览器手动验证**

在 320、1024、1280、1440、1780 CSS 像素宽度下检查分区导航、窄屏脚本卡片和主要内容；搜索区不被播放器遮挡；播放栏固定在资料库底部且内容可滚到底。另需在整页 reload 后等待 Zustand 水合，确认恢复的已选分区不会留下空工作区。使用同一首可播放曲目：

1. 播放中分别从 HeaderToolbar、导航岛进入资料库，确认音频不断、曲目一致、currentTime 连续增长、队列条目一致。
2. 暂停后进入，确认仍暂停且进度不变。
3. 处于加载或失败状态时进入，确认没有额外 play/load/seek/next；错误状态仍可见。
4. 在管理页用播放栏明确操作暂停/播放、进度和队列；返回首页确认浮窗播放器恢复原有位置与样式。
5. 窄屏滚动至聚搜结果末尾和离线列表末尾，确认底部播放栏不遮住最后一项。
6. 音源弹窗切换五个 Tab 并操作登录、脚本配置、诊断和重试。

如本机没有可用账号或可播放来源，准确记录未执行的播放手动检查及原因，不以 DOM 测试代替连续播放证据。

**本轮浏览器验收记录**

- 1024、1280、1440、1780 CSS 像素下切换七个分区；聚搜另在 375、768、1024、1280、1440、1780 像素检查。文档宽度未超出视口，1780 像素时主内容宽度为 1720 像素，1024–1780 像素时主内容底部留白为 128 像素。
- 聚搜请求失败态和重试按钮可见；两个入口都能应用内到达 `/data-manager`；音源弹窗五个 Tab 都可切换，375 像素视口下弹窗仍留在视口内并通过内部滚动查看内容。
- 初次浏览器复查发现 Zustand 水合恢复非默认分区后 Keep-Alive 集合仍只有默认分区，导致 reload 后工作区空白。渲染条件现将当前分区纳入挂载集合，并加入回归用例；修复后需在生产构建页面重新确认首次加载内容可见。
- 音源弹窗在 320 像素视口下标题、说明和脚本操作可读，开关/删除按钮未挤入说明列；管理页聚搜提供内部纵向滚动，窄导航可水平滚动访问。
- 未执行真实曲目播放中/暂停中/加载中连续播放验证：该隔离预览没有正在播放的曲目，云端音源均未登录。播放状态边界由 store/组件测试覆盖，但不将单测视作真实音频连续性证据。没有提交登录、测速、诊断、下载或清理操作。

- [x] **Step 4：完成项目交付文档**

已更新 docs/nbl/CHANGELOG.md，记录导航、底部播放栏、七区统一、搜索失败态、源弹窗及验证边界。已核对 docs/nbl/checklists/existing-feature-release-checklist.md：自动化队列 smoke 已通过；真实播放/暂停/切歌和登录源验证因隔离预览无当前曲目/登录凭证未执行；歌词、可视化、备份与设置编辑项不属于本轮范围。

- [x] **Step 5：提交、合并和回归**

已确认工作树未包含用户未提交改动。集成分支 `fix/library-hub-playback-ui-merge` 的代码与文档提交已用 `--no-ff` 合入功能分支 `fix/library-hub-playback-ui`，再以 `--no-ff` 合入稳定分支 `master`；代码合并提交为 `901c6a5`。合入 master 后重跑本计划 Step 1 定向测试（20 个文件、128 项通过）、TypeScript、改动文件 ESLint、Prettier、`git diff --check` 和 `npm run build`，均通过。生产构建生成 `/data-manager` 与 `/api/playlist/search`；Next.js 未报告额外 worktree lockfile 警告。未推送远程、未创建 PR。

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

自审结果：无未定义的 store action；播放栏使用 audioStore、queueStore 和现有 queue panel API，/data-manager 路由托管该队列面板；队列跳歌覆盖曲目仍在队列、已移出、单候选和随机模式；路由检测位于根布局全局组件且 hooks 无条件挂载；规格中每类状态都有实现任务和验收项；计划未引入新依赖或持久化字段。

---

**Execution Mode:** parallel
