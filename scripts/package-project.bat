@echo off
chcp 65001 >nul
echo ========================================
echo Vibe Music Player 项目打包工具
echo ========================================
echo.

set "PROJECT_DIR=%~dp0.."
set "OUTPUT_FILE=%PROJECT_DIR%\..\vibe-music-player-backup.zip"

echo 项目根目录: %PROJECT_DIR%
echo 输出文件: %OUTPUT_FILE%
echo.

if exist "%OUTPUT_FILE%" (
    echo 删除旧的备份文件...
    del /f /q "%OUTPUT_FILE%"
)

echo 开始打包项目...
echo.

echo 排除的文件/文件夹:
echo   - node_modules
echo   - .next
echo   - dist-electron
echo   - .venv
echo   - .git
echo   - *.log
echo   - *.tsbuildinfo
echo.

cd /d "%PROJECT_DIR%"

echo 正在压缩项目文件...
echo.

powershell -Command "& {Compress-Archive -Path @('src','electron','public','scripts','docs','package.json','package-lock.json','tsconfig.json','tailwind.config.ts','next.config.js','.eslintrc.json','.prettierrc','.gitignore','README.md','PROJECT_DOCUMENTATION.md','PROJECT_MIGRATION_GUIDE.md') -DestinationPath '%OUTPUT_FILE%' -Force}"

if exist "%OUTPUT_FILE%" (
    echo.
    echo ========================================
    echo 打包完成!
    echo ========================================
    echo.
    
    for %%F in ("%OUTPUT_FILE%") do set "SIZE=%%~zF"
    set /a SIZE_MB=%SIZE%/1048576
    echo 备份文件: %OUTPUT_FILE%
    echo 文件大小: %SIZE_MB% MB
    echo.
    echo 下一步:
    echo 1. 将 %OUTPUT_FILE% 复制到另一台电脑
    echo 2. 解压到目标位置
    echo 3. 运行 'npm install' 安装依赖
    echo 4. 运行 'npm run dev' 启动开发服务器
    echo.
) else (
    echo.
    echo ========================================
    echo 打包失败!
    echo ========================================
    echo.
    pause
)

echo.
pause
