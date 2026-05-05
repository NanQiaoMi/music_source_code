# mimimusic Backend

AI 增强音乐播放器后端

## 项目结构

```
backend/
├── api/                 # API 路由
│   ├── __init__.py
│   ├── health.py       # 健康检查 API
│   ├── models.py       # 模型管理 API
│   ├── speech.py       # 语音识别 API
│   └── translation.py  # 翻译 API
├── core/               # 核心模块
│   ├── __init__.py
│   ├── config.py       # 配置模块
│   └── model_manager.py  # 模型管理器
├── models/             # AI 模型模块
│   ├── __init__.py
│   ├── speech_recognition.py  # 语音识别服务
│   └── translation.py         # 翻译服务
├── ws/                 # WebSocket 模块（待实现）
├── __init__.py
├── main.py             # FastAPI 主文件
├── requirements.txt    # Python 依赖
└── README.md          # 本文件
```

## 快集成开发速开始

### 环境要求

- Python 3.10+
- pip

### 安装依赖

```bash
# 1. 创建虚拟环境（推荐）
python -m venv venv

# 2. 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt
```

### 运行服务器

```bash
# 开发模式（带热重载）
cd backend
python -m uvicorn main:app --reload --port 8000

# 或者直接运行
python main.py
```

### 访问 API

- 根路径: <http://localhost:8000>
- API 文档: <http://localhost:8000/docs>
- 健康检查: <http://localhost:8000/api/health>

## API 接口

### 健康检查

```bash
GET /api/health
```

响应:

```json
{
  "status": "healthy",
  "app_name": "Vibe Music Player Backend",
  "app_version": "1.0.0",
  "models": {
    "loaded_count": 0,
    "total_count": 12,
    "models": [...]
  }
}
```

### 模型管理

#### 获取所有模型

```bash
GET /api/models
```

#### 获取单个模型

```bash
GET /api/models/{model_id}
```

#### 按分类获取模型

```bash
GET /api/models/category/{category}
```

#### 检查模型文件

```bash
GET /api/models/{model_id}/check-files
```

#### 加载模型

```bash
POST /api/models/load
Content-Type: application/json

{
  "model_id": "whisper-tiny"
}
```

#### 卸载模型

```bash
POST /api/models/{model_id}/unload
```

#### 卸载所有模型

```bash
POST /api/models/unload-all
```

#### 获取已加载模型

```bash
GET /api/models/status/loaded
```

#### 获取模型管理器状态

```bash
GET /api/models/status/manager
```

### 语音识别

#### 语音识别 - Base64 音频

```bash
POST /api/speech/recognize
Content-Type: application/json

{
  "audio": "base64_encoded_audio",
  "model": "whisper-tiny",
  "language": "auto",
  "generate_segments": true
}
```

#### 语音识别 - 文件上传

```bash
POST /api/speech/recognize/file?model=whisper-tiny&language=auto
Content-Type: multipart/form-data

file: [audio file]
```

#### 获取语音识别服务状态

```bash
GET /api/speech/status
```

#### 重置语音识别服务

```bash
POST /api/speech/reset
```

### 翻译

#### 翻译文本

```bash
POST /api/translation/translate
Content-Type: application/json

{
  "text": "要翻译的文本",
  "source_language": "auto",
  "target_language": "zh",
  "model_preference": "opus-mt"
}
```

#### 获取翻译历史

```bash
GET /api/translation/history?limit=50&offset=0
```

#### 清空翻译历史

```bash
DELETE /api/translation/history
```

#### 获取支持语言列表

```bash
GET /api/translation/languages/supported
```

#### 获取翻译服务状态

```bash
GET /api/translation/status
```

#### 重置翻译服务

```bash
POST /api/translation/reset
```

## 支持的模型

### 语音识别

- `whisper-tiny` - Whisper Tiny 轻量级语音识别
- `whisper-base` - Whisper Base 标准语音识别
- `paraformer-zh` - Paraformer 高精度中文语音识别

### 翻译

- `opus-mt-en-zh` - OPUS-MT 英语到中文翻译
- `opus-mt-zh-en` - OPUS-MT 中文到英语翻译
- `nllb-200` - NLLB-200 200+ 语言多语言翻译

### NLP

- `bert-chinese` - BERT 中文文本理解

### 音频处理

- `wav2vec2-base` - Wav2Vec 2.0 音频特征提取
- `hubert-base` - HuBERT Base 自监督音频表示
- `sambert-zh` - SamBERT 中文语音合成

### 视觉

- `vit-base` - ViT Base 图像分类
- `clip-vit` - CLIP ViT 图像-文本匹配

## 配置

配置文件: `backend/core/config.py`

主要配置项:

- `host` - 服务器地址 (默认: `0.0.0.0`)
- `port` - 服务器端口 (默认: `8000`)
- `debug` - 调试模式 (默认: `True`)
- `cors_origins` - CORS 允许的来源
- `models_dir` - 模型文件路径

## 开发计划

### Week 1 - 项目搭建 ✅

- [x] 后端项目初始化 (FastAPI)
- [x] 前后端通信架构搭建
- [x] 模型管理器基础框架
- [x] 基础 API 接口

### Week 2 - 语音识别功能

- [x] 语音识别服务框架
- [x] 语音识别 API 接口（Base64 + 文件上传）
- [ ] Whisper 模型集成
- [ ] Paraformer 模型集成
- [ ] 前端录音组件
- [ ] 实时转写功能

### Week 3 - 翻译功能

- [x] 翻译服务框架
- [x] 翻译 API 接口（文本翻译 + 历史记录）
- [ ] OPUS-MT 模型集成
- [ ] NLLB-200 模型集成
- [ ] 前端翻译组件
- [ ] 双语对照显示

### Week 4 - MVP 整合与测试

- [x] 所有功能框架整合
- [ ] 真实模型集成
- [ ] UI/UX 优化
- [ ] 错误处理完善
- [ ] 性能基础监控
- [ ] MVP 测试与修复

详细开发计划请参考: `docs/MODEL_FEATURE_DEVELOPMENT.md`

## 许可证

本项目仅供学习和研究使用。
