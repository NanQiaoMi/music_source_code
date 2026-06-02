"""Lightweight translation service facade.

The full translation model is optional. This no-model implementation exposes the
same status surface used by backend diagnostics.
"""

from typing import Any, Dict


class TranslationService:
    def __init__(self) -> None:
        self.is_ready = True
        self.loaded_model = None

    def get_status(self) -> Dict[str, Any]:
        return {
            "ready": self.is_ready,
            "loaded_model": self.loaded_model,
            "mode": "lightweight",
        }


translation_service = TranslationService()
