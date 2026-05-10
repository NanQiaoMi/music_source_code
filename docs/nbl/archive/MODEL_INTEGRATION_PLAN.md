# V6.0 AI 模型深度整合开发计划

**文档版本**: v2.0
**创建时间**: 2026-03-28
**更新时间**: 2026-03-28
**状态**: 📋 已审核 - 准备实施

---

## 🎯 项目目标

完全重写 AI 功能，使用 **ModelScope（阿里）** 作为后端 AI 框架，用户手动下载模型到 `public/models` 目录，前端通过 **FastAPI RESTful API** 调用，实现 12 个模型的完整功能。

---

## 🛠️ 技术栈选型（已确认）

### 后端技术栈
| 组件 | 技术选型 | 说明 |
|------|----------|------|
| Web 框架 | FastAPI + Uvicorn | 已有的后端框架，保持不变 |
| AI 框架 | ModelScope | 阿里的国内 AI 平台，下载更快，中文模型优化好 |
| 模型加载 | 预加载所有 12 个模型 | 服务启动时一次性加载全部模型 |
| API 风格 | RESTful API | 前端通过 HTTP 请求调用 |
| 错误处理 | HTTP 状态码 + 统一 JSON | 两者结合 |
| 文件上传限制 | 音频 100MB，图像 20MB | 宽松限制 |
| 日志级别 | 详细日志（DEBUG/INFO/WARN/ERROR） | 详细记录所有事件 |

### 前端技术栈
| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 框架 | Next.js 14.1.4 | 已有的前端框架 |
| UI 风格 | Glassmorphism（玻璃拟态） | 延续现有风格，半透明+渐变 |
| 状态管理 | Zustand | 已有的状态管理 |
| API 客户端 | Fetch API | 直接调用后端 FastAPI |
| 重试机制 | 单独重试 + 全局重试 | 两者都支持 |
| 启动反馈 | 每个模型详细加载状态 | 逐个显示 |
| CORS | 开发环境允许跨域 | 生产环境 Nginx 反向代理 |

---

## 🤖 12 个模型功能映射（推荐 ModelScope 模型）

| 序号 | 模型 ID | 推荐 ModelScope 模型 | 功能分类 | 具体功能 |
|------|---------|---------------------|---------|---------|
| 1 | whisper-tiny | `damo/speech_whisper-tiny-en_asr` | 语音识别 | 通用语音识别（小体积，快速） |
| 2 | whisper-base | `damo/speech_whisper-base-en_asr` | 语音识别 | 通用语音识别（标准体积，更准确） |
| 3 | paraformer-zh | `damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch` | 语音识别 | 专门针对中文优化的语音识别 |
| 4 | opus-mt-en-zh | `damo/nlp_csanmt_translation_en2zh` | 翻译 | 英语 → 中文翻译 |
| 5 | opus-mt-zh-en | `damo/nlp_csanmt_translation_zh2en` | 翻译 | 中文 → 英语翻译 |
| 6 | nllb-200 | `damo/nlp_m2m_meta-nllb-200-distilled-600m_translation` | 翻译 | 200+ 语言多语言翻译 |
| 7 | bert-chinese | `damo/nlp_structbert_sentiment-analysis_chinese-large` | 文本理解 | 中文文本分类、情感分析 |
| 8 | wav2vec2-base | `damo/speech_wav2vec2-base-960h_asr` | 音频处理 | 音频特征提取、音乐分类 |
| 9 | hubert-base | `damo/speech_hubert-large_asr` | 音频处理 | 音频特征提取、语音表示 |
| 10 | sambert-zh | `damo/speech_sambert-hifigan_tts_zh-cn_16k` | 语音合成 | 中文文本转语音 |
| 11 | vit-base | `damo/cv_vit-base_image-classification_ImageNet1k` | 视觉 | 专辑封面图像分类 |
| 12 | clip-vit | `damo/multi-modal_clip-vit-base-patch16_zh` | 视觉 | 图像-文本匹配、图文检索 |

---

## 📁 项目目录结构

