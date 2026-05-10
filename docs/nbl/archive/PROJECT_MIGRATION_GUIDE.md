# 项目迁移指南

这份指南将帮助您将 Vibe Music Player 项目打包并迁移到另一台电脑继续开发。

---

## 📦 方式一：使用打包脚本（推荐）

### 步骤 1：打包项目

在原电脑上，打开 PowerShell，进入项目目录，运行：

```powershell
.\scripts\package-project.ps1
```

这将在项目根目录的上一级创建 `vibe-music-player-backup.zip` 文件。

**脚本功能：**
- ✅ 自动排除不需要的文件（node_modules、.next、.venv 等）
- ✅ 压缩所有源代码和配置文件
- ✅ 显示备份文件大小和位置

### 步骤 2：传输文件

将生成的 `vibe-music-player-backup.zip` 文件复制到另一台电脑。

### 步骤 3：解压项目

在目标电脑上，解压 `vibe-music-player-backup.zip` 到您想要的位置。

### 步骤 4：安装依赖

在目标电脑上，进入项目目录，运行：

```bash
npm install
```

这将安装所有 Node.js 依赖。

### 步骤 5：启动开发服务器

```bash
npm run dev
```

打开浏览器访问 http://localhost:3025

---

## 📦 方式二：手动打包

如果您想手动控制打包过程：

### 1. 复制项目文件夹

复制整个项目文件夹，但**排除**以下内容：

```
node_modules/          # 依赖包（很大，通过 npm install 重新安装）
.next/                # Next.js 构建输出
dist-electron/        # Electron 打包输出
.venv/                # Python 虚拟环境（如果有）
.git/                 # Git 仓库（如果使用 Git）
*.log                 # 日志文件
*.tsbuildinfo         # TypeScript 构建信息
.DS_Store             # macOS 系统文件
.env*.local           # 本地环境变量
```

### 2. 压缩项目

将剩余的项目文件压缩为 ZIP 文件。

### 3. 后续步骤

按照方式一的步骤 2-5 进行。

---

## 🛠️ 完整环境设置（目标电脑）

### 前置要求

在目标电脑上确保已安装：

| 软件 | 版本要求 | 用途 |
|------|---------|------|
| **Node.js** | 18+ | JavaScript 运行时 |
| **npm** | 9+ | 包管理器 |
| **Git** | 任意 | 版本控制（可选） |
| **Python** | 3.9+ | 后端（可选） |
| **PowerShell** | 5.1+ | Windows 脚本 |

### 检查环境

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version

# 检查 Python 版本（如果需要后端）
python --version
```

### 安装 Node.js

如果目标电脑没有安装 Node.js：

1. 访问 https://nodejs.org/
2. 下载 LTS 版本（推荐 20.x 或 18.x）
3. 运行安装程序，按照提示完成安装
4. 重启终端或命令提示符

---

## 🚀 快速启动命令

### 开发模式

```bash
# 仅 Web 开发
npm run dev

# Web + Electron 桌面应用
npm run dev:electron

# 完整模式（前端 + 后端）
npm run dev:full
```

### 构建生产版本

```bash
# 构建 Next.js
npm run build

# 构建当前平台 Electron 应用
npm run build:electron

# 构建 Windows 版本
npm run build:electron:win

# 构建 macOS 版本
npm run build:electron:mac

# 构建 Linux 版本
npm run build:electron:linux
```

### 其他常用命令

```bash
# 代码格式化
npm run format

# 代码检查
npm run lint

# 清理构建文件
npm run clean

# 完整重建
npm run rebuild
```

---

## 📋 常见问题

### Q: npm install 很慢怎么办？

A: 使用国内镜像源：

```bash
# 临时使用淘宝镜像
npm install --registry=https://registry.npmmirror.com

# 永久设置淘宝镜像
npm config set registry https://registry.npmmirror.com
```

### Q: 端口 3025 被占用怎么办？

A: 可以修改 `package.json` 中的端口号，或者先关闭占用端口的程序：

```bash
# 查看端口占用
netstat -ano | findstr :3025

# 结束进程（替换 PID 为实际进程 ID）
taskkill /PID <PID> /F
```

### Q: Electron 相关功能在目标电脑上不工作？

A: 确保已安装所有依赖：

```bash
# 重新安装依赖
npm install

# 清理缓存后重新安装
npm run clean:full
npm install
```

### Q: Python 后端需要吗？

A: Python 后端是可选的。如果只需要前端功能，可以直接使用 `npm run dev` 启动。

---

## 📂 项目结构验证

解压后，您的项目应该包含以下核心文件和文件夹：

```
vibe-music-player/
├── src/                    # 源代码 ⭐
│   ├── app/               # Next.js App Router
│   ├── components/        # React 组件
│   ├── hooks/            # 自定义 Hooks
│   ├── store/            # Zustand 状态管理
│   ├── lib/              # 核心库
│   ├── services/         # 服务层
│   └── utils/            # 工具函数
├── electron/              # Electron 桌面应用
├── public/                # 静态资源
├── scripts/               # 脚本文件
├── docs/                  # 项目文档
├── package.json           # 项目配置 ⭐
├── package-lock.json      # 依赖锁定
├── tsconfig.json          # TypeScript 配置
├── tailwind.config.ts     # Tailwind 配置
├── next.config.js         # Next.js 配置
├── .eslintrc.json         # ESLint 配置
├── .prettierrc            # Prettier 配置
├── .gitignore             # Git 忽略文件
└── README.md              # 项目说明
```

---

## 🎯 下一步

成功设置后，您可以：

1. **继续开发** - 使用 `npm run dev` 启动开发服务器
2. **查看文档** - 阅读 `PROJECT_DOCUMENTATION.md` 了解项目详情
3. **使用 Git** - 如果需要版本控制，初始化 Git 仓库
4. **打包桌面应用** - 使用 `npm run build:electron:win` 打包 Windows 版本

---

## 📞 需要帮助？

如果遇到问题，请检查：

1. `docs/TROUBLESHOOTING.md` - 故障排除文档
2. `README.md` - 项目说明
3. `PROJECT_DOCUMENTATION.md` - 完整项目文档

祝开发顺利！🎉

---

**文档版本**: 1.0  
**最后更新**: 2026-04-16
