# Phase 1: Store 架构解耦 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `nbl.subagent-driven-development` or `nbl.executing-plans` to implement this plan task-by-task.

**Goal:** 建立 Coordinator 协调层，消除 Store 间循环依赖，拆分过大的 audioStore

**Architecture:** 新建 `src/store/coordinator/` 目录，Coordinator 作为纯函数模块管理跨 Store 事务；拆分 `audioStore` 为 `playerStore` (播放核心) + 精简 `audioStore` (仅设备/效果/设置)

**Tech Stack:** Zustand 5 | TypeScript 5.4

---

### Task 1.1: 设计 Coordinator 层接口规范

**状态**
- [ ] 任务完成

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: 创建协调器类型定义文件 `src/store/coordinator/types.ts`**

```typescript
// 跨 Store 协调器类型定义
// Coordinator 是纯函数模块，不持有状态，仅编排多个 Store 的调用

import type { Song } from "@/types/song";

export interface AudioCoordinator {
  /** 播放指定歌曲，同步更新 audioStore + queueStore */
  playSong(song: Song): void;
  /** 将歌曲添加到队列并播放，同步更新 queueStore + audioStore */
  appendAndPlay(songs: Song[]): void;
  /** 停止播放并清理相关状态 */
  stopPlayback(): void;
}

export interface QueueCoordinator {
  /** 在当前位置后插入歌曲 */
  insertNext(song: Song): void;
  /** 清空队列并返回旧队列内容 */
  clearQueue(): Song[];
  /** 播放完后的下一步（推荐/停止/循环） */
  handleQueueEnd(): void;
}

export interface EmotionCoordinator {
  /** 基于情感标签获取推荐 */
  getRecommendationsByEmotion(coords: { x: number; y: number }): Song[];
  /** 智能播放列表（情感 + 播放历史 + 随机） */
  createSmartPlaylist(baseSong: Song): Song[];
}
```

- [ ] **Step 2: 提交类型定义**

```bash
git add -A
git commit --no-verify -m "feat(coordinator): add Coordinator type definitions
```

---

### Task 1.2: 实现 AudioCoordinator + QueueCoordinator

**状态**
- [ ] 任务完成

**Dependencies:** Task 1.1
**Parallelizable:** No

- [ ] **Step 1: 创建 `src/store/coordinator/audioCoordinator.ts`**

```typescript
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import type { Song } from "@/types/song";
import type { AudioCoordinator } from "./types";

export const audioCoordinator: AudioCoordinator = {
  playSong: (song: Song) => {
    const { play } = useAudioStore.getState();
    const { setCurrentIndex, addToHistory } = useQueueStore.getState();
    play(song);
    setCurrentIndex(song.id);
    addToHistory(song);
  },

  appendAndPlay: (songs: Song[]) => {
    const { appendSongsAndPlay } = useAudioStore.getState();
    appendSongsAndPlay(songs);
  },

  stopPlayback: () => {
    const { pause, setCurrentTrack } = useAudioStore.getState();
    const { clearQueue } = useQueueStore.getState();
    pause();
    setCurrentTrack(null);
    clearQueue();
  },
};
```

- [ ] **Step 2: 创建 `src/store/coordinator/queueCoordinator.ts`**

```typescript
import { useQueueStore } from "@/store/queueStore";
import { useRecommendationStore } from "@/store/recommendationStore";
import type { Song } from "@/types/song";
import type { QueueCoordinator } from "./types";

export const queueCoordinator: QueueCoordinator = {
  insertNext: (song: Song) => {
    const { queue, currentIndex } = useQueueStore.getState();
    const insertAt = currentIndex + 1;
    const newQueue = [...queue.slice(0, insertAt), song, ...queue.slice(insertAt)];
    useQueueStore.getState().setQueue(newQueue);
  },

  clearQueue: () => {
    const { queue, setQueue } = useQueueStore.getState();
    setQueue([]);
    return queue;
  },

  handleQueueEnd: () => {
    const { playMode } = useQueueStore.getState();
    if (playMode === "normal") return; // stop at end
    if (playMode === "loop") {
      // restart queue
      const { queue } = useQueueStore.getState();
      if (queue.length > 0) {
        audioCoordinator.playSong(queue[0]);
      }
    }
    if (playMode === "smart") {
      const recs = useRecommendationStore.getState().getRecommendations();
      if (recs.length > 0) {
        audioCoordinator.appendAndPlay(recs);
      }
    }
  },
};
```

- [ ] **Step 3: 创建 `src/store/coordinator/index.ts`**

```typescript
export { audioCoordinator } from "./audioCoordinator";
export { queueCoordinator } from "./queueCoordinator";
export type { AudioCoordinator, QueueCoordinator, EmotionCoordinator } from "./types";
```

- [ ] **Step 4: 验证编译通过**

```bash
npm run build
```

预期：构建成功，无 TS 错误。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit --no-verify -m "feat(coordinator): implement AudioCoordinator and QueueCoordinator
```

---

### Task 1.3: 替换 emotionStore 直接 import → Coordinator

**状态**
- [ ] 任务完成

**Dependencies:** Task 1.2
**Parallelizable:** No

- [ ] **Step 1: 修改 `src/store/emotionStore.ts`**

移除对 `aiStore` 和 `smartPlaylistStore` 的直接 import，改为通过 Coordinator 调用。

查找：`import { useAiStore } from "./aiStore"` 和 `import { useSmartPlaylistStore } from "./smartPlaylistStore"`

改为通过参数注入或 Coordinator 回调：

```typescript
// 在文件顶部添加
import { audioCoordinator } from "./coordinator";

