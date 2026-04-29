@echo off
REM Vibe Music Player - 完整启动脚本
REM 同时启动后端和前端

echo ========================================
echo Vibe Music Player - 完整启动
echo ========================================
echo.

echo [1/4] 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python
    pause
    exit /b 1
)
echo Python 环境检查通过
echo.

echo [2/4] 清理端口...
call npm run clean:port
echo.

echo [3/4] 启动后端服务...
start "Vibe Music Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --port 8000"
timeout /t 3 /nobreak >nul
echo 后端服务已启动在 http://localhost:8000
echo.

echo [4/4] 启动前端服务...
echo 前端服务将启动在 http://localhost:3025
echo.
echo ========================================
echo 服务启动完成！
echo ========================================
echo.
echo 后端 API 文档: http://localhost:8000/docs
echo 前端应用: http://localhost:3025
echo.
echo 按任意键启动前端...
pause >nul
call npm run dev
