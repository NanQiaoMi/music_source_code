#!/usr/bin/env python3
"""
后端依赖安装脚本
自动安装所有必需的 Python 依赖
"""
import subprocess
import sys
import os


def run_command(cmd, description):
    """运行命令并显示进度"""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")
    try:
        subprocess.check_call(cmd, shell=True)
        print(f"✅ {description} 完成")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} 失败: {e}")
        return False


def main():
    print("Vibe Music Player - 后端依赖安装")
    print("="*60)
    
    # 检查 pip
    print("\n[1/3] 检查 pip...")
    try:
        subprocess.check_output([sys.executable, "-m", "pip", "--version"], 
                               stderr=subprocess.STDOUT)
        print("✅ pip 检查通过")
    except Exception as e:
        print(f"❌ pip 检查失败: {e}")
        print("\n请先确保 Python 和 pip 已正确安装")
        return 1
    
    # 升级 pip
    if not run_command(
        f'"{sys.executable}" -m pip install --upgrade pip',
        "升级 pip"
    ):
        print("\n警告: pip 升级失败，但继续安装依赖")
    
    # 安装基础依赖
    requirements = [
        "fastapi>=0.109.0",
        "uvicorn[standard]>=0.27.0",
        "python-multipart>=0.0.6",
    ]
    
    print("\n[2/3] 安装基础依赖...")
    for req in requirements:
        print(f"  安装 {req}...")
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", req],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT
            )
            print(f"  ✅ {req}")
        except subprocess.CalledProcessError:
            print(f"  ⚠️ {req} 安装失败，继续...")
    
    # 创建 requirements.txt（如果不存在）
    req_file = os.path.join(os.path.dirname(__file__), "requirements.txt")
    if not os.path.exists(req_file):
        print(f"\n[3/3] 创建 requirements.txt...")
        with open(req_file, "w", encoding="utf-8") as f:
            f.write("""# Vibe Music Player Backend Dependencies
# FastAPI Web Framework
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
python-multipart>=0.0.6

# AI & ML (可选，用于真实模型集成)
# torch>=2.1.0
# transformers>=4.36.0
# modelscope>=1.14.0
# librosa>=0.10.0
# soundfile>=0.12.0
# numpy>=1.24.0
# pillow>=10.0.0
""")
        print("✅ requirements.txt 已创建")
    
    print("\n" + "="*60)
    print("后端依赖安装完成！")
    print("="*60)
    print("\n现在可以运行:")
    print("  cd backend")
    print("  python -m uvicorn main:app --reload --port 8000")
    print("\n或运行完整启动:")
    print("  npm run dev:full")
    print()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
