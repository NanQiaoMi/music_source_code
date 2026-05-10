# V6.0 项目问题彻底解决方案

## 一、常见问题类型

### 1. localStorage 配额超限问题
**错误信息**: `QuotaExceededError: Failed to execute 'setItem' on 'Storage'`

### 2. Next.js 构建缓存损坏问题
**错误信息**:
- `Cannot find module './22.js'`
- `Cannot find module for page: /_document`
- `PageNotFoundError: Cannot find module`

---

## 二、快速恢复方案（按顺序执行）

### 步骤 1: 清理浏览器 localStorage
打开浏览器控制台（F12），执行以下命令：

```javascript
localStorage.removeItem('vibe-music-ai-preferences');
localStorage.removeItem('vibe-music-preferences');
localStorage.clear(); // 可选，清空所有数据
location.reload(); // 刷新页面
```

### 步骤 2: 清理 Next.js 构建缓存
在项目根目录下执行：

```powershell
# Windows PowerShell
npx rimraf .next
npx rimraf node_modules/.cache
```

### 步骤 3: 重新构建项目

```powershell
npm run build
```

### 步骤 4: 启动开发服务器（如果需要）

```powershell
npm run dev
```

---

## 三、永久预防方案

### 1. 确保 aiStore persist 配置正确

文件位置: `src/ai/store/aiStore.ts`

确保配置如下：
- ✅ 只持久化必要的小数据
- ✅ 不持久化 `models` 数组
- ✅ 不持久化 `engine` 或 `isInitialized`
- ✅ 添加自动清理旧大数据逻辑

### 2. 添加 package.json 清理脚本

在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "clean": "npx rimraf .next && npx rimraf node_modules/.cache",
    "clean:all": "npx rimraf .next && npx rimraf node_modules/.cache && npx rimraf node_modules",
    "rebuild": "npm run clean && npm run build",
    "reset": "npm run clean:all && npm install && npm run build"
  }
}
```

### 3. 定期清理缓存

建议每周或发现问题时执行：

```powershell
npm run clean
npm run build
```

---

## 四、完整的一键清理脚本

创建文件 `scripts/cleanup.ps1`:

```powershell
# 完整清理脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V6.0 项目清理和恢复脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 清理 Next.js 构建缓存
Write-Host "1. 清理 Next.js 构建缓存..." -ForegroundColor Yellow
try {
  npx rimraf .next
  Write-Host "   ✓ .next 目录已清理" -ForegroundColor Green
} catch {
  Write-Host "   ⚠  跳过 .next 清理 (可能不存在)" -ForegroundColor Yellow
}

# 2. 清理 Node 模块缓存
Write-Host "2. 清理 Node 模块缓存..." -ForegroundColor Yellow
try {
  npx rimraf node_modules/.cache
  Write-Host "   ✓ node_modules/.cache 已清理" -ForegroundColor Green
} catch {
  Write-Host "   ⚠  跳过缓存清理 (可能不存在)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "清理完成！现在可以重新构建:" -ForegroundColor Green
Write-Host "  npm run build" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
```

使用方法：
```powershell
.\scripts\cleanup.ps1
npm run build
```

---

## 五、如果问题仍然存在

### 方案 A: 完全重置项目

```powershell
# 1. 删除所有缓存和构建
npx rimraf .next
npx rimraf node_modules/.cache

# 2. 删除并重新安装依赖（可选）
npx rimraf node_modules
npm install

# 3. 重新构建
npm run build
```

### 方案 B: 检查浏览器设置

1. 打开浏览器设置
2. 清除浏览器缓存和 Cookie
3. 检查浏览器存储配额设置
4. 尝试使用隐身/无痕模式

### 方案 C: 检查磁盘空间

确保系统磁盘有足够空间（建议至少 5GB）

---

## 六、验证修复成功的标志

执行 `npm run build` 后看到以下输出说明成功：

```
✓ Compiled successfully
✓ Checking validity of types
✓ Collecting page data
✓ Generating static pages (5/5)
✓ Collecting build traces
✓ Finalizing page optimization
```

---

## 七、联系支持

如果以上方案都无法解决问题，请提供以下信息：
1. Node.js 版本 (`node -v`)
2. npm 版本 (`npm -v`)
3. 完整的错误信息和调用栈
4. 浏览器控制台截图
5. 您的操作系统版本

---

**最后更新**: 2026-03-27
**版本**: V6.0 Alpha v52.0
