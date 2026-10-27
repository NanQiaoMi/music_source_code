# ADR 0004: 持久化注册表、版本与备份范围

- 状态: Proposed
- 日期: 2026-10-21
- 关联: D4、Q05、Q07、S1-1/S1-2、S6-2
- 决策人: 待用户

## 背景

- 44 处 persist 分散在 44 个 store；仅 3 个有 version、1 个有 migrate。
- backupRestoreStore 10 个槽位中 5 个 key 错配（gesture-store/sleep-timer-store/playlist-store/queue-store/recommendation-store），恢复后不 rehydrate。
- safeStorage 启动压缩把有效队列 200→50、历史 30→20；配额失败写空队列。
- S1-1 已落地 src/lib/storage/storageRegistry.ts（44 key / 8 backup / owner+version+group+quotaPolicy）+ 一致性测试。

## 决策（推荐）

1. 注册表即代码：所有 persist key 必须注册；CI 一致性测试阻断漂移。
2. 版本：当前形状记为 v1；uiStore v2。改结构必须 version+1 + migrate + 旧 JSON fixture。
3. 备份 v5：仅 registry 中 backup=true 的 8 个 key；恢复后 rehydrate + 提示；不含 IndexedDB 音频二进制（D4-A）。
4. 旧 key 保留一个版本后删除；删除 PR 独立于迁移 PR。
5. 新增 theme-store-v1 / quality-store-v1 时先更新注册表与备份清单（Q05）。

## 验收

44/44 注册且一致性测试通过；备份→恢复→重载闭环；旧备份可导入；启动压缩不再截断有效队列。
