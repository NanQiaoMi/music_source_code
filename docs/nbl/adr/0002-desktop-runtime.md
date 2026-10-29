# ADR 0002: Windows 桌面运行时形态

- 状态: Proposed（证据倾向 B；**D2 于 2026-10-29 由用户暂缓 / Deferred，未批准**）
- 日期: 2026-10-21（提议）/ 2026-10-29（Deferred）
- 关联: D2、S0-3、S7-4/5/6
- 决策人: 待用户（2026-10-29 决定暂缓）
- 2026-10-29 记录: 用户暂缓 D2。桌面发布继续冻结（`verify-desktop-release-ready` fail-fast），S7-4..S7-8 不启动，S0-3 的 out/ 不回填；恢复讨论时仍以 B 为唯一保留在线能力的路径。

## 背景

- electron/main/index.js:197-198 生产窗口加载 app://app/，由 out/ 提供静态文件；package.json electron-builder 只打包 out/\*\*。
- npm run build 默认不产 out（next.config.js:3 仅在 STATIC_EXPORT=1 时 output:"export"），实测 out/ mtime 为 2026-07-30 → 桌面发布会发旧前端。
- 2026-10-21 S0-3 实测：STATIC_EXPORT=1 next build --webpack 失败：
  "export const dynamic = force-static/revalidate not configured on route /api/audio/proxy with output: export"
  同样失败于 /api/kugou/login/status 等 31 个 API route。
- 渲染层所有 /api/\* 以 location.origin 为契约（MultiSourceResolver.ts:227-231）。

## 决策（推荐）

采用 B：Windows 桌面捆绑本地 Next standalone 运行时 + app:// 协议桥接 + BackendGateway；保留 app://app origin 以避免 44 个 key/IndexedDB 迁移。
A（静态导出）已被实测排除（与 API routes 不兼容，除非砍掉在线能力）。
S0-3 期间桌面发布冻结：scripts/verify-desktop-release-ready.mjs 默认 exit 1；build-desktop-win.ps1 与 CI desktop job 均先过该门禁。

## 影响

- S7-4 需要 standalone 产物、loopback 健康检查、协议桥接与回退方案。
- 发布流程在 S7-4 完成前不可用（有意为之，防止发旧前端）。

## 验收

- 打包 --dir 冷启动窗口 <3s；/ 与 /data-manager 200；旧 origin 数据可见；在线链路可用或明确降级；out 陈旧时构建必须失败。
