@echo off
echo ========================================
echo   Vibe Music Player Backend
echo   启动后端服务
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] 检查虚拟环境...
if not exist "venv" (
    echo 创建虚拟环境...
    python -m venv venv
)

echo.
echo [2/3] 激活虚拟环境...
call venv\Scripts\activate.bat

echo.
echo [3/3] 安装依赖...
pip install -r requirements.txt

echo.
echo ========================================
echo   启动后端服务器...
echo   访问地址: http://localhost:8000
echo   API 文档: http://localhost:8000/docs
echo ========================================
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
