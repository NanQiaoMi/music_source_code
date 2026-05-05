@echo off
chcp 65001 >nul
echo ========================================
echo MIMI Music Player - 一键打包工具
echo ========================================
echo.

set "PROJECT_DIR=%~dp0.."
set "OUTPUT_DIR=%PROJECT_DIR%\MIMI-Music-Player-Portable"
set "BACKEND_DIR=%PROJECT_DIR%\backend"

echo [1/6] 清理旧的构建产物...
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"
if exist "%PROJECT_DIR%\dist-electron" rmdir /s /q "%PROJECT_DIR%\dist-electron"
if exist "%PROJECT_DIR%\.next" rmdir /s /q "%PROJECT_DIR%\.next"
if exist "%PROJECT_DIR%\out" rmdir /s /q "%PROJECT_DIR%\out"
echo.

echo [2/6] 安装前端依赖...
cd /d "%PROJECT_DIR%"
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo 错误: 前端依赖安装失败
    pause
    exit /b 1
)
echo.

echo [3/6] 构建前端...
call npm run build
if errorlevel 1 (
    echo 错误: 前端构建失败
    pause
    exit /b 1
)
echo.

echo [4/6] 打包 Electron...
call npx electron-builder --win portable
if errorlevel 1 (
    echo 错误: Electron 打包失败
    pause
    exit /b 1
)
echo.

echo [5/6] 打包后端...
pip install -r "%BACKEND_DIR%\requirements-minimal.txt" --quiet
pip install pyinstaller --quiet
cd /d "%BACKEND_DIR%"
pyinstaller build.spec --clean --noconfirm
if errorlevel 1 (
    echo 错误: 后端打包失败
    pause
    exit /b 1
)
echo.

echo [6/6] 组装便携式文件夹...
mkdir "%OUTPUT_DIR%"

REM 复制 Electron 主程序
if exist "%PROJECT_DIR%\dist-electron\MIMI Music Player Portable.exe" (
    copy "%PROJECT_DIR%\dist-electron\MIMI Music Player Portable.exe" "%OUTPUT_DIR%\MIMI Music Player.exe"
) else if exist "%PROJECT_DIR%\dist-electron\MIMI Music Player.exe" (
    copy "%PROJECT_DIR%\dist-electron\MIMI Music Player.exe" "%OUTPUT_DIR%\MIMI Music Player.exe"
) else (
    for %%f in ("%PROJECT_DIR%\dist-electron\*.exe") do (
        copy "%%f" "%OUTPUT_DIR%\MIMI Music Player.exe"
        goto :found_exe
    )
    echo 警告: 未找到 Electron 可执行文件
)
:found_exe

REM 复制后端
copy "%BACKEND_DIR%\dist\backend.exe" "%OUTPUT_DIR%\backend.exe"

REM 复制静态资源
if exist "%PROJECT_DIR%\public" xcopy "%PROJECT_DIR%\public" "%OUTPUT_DIR%\public\" /e /i /q

REM 创建启动脚本
(
echo @echo off
echo chcp 65001 ^>nul
echo echo 正在启动 MIMI Music Player...
echo cd /d "%%~dp0"
echo start "" "MIMI Music Player.exe"
) > "%OUTPUT_DIR%\启动.bat"

echo.
echo ========================================
echo 打包完成!
echo ========================================
echo.
echo 输出目录: %OUTPUT_DIR%
echo.
echo 文件夹内容:
dir /b "%OUTPUT_DIR%"
echo.
echo 请将 MIMI-Music-Player-Portable 文件夹打包分发即可
echo 目标用户只需解压后双击"启动.bat"即可使用
echo.
pause
