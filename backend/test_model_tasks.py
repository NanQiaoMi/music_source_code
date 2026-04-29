#!/usr/bin/env python3
"""测试模型的正确任务名称"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

def test_tasks():
    """测试任务名称"""
    try:
        from modelscope.pipelines import pipeline
        from modelscope.utils.constant import Tasks
        
        print("✅ ModelScope 可用")
        print(f"\n可用的任务:")
        for task in dir(Tasks):
            if not task.startswith('_'):
                print(f"  - {task}")
        
        print("\n\n让我们尝试加载一些模型来确认任务名称:")
        
        # 测试 Whisper
        print("\n1. 测试 Whisper 任务...")
        try:
            # 检查自动语音识别任务名称
            test_tasks = ['automatic-speech-recognition', 'auto-speech-recognition', 'asr']
            for task in test_tasks:
                try:
                    p = pipeline(task=task, model='damo/speech_whisper-tiny-en_asr', model_revision='v1.0.4')
                    print(f"   ✅ Whisper 使用任务 '{task}' 成功!")
                    break
                except Exception as e:
                    print(f"   ❌ '{task}' 失败: {type(e).__name__}")
        except Exception as e:
            print(f"   ❌ Whisper 测试失败: {e}")
        
        # 测试翻译
        print("\n2. 测试翻译任务...")
        try:
            test_tasks = ['translation', 'text-to-text-generation', 'text-generation']
            for task in test_tasks:
                try:
                    p = pipeline(task=task, model='damo/nlp_csanmt_translation_en2zh')
                    print(f"   ✅ 翻译使用任务 '{task}' 成功!")
                    break
                except Exception as e:
                    print(f"   ❌ '{task}' 失败: {type(e).__name__}")
        except Exception as e:
            print(f"   ❌ 翻译测试失败: {e}")
        
        # 测试 CLIP
        print("\n3. 测试 CLIP 任务...")
        try:
            test_tasks = ['multi-modal-embedding', 'feature-extraction', 'image-text-embedding']
            for task in test_tasks:
                try:
                    p = pipeline(task=task, model='damo/multi-modal_clip-vit-base-patch16_zh')
                    print(f"   ✅ CLIP 使用任务 '{task}' 成功!")
                    break
                except Exception as e:
                    print(f"   ❌ '{task}' 失败: {type(e).__name__}")
        except Exception as e:
            print(f"   ❌ CLIP 测试失败: {e}")
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_tasks()
