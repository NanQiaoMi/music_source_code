import sys
import os

print("=" * 60)
print("Python 路径:")
print(sys.executable)
print()
print("sys.path:")
for p in sys.path:
    print(f"  {p}")
print()
print("=" * 60)
print("尝试导入 ModelScope...")

try:
    import modelscope
    print(f"✅ ModelScope 导入成功！版本: {modelscope.__version__}")
    print()
    print("尝试导入 pipeline...")
    from modelscope.pipelines import pipeline
    print("✅ pipeline 导入成功！")
    print()
    print("=" * 60)
    print("所有导入测试通过！")
except Exception as e:
    print(f"❌ 导入失败: {e}")
    import traceback
    traceback.print_exc()
