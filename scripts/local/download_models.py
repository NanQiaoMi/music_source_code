#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ModelScope 模型批量下载脚本
用于下载 Vibe Music Player 所需的 AI 模型
"""

from modelscope import snapshot_download
import os
import sys

# 项目根目录（自动检测）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = SCRIPT_DIR
MODELS_DIR = os.path.join(PROJECT_DIR, "public", "models")

# 要下载的模型完整列表
ALL_MODELS = [
    {
        "model_id": "openai-mirror/whisper-tiny",
        "local_path": "whisper-tiny",
        "name": "Whisper Tiny 语音识别",
        "size": "150 MB",
        "category": "lyrics"
    },
    {
        "model_id": "openai-mirror/whisper-base",
        "local_path": "whisper-base",
        "name": "Whisper Base 语音识别",
        "size": "290 MB",
        "category": "lyrics"
    },
    {
        "model_id": "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        "local_path": "paraformer-zh",
        "name": "Paraformer 中文语音识别",
        "size": "1.2 GB",
        "category": "lyrics"
    },
    {
        "model_id": "Helsinki-NLP/opus-mt-zh-en",
        "local_path": "opus-mt-zh-en",
        "name": "OPUS-MT 中英翻译",
        "size": "280 MB",
        "category": "lyrics"
    },
    {
        "model_id": "Helsinki-NLP/opus-mt-en-zh",
        "local_path": "opus-mt-en-zh",
        "name": "OPUS-MT 英中翻译",
        "size": "280 MB",
        "category": "lyrics"
    },
    {
        "model_id": "facebook/nllb-200-distilled-600M",
        "local_path": "nllb-200",
        "name": "NLLB-200 多语言翻译",
        "size": "1.1 GB",
        "category": "lyrics"
    },
    {
        "model_id": "iic/nlp_structbert_sentiment-classification_chinese-base",
        "local_path": "bert-chinese",
        "name": "BERT 中文",
        "size": "412 MB",
        "category": "nlp"
    },
    {
        "model_id": "BiaoFuXMU/wav2vec-S-Large-ft-960h",
        "local_path": "wav2vec2-base",
        "name": "Wav2Vec 2.0",
        "size": "390 MB",
        "category": "audio"
    },
    {
        "model_id": "pengzhendong/chinese-hubert-base",
        "local_path": "hubert-base",
        "name": "HuBERT Base",
        "size": "380 MB",
        "category": "audio"
    },
    {
        "model_id": "iic/speech_personal_sambert-hifigan_nsf_tts_zh-cn_pretrain_16k",
        "local_path": "sambert-zh",
        "name": "SamBERT 中文语音合成",
        "size": "800 MB",
        "category": "audio"
    },
    {
        "model_id": "iic/cv_vit-base_image-classification_ImageNet-labels",
        "local_path": "vit-base",
        "name": "ViT Base",
        "size": "346 MB",
        "category": "recommendation"
    },
    {
        "model_id": "iic/multi-modal_clip-vit-base-patch16_zh",
        "local_path": "clip-vit",
        "name": "CLIP ViT",
        "size": "657 MB",
        "category": "recommendation"
    },
]

# 推荐的核心模型（较小，适合初次使用）
RECOMMENDED_MODELS = [
    {
        "model_id": "openai-mirror/whisper-tiny",
        "local_path": "whisper-tiny",
        "name": "Whisper Tiny 语音识别",
        "size": "150 MB",
        "category": "lyrics"
    },
    {
        "model_id": "Helsinki-NLP/opus-mt-en-zh",
        "local_path": "opus-mt-en-zh",
        "name": "OPUS-MT 英中翻译",
        "size": "280 MB",
        "category": "lyrics"
    },
    {
        "model_id": "Helsinki-NLP/opus-mt-zh-en",
        "local_path": "opus-mt-zh-en",
        "name": "OPUS-MT 中英翻译",
        "size": "280 MB",
        "category": "lyrics"
    },
]

def print_header():
    """打印标题"""
    print("=" * 70)
    print("🎵 Vibe Music Player - ModelScope 模型下载工具")
    print("=" * 70)
    print()

def print_menu():
    """打印菜单"""
    print("请选择下载模式：")
    print("  1. 下载推荐的核心模型（约 710 MB）")
    print("  2. 下载所有模型（约 6.5 GB）")
    print("  3. 显示模型列表并选择")
    print("  0. 退出")
    print()

def print_model_list(models):
    """打印模型列表"""
    print("\n可用模型列表：")
    print("-" * 70)
    for i, model in enumerate(models, 1):
        category_emoji = {
            "lyrics": "🎤",
            "audio": "🎵",
            "nlp": "📝",
            "recommendation": "🎯"
        }.get(model["category"], "📦")
        print(f"  {i:2d}. {category_emoji} {model['name']}")
        print(f"      模型ID: {model['model_id']}")
        print(f"      大小: {model['size']}")
    print("-" * 70)

def download_model(model_info):
    """下载单个模型"""
    print(f"\n📥 正在下载: {model_info['name']}")
    print(f"   模型ID: {model_info['model_id']}")
    print(f"   目标路径: {model_info['local_path']}")
    
    local_dir = os.path.join(MODELS_DIR, model_info['local_path'])
    
    try:
        model_dir = snapshot_download(
            model_info['model_id'],
            local_dir=local_dir,
            local_dir_use_symlinks=False
        )
        print(f"✅ 下载完成: {model_dir}")
        return True
    except Exception as e:
        print(f"❌ 下载失败: {e}")
        return False

def download_models(models):
    """下载多个模型"""
    # 确保模型目录存在
    os.makedirs(MODELS_DIR, exist_ok=True)
    print(f"📁 模型目录: {MODELS_DIR}")
    
    success_count = 0
    failed_models = []
    
    for model_info in models:
        if download_model(model_info):
            success_count += 1
        else:
            failed_models.append(model_info)
    
    # 打印总结
    print("\n" + "=" * 70)
    print(f"下载完成！成功: {success_count}/{len(models)}")
    
    if failed_models:
        print("\n以下模型下载失败：")
        for model in failed_models:
            print(f"  - {model['name']}")
    
    print("=" * 70)
    return success_count == len(models)

def main():
    """主函数"""
    print_header()
    
    # 检查 ModelScope SDK 是否已安装
    try:
        import modelscope
        print(f"✅ ModelScope SDK 已安装 (版本: {modelscope.__version__})")
    except ImportError:
        print("❌ ModelScope SDK 未安装！")
        print("\n请先运行以下命令安装：")
        print("  pip install modelscope")
        print("\n或者使用国内镜像：")
        print("  pip install modelscope -i https://pypi.tuna.tsinghua.edu.cn/simple")
        return 1
    
    print()
    
    while True:
        print_menu()
        choice = input("请输入选项 (0-3): ").strip()
        
        if choice == "0":
            print("\n👋 再见！")
            break
        
        elif choice == "1":
            print("\n🎯 下载推荐的核心模型...")
            print_model_list(RECOMMENDED_MODELS)
            confirm = input("\n确认下载？(y/n): ").strip().lower()
            if confirm == "y":
                download_models(RECOMMENDED_MODELS)
            break
        
        elif choice == "2":
            print("\n📦 下载所有模型...")
            print_model_list(ALL_MODELS)
            total_size = sum(float(m["size"].split()[0]) for m in ALL_MODELS)
            print(f"\n总大小约: {total_size:.1f} GB")
            confirm = input("\n确认下载？(y/n): ").strip().lower()
            if confirm == "y":
                download_models(ALL_MODELS)
            break
        
        elif choice == "3":
            print("\n📋 选择要下载的模型...")
            print_model_list(ALL_MODELS)
            print("\n请输入要下载的模型编号（多个用逗号分隔，例如: 1,3,5）")
            selection = input("输入: ").strip()
            
            try:
                indices = [int(x.strip()) - 1 for x in selection.split(",") if x.strip()]
                selected_models = [ALL_MODELS[i] for i in indices if 0 <= i < len(ALL_MODELS)]
                
                if selected_models:
                    print(f"\n已选择 {len(selected_models)} 个模型：")
                    for model in selected_models:
                        print(f"  - {model['name']}")
                    
                    confirm = input("\n确认下载？(y/n): ").strip().lower()
                    if confirm == "y":
                        download_models(selected_models)
                else:
                    print("❌ 没有选择有效的模型")
            except ValueError:
                print("❌ 输入格式错误，请输入数字编号")
        
        else:
            print("❌ 无效选项，请重新输入")
        
        print()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
