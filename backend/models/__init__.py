"""
AI 模型集成模块
"""
from .speech_recognition import speech_recognition_service
from .translation import translation_service

__all__ = [
    "speech_recognition_service",
    "translation_service",
]