```
d:\26project\music\
├── backend\                          # 后端 FastAPI
│   ├── api\                          # API 路由
│   │   ├── __init__.py
│   │   ├── health.py                # 健康检查
│   │   ├── models.py                # 模型管理 API
│   │   ├── speech.py                # 语音识别 API
│   │   ├── translation.py           # 翻译 API
│   │   ├── text.py                  # 文本理解 API（新增）
│   │   ├── audio.py                 # 音频处理 API（新增）
│   │   ├── tts.py                   # 语音合成 API（新增）
│   │   └── vision.py                # 视觉处理 API（新增）
│   ├── core\                         # 核心模块
│   │   ├── __init__.py
│   │   ├── config.py                # 配置（更新）
│   │   ├── model_manager.py         # 模型管理器（重构）
│   │   └── model_loader.py          # 模型加载器（重构）
│   ├── models\                       # AI 模型服务
│   │   ├── __init__.py
│   │   ├── speech_recognition.py     # 语音识别服务（重构）
│   │   ├── translation.py           # 翻译服务（重构）
│   │   ├── text_understanding.py    # 文本理解服务（新增）
│   │   ├── audio_processing.py      # 音频处理服务（新增）
│   │   ├── speech_synthesis.py      # 语音合成服务（新增）
│   │   └── vision_processing.py     # 视觉处理服务（新增）
│   ├── main.py                       # FastAPI 主文件
│   └── requirements.txt              # Python 依赖（更新）
│
├── src\
│   ├── components\                   # 前端组件（完全重写）
│   │   ├── AIModelDashboard.tsx      # AI 模型总控面板（新增）
│   │   ├── SpeechRecognitionPanel.tsx # 语音识别面板（重写）
│   │   ├── TranslationPanel.tsx      # 翻译面板（重写）
│   │   ├── TextUnderstandingPanel.tsx # 文本理解面板（新增）
│   │   ├── AudioProcessingPanel.tsx   # 音频处理面板（新增）
│   │   ├── SpeechSynthesisPanel.tsx   # 语音合成面板（新增）
│   │   └── VisionProcessingPanel.tsx  # 视觉处理面板（新增）
│   ├── ai\
│   │   └── core\
│   │       └── apiClient.ts          # API 客户端（更新）
│   └── app\
│       └── ai\
│           └── page.tsx              # AI 功能页面（重写）
│
├── public\
│   └── models\                       # 用户手动放置的模型文件
│       ├── whisper-tiny\
│       ├── whisper-base\
│       ├── paraformer-zh\
│       ├── opus-mt-en-zh\
│       ├── opus-mt-zh-en\
│       ├── nllb-200\
│       ├── bert-chinese\
│       ├── wav2vec2-base\
│       ├── hubert-base\
│       ├── sambert-zh\
│       ├── vit-base\
│       └── clip-vit\
│
└── docs\
    └── MODEL_DOWNLOAD_GUIDE.md       # 模型下载指南（更新）
```

---

## 🔧 后端实现详解

### 1. 依赖更新 (`backend/requirements.txt`)

```txt
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
python-multipart>=0.0.6
modelscope>=1.12.0
torch>=2.0.0
transformers>=4.35.0
numpy>=1.24.0
pillow>=10.0.0
soundfile>=0.12.0
librosa>=0.10.0
pydub>=0.25.0
```

### 2. 配置模块 (`backend/core/config.py`)

```python
class Settings:
    app_name: str = "Vibe Music Player Backend"
    app_version: str = "2.0.0"
    
    # 模型目录
    models_dir: Path = Path(__file__).parent.parent.parent / "public" / "models"
    
    # 文件上传限制
    max_audio_size_mb: int = 100
    max_image_size_mb: int = 20
    
    # 支持的音频格式
    supported_audio_formats: list = [".wav", ".mp3", ".webm", ".ogg", ".flac"]
    
    # TTS 输出配置
    tts_format: str = "mp3"
    tts_bitrate: str = "128k"
    
    # 12 个模型完整配置
    model_configs: dict = {
        "whisper-tiny": {
            "model_id": "damo/speech_whisper-tiny-en_asr",
            "task": "auto-speech-recognition",
            "category": "speech",
            "display_name": "Whisper Tiny",
            "description": "通用语音识别（小体积，快速）",
        },
        "whisper-base": {
            "model_id": "damo/speech_whisper-base-en_asr",
            "task": "auto-speech-recognition",
            "category": "speech",
            "display_name": "Whisper Base",
            "description": "通用语音识别（标准体积，更准确）",
        },
        "paraformer-zh": {
            "model_id": "damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
            "task": "auto-speech-recognition",
            "category": "speech",
            "display_name": "Paraformer",
            "description": "专门针对中文优化的语音识别",
        },
        "opus-mt-en-zh": {
            "model_id": "damo/nlp_csanmt_translation_en2zh",
            "task": "translation",
            "category": "translation",
            "display_name": "OPUS-MT en-zh",
            "description": "英语 → 中文翻译",
        },
        "opus-mt-zh-en": {
            "model_id": "damo/nlp_csanmt_translation_zh2en",
            "task": "translation",
            "category": "translation",
            "display_name": "OPUS-MT zh-en",
            "description": "中文 → 英语翻译",
        },
        "nllb-200": {
            "model_id": "damo/nlp_m2m_meta-nllb-200-distilled-600m_translation",
            "task": "translation",
            "category": "translation",
            "display_name": "NLLB-200",
            "description": "200+ 语言多语言翻译",
        },
        "bert-chinese": {
            "model_id": "damo/nlp_structbert_sentiment-analysis_chinese-large",
            "task": "text-classification",
            "category": "text",
            "display_name": "BERT Chinese",
            "description": "中文文本分类、情感分析",
        },
        "wav2vec2-base": {
            "model_id": "damo/speech_wav2vec2-base-960h_asr",
            "task": "auto-speech-recognition",
            "category": "audio",
            "display_name": "Wav2Vec 2.0",
            "description": "音频特征提取、音乐分类",
        },
        "hubert-base": {
            "model_id": "damo/speech_hubert-large_asr",
            "task": "auto-speech-recognition",
            "category": "audio",
            "display_name": "HuBERT",
            "description": "音频特征提取、语音表示",
        },
        "sambert-zh": {
            "model_id": "damo/speech_sambert-hifigan_tts_zh-cn_16k",
            "task": "text-to-speech",
            "category": "tts",
            "display_name": "SamBERT",
            "description": "中文文本转语音",
        },
        "vit-base": {
            "model_id": "damo/cv_vit-base_image-classification_ImageNet1k",
            "task": "image-classification",
            "category": "vision",
            "display_name": "ViT Base",
            "description": "专辑封面图像分类",
        },
        "clip-vit": {
            "model_id": "damo/multi-modal_clip-vit-base-patch16_zh",
            "task": "multi-modal",
            "category": "vision",
            "display_name": "CLIP ViT",
            "description": "图像-文本匹配、图文检索",
        },
    }
```

### 3. 模型加载器 (`backend/core/model_loader.py`)

使用 ModelScope 加载模型：

```python
from modelscope.pipelines import pipeline
from modelscope.utils.constant import Tasks
import logging

logger = logging.getLogger(__name__)

class ModelScopeLoader:
    """ModelScope 模型加载器"""
    
    def __init__(self, model_path: str, model_id: str, task: str):
        self.model_path = model_path
        self.model_id = model_id
        self.task = task
        self.pipeline = None
        self.is_loaded = False
        self.load_error = None
    
    async def load(self) -> bool:
        """加载模型"""
        try:
            logger.info(f"开始加载模型: {self.model_id}")
            
            # 优先从本地加载，如果没有则从 ModelScope 下载
            self.pipeline = pipeline(
                task=self.task,
                model=self.model_id,
                model_revision='master',
            )
            
            self.is_loaded = True
            logger.info(f"✅ 模型加载成功: {self.model_id}")
            return True
            
        except Exception as e:
            self.load_error = str(e)
            logger.error(f"❌ 模型加载失败: {self.model_id}, 错误: {e}")
            return False
    
    async def infer(self, *args, **kwargs):
        """模型推理"""
        if not self.is_loaded:
            raise RuntimeError(f"Model {self.model_id} not loaded")
        return self.pipeline(*args, **kwargs)
    
    def get_status(self) -> dict:
        """获取模型状态"""
        return {
            "model_id": self.model_id,
            "is_loaded": self.is_loaded,
            "load_error": self.load_error,
        }
```

### 4. 模型管理器 (`backend/core/model_manager.py`)

预加载所有 12 个模型，失败时跳过继续：

