from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_name: str = "Vibe Music Player Backend"
    app_version: str = "2.0.0"
    
    # 服务配置
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    # CORS 配置
    cors_origins: List[str] = [
        "http://localhost:3025",
        "http://127.0.0.1:3025",
    ]
    
    # 文件上传限制
    max_audio_size_mb: int = 100
    max_image_size_mb: int = 20
    
    # 支持的音频格式
    supported_audio_formats: list = [".wav", ".mp3", ".webm", ".ogg", ".flac"]


settings = Settings()
