# S2 音频图与持久化性能 — 实现级执行计划

> **上级计划**：[2026-10-21 架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §5 S2、§4.3、§6.2
> **阶段**：S2（S0→S1→**S2**→S3 关键路径第 3 段）｜**预估**：4–5 人日（6 个 PR，约 1,500 行 + 测试）｜**状态**：未开始
> **审计依据**：审计 C（runtime-audio-audit.md）P0-5/P1-2/P1-3/P1-4/P1-9；审计 B P1-1/P1-3；审计 A P0-02/P1-04。本文引用行号均已用 read/grep 在当前脏树核实；未核实项标「待核实」。
> **本阶段只写计划**：不改代码、不跑构建/测试；执行者按任务顺序开工。

---

## 1. 阶段目标与出口条件

**目标**：把 Web Audio 图从「多所有者、多入口、多写」收敛为「单一混音入口 + 单一音量控制 + 效果参数增量 + 单一 FFT 数据源」，并把播放持久化从「每秒 8 次写盘」降到「≤1 次/秒、刷新恢复误差 ≤5s」，同时给音频节点/模块级集合补上生命周期与上界。

| # | 出口指标 | 现状（基线） | 目标 | 硬阈值（验收 fail） | 测量方式 |
|---|---|---:|---:|---:|---|
| E1 | destination 入边数（无效果/有效果） | 2 / 2（常连旁路 + 效果链） | 1 / 1 | ≠1 即 fail | dev probe __audioGraph.destinationInbound |
| E2 | 音量写入点数（audio.volume + masterGain） | 2 | 1（仅 masterGain） | >1 即 fail | 代码计数 + audio.volume===1 断言 |
| E3 | 效果滑杆 100 次拖动引起的 connect 次数 | ≈4,400（44 connect/次重建） | 0 | >0 即 fail | probe __audioGraphStats.connect 差值 |
| E4 | 播放期 localStorage 写入（player-store + audio-store-v4） | ≈8 次/秒 | ≤1 次/秒 | >2 次/秒 fail | patch Storage.prototype.setItem 计 60s |
| E5 | 共享 analyser fftSize | 被多消费者改写 256/2048 | 恒定 2048 | 出现非 2048 采样 fail | 60s 内每 100ms 采样断言 |
| E6 | 稳态每帧 Uint8Array 分配（analyser 读取） | 2 次/帧/消费者 | 0 | >0.1 次/帧 fail | CDP HeapProfiler / probe 计数 |
| E7 | 100 次切歌 activeAudioNodes 增量 | 未测（sourceNodes 只增不删） | 0 | >5 fail | sourceNodes.size + connect/disconnect 差值 |
| E8 | 播放 60s 后模块级集合大小 | 随歌曲单调增长无上界 | 全部 ≤ 上限（300/200/500） | 任一超限 fail | probe 导出集合 size |
| E9 | 刷新恢复进度误差 | 4Hz 写盘，≤0.25s | ≤5s（默认 2s） | >5s fail | 写盘后 1s 刷新读取对比 |

**出口条件**：E1–E9 全部达标且有 before/after 证据；S1 播放正确性回归测试不改动仍全绿；听感 A/B（效果强度/音量曲线）通过；AudioEffectsPanel 拖动无爆音、无 >50ms 长任务。

---

## 2. 前置条件、依赖与不变量

| 类型 | 内容 |
|---|---|
| 必须已合入 | S0-1（干净树）、S0-6（scripts/perf 测量基座与 perf/measure.py 固化）、S1-5（队列唯一权威）、S1-6（PlaybackMediaBridge 单例，useAudioPlayer 已成薄壳）、S1-7（Watchdog 懒 attach/detach） |
| 数据兼容（I1） | 不新增/不重命名 localStorage key；player-store 与 audio-store-v4 的 partialize 只减字段不换结构（旧数据含 currentTime 可忽略），无需 version+1 |
| 播放连续性（I2） | 改图期间不得重建 audio 元素；EQ/效果切换不得重置 currentTime；S2-1 合入后「无效果」必须是直连而非静音 |
| 单一事实源（I3） | 音量唯一可写点 = AudioEngine.setVolume；destination 唯一入边所有者 = AudioEffectsManager；FFT 唯一读取入口 = AnalyserHub |
| 资源有 owner（I4） | 每个 AudioNode/监听/集合必须有创建点与释放点；S2-5 补 dispose |
| 受保护界面（D7） | 本阶段不碰 Home/Player/歌词视觉；只改音频行为与数据路径。VisualizationView.tsx 在 S2-3 仅改 analyser 读取 3 行（:209-211、:363-371），PR 须标注「仅数据源替换，无视觉变化」 |
| 验证顺序（I7） | eslint → vitest → tsc → build → dev/smoke；禁止并行 build/tsc |

**文件冲突矩阵（决定同阶段串行顺序）**：useAudioPlayer.ts 被 S2-1（:986-1006、:1758-1764）、S2-4（:412-429）、S2-5（:63-70）三处触碰 → 三者必须串行（S2-1 → S2-4 → S2-5）。VisualizationView.tsx 与 S3-3 同文件 → S2-3 先合入，S3-3 在其之后 rebase。S2-2 与 S2-3 文件不相交可并行；S2-6 最后。

---

## 3. 任务总表

| ID | 任务 | 写作用域（精确文件） | PR 数 | 依赖 | 风险 | 验收 |
|---|---|---|---|---:|---|---|
| S2-1 | 单入口混音 + 音量单点 | src/lib/audio/AudioEngine.ts、src/lib/audio/AudioEffectsManager.ts、src/hooks/useAudioPlayer.ts、新增 src/lib/audio/audioGraphStats.ts、测试 | 1（~350 行） | S1-6 | 中（听感/音量） | E1=1、E2=1；效果 A/B 通过；audio.volume===1 |
| S2-2 | 效果参数增量更新 | src/lib/audio/AudioEffectsManager.ts、src/components/features-v7/AudioEffectsPanel.tsx、测试 | 1（~260 行） | S2-1 | 中（爆音/强度） | E3=0；拖动无 >50ms 长任务 |
| S2-3 | AnalyserHub | 新增 src/lib/audio/analyserHub.ts、src/hooks/useVisualizationV8.ts、src/components/visualization/VisualizationView.tsx、src/lib/audio/AudioVisualizerManager.ts、测试 | 1（~270 行） | S2-1 | 低中（视觉回归） | E5 恒定、E6=0 |
| S2-4 | 播放写盘降频 | 新增 src/lib/storage/throttledStorage.ts、src/lib/playback/progressCheckpoint.ts、src/store/playerStore.ts、src/store/audioStore.ts、src/hooks/useAudioPlayer.ts、src/lib/bootstrap.ts、测试 | 1（~280 行） | S1-5、S2-1 | 中（恢复精度） | E4≤1/s、E9≤5s |
| S2-5 | 图与集合生命周期 | src/lib/audio/AudioEngine.ts、src/hooks/useAudioPlayer.ts、src/hooks/useNetworkAudioCache.ts、src/services/MultiSourceResolver.ts、新增 src/lib/util/boundedCollections.ts、测试 | 1（~300 行） | S1-7、S2-1/3 | 低（行为不变） | E7=0、E8 有界；2h soak <30MB |
| S2-6 | 性能验证与沉淀 | scripts/perf/audio-metrics.mjs、perf/baseline-audio-2026q4.json、本目录 evidence/S2-report.md | 1（~160 行） | S2-1..S2-5 | 低 | 一条命令产出 JSON + before/after 表 |

建议顺序：S2-1 →（S2-2 ∥ S2-3）→ S2-4 → S2-5 → S2-6。每个 PR 目标 ≤400 行（测试不计）。

---

## 4. 逐任务执行步骤

### S2-1 单入口混音与音量单点（审计 C P0-5）

**目标**：analyser→destination 只由效果链独占；无效果时直连；音量只由 masterGain 控制，audio.volume 固定 1。

**前置**：S1-6 已把媒体事件收敛到 bridge（改 initializeAudioGraph 不涉及事件）。

**Step 1｜去掉 AudioEngine 的常连旁路**
- AudioEngine.ts:68 删除 this.analyser.connect(this.context.destination)。
- initContext()（:42-71）末尾改为调用 this.connectFallbackOutput()；新增私有字段 outputOwnedByEffects = false。
- 新增公开 API：

~~~ts
public getDestination(): AudioNode | null;      // this.context?.destination ?? null
public connectFallbackOutput(): void;           // 幂等：!outputOwnedByEffects 时 analyser.connect(destination)
public setOutputOwnedByEffects(owned: boolean): void; // true 时先 analyser.disconnect()，由效果链独占
~~~

- 语义：默认 fallback 直连（任何异常路径仍有声）；AudioEffectsManager.connect() 成功后置 owned=true 并断开 fallback。

**Step 2｜效果链成为唯一输出所有者**
- AudioEffectsManager.ts:316-329 connect()：先断开自己拥有的旧输出（sourceNode/destinationNode），再 AudioEngine.getInstance().setOutputOwnedByEffects(true)，然后 rebuildAudioChain()。
- rebuildAudioChain() 现有两支已正确：无效果 :379-388 直连 source→destination；有效果 :390-617 尾部 :617 连 destination。不要新增第二条到 destination 的边。
- 新增 detach()：sourceNode.disconnect()、清引用、setOutputOwnedByEffects(false) 并 connectFallbackOutput()。

**Step 3｜播放路径接线**
- useAudioPlayer.ts:986-1006 initializeAudioGraph()：effectsManager.connect(...)（:1003）外包 try/catch；catch 中 AudioEngine.getInstance().connectFallbackOutput() 并 console.warn。
- isAudioGraphInitialized 幂等分支（:994-999）保持不变（重复调用不得新增边）。

**Step 4｜音量单点**
- useAudioPlayer.ts:1758-1764 删除 audio.volume = isMuted ? 0 : volume，只保留 AudioEngine.getInstance().setVolume(...)。
- 在 ensureAudioElements()（audio 元素创建处，执行时 grep "new Audio" 定位，待核实行号）显式 audio.volume = 1，注释「音量唯一可控点 = AudioEngine.masterGain」。
- AudioEngine.ts:194-198 保持 masterGain.gain.setTargetAtTime；createGain 默认 1 不改。

**Step 5｜dev-only 计数探针**
- 新增 src/lib/audio/audioGraphStats.ts（NODE_ENV==="development" 时挂 window.__audioGraph / __audioGraphStats）：destinationInbound、connect、disconnect、rebuilds。
- 埋点位置：AudioEngine.init/connectFallbackOutput/setOutputOwnedByEffects、AudioEffectsManager.rebuildAudioChain/setEffectIntensity。

**测试（新增）**
- src/lib/audio/audioGraphRouting.test.ts（mock AudioContext/Gain/Analyser，记录 connect/disconnect 边）：
  - "无效果时 destination 入边恰好为 1"
  - "启用 reverb 后 destination 入边仍为 1 且经过 reverb"
  - "initializeAudioGraph 重复调用不新增 destination 入边"
  - "effectsManager.detach 后恢复 fallback 直连"
- src/lib/audio/audioVolume.test.ts："音量只写 masterGain.gain（setTargetAtTime 1 次、audio.volume 恒为 1）"；OfflineAudioContext 渲染 1kHz 正弦断言 0.5 增益 RMS ≈ -6dB（±0.5dB）。

**验证命令与预期**

~~~bash
npx vitest run src/lib/audio/audioGraphRouting.test.ts src/lib/audio/audioVolume.test.ts src/lib/audio/AudioEngine.test.ts
# 预期：3 文件全 pass；新增 ≥5 用例；无 unhandled rejection
npm run dev   # 3025；console 读 __audioGraph.destinationInbound
# 无效果 / 有效果各测一次，均 === 1
~~~

**验收标准**：E1=1、E2=1；启用 reverb 后干声不再叠加（同曲同音量 A/B，有效果时输出电平差 ≤1dB，人工 + OfflineAudioContext RMS 断言）；切效果不重建 audio 元素（audio.src 不变、currentTime 连续）。

**回滚**：整 PR revert（4 文件），无数据变更。**风险**：①效果变强/音量变大（原先被双路稀释）属预期修复，PR 附 A/B 录音；②耳机预设/淡入淡出可能依赖 element.volume → 执行前 grep \.volume\s*= 确认仅此一处。

---

### S2-2 效果参数增量更新（审计 C P1-3）

**目标**：intensity 连续参数走 AudioParam.setTargetAtTime，不重建链路；滑杆按 rAF 合并。

**前置**：S2-1 合入（单入口语义确定）。

**Step 1｜参数 applier 注册表**
- AudioEffectsManager.ts:69-70 旁新增 intensityAppliers = new Map<AudioEffectType, (v:number)=>void>()。
- rebuildAudioChain()（:331-618）中每个效果成功接线分支末尾注册 applier：reverb 的 :589-601 wet/dry gain、tremolo :605-615、stereoWidener :571-585 delayTime、vocalRemove/underwater/vinyl/talkie/megaBass/asmr/phaser/autoPan 的 gain/frequency/Q。applier 内只用 setTargetAtTime(v, ctx.currentTime, 0.02)。
- 纯结构效果（bitcrusher 的 WaveShaper.curve）：拖动期间只调 gain 补偿，pointerup 时按 Math.abs(v-last) > 0.02 重算 curve。
- rebuildAudioChain() 开头 intensityAppliers.clear()。

**Step 2｜setEffectIntensity 短路**
- :625-628 改为：先 effectIntensities.set(...)；const applier = intensityAppliers.get(effect)；if (applier) { applier(intensity); return; } rebuildAudioChain()。
- setEffectEnabled（:620-623）保持 rebuild（结构变化）。

**Step 3｜滑杆 rAF 合并**
- AudioEffectsPanel.tsx:371-383：本地 draftIntensity state 用于显示；onChange 只 setDraft + 写 pendingRef；rAF 合并一帧最多一次 setEffectIntensity(id,pending)；onPointerUp/onTouchEnd/onBlur 立即 flush；卸载 cancelAnimationFrame。

**测试（新增）**
- src/lib/audio/AudioEffectsManager.intensity.test.ts：
  - "100 次 setEffectIntensity 不触发 rebuildAudioChain"（spy rebuild）
  - "reverb intensity 0.2→0.8 时 wetGain.setTargetAtTime 收到两次目标值"
  - "setEffectEnabled(true) 仍触发一次 rebuild"
  - "100 次 setEffectIntensity 的 connect 调用次数为 0"（mock context 计数）
- src/components/features-v7/AudioEffectsPanel.test.tsx："连续 input 事件一帧内只调用一次 setEffectIntensity"（fake rAF）。

**验证命令与预期**

~~~bash
npx vitest run src/lib/audio/AudioEffectsManager.intensity.test.ts src/components/features-v7/AudioEffectsPanel.test.tsx
# 预期 pass，新增 ≥6 用例
# 手动：dev 下归零 __audioGraphStats 后拖动滑杆 3s -> connect/disconnect/rebuilds 增量均 0
~~~

**验收标准**：E3=0；拖动 3s 无爆音（3 次人工 A/B）、无 >50ms 长任务（PerformanceObserver 记录 0）；强度感知与旧版一致（PR 附录屏）。

**回滚**：revert 2 文件；setEffectIntensity 回退为 rebuild 即恢复旧行为。**风险**：WaveShaper.curve 重建策略不当会咔哒 → 白名单只对 gain/filter 参数做 continuous，curve 类 pointerup 提交。

---

### S2-3 AnalyserHub（审计 C P1-4）

**目标**：一份 FFT 多消费者共享；预分配缓冲；fftSize 固定不被改写；每帧 0 分配。

**前置**：S2-1（analyser 输出语义稳定）。与 S3-3 同文件，本任务先合入。

**Step 1｜新增 src/lib/audio/analyserHub.ts**

~~~ts
export interface AnalyserFrame {
  frequency: Uint8Array;   // 共享只读视图（长度 FFT_SIZE/2）
  waveform: Uint8Array;
  bass: number; mid: number; treble: number; full: number; // 0..1 预计算
  frameId: number;         // 对应 AudioContext.currentTime 量子
}
export const FFT_SIZE = 2048;
class AnalyserHub {
  attach(analyser: AnalyserNode): void; // 设置 fftSize=FFT_SIZE，分配一次缓冲
  detach(): void;
  readFrame(): AnalyserFrame;           // 同 currentTime 只调一次 getByteFrequencyData/TimeDomainData
  get fftSize(): number;                // 恒为 FFT_SIZE
}
export const analyserHub = new AnalyserHub();
~~~

- 只分配 4 个数组（freqRaw/waveRaw/freqView/waveView）+ 1 个 frame 对象，之后复用；readFrame 以 analyser.context.currentTime 为帧键，同帧返回缓存对象（消费方禁止写）。

**Step 2｜AudioEngine 接入**
- AudioEngine.ts:52-54 保持 fftSize=2048/smoothing=0.8，随后 analyserHub.attach(this.analyser)。
- getByteFrequencyData（:213-215）改为转调 hub（兼容旧调用）。

**Step 3｜消费者迁移（本 PR 只改写点与高频点）**
- useVisualizationV8.ts:56-66 删除 analyser.fftSize=256 与本地 dataArrayRef；:83-93 改为 analyserHub.readFrame() 读取 frequency/waveform/bass/mid/treble，不再 new Uint8Array。
- VisualizationView.tsx:209-211 删除 analyser.fftSize=256；:363-371 改为 hub.readFrame()（保留长度同步逻辑）。
- AudioVisualizerManager.ts:5-8 增加 export const getAnalyserHub = () => analyserHub；getSharedAnalyser 保留兼容。
- 其余消费者（Player3D.tsx:385、Shelf3DView.tsx:1309、FloatingSpectrumGlow.tsx:103、WaveformVisualization.tsx:28、SpectrumAnalyzer.tsx:27、AppleMusicVisualizer.tsx:78）本 PR 不改：grep 已确认 fftSize 写点仅 VisualizationView.tsx:211 与 useVisualizationV8.ts:61 两处。

**测试（新增）**
- src/lib/audio/analyserHub.test.ts：
  - "同一 currentTime 内 getByteFrequencyData 只调用 1 次"
  - "连续 1000 帧返回同一 frame/数组引用（无新 Uint8Array）"
  - "attach 后 fftSize 恒为 2048 且消费方无法改写"
  - "bass/mid/treble 归一化 0..1"

**验证命令与预期**

~~~bash
npx vitest run src/lib/audio/analyserHub.test.ts
# 预期 pass，新增 ≥4 用例
# dev + CDP：播放 60s 每 100ms 读 __analyserHub.fftSize -> 全部 2048
# CDP HeapProfiler Allocation 10s -> 无 Uint8Array 新增长期对象
~~~

**验收标准**：E5、E6 达标；V7 频谱/Player3D 视觉观感不变（PR 附 2 张截图对比）。

**回滚**：revert PR（删 hub + 恢复 3 个消费点）。**风险**：VisualizationView 待机缓冲长度校验（:363-371）必须保留，否则 getByteFrequencyData 抛错。

---

### S2-4 播放写盘降频（审计 C P1-2）

**目标**：播放期两个 persist key 合计写入 ≤1 次/秒；暂停/seek/切歌/页面隐藏立即补写；刷新恢复误差 ≤5s。

**前置**：S1-5（队列唯一权威）、S2-1。

**Step 1｜新增节流 storage**
- 新增 src/lib/storage/throttledStorage.ts：

~~~ts
export interface ThrottledStorageOptions { minWriteIntervalMs?: number; base?: StateStorage }
export function createThrottledStorage(key: string, opts?: ThrottledStorageOptions): StateStorage & { flush(): void };
export function flushAllThrottledStorages(): void;   // 遍历已注册 key
export function installFlushOnPageHide(): () => void; // visibilitychange(hidden)+pagehide 时 flushAll
~~~

- 首写立即落盘；后续同 key 写入合并到 minWriteIntervalMs（默认 2000ms）后落盘，保留最后一次值；flush() 同步写 pending。
- bootstrap.ts 初始化时调用 installFlushOnPageHide()（幂等）。

**Step 2｜两个 store 换 storage**
- playerStore.ts:148-160：storage 改 createJSONStorage(() => createThrottledStorage("player-store", { minWriteIntervalMs: 2000 }))；:153 partialize 删除 currentTime（改由 checkpoint 承担），duration 保留。
- audioStore.ts:702-736：同法；:707 删除 currentTime。
- 新增 src/lib/playback/progressCheckpoint.ts：scheduleCheckpoint(getTime)，每 5000ms 写 sessionStorage["mimi-progress-checkpoint"] = JSON.stringify({songId,time,at})（前缀 mimi-playback- 在 S1-1 registry 登记为 transient，persist:false）；flushCheckpoint() 在 pause/ended/seek/visibilitychange 时立即写。

**Step 3｜timeupdate 降频与补写**
- useAudioPlayer.ts:412-429：TIMEUPDATE_THROTTLE_MS 由 250 提到 1000（两个 store 1Hz 更新，进度条仍够用；更高频进度消费在 S6-3 切 PlaybackClock）。
- attachListeners 内 onPause/onEnded、seek action（:1790-1811 附近，待核实精确行）与 visibilitychange 中调 flushAllThrottledStorages() + flushCheckpoint()。
- 恢复：restorePlaybackSession（src/lib/audio/restorePlaybackSession.ts，S1 资产）优先读 checkpoint，否则读 persist 旧 currentTime（旧数据兼容）→ 误差 ≤5s。

**测试（新增）**
- src/lib/storage/throttledStorage.test.ts（fake timers）："1s 内 20 次写入只落盘 1 次"；"flush 立即落盘最后一次值"；"pagehide 触发全部 flush"；"getItem 返回最近落盘值"。
- src/store/playbackPersistence.test.ts："模拟 60s timeupdate：player-store+audio-store-v4 setItem 合计 ≤60"；"暂停/seek 立即补写"；"旧 JSON 含 currentTime 仍可 hydrate"。

**验证命令与预期**

~~~bash
npx vitest run src/lib/storage/throttledStorage.test.ts src/store/playbackPersistence.test.ts
# 预期 pass
# CDP: (()=>{const o=Storage.prototype.setItem;window.__w=[];Storage.prototype.setItem=function(k,v){window.__w.push([performance.now(),k]);return o.call(this,k,v)}})()
# 播放 60s 后 __w.filter(([,k])=>k==="player-store"||k==="audio-store-v4").length <= 60
~~~

**验收标准**：E4≤1/s（目标 0.4/s）、E9≤5s（目标 2s）；30min 播放无 >20ms 长任务源于 localStorage；暂停后 100ms 内落盘。

**回滚**：revert PR（恢复 250ms 直写）。**风险**：①恢复精度下降 → checkpoint + flush 兜底；②关页丢最后 2s → pagehide flush；③与 S1-3 createSafeStorage 组合顺序：throttled(outer) → safeStorage(inner)，需组合测试配额降级。

---

### S2-5 图与集合生命周期（审计 C P1-9）

**目标**：删除已丢弃 media 元素对 sourceNodes 的强引用；模块级 Set/Map 全部有上界；Watchdog 有心跳；dispose 可测。

**前置**：S1-7、S2-1/S2-3。

**Step 1｜AudioEngine 元素回收**
- AudioEngine.ts:16 sourceNodes 增加 static MAX_SOURCE_NODES = 4；init()（:128-146）与 createMediaSource()（:151-166）set 后超限淘汰最旧（Map 插入序）。
- 新增：

~~~ts
public releaseElement(el: HTMLAudioElement): void; // sourceNode.disconnect(); sourceNodes.delete(el)
public dispose(): void;                            // 所有 sourceNode disconnect + close context + 置 null（HMR/测试）
public get sourceElementCount(): number;           // soak/probe 用
~~~

- useAudioPlayer.ts 中 deck 回收处（secondaryAudio 池/换元素路径，执行时 grep createMediaSource|init( 调用点）调用 releaseElement。

**Step 2｜模块级集合上界**
- 新增 src/lib/util/boundedCollections.ts：BoundedSet<T>(max)、BoundedMap<K,V>(max)（插入序淘汰，实现 Set/Map 常用子集）。
- useAudioPlayer.ts:63-70：rescuedUrlsRef/failedUrlsRef 改 BoundedSet(200)、songRescueAttemptsRef 改 BoundedMap(200)；rescuedUrlsRef.clear()（:1385 附近）保留。
- useNetworkAudioCache.ts:31,34：cachingTasks/cachedStatusMap 改 BoundedMap(500)；network cache LRU 淘汰时同步 delete status。
- MultiSourceResolver.ts:253 resolvedUrlCache 改 BoundedMap(300)+TTL 20min（写入时间戳，读取校验，与 prefetcher 25min 对齐）；:899 searchCache 增加容量 100 与过期即删。

**Step 3｜Watchdog 心跳**
- 在 S1-7 合入版 AudioContextWatchdog 的 start()/stop() 中增加 30s setInterval：ctx.state==="suspended" 时 void ctx.resume()；stop() 中 clearInterval 并解除 statechange。行号以 S1-7 合入版本为准（执行时重新 grep，不照抄审计行号）。

**测试（新增）**
- src/lib/audio/audioEngineLifecycle.test.ts："releaseElement 后 sourceNodes.size 递减"；"dispose 幂等且 context.close 调用一次"；"超过 MAX_SOURCE_NODES 淘汰最旧"。
- src/lib/util/boundedCollections.test.ts："插入 1000 条后 size==max 且顺序正确"；"clear 后 size==0"。
- src/hooks/useNetworkAudioCache.bounds.test.ts："1000 个不同歌曲状态后 map.size<=500"。
- src/services/MultiSourceResolver.cache.test.ts："resolvedUrlCache 超过 300 条淘汰最旧"；"TTL 过期后 miss"。

**验证命令与预期**

~~~bash
npx vitest run src/lib/audio/audioEngineLifecycle.test.ts src/lib/util/boundedCollections.test.ts \
  src/hooks/useNetworkAudioCache.bounds.test.ts src/services/MultiSourceResolver.cache.test.ts
# 预期 pass
# 2h soak（S2-6 脚本）: node scripts/perf/soak-audio.mjs --duration=2h --interval=30s
#   预期 heap 增长 <30MB；sourceElementCount<=2；集合全部 <= 上限
~~~

**验收标准**：E7=0（100 次切歌后 sourceNodes.size 不增）、E8 有界；2h soak heap <30MB；stop 后无残留 timer。

**回滚**：bounded 集合与 engine 回收分开两个 commit，可独立 revert。**风险**：BoundedSet 替代原生 Set 影响 5 个使用点 → 保留 .current 的 Set 接口子集并跑 tsc；dispose() 误关共享 context 会静音 → 只在测试/HMR 显式调用。

---

### S2-6 性能验证与沉淀

**目标**：一条命令产出 S2 全部指标 JSON 与 before/after 报告，可复跑。

**前置**：S2-1..S2-5、S0-6（scripts/perf 基座与 perf/measure.py）。

**Step 1｜新增 scripts/perf/audio-metrics.mjs**
- 复用 S0-6 的 scripts/perf/cdp.mjs 连接 http://127.0.0.1:3025，注入探针，跑场景：
  1. playback-5min：本地 3 曲循环；采 persistWrites、connect/disconnect、activeNodes、analyserReads、firstSound marks。
  2. effects-drag：打开效果面板，100 次 input；采 connect/disconnect/rebuilds/longtask。
  3. soak-100-skip：100 次切歌；采 activeNodes/collection sizes。
- 输出 perf/audio-2026q4.json（schema：{scenario, metrics, env, commit}）；--baseline 对比，超 §1 硬阈值 exit 1。

**Step 2｜基线入库**
- 生成 perf/baseline-audio-2026q4.json（S2-1 之前 *_before.json 与之后 *_after.json 各一份）。

**Step 3｜报告**
- 写 docs/nbl/plans/2026-10-21-arch-perf-execution/evidence/S2-report.md：场景/指标/before/after/样本数/命令输出摘要/未覆盖项（真机听感、合盖恢复需人工）。

**测试**
- scripts/perf/audio-metrics.test.mjs（node:test）："解析 before/after 计算 delta 正确"；"超硬阈值时 exitCode=1"。

**验证命令与预期**

~~~bash
npm run build && npm run clean:port && npm start   # S0-3 后统一端口 3025
node scripts/perf/audio-metrics.mjs --scenario playback-5min --out perf/audio-2026q4.json
# 预期 exit 0；JSON 含 E1..E9 字段；与 _before.json 对比输出表格；3 次复跑方差 <10%
~~~

**回滚**：删脚本/report 即可（不改产品代码）。**风险**：CDP 探针依赖 dev-only 全局，生产构建需 --dev 参数切换；机器差异 → 指标以次数为主（非耗时），记录 commit 与机器信息。

---

## 5. 阶段级验证命令与证据清单

顺序执行（I7），任一失败停止：

~~~bash
# 1 Lint（改动文件；全仓 lint 在 S8 前保持 --max-warnings=99999）
npx eslint src/lib/audio src/lib/storage/throttledStorage.ts src/lib/util/boundedCollections.ts \
  src/hooks/useAudioPlayer.ts src/hooks/useNetworkAudioCache.ts src/components/features-v7/AudioEffectsPanel.tsx \
  src/components/visualization/VisualizationView.tsx src/hooks/useVisualizationV8.ts --max-warnings=0
# 预期 exit 0

# 2 单测
npx vitest run src/lib/audio src/lib/storage src/lib/util src/components/features-v7 src/store/playbackPersistence.test.ts
# 预期全 pass；S2 新增 ≥20 用例

# 3 类型
npx tsc --noEmit --incremental false --pretty false   # 预期 0 error

# 4 构建
npm run build   # 预期 exit 0；S2 不改包体，rootMain 允许 ±5KB

# 5 dev + 冒烟
npm run clean:port && npm run dev   # 3025
# 播放 60s -> 暂停 -> seek -> 切歌；开关 EQ/reverb -> 拖动强度滑杆
# CDP：0 console.error / 0 uncaught exception；__audioGraph.destinationInbound===1

# 6 指标
node scripts/perf/audio-metrics.mjs --scenario playback-5min --baseline perf/baseline-audio-2026q4.json
# 预期 E1=1 E2=1 E3=0 E4<=1 E5=2048 E6=0 E7=0 E8 有界 E9<=5s，exit 0
~~~

**证据清单（PR 必附）**：①上述命令与退出码；②audio-2026q4.json diff 表；③效果拖动录屏/听感 A/B 说明；④2h soak 输出；⑤受保护视图（Player3D/可视化）截图——只允许「无差异」结论。

---

## 6. 与相邻阶段的接口/交接物

| 方向 | 交接物 |
|---|---|
| S1 → S2 | mediaBridge 单例与 requestToken（S1-6/8）；PlaybackClock（S1）；队列唯一权威（S1-5）；AudioContextWatchdog lazy 版（S1-7） |
| S2 → S3 | ①播放写盘已降频，S3 订阅优化不再被 8 次/秒 setState 干扰；②analyserHub 成为唯一 FFT 源；③VisualizationView.tsx 已由 S2-3 改动 :209-211/:363-371，S3-3 rebase 后改其余行 |
| S2 → S4 | audio-metrics.mjs 纳入 nightly；无包体影响 |
| S2 → S5 | AnalyserHub 直接作为 VisualRuntime 音频数据源；audioGraphStats 保留至 S5 后删除 |
| S2 → S6 | S6-3 删除双向同步/双 persist 时复用 throttledStorage；S6-2 把 mimi-progress-checkpoint 登记进 registry |
| 与 S0-6 | 本阶段脚本复用 scripts/perf 基座，不重复实现 CDP/构建期采集 |

---

## 7. 未决问题 / 需决策项

1. **音量听感变化（需产品确认）**：S2-1 修复后实际输出约 +3dB、效果强度更明显。是否接受为「修复」并在 Changelog 说明？（默认：接受，附 A/B 录音）
2. **progress checkpoint 存储位置**：默认 sessionStorage（刷新可恢复、关浏览器即清）；若要求跨会话恢复则改 localStorage 新 key（需 S1-1 registry + 体积预算）。建议默认 sessionStorage。
3. **fftSize 统一 2048 对 256-bin 消费观感**：hub 提供降采样视图（每 8 bin 平均）；若差异明显，改 hub 内部维护两个 analyser（双 FFT 成本 +1）。默认先降采样。
4. **效果参数曲线**：intensity 改连续参数后部分效果（cassette/vocalRemove）映射与前不同，需听审在 PR 前试听 17 个效果（默认按现公式线性映射）。
5. **S2-3 改动 VisualizationView.tsx 的授权**：仅 2 处数据源替换，但受 D7 保护。需 Lead 确认「仅订阅/数据源等价改写」授权（同 D7-A）；否则改为 wrapper（风险更高）。
6. **待核实项**：ensureAudioElements 内 audio 创建行号、onPause/onEnded 处理器精确行号、restorePlaybackSession 现实现、Watchdog 合入后行号——执行时以 S1 合入版本重新 grep 并回填 PR 描述。