```python
import logging
from typing import Dict, List
from .config import settings
from .model_loader import ModelScopeLoader

logger = logging.getLogger(__name__)

class ModelStatus:
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    LOADED = "loaded"
    ERROR = "error"

class ModelManager:
    """模型管理器"""
    
    def __init__(self):
        self.loaders: Dict[str, ModelScopeLoader] = {}
        self.status: Dict[str, ModelStatus] = {}
        self.load_progress: Dict[str, float] = {}
    
    async def preload_all_models(self):
        """预加载所有 12 个模型"""
        logger.info("=" * 60)
        logger.info("开始预加载所有 12 个模型...")
        logger.info("=" * 60)
        
        success_count = 0
        
        for model_id, config in settings.model_configs.items():
            try:
                self.status[model_id] = ModelStatus.LOADING
                self.load_progress[model_id] = 0
                
                logger.info(f"[{success_count + 1}/12] 正在加载: {model_id}")
                
                loader = ModelScopeLoader(
                    model_path=str(settings.models_dir / model_id),
                    model_id=config["model_id"],
                    task=config["task"],
                )
                
                success = await loader.load()
                
                if success:
                    self.loaders[model_id] = loader
                    self.status[model_id] = ModelStatus.LOADED
                    self.load_progress[model_id] = 100
                    success_count += 1
                    logger.info(f"✅ [{success_count}/12] {model_id} 加载成功")
                else:
                    self.status[model_id] = ModelStatus.ERROR
                    self.load_progress[model_id] = 0
                    logger.warning(f"⚠️  跳过 {model_id}，继续加载其他模型")
                    
            except Exception as e:
                self.status[model_id] = ModelStatus.ERROR
                self.load_progress[model_id] = 0
                logger.error(f"❌ {model_id} 加载异常: {e}")
                logger.warning(f"⚠️  跳过 {model_id}，继续加载其他模型")
        
        logger.info("=" * 60)
        logger.info(f"预加载完成！成功: {success_count}/12")
        logger.info("=" * 60)
    
    def get_all_status(self) -> List[dict]:
        """获取所有模型状态"""
        result = []
        for model_id, config in settings.model_configs.items():
            result.append({
                "model_id": model_id,
                "display_name": config["display_name"],
                "description": config["description"],
                "category": config["category"],
                "status": self.status.get(model_id, ModelStatus.NOT_LOADED),
                "progress": self.load_progress.get(model_id, 0),
                "is_loaded": model_id in self.loaders,
            })
        return result
    
    def get_loader(self, model_id: str) -> ModelScopeLoader:
        """获取模型加载器"""
        if model_id not in self.loaders:
            raise RuntimeError(f"Model {model_id} not loaded")
        return self.loaders[model_id]
    
    async def reload_model(self, model_id: str) -> bool:
        """重新加载单个模型"""
        if model_id not in settings.model_configs:
            raise ValueError(f"Unknown model: {model_id}")
        
        config = settings.model_configs[model_id]
        
        # 卸载旧模型
        if model_id in self.loaders:
            del self.loaders[model_id]
        
        # 加载新模型
        self.status[model_id] = ModelStatus.LOADING
        loader = ModelScopeLoader(
            model_path=str(settings.models_dir / model_id),
            model_id=config["model_id"],
            task=config["task"],
        )
        
        success = await loader.load()
        
        if success:
            self.loaders[model_id] = loader
            self.status[model_id] = ModelStatus.LOADED
        else:
            self.status[model_id] = ModelStatus.ERROR
        
        return success
    
    async def reload_all_models(self):
        """重新加载所有模型"""
        # 清空现有模型
        self.loaders.clear()
        self.status.clear()
        self.load_progress.clear()
        
        # 重新加载
        await self.preload_all_models()

# 全局单例
model_manager = ModelManager()
```

### 5. API 统一响应格式

```python
from pydantic import BaseModel
from typing import Any, Optional

class ApiResponse(BaseModel):
    """统一 API 响应格式"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    message: Optional[str] = None
```

### 6. CORS 配置 (`backend/main.py`)

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3025",
        "http://127.0.0.1:3025",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 7. API 路由模块（第一阶段核心）

