# MIMI Music Player 编码与测试规范

> **版本**: v1.0 | **创建日期**: 2026-05-10

---

## 1. TypeScript 规范

```typescript
// 对象类型优先用 interface
interface UserPreferences {
  theme: "dark" | "light";
  volume: number;
}

// 联合/工具类型用 type
type ViewType = "home" | "player" | "lyrics" | "visualization" | "emotion";

// 显式声明函数返回值
function formatTime(seconds: number): string {
  // ...
}
```

### 禁止规则

- **禁止使用 `any`** — 使用 `unknown` + 类型守卫替代（当前 431 个，Phase 4 清除）
- **禁止未使用的变量/导入**（当前 325 个，Phase 4 清除）
- **禁止动态 `require()`** — 使用顶层 `import`（当前在 audioStore、smartPlaylistStore、emotionStore 中存在）

### 渐进式修复策略

| Phase | 目标 | 方法 |
|-------|------|------|
| Phase 0 | 修复 prettier 格式问题 | `npx prettier --write src/` |
| Phase 1-3 | 抑制新增的 lint 错误 | 新代码严格遵循规范 |
| Phase 4 | 清零所有存量错误 | 批量修复 no-explicit-any + no-unused-vars |

---

## 2. React 组件规范

```typescript
// 函数组件 + hooks
// 文件名 = 组件名 (PascalCase)
// 默认导出组件
const GlassCard: React.FC<GlassCardProps> = ({ children, className }) => {
  return <div className={`glass-card ${className}`}>{children}</div>;
};

export default GlassCard;
```

### 组件组织原则

- **全局面板容器**: 使用 `GlassPanel` / `GlassDrawer` / `GlassModal` / `GlassCard`
- **组件拆分**: 单个文件超过 300 行考虑拆分
- **Code-Splitting**: 重面板使用 `next/dynamic` + `ssr: false` 延迟加载
- **Props 接口**: 在组件文件顶部显式声明，后缀 `Props`

### "use client" 声明

项目为纯客户端 SPA（Next.js static export），所有组件**必须**以 `"use client"` 开头。

---

## 3. Zustand Store 规范

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AudioState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  play: (track: Track) => void;
  pause: () => void;
  setVolume: (volume: number) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      currentTrack: null,
      isPlaying: false,
      volume: 0.8,
      play: (track) => set({ currentTrack: track, isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: "mimi-audio",
      partialize: (state) => ({ volume: state.volume }),
    }
  )
);
```

### 规则

- **使用 `partialize` 选择性持久化** — 只持久化必要的字段（如 volume、播放模式），避免序列化整个 store
- **使用精细化 Selector** — 高频更新组件避免直接订阅整个 store

```typescript
// 好的写法
const volume = useAudioStore((s) => s.volume);

// 不好的写法（每次任何状态变更都重渲染）
const { volume, isPlaying, currentTrack } = useAudioStore();
```

- **Store 间通信** — 通过 Coordinator 层（Phase 1 引入），禁止直接 import 交叉引用

---

## 4. 样式规范

### 4.1 基本规则

- 优先 Tailwind CSS 类名
- 颜色从 `src/lib/tokens.ts` 导入，使用 OKLCH 色值
- 复杂样式封装为 Glass 组件

### 4.2 Glass 组件使用

```tsx
// 面板容器（侧边）
<GlassPanel side="right" title="播放队列" onClose={handleClose}>
  {children}
</GlassPanel>

// 底部抽屉
<GlassDrawer title="播放历史" onClose={handleClose}>
  {children}
</GlassDrawer>

// 居中弹窗
<GlassModal isOpen={showSearch} onClose={handleClose} size="lg">
  {children}
</GlassModal>
```

### 4.3 导入顺序

```typescript
// 1. 外部库
import { motion } from "framer-motion";

// 2. 内部模块（按层级）
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { useAudioStore } from "@/store/audioStore";

// 3. 组件
import { GlassPanel } from "@/components/shared/Glass";

// 4. 类型
import type { Track } from "@/types";
```

---

## 5. 测试规范

### 5.1 测试层级

| 层级 | 覆盖范围 | 工具 | 目标覆盖率 |
|------|----------|------|-----------|
| Unit | 工具函数、纯逻辑 | Vitest | ≥80% |
| Component | 组件渲染、交互 | Vitest + jsdom | ≥60% |
| Integration | Store + 组件联动 | Vitest | ≥40% |
| E2E | 核心用户流程 | Playwright（未来） | 关键路径 |

### 5.2 命名规范

```
src/
├── utils/
│   ├── formatTime.ts
│   └── formatTime.test.ts       # ✅ 测试文件与源文件同级
├── lib/
│   ├── audio/
│   │   ├── AudioEngine.ts
│   │   └── AudioEngine.test.ts  # ✅
└── store/
    ├── audioStore.ts
    └── audioStore.test.ts       # ✅
```

### 5.3 测试结构（AAA 模式）

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useAudioStore } from "./audioStore";

describe("audioStore", () => {
  beforeEach(() => {
    useAudioStore.setState({ currentTrack: null, isPlaying: false, volume: 0.8 });
  });

  describe("播放控制", () => {
    it("play 设置当前曲目并切换状态", () => {
      const track = { id: "test-1", title: "Test Song", artist: "Test", duration: 180 };
      useAudioStore.getState().play(track);
      const state = useAudioStore.getState();
      expect(state.currentTrack?.id).toBe("test-1");
      expect(state.isPlaying).toBe(true);
    });
  });

  describe("音量控制", () => {
    it("音量限制在 0-1 范围", () => {
      useAudioStore.getState().setVolume(1.5);
      expect(useAudioStore.getState().volume).toBe(1);
      useAudioStore.getState().setVolume(-0.5);
      expect(useAudioStore.getState().volume).toBe(0);
    });
  });
});
```

### 5.4 Mock 策略

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
```

---

## 6. 注释规范

```typescript
// ❌ 避免：废话注释
const age = 25; // 设置年龄为 25

// ✅ 好的：解释"为什么"
// 使用固定延迟避免快速切歌导致的 AudioContext 状态冲突
const SWITCH_DELAY_MS = 50;

// ✅ 好的：复杂逻辑需要注释
// 使用 FFT 算法将时域信号转换为频域，
// 结果数组的前半部分包含正频率分量
```

---

## 附录: 代码质量检查清单（合并前自查）

- [ ] 无 TypeScript 类型错误
- [ ] 无 `any` 类型（新代码）
- [ ] 无未使用的变量/导入
- [ ] 测试编写并运行通过
- [ ] 遵循导入顺序规范
- [ ] 使用 `@/` 路径别名
- [ ] 颜色来自 `tokens.ts`
- [ ] 面板使用 Glass 组件
- [ ] Store 使用精细化 Selector
- [ ] 无 `console.log` 遗留
- [ ] 无 TODO/FIXME 未处理