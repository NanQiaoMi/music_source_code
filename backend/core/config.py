from pathlib import Path
from typing import Any, Dict, List

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vibe Music Player Backend"
    app_version: str = "2.0.0"

    # Service configuration
    host: str = Field(
        "127.0.0.1",
        validation_alias=AliasChoices("VIBE_BACKEND_HOST", "VIBE_HOST"),
    )
    port: int = Field(
        8000,
        validation_alias=AliasChoices("VIBE_BACKEND_PORT", "VIBE_PORT"),
    )
    debug: bool = False

    # CORS configuration
    cors_origins: List[str] = [
        "http://localhost:3025",
        "http://127.0.0.1:3025",
        "app://app",
    ]

    # File upload limits
    max_audio_size_mb: int = 100
    max_image_size_mb: int = 20

    # Model configuration. The lightweight local backend can run without model files;
    # these fields keep health checks and model-loader tests stable in that mode.
    models_dir: Path = Field(
        Path(__file__).resolve().parents[1] / "models",
        validation_alias=AliasChoices("VIBE_MODELS_DIR", "MODELS_DIR"),
    )
    model_configs: Dict[str, Dict[str, Any]] = {}

    # Supported audio formats
    supported_audio_formats: List[str] = [".wav", ".mp3", ".webm", ".ogg", ".flac"]

    model_config = SettingsConfigDict(
        env_prefix="VIBE_",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
