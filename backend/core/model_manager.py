"""
Model Manager Mock
用于在不使用 AI 功能时让后端正常启动
"""

class ModelManager:
    def __init__(self):
        self.loaded_models = {}

    def get_status(self):
        return {
            "loaded_count": 0,
            "total_count": 0,
            "models": []
        }

model_manager = ModelManager()
