@echo off
chcp 65001 >nul
echo ========================================
echo MIMI Music Player - 后端打包工具
echo ========================================
echo.

set "PROJECT_DIR=%~dp0.."
set "BACKEND_DIR=%PROJECT_DIR%\backend"

echo [1/4] 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)
echo Python 环境检查通过
echo.

echo [2/4] 安装精简版依赖...
pip install -r "%BACKEND_DIR%\requirements-minimal.txt" --quiet
if errorlevel 1 (
    echo 警告: 部分依赖安装失败，继续...
)
echo.

echo [3/4] 安装 PyInstaller...
pip install pyinstaller --quiet
if errorlevel 1 (
    echo 错误: PyInstaller 安装失败
    pause
    exit /b 1
)
echo.

echo [4/4] 打包后端...
cd /d "%BACKEND_DIR%"
pyinstaller build.spec --clean --noconfirm
if errorlevel 1 (
    echo 错误: 打包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo 后端打包完成!
echo 输出: %BACKEND_DIR%\dist\backend.exe
echo ========================================
echo.
pause
