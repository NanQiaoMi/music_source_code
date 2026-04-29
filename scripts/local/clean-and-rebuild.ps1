# 一键清理和重建脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V6.0 一键清理和重建" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 清理所有缓存
Write-Host "步骤 1/3: 清理缓存..." -ForegroundColor Yellow
npx rimraf .next
npx rimraf node_modules/.cache
Write-Host "   ✓ 缓存已清理" -ForegroundColor Green

Write-Host ""

# 2. 重新构建
Write-Host "步骤 2/3: 重新构建项目..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
  Write-Host "   ✓ 构建成功" -ForegroundColor Green
} else {
  Write-Host "   ✗ 构建失败" -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""

# 3. 完成
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "清理和重建完成！" -ForegroundColor Green
Write-Host "现在可以运行: npm run dev" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
