# S1-8b 证据（部分，2026-10-28）

## 已完成

- 分支：`feature/arch-perf-s1-8a`（7ff38da）、`feature/arch-perf-s1-8b`（1b30665, 4c74f51, 33e6feb, 8207d91）
- 协调器：`src/lib/playback/requestCoordinator.ts`（begin/complete/abortAll/isCurrent/inFlight + throwIfAborted + combineSignals）
- 信号贯穿（可选参数，向后兼容）：
  - `MultiSourceResolver.resolvePlayableAudio(query, { bypassCache, signal })`
  - `resolveAudioSourceBlob(song, { signal, timeoutMs })`
  - `triggerBackgroundCache(song, url, { signal })`
  - `audioPrefetcher.prefetchSong(song, { signal })`

## 验证命令

```bash
npx vitest run \
  src/lib/playback/requestCoordinator.test.ts \
  src/lib/playback/resolvePlayableAbort.test.ts \
  src/lib/audio/audioSource.test.ts \
  src/lib/audio/audioPrefetcher.test.ts
npx tsc --noEmit --incremental false --pretty false
npx eslint src/lib/playback src/lib/audio/audioSource.ts src/lib/audio/audioPrefetcher.ts src/hooks/useNetworkAudioCache.ts
```

## 结果

- 测试：4 files / 16 tests passed
- tsc：exit 0
- eslint：exit 0

## 未完成（S1-8b 验收门槛）

- [ ] resolver 内部 30+ fetch 透传 signal
- [ ] `useAudioPlayer.managePlayback` 使用 coordinator.begin/complete + throwIfAborted
- [ ] 连点 5 首仅 1 in-flight 集成测试
- [ ] 旧结果不写 store、无 stale toast 断言
