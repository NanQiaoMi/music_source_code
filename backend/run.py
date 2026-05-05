"""
打包入口文件 - 用于 PyInstaller
启动 FastAPI 后端服务，隐藏控制台窗口
"""
import sys
import os

# 设置环境变量
os.environ["PYINSTALLER_BUILD"] = "1"


def run_server():
    """运行 FastAPI 服务器"""
    import uvicorn
    from core.config import settings

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
        use_colors=False,
    )


if __name__ == "__main__":
    # 修复打包后 sys.stdout/stderr 为 None 导致 uvicorn 崩溃的问题
    # AttributeError: 'NoneType' object has no attribute 'isatty'
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")

    # Windows 下隐藏控制台窗口
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.ShowWindow(
                ctypes.windll.kernel32.GetConsoleWindow(), 0
            )
        except Exception:
            pass

    run_server()