#### 语音识别 API (`backend/api/speech.py`)
```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import io
import soundfile as sf
from ..models.speech_recognition import speech_recognition_service

router = APIRouter(prefix="/api/speech", tags=["speech"])

class SpeechRecognitionRequest(BaseModel):
    audio_base64: str
    model_id: str = "whisper-tiny"
    language: Optional[str] = None
    generate_word_timestamps: bool = True

class WordTimestamp(BaseModel):
    word: str
    start_time: float
    end_time: float
    confidence: float

class SpeechRecognitionResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    words: Optional[list[WordTimestamp]] = None
    segments: Optional[list] = None
    model_used: Optional[str] = None
    error: Optional[str] = None

@router.post("/recognize/file", response_model=SpeechRecognitionResponse)
async def recognize_audio_file(
    file: UploadFile = File(...),
    model_id: str = "whisper-tiny",
    language: Optional[str] = None,
    generate_word_timestamps: bool = True,
):
    """语音识别（文件上传） - 支持 WAV/MP3/WebM/OGG/FLAC"""
    try:
        # 检查文件大小
        file_size_mb = file.size / (1024 * 1024)
        if file_size_mb > 100:
            raise HTTPException(status_code=400, detail="Audio file too large (max 100MB)")
        
        # 读取音频数据
        audio_data = await file.read()
        
        # 调用语音识别服务
        result = await speech_recognition_service.recognize(
            audio_data=audio_data,
            model_id=model_id,
            language=language,
            generate_word_timestamps=generate_word_timestamps,
        )
        
        return SpeechRecognitionResponse(**result)
        
    except Exception as e:
        return SpeechRecognitionResponse(
            success=False,
            error=str(e),
        )
```

#### 翻译 API (`backend/api/translation.py`)
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..models.translation import translation_service

router = APIRouter(prefix="/api/translation", tags=["translation"])

class TranslationRequest(BaseModel):
    text: str
    source_language: str = "auto"
    target_language: str = "en"
    model_id: str = "opus-mt-en-zh"
    enable_realtime: bool = False

class TranslationResponse(BaseModel):
    success: bool
    original_text: Optional[str] = None
    translated_text: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    model_used: Optional[str] = None
    error: Optional[str] = None

@router.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    """文本翻译 - 支持手动和实时模式"""
    try:
        result = await translation_service.translate(
            text=request.text,
            source_language=request.source_language,
            target_language=request.target_language,
            model_id=request.model_id,
        )
        
        return TranslationResponse(**result)
        
    except Exception as e:
        return TranslationResponse(
            success=False,
            error=str(e),
        )
