"""Capability discovery and explicit unavailable responses for optional AI features."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse


router = APIRouter(prefix="/api", tags=["capabilities"])

CAPABILITIES = {
    "audio_processing": {
        "id": "audio_processing",
        "available": False,
        "endpoint": "/api/audio/process",
        "reason": "本地音频模型运行时尚未随桌面版本提供，请先在设置中准备模型。",
    },
    "speech_synthesis": {
        "id": "speech_synthesis",
        "available": False,
        "endpoint": "/api/tts/synthesize",
        "reason": "本地语音合成模型运行时尚未随桌面版本提供，请先在设置中准备模型。",
    },
    "vision_processing": {
        "id": "vision_processing",
        "available": False,
        "endpoint": "/api/vision/process",
        "reason": "本地图像模型运行时尚未随桌面版本提供，请先在设置中准备模型。",
    },
}


def unavailable_response(capability_id: str) -> JSONResponse:
    capability = CAPABILITIES[capability_id]
    return JSONResponse(
        status_code=501,
        content={
            "success": False,
            "code": "CAPABILITY_UNAVAILABLE",
            "capability": capability_id,
            "error_message": capability["reason"],
            "available": False,
        },
    )


@router.get("/capabilities")
async def list_capabilities():
    return {"capabilities": CAPABILITIES}


@router.post("/audio/process")
async def process_audio():
    return unavailable_response("audio_processing")


@router.post("/tts/synthesize")
async def synthesize_speech():
    return unavailable_response("speech_synthesis")


@router.post("/vision/process")
async def process_vision():
    return unavailable_response("vision_processing")
