from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Any, Dict, List


class Settings(BaseSettings):
    app_name: str = "Vibe Music Player Backend"
    app_version: str = "2.0.0"

    # Service configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # CORS configuration
    cors_origins: List[str] = [
        "http://localhost:3025",
        "http://127.0.0.1:3025",
    ]

    # File upload limits
    max_audio_size_mb: int = 100
    max_image_size_mb: int = 20

    # Model configuration. The lightweight local backend can run without model files;
    # these fields keep health checks and model-loader tests stable in that mode.
    models_dir: Path = Path(__file__).resolve().parents[1] / "models"
    model_configs: Dict[str, Dict[str, Any]] = {}

    # Supported audio formats
    supported_audio_formats: List[str] = [".wav", ".mp3", ".webm", ".ogg", ".flac"]


settings = Settings()
