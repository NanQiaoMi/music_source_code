# ModelScope 模型下载教程

本教程将指导您如何从 ModelScope（魔搭社区）下载模型并放置到项目中使用。

## 前置要求

- Python 3.7 或更高版本
- pip 包管理器

## 第一步：安装 ModelScope SDK

在终端中执行以下命令安装 ModelScope SDK：

```bash
pip install modelscope
```

如果您在中国境内，可以使用国内镜像源加速安装：

```bash
pip install modelscope -i https://pypi.tuna.tsinghua.edu.cn/simple
```

## 第二步：验证安装

安装完成后，验证 SDK 是否安装成功：

```bash
python -c "import modelscope; print(modelscope.__version__)"
```

如果输出版本号，说明安装成功。

## 第三步：下载模型

### 方式一：使用命令行下载（推荐）

进入项目目录，然后执行下载命令：

```bash
# 进入项目目录
cd d:\26project\music

# 创建模型目录（如果不存在）
mkdir -p public/models
```

#### 下载 Whisper Tiny 语音识别模型

```bash
modelscope download --model openai-mirror/whisper-tiny --local_dir public/models/whisper-tiny
```

#### 下载 Whisper Base 语音识别模型

```bash
modelscope download --model openai-mirror/whisper-base --local_dir public/models/whisper-base
```

#### 下载 Paraformer 中文语音识别模型

```bash
modelscope download --model iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch --local_dir public/models/paraformer-zh
```

#### 下载 OPUS-MT 中英翻译模型

```bash
modelscope download --model Helsinki-NLP/opus-mt-zh-en --local_dir public/models/opus-mt-zh-en
```

#### 下载 OPUS-MT 英中翻译模型

```bash
modelscope download --model Helsinki-NLP/opus-mt-en-zh --local_dir public/models/opus-mt-en-zh
```

#### 下载 NLLB-200 多语言翻译模型

```bash
modelscope download --model facebook/nllb-200-distilled-600M --local_dir public/models/nllb-200
```

#### 下载 BERT 中文模型

```bash
modelscope download --model iic/nlp_structbert_sentiment-classification_chinese-base --local_dir public/models/bert-chinese
```

#### 下载 Wav2Vec 2.0 模型

```bash
modelscope download --model BiaoFuXMU/wav2vec-S-Large-ft-960h --local_dir public/models/wav2vec2-base
```

#### 下载 HuBERT Base 模型

```bash
modelscope download --model pengzhendong/chinese-hubert-base --local_dir public/models/hubert-base
```

#### 下载 SamBERT 中文语音合成模型

```bash
modelscope download --model iic/speech_personal_sambert-hifigan_nsf_tts_zh-cn_pretrain_16k --local_dir public/models/sambert-zh
```

#### 下载 ViT Base 视觉模型

```bash
modelscope download --model iic/cv_vit-base_image-classification_ImageNet-labels --local_dir public/models/vit-base
```

#### 下载 CLIP ViT 视觉语言模型

```bash
modelscope download --model iic/multi-modal_clip-vit-base-patch16_zh --local_dir public/models/clip-vit
```

### 方式二：使用 Python 脚本下载

创建一个 Python 脚本 `download_models.py`：

```python
from modelscope import snapshot_download
import os

# 项目根目录
PROJECT_DIR = r"d:\26project\music"
MODELS_DIR = os.path.join(PROJECT_DIR, "public", "models")

# 确保模型目录存在
os.makedirs(MODELS_DIR, exist_ok=True)

# 要下载的模型列表
models_to_download = [
    {
        "model_id": "damo/speech_whisper-tiny_asr",
        "local_path": "whisper-tiny",
        "name": "Whisper Tiny 语音识别"
    },
    {
        "model_id": "damo/speech_whisper-base_asr",
        "local_path": "whisper-base",
        "name": "Whisper Base 语音识别"
    },
    {
        "model_id": "damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        "local_path": "paraformer-zh",
        "name": "Paraformer 中文语音识别"
    },
    {
        "model_id": "iic/translation_opus-mt-en-zh",
        "local_path": "opus-mt-en-zh",
        "name": "OPUS-MT 英中翻译"
    },
    {
        "model_id": "iic/translation_opus-mt-zh-en",
        "local_path": "opus-mt-zh-en",
        "name": "OPUS-MT 中英翻译"
    },
    {
        "model_id": "iic/translation_nllb-200-distilled-600M",
        "local_path": "nllb-200",
        "name": "NLLB-200 多语言翻译"
    },
]

# 下载所有模型
for model_info in models_to_download:
    print(f"\n正在下载: {model_info['name']}")
    print(f"模型 ID: {model_info['model_id']}")
    
    local_dir = os.path.join(MODELS_DIR, model_info['local_path'])
    
    try:
        model_dir = snapshot_download(
            model_info['model_id'],
            local_dir=local_dir,
            local_dir_use_symlinks=False
        )
        print(f"✓ 下载完成: {model_dir}")
    except Exception as e:
        print(f"✗ 下载失败: {e}")

print("\n所有模型下载完成！")
```

然后运行脚本：

```bash
python download_models.py
```

## 第四步：验证模型文件

下载完成后，检查模型目录结构：

```bash
# 查看模型目录
dir public\models

# 查看特定模型的文件
dir public\models\whisper-tiny
```

确保每个模型目录下都有必要的文件，例如：
- `config.json`
- `model.onnx` 或 `model.pt`
- `tokenizer.json`（如适用）
- 其他必要的配置文件

## 第五步：在应用中使用模型

1. 启动应用：

```bash
npm run dev
```

2. 打开应用，进入 AI 设置面板
3. 您会看到已下载的模型显示为可用状态
4. 点击"加载"按钮加载模型

## 常见问题

### Q: 下载速度很慢怎么办？

A: ModelScope 在中国境内速度很快，如果仍然很慢，可以：
- 检查网络连接
- 尝试使用代理或 VPN
- 使用 Python 脚本方式下载，可以断点续传

### Q: 下载中断了怎么办？

A: 使用 Python 脚本的 `snapshot_download` 函数支持断点续传，重新运行脚本即可继续下载。

### Q: 模型文件太大怎么办？

A: 您可以选择性地下载需要的模型，不必下载所有模型。推荐先下载以下核心模型：
- Whisper Tiny（语音识别，150MB）
- OPUS-MT 英中/中英翻译（各 280MB）
- BERT 中文（412MB）

### Q: 如何更新模型？

A: 删除旧的模型目录，然后重新运行下载命令即可。

### Q: 可以使用其他来源的模型吗？

A: 可以！只要模型文件结构兼容，您可以将任何来源的模型放置到 `public/models/[model-name]/` 目录下。

## 更多资源

- ModelScope 官方文档: https://modelscope.cn/docs
- ModelScope 模型库: https://modelscope.cn/models
- 项目 AI 设置面板中也有简化的下载指南

## 技术支持

如果遇到问题，请检查：
1. Python 版本是否 >= 3.7
2. ModelScope SDK 是否正确安装
3. 网络连接是否正常
4. 磁盘空间是否充足（建议至少 10GB 可用空间）

祝您使用愉快！