// 将原来直接调用 aiStore 的逻辑改为：
// const aiState = useAiStore.getState();
// → 改为通过函数参数传递或从组件层传入
```

- [ ] **Step 2: 运行测试 + 构建验证**

```bash
npm run test
npm run build
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit --no-verify -m "refactor(store): replace direct store imports with Coordinator in emotionStore"
```

---

### Task 1.4: 消除动态 require()

**状态**
- [ ] 任务完成

**Dependencies:** Task 1.1
**Parallelizable:** Yes

- [ ] **Step 1: 搜索所有动态 require() 引用**

```bash
rg "require\(" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: 替换为顶层 import**

在 `audioStore.ts`、`smartPlaylistStore.ts`、`emotionStore.ts` 中将所有动态 `require()` 替换为顶层 `import`。

```typescript
// 原来的写法
const { useQueueStore } = require("./queueStore");

// 改为顶层 import
import { useQueueStore } from "./queueStore";
```

- [ ] **Step 3: 验证循环依赖消除**

```bash
npm run build
```

预期：构建通过，无循环依赖警告。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit --no-verify -m "refactor(store): replace dynamic require() with static imports"
```

---

### Task 1.5: 拆分 audioStore

**状态**
- [ ] 任务完成

**Dependencies:** Task 1.4
**Parallelizable:** No

- [ ] **Step 1: 创建 `src/store/playerStore.ts`**

从 `audioStore.ts` 中抽取播放核心状态（currentTrack, isPlaying, currentTime, duration, volume, muted, playbackRate, loopMode）和相关 actions（play, pause, stop, seek, setVolume, setMuted, setPlaybackRate, setLoopMode）。

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Song } from "@/types/song";

interface PlayerState {
  currentTrack: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  loopMode: "none" | "one" | "all";

  play: (track: Song) => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setLoopMode: (mode: "none" | "one" | "all") => void;
  setCurrentTrack: (track: Song | null) => void;
  setIsPlaying: (playing: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      muted: false,
      playbackRate: 1,
      loopMode: "none",

      play: (track) => set({ currentTrack: track, isPlaying: true, currentTime: 0 }),
      pause: () => set({ isPlaying: false }),
      stop: () => set({ currentTrack: null, isPlaying: false, currentTime: 0 }),
      seek: (time) => set({ currentTime: time }),
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setMuted: (muted) => set({ muted }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      setLoopMode: (mode) => set({ loopMode: mode }),
      setCurrentTrack: (track) => set({ currentTrack: track }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
    }),
    {
      name: "mimi-player",
      partialize: (state) => ({ volume: state.volume, muted: state.muted, playbackRate: state.playbackRate, loopMode: state.loopMode }),
    }
  )
);
```

- [ ] **Step 2: 精简 `src/store/audioStore.ts`**

移除播放核心状态（已移到 playerStore），保留：EQ 设置、音频设备、环绕声、增强效果、交叉淡入淡出等音频处理相关状态。在文件顶部导出兼容层：

```typescript
// 兼容层：保持旧的 audioStore API 可用
// 新代码请直接使用 usePlayerStore
export const useAudioStore = {
  ...usePlayerStore,
  // ... 剩余的音频处理状态
};
```

- [ ] **Step 3: 更新所有引用 `useAudioStore` 的组件**

将使用播放核心状态的组件（play/pause/volume 等）改为 `import { usePlayerStore } from "@/store/playerStore"`。

- [ ] **Step 4: 运行测试 + 构建验证**

```bash
npm run test
npm run build
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit --no-verify -m "refactor(store): split audioStore into playerStore (core) + audioStore (audio processing)"
```

---

### Task 1.6: 统一 Song 类型

**状态**
- [ ] 任务完成

**Dependencies:** Task 1.4
**Parallelizable:** Yes

- [ ] **Step 1: 检查现有的类型定义**

```bash
rg "interface Song" src/types/ --include="*.ts"
rg "interface HealthIssueType" src/ --include="*.ts"
```

- [ ] **Step 2: 统一到 `src/types/song.ts`**

合并所有 `Song` 类型定义，确保字段完整：

```typescript
export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  url: string;
  cover?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  emotion?: { x: number; y: number };
  lyric?: string;
  format?: string;
  bitrate?: number;
  sampleRate?: number;
  fileSize?: number;
  dateAdded?: number;
  playCount?: number;
}

export type HealthIssueType = "missing" | "duplicate" | "corrupt" | "metadata";

export interface HealthIssue {
  id: string;
  type: HealthIssueType;
  songId: string;
  description: string;
  fixable: boolean;
}
```

- [ ] **Step 3: 更新所有导入路径**

将分散在各个文件中的 `Song` 类型引用改为 `import { Song } from "@/types/song"`。

- [ ] **Step 4: 运行测试 + 构建验证**

```bash
npm run test
npm run build
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit --no-verify -m "refactor(types): unify Song type and HealthIssueType into src/types/song.ts"
```

---

## 执行顺序

```
Phase 1 执行顺序（串行）:
  1.6 (类型统一, 可并行) ──────────┐
  1.4 (消除 require, 可并行) ─────┤
  1.1 (类型定义) → 1.2 (Coordinator) → 1.3 (emotionStore 解耦)
                                     └→ 1.5 (audioStore 拆分)
```

---

**Execution Mode:** serial (strong dependency chain, complex refactoring)