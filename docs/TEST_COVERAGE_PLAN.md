# 测试覆盖率提升计划

> **版本**: v1.0
> **创建日期**: 2026-05-10
> **关联**: `docs/CI_CD_ACTIVATION_PLAN.md`（CI 门禁）
> **当前覆盖率**: 仅 3 个测试文件，无覆盖率门禁

---

## 1. 现状分析

### 1.1 当前测试资产

```text
✅ src/utils/formatTime.test.ts          # 3 个测试，纯函数
✅ src/utils/songValidation.test.ts      # 7 个 describe 块
✅ src/lib/audio/DSPProcessor.test.ts    # 8 个测试（DSP 处理链）
```

### 1.2 测试覆盖缺口（按优先级排序）

| 模块                     | 文件数 | 测试文件数 | 覆盖率估算 | 优先级 |
| ------------------------ | ------ | ---------- | ---------- | ------ |
| `src/utils/`             | 4      | 2          | ~50%       | 🔴 高  |
| `src/lib/audio/`         | 5+     | 1          | ~20%       | 🔴 高  |
| `src/store/`             | 44     | 0          | 0%         | 🟡 中  |
| `src/hooks/`             | 16     | 0          | 0%         | 🟡 中  |
| `src/services/`          | 3      | 0          | 0%         | 🟡 中  |
| `src/components/shared/` | 9      | 0          | 0%         | 🟢 低  |
| `src/types/`             | 2      | 0          | 0%         | 🟢 低  |
| `src/workers/`           | 4      | 0          | 0%         | 🟢 低  |

### 1.3 关键结论

1. **核心逻辑层缺测试** — `src/lib/audio/`（AudioEngine、DSP）是播放器心脏，覆盖率严重不足
2. **Store 层完全无测试** — 44 个 Zustand store 零测试，状态变更无保障
3. **Utils 覆盖一半** — 还有 `colorExtractor.ts`、`recommendationLogic.ts` 未覆盖
4. **CI 测试被禁用** — 即使有测试，CI 也不会阻止不通过代码合并

---

## 2. 测试策略

### 2.1 测试金字塔

```
        ╱╲
       ╱ E2E ╲          ← Playwright（未来）
      ╱────────╲
     ╱Integration╲       ← Store + Component 联动
    ╱──────────────╲
   ╱  Component     ╲     ← 组件渲染 + 交互
  ╱────────────────────╲
 ╱      Unit Tests       ╲    ← 纯函数、工具、Store
╱──────────────────────────╲
```

**本阶段聚焦**: Unit tests（80%）+ 少量 Component tests（20%）

### 2.2 优先覆盖原则

1. **纯函数优先** — 输入输出明确，测试成本最低，收益最高
2. **核心逻辑优先** — AudioEngine、DSP 直接影响播放体验
3. **Store action 优先** — 状态变更逻辑复杂，易出 bug
4. **工具函数兜底** — 格式化、验证、推荐算法

---

## 3. 分阶段实施

### 阶段一: Utils 全覆盖（P0，预计 1 天）

**目标**: `src/utils/` 下所有工具函数 100% 覆盖

| 文件                     | 测试目标              | 示例测试用例               | 预计测试数 |
| ------------------------ | --------------------- | -------------------------- | ---------- |
| `formatTime.ts`          | ✅ 已有，补充边界     | NaN, Infinity, 超大数字    | 3 → 8      |
| `songValidation.ts`      | ✅ 已有，补充边缘情况 | 空文件、特殊字符文件名     | 7 → 12     |
| `colorExtractor.ts`      | 🆕 新增               | 空输入、无效颜色、边界色值 | 6          |
| `recommendationLogic.ts` | 🆕 新增               | 空列表、单曲推荐、去重逻辑 | 8          |

**示例: colorExtractor.test.ts**

```typescript
import { extractDominantColor } from "./colorExtractor";

describe("extractDominantColor", () => {
  it("从有效图像数据中提取主色", () => {
    const result = extractDominantColor(mockImageData);
    expect(result).toMatch(/^oklch\(/);
  });

  it("空数据返回默认色", () => {
    expect(extractDominantColor(null)).toBe("oklch(60% 0.25 300)");
  });
});
```

### 阶段二: 音频核心层（P0，预计 1.5 天）

**目标**: `src/lib/audio/` 核心逻辑 60%+ 覆盖

| 文件               | 测试目标                                      | 预计测试数                                       |
| ------------------ | --------------------------------------------- | ------------------------------------------------ | --- |
| `AudioEngine.ts`   | 单例模式、play/pause/stop、状态变更、事件派发 | 15                                               |
| `DSPProcessor.ts`  | ✅ 已有，补充边界                             | 8 → 15                                           |
| `AudioAnalyzer.ts` | 🆕 新增                                       | getByteFrequencyData、getByteTimeDomainData 包装 | 8   |

**示例: AudioEngine.test.ts**

```typescript
import { AudioEngine } from "./AudioEngine";

describe("AudioEngine", () => {
  it("是单例模式", () => {
    const engine1 = AudioEngine.getInstance();
    const engine2 = AudioEngine.getInstance();
    expect(engine1).toBe(engine2);
  });

  it("play 后状态变为 playing", () => {
    const engine = AudioEngine.getInstance();
    engine.play(mockTrack);
    expect(engine.getState().isPlaying).toBe(true);
  });

  it("stop 后清理音频上下文", () => {
    const engine = AudioEngine.getInstance();
    engine.play(mockTrack);
    engine.stop();
    expect(engine.getState().isPlaying).toBe(false);
    expect(engine.getState().currentTrack).toBeNull();
  });
});
```

### 阶段三: 核心 Store 测试（P1，预计 1.5 天）

**目标**: Top 10 关键 Store 覆盖

| Store                | 重要性  | 测试重点                                 | 预计测试数 |
| -------------------- | ------- | ---------------------------------------- | ---------- |
| `audioStore`         | 🔴 核心 | play/pause/next/prev、音量控制、播放模式 | 12         |
| `uiStore`            | 🔴 核心 | view 切换、面板开关、主题切换            | 8          |
| `playlistStore`      | 🟡 高   | 增删改查、排序、拖拽重排                 | 10         |
| `visualizationStore` | 🟡 高   | 效果切换、参数变更                       | 8          |
| `emotionStore`       | 🟡 高   | 情感坐标计算、筛选                       | 8          |
| `spectrumStore`      | 🟡 中   | 频谱数据更新、降采样                     | 6          |
| `lyricSettingsStore` | 🟢 中   | 歌词显示配置持久化                       | 4          |
| `favoritesStore`     | 🟢 中   | 收藏/取消收藏、批量操作                  | 6          |
| `searchStore`        | 🟢 中   | 搜索逻辑、历史记录                       | 6          |
| `sleepTimerStore`    | 🟢 低   | 定时器逻辑                               | 4          |

**示例: audioStore.test.ts**

```typescript
import { useAudioStore } from "./audioStore";

describe("audioStore", () => {
  beforeEach(() => {
    useAudioStore.setState({ currentTrack: null, isPlaying: false, volume: 0.8 });
  });

  it("play 设置当前曲目并切换状态", () => {
    const track = { id: "1", title: "Test Song" };
    useAudioStore.getState().play(track);
    const state = useAudioStore.getState();
    expect(state.currentTrack?.id).toBe("1");
    expect(state.isPlaying).toBe(true);
  });

  it("音量限制在 0-1 范围", () => {
    useAudioStore.getState().setVolume(1.5);
    expect(useAudioStore.getState().volume).toBe(1);
    useAudioStore.getState().setVolume(-0.5);
    expect(useAudioStore.getState().volume).toBe(0);
  });
});
```

### 阶段四: Hooks + Services 测试（P2，预计 1 天）

| 文件                     | 测试重点               | 预计测试数 |
| ------------------------ | ---------------------- | ---------- |
| `useAudioPlayer`         | 播放控制包装、状态同步 | 8          |
| `useDynamicTheme`        | 主题提取、切换逻辑     | 6          |
| `useKeyboardShortcuts`   | 快捷键绑定与触发       | 6          |
| `audioMetadata.ts`       | 元数据解析             | 8          |
| `lyricsSearchService.ts` | 歌词搜索、解析         | 6          |

### 阶段五: 组件测试（P2，预计 1 天）

**目标**: 核心共享组件渲染测试

| 组件                 | 测试重点                         | 预计测试数 |
| -------------------- | -------------------------------- | ---------- |
| `GlassCard`          | 渲染子元素、应用样式类           | 3          |
| `GlassButton`        | 点击事件、禁用状态、loading 状态 | 5          |
| `GlassSlider`        | 拖拽事件、值变更回调             | 4          |
| `PanelErrorBoundary` | 错误捕获、fallback UI 渲染       | 3          |
| `LazyPanel`          | 懒加载渲染、loading 状态         | 3          |

---

## 4. 覆盖率目标路线图

| 阶段 | 时间点 | Utils | Audio | Store | Hooks | 组件 | 总体 |
| ---- | ------ | ----- | ----- | ----- | ----- | ---- | ---- |
| 当前 | Day 0  | 50%   | 20%   | 0%    | 0%    | 0%   | ~5%  |
| P0   | 2.5 天 | 100%  | 60%   | 0%    | 0%    | 0%   | ~25% |
| P1   | 4 天   | 100%  | 60%   | 50%   | 0%    | 0%   | ~40% |
| P2   | 6 天   | 100%  | 70%   | 60%   | 40%   | 30%  | ~55% |
| P3   | 8 天   | 100%  | 80%   | 70%   | 60%   | 50%  | ~70% |

---

## 5. CI 门禁配置

**配套文档**: `docs/CI_CD_ACTIVATION_PLAN.md`

```typescript
// vitest.config.ts — 建议覆盖率阈值
coverage: {
  thresholds: {
    statements: 60,   // P0 完成后激活
    branches: 50,
    functions: 60,
    lines: 60,
  },
  // 随阶段推进逐步提高：
  // P1 → 70, P2 → 80
}
```

## 6. 测试编写规范

### 6.1 Mock 策略

```typescript
// ✅ Mock AudioContext（浏览器 API）
vi.stubGlobal("AudioContext", MockAudioContext);

// ✅ Mock Zustand store
vi.mock("@/store/audioStore", () => ({
  useAudioStore: vi.fn(() => ({
    isPlaying: false,
    volume: 0.8,
  })),
}));

// ❌ 不要 Mock Three.js（集成测试再考虑）
// ❌ 不要 Mock 整个组件（测试真实渲染）
```

### 6.2 测试数据

在 `src/test/fixtures/` 中复用测试数据:

```typescript
// src/test/fixtures/tracks.ts
export const mockTrack = {
  id: "test-1",
  title: "Test Song",
  artist: "Test Artist",
  duration: 180,
  url: "/test.mp3",
};
```

### 6.3 运行命令

```bash
# 运行全部测试
npm run test

# 运行指定模块
npx vitest src/utils/formatTime.test.ts

# 带覆盖率报告
npm run test:coverage
```
