# Windows x64 桌面部署计划（v0.2.1）

## 目标

将 MIMI Music Player 构建为可重复验证的 Windows x64 portable EXE 与 NSIS 安装程序，Electron 管理轻量 FastAPI 后端生命周期。

## 资源布局

- Next.js 静态导出：`out/`
- Electron 资源：`app.asar`
- 内置后端：`resources/backend.exe`
- 用户模型目录：Electron `userData/models`
- 产物：`dist-electron/`

生产页面使用 `app://app/` 协议加载，覆盖根页面、`data-manager` 和 `/_next` 静态资源；生产窗口禁止导航到外部地址，外链交给系统浏览器。

## 构建顺序

Windows PowerShell 执行 `scripts/build-desktop-win.ps1`，顺序固定为：

1. npm 依赖安装
2. 轻量 Python 依赖与 PyInstaller
3. 后端 EXE
4. Next.js 静态导出
5. Electron Builder x64 portable + NSIS
6. unpacked 资源检查
7. SHA-256 生成

## 后端边界

后端读取 `VIBE_HOST`、`VIBE_PORT`、`VIBE_MODELS_DIR`，默认绑定 `127.0.0.1`，关闭 debug/reload。当前可验证 API 为 health 和 capability discovery；音频、TTS、视觉占位入口显式返回 501，不伪装为真实推理。

## 验证矩阵

- Node/Electron：语法检查、TypeScript、Next build
- Python：compileall、后端功能检查、PyInstaller smoke
- Web：根页面、`/data-manager`、`/_next` 资源
- Windows：portable 启动、NSIS 安装/启动/卸载、后端健康检查、退出进程清理
- 发布：portable/NSIS SHA-256、未签名状态与 SmartScreen 提示

## 回滚点

部署改动基线为 `1d7dfd3`。构建失败时保留源码改动和诊断日志，使用阶段提交或 `git revert` 回滚，不删除用户已有工作树和本地数据。
