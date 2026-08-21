"""Compatibility model-loader facade for backend self-tests.

The production-heavy model loaders are optional in this lightweight backend.
This module provides a small, explicit loader abstraction so tests and health
checks can verify wiring without downloading model weights.
"""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


class ModelType(str, Enum):
    SPEECH_RECOGNITION = "speech_recognition"
    TRANSLATION = "translation"
    TEXT_UNDERSTANDING = "text_understanding"
    SPEECH_SYNTHESIS = "speech_synthesis"
    VISION_PROCESSING = "vision_processing"


@dataclass
class ModelLoader:
    model_id: str
    model_path: Path

    def exists(self) -> bool:
        return self.model_path.exists()


KNOWN_MODEL_TYPES = {
    "whisper": ModelType.SPEECH_RECOGNITION,
    "translation": ModelType.TRANSLATION,
    "text": ModelType.TEXT_UNDERSTANDING,
    "tts": ModelType.SPEECH_SYNTHESIS,
    "vision": ModelType.VISION_PROCESSING,
}


def create_model_loader(model_id: str, model_path: str) -> Optional[ModelLoader]:
    if not model_id:
        return None
    return ModelLoader(model_id=model_id, model_path=Path(model_path))