```

---

## 🎨 前端组件设计

### 1. AI 模型总控面板 (`src/components/AIModelDashboard.tsx`)

**功能：**
- 显示 12 个模型的加载状态（逐个显示）
- 每个模型单独重试按钮
- 全局一键重新加载所有模型
- 显示每个模型的详细信息（描述、分类）

**UI 设计（玻璃拟态）：**
```
┌───────────────────────────────────────────────────────┐
│  🤖 AI 模型总控面板                              │
├───────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │  Whisper     │ │  Whisper     │ │  Paraformer  │ │
│  │   Tiny       │ │   Base       │ │      Zh      │ │
│  │ ✅ 加载成功  │ │ ✅ 加载成功  │ │ ⏳ 加载中... │ │
│  │  [🔄重试]    │ │  [🔄重试]    │ │              │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
│  ... (其他 9 个模型卡片)                             │
├───────────────────────────────────────────────────────┤
│  [🔄 重新加载所有模型]                               │
└───────────────────────────────────────────────────────┘
```

### 2. 语音识别面板 (`SpeechRecognitionPanel.tsx`)
- 🎤 实时录音
- 📁 音频文件上传（WAV/MP3/WebM/OGG/FLAC）
- 📝 实时转写显示
- ⏱️ **词级别**时间戳（每个词的开始/结束时间）
- 🔄 模型选择（3个模型）

### 3. 翻译面板 (`TranslationPanel.tsx`)
- 📝 源文本输入
- 🌐 语言选择（200+种）
- 📊 翻译结果显示
- 📜 翻译历史
- 🔄 模型选择（4个模型）
- ⚡ **手动/实时翻译可切换**

---

## 🚀 开发阶段规划（已确认分阶段实施）

### 第一阶段：核心基础（当前阶段）
**范围**：配置 + 模型加载器 + 语音识别 + 翻译

**任务清单：**
- [ ] 更新 `backend/requirements.txt`
- [ ] 重构 `backend/core/config.py`（12个模型完整配置）
- [ ] 重写 `backend/core/model_loader.py`（ModelScope）
- [ ] 重写 `backend/core/model_manager.py`（预加载+降级策略）
- [ ] 更新 `backend/main.py`（CORS配置）
- [ ] 重构 `backend/models/speech_recognition.py`
- [ ] 重构 `backend/models/translation.py`
- [ ] 重构 `backend/api/speech.py`
- [ ] 重构 `backend/api/translation.py`
- [ ] 创建 `src/components/AIModelDashboard.tsx`
- [ ] 重写 `src/components/SpeechRecognitionPanel.tsx`
- [ ] 重写 `src/components/TranslationPanel.tsx`
- [ ] 更新 `src/ai/core/apiClient.ts`
- [ ] 重写 `src/app/ai/page.tsx`
- [ ] 第一阶段审核与测试

### 第二阶段：扩展功能
- [ ] 创建文本理解模块
- [ ] 创建音频处理模块
- [ ] 创建语音合成模块（MP3 128kbps）
- [ ] 创建视觉处理模块
- [ ] 对应前端组件

### 第三阶段：集成与测试
- [ ] 端到端测试
- [ ] 错误处理优化
- [ ] 性能优化

---

## ⚠️ 关键技术难点与解决方案（已确认）

### 难点 1：12 个模型预加载的内存占用
**风险**：12 个模型可能占用 5GB+ 内存
**解决方案**：
- 提供内存统计显示
- 失败时跳过该模型，继续加载其他（已确认）
- 添加内存警告阈值

### 难点 2：ModelScope 模型加载失败
**风险**：网络问题、权限问题、模型不存在
**解决方案**：
- 完善的错误捕获和重试机制
- 友好的错误提示
- 模型加载日志实时显示
- 失败时跳过，不影响整体（已确认）

### 难点 3：音频格式兼容性
**风险**：MP3、WAV、WebM、OGG、FLAC
**解决方案**：
- 使用 librosa + pydub 统一处理
- 格式自动检测和转换
- 清晰的格式支持说明（最全格式已确认）

### 难点 4：移动端兼容性
**风险**：手机浏览器性能限制
**解决方案**：
- 响应式设计
- 移动端优化的 UI
- 大模型在移动端提示用户

### 难点 5：用户隐私与安全
**风险**：音频/图像数据处理
**解决方案**：
- 所有数据本地处理，不上传
- 清晰的隐私说明
- 权限请求友好提示

### 难点 6：CORS 跨域问题
**解决方案**：
- 开发环境配置 CORS 允许 localhost:3025（已确认）
- 生产环境 Nginx 反向代理（已确认）

---

## ✅ 验收标准

### 后端验收
- [ ] 所有 12 个模型预加载（失败跳过）
- [ ] 所有 API 接口正常响应
- [ ] 统一错误响应格式（HTTP + JSON）
- [ ] 详细日志记录
- [ ] 文件上传限制生效（音频100MB，图像20MB）

### 前端验收
- [ ] AIModelDashboard 显示 12 个模型状态
- [ ] 每个模型单独重试 + 全局重试
- [ ] 6 个功能面板完整实现
- [ ] 玻璃拟态风格统一
- [ ] 响应式设计，移动端可用
- [ ] 加载/推理进度实时显示

---

## 📅 预计开发时间

| 阶段 | 预计时间 |
|------|---------|
| 第一阶段：核心基础 | 4-6 小时 |
| 第二阶段：扩展功能 | 6-8 小时 |
| 第三阶段：集成与测试 | 2-3 小时 |
| **总计** | **12-17 小时** |

---

## 📝 备注

- 本计划基于**两轮深度访谈**结果制定
- **分阶段实施**，每阶段完成后请用户审核（已确认）
- 建议分阶段测试，及时反馈问题
- ModelScope 模型下载指南需要更新

---

**文档状态**: ✅ 已审核 - 准备实施
**下一步**: 开始第一阶段实施（核心基础）
