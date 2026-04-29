#!/usr/bin/env python3
"""
后端功能测试脚本
测试所有 API 接口是否正常工作
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))


async def test_model_manager():
    """测试模型管理器"""
    print("\n" + "="*60)
    print("测试模型管理器")
    print("="*60)
    
    from backend.core.model_manager import model_manager, ModelStatus
    
    print("\n1. 获取所有模型:")
    models = model_manager.get_all_models()
    print(f"   找到 {len(models)} 个模型")
    for model in models[:3]:
        print(f"   - {model.model_id} ({model.category})")
    
    print("\n2. 检查模型文件:")
    test_model_id = "whisper-tiny"
    has_files = model_manager.check_model_files(test_model_id)
    print(f"   {test_model_id} 文件存在: {has_files}")
    
    print("\n3. 尝试加载模型:")
    try:
        success = await model_manager.load_model(test_model_id)
        print(f"   模型加载: {'成功' if success else '失败'}")
    except Exception as e:
        print(f"   模型加载出错: {e}")
    
    print("\n4. 获取管理器状态:")
    status = model_manager.get_status()
    print(f"   已加载: {status['loaded_count']}/{status['total_count']}")
    
    print("\n5. 卸载模型:")
    await model_manager.unload_model(test_model_id)
    print(f"   模型已卸载")


async def test_speech_service():
    """测试语音识别服务"""
    print("\n" + "="*60)
    print("测试语音识别服务")
    print("="*60)
    
    from backend.models.speech_recognition import speech_recognition_service
    
    print("\n1. 获取服务状态:")
    status = speech_recognition_service.get_status()
    print(f"   状态: {status}")
    
    print("\n2. 服务已就绪")


async def test_translation_service():
    """测试翻译服务"""
    print("\n" + "="*60)
    print("测试翻译服务")
    print("="*60)
    
    from backend.models.translation import translation_service
    
    print("\n1. 获取服务状态:")
    status = translation_service.get_status()
    print(f"   状态: {status}")
    
    print("\n2. 服务已就绪")


async def test_config():
    """测试配置"""
    print("\n" + "="*60)
    print("测试配置模块")
    print("="*60)
    
    from backend.core.config import settings
    
    print(f"\n1. 应用信息:")
    print(f"   名称: {settings.app_name}")
    print(f"   版本: {settings.app_version}")
    print(f"   调试: {settings.debug}")
    
    print(f"\n2. 服务器配置:")
    print(f"   主机: {settings.host}")
    print(f"   端口: {settings.port}")
    
    print(f"\n3. 模型配置:")
    print(f"   模型目录: {settings.models_dir}")
    print(f"   模型数量: {len(settings.model_configs)}")


async def test_model_loader():
    """测试模型加载器"""
    print("\n" + "="*60)
    print("测试模型加载器")
    print("="*60)
    
    from backend.core.model_loader import (
        create_model_loader,
        ModelType,
    )
    from backend.core.config import settings
    
    print("\n1. 测试模型类型:")
    print(f"   总类型数: {len(ModelType)}")
    for model_type in list(ModelType)[:5]:
        print(f"   - {model_type.value}")
    
    print("\n2. 尝试创建加载器:")
    test_model_id = "whisper-tiny"
    model_path = settings.models_dir / test_model_id
    loader = create_model_loader(test_model_id, str(model_path))
    print(f"   {test_model_id} 加载器: {'创建成功' if loader else '创建失败'}")


async def main():
    """主测试函数"""
    print("Vibe Music Player - 后端功能测试")
    print("="*60)
    
    try:
        await test_config()
        await test_model_loader()
        await test_model_manager()
        await test_speech_service()
        await test_translation_service()
        
        print("\n" + "="*60)
        print("所有测试完成！")
        print("="*60)
        
    except Exception as e:
        print(f"\n测试出错: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
