"""
Lightweight model manager used by the local development backend.

The full AI model runtime is optional. This manager exposes the same control
surface expected by the backend health checks while safely reporting models as
unavailable when model files are not present.
"""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List

from .config import settings


class ModelStatus(str, Enum):
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    LOADED = "loaded"
    ERROR = "error"


@dataclass(frozen=True)
class ModelInfo:
    model_id: str
    category: str
    path: Path
    status: ModelStatus = ModelStatus.NOT_LOADED


DEFAULT_MODELS: List[ModelInfo] = [
    ModelInfo("whisper-tiny", "speech", settings.models_dir / "whisper-tiny"),
    ModelInfo("nllb-translation", "translation", settings.models_dir / "nllb-translation"),
    ModelInfo("music-emotion", "analysis", settings.models_dir / "music-emotion"),
]


class ModelManager:
    def __init__(self) -> None:
        self.loaded_models: Dict[str, Any] = {}
        self.models: Dict[str, ModelInfo] = {model.model_id: model for model in DEFAULT_MODELS}

    def get_all_models(self) -> List[ModelInfo]:
        return list(self.models.values())

    def check_model_files(self, model_id: str) -> bool:
        model = self.models.get(model_id)
        return bool(model and model.path.exists())

    async def load_model(self, model_id: str) -> bool:
        if not self.check_model_files(model_id):
            return False
        self.loaded_models[model_id] = {"id": model_id, "status": ModelStatus.LOADED.value}
        return True

    async def unload_model(self, model_id: str) -> None:
        self.loaded_models.pop(model_id, None)

    def get_status(self) -> Dict[str, Any]:
        return {
            "loaded_count": len(self.loaded_models),
            "total_count": len(self.models),
            "models": [
                {
                    "id": model.model_id,
                    "category": model.category,
                    "available": self.check_model_files(model.model_id),
                    "loaded": model.model_id in self.loaded_models,
                }
                for model in self.get_all_models()
            ],
        }


model_manager = ModelManager()
