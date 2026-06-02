"""Lightweight speech recognition service facade.

The real speech model runtime is optional for local development. This service
keeps backend health checks stable and reports capability status without loading
large model weights.
"""

from typing import Any, Dict


class SpeechRecognitionService:
    def __init__(self) -> None:
        self.is_ready = True
        self.loaded_model = None

    def get_status(self) -> Dict[str, Any]:
        return {
            "ready": self.is_ready,
            "loaded_model": self.loaded_model,
            "mode": "lightweight",
        }


speech_recognition_service = SpeechRecognitionService()
