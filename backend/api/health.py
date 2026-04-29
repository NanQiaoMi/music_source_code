"""
健康检查 API
"""
from fastapi import APIRouter
from pydantic import BaseModel

from core.config import settings
from core.model_manager import model_manager


router = APIRouter(prefix="/api", tags=["health"])


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    app_name: str
    app_version: str
    models: dict


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """健康检查接口"""
    model_status = model_manager.get_status()
    
    return HealthResponse(
        status="healthy",
        app_name=settings.app_name,
        app_version=settings.app_version,
        models=model_status,
    )
