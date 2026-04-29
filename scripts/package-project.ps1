# 项目打包脚本
# 使用方法: .\scripts\package-project.ps1

param(
    [string]$OutputPath = "..\vibe-music-player-backup.zip"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Vibe Music Player 项目打包工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取当前脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "项目根目录: $ProjectRoot" -ForegroundColor Yellow
Write-Host "输出文件: $OutputPath" -ForegroundColor Yellow
Write-Host ""

# 检查输出文件是否存在，存在则删除
if (Test-Path $OutputPath) {
    Write-Host "删除旧的备份文件..." -ForegroundColor Yellow
    Remove-Item $OutputPath -Force
}

Write-Host "开始打包项目..." -ForegroundColor Green
Write-Host ""

# 需要排除的文件和文件夹
$Exclude = @(
    "node_modules",
    ".next",
    "dist-electron",
    ".venv",
    ".git",
    ".gitignore",
    "*.log",
    "*.tsbuildinfo",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    ".DS_Store",
    "*.pem",
    ".env*.local"
)

Write-Host "排除的文件/文件夹:" -ForegroundColor Gray
foreach ($item in $Exclude) {
    Write-Host "  - $item" -ForegroundColor Gray
}
Write-Host ""

try {
    # 使用 Compress-Archive 打包
    Write-Host "正在压缩项目文件..." -ForegroundColor Green
    
    # 获取所有文件，排除不需要的
    $FilesToInclude = Get-ChildItem -Path $ProjectRoot -Force | Where-Object {
        $include = $true
        foreach ($excludeItem in $Exclude) {
            if ($_.Name -like $excludeItem -or $_.FullName -like "*\$excludeItem\*") {
                $include = $false
                break
            }
        }
        $include
    }

    # 压缩
    Compress-Archive -Path $FilesToInclude.FullName -DestinationPath $OutputPath -Force

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "打包完成!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # 显示文件大小
    $FileSize = (Get-Item $OutputPath).Length
    $FileSizeMB = [math]::Round($FileSize / 1MB, 2)
    Write-Host "备份文件: $OutputPath" -ForegroundColor Cyan
    Write-Host "文件大小: $FileSizeMB MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Yellow
    Write-Host "1. 将 $OutputPath 复制到另一台电脑" -ForegroundColor White
    Write-Host "2. 解压到目标位置" -ForegroundColor White
    Write-Host "3. 运行 'npm install' 安装依赖" -ForegroundColor White
    Write-Host "4. 运行 'npm run dev' 启动开发服务器" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "打包失败!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "错误信息: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}
