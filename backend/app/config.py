from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # App
    APP_NAME: str = "MiMo TTS Platform"
    DEBUG: bool = False
    SECRET_KEY: str = "replace-with-a-random-secret-key"

    # Database
    DATABASE_URL: str = "mysql+aiomysql://appuser:app-password@localhost:3306/mimo_tts"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    # Object Storage (S3-compatible)
    S3_ENDPOINT: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET: str = "mimo-tts-audio"
    S3_REGION: str = "us-east-1"

    # MiMo TTS Provider
    MIMO_API_BASE: str = ""
    MIMO_API_KEY: str = ""

    # Phase 1 additions
    PROVIDER_MODE: str = "mock"  # "mock" or "mimo"
    LOCAL_STORAGE_PATH: str = str(BASE_DIR / "storage")
    TASK_DEFAULT_USER_ID: int = 1
    CELERY_ENABLED: bool = False  # Set True when Redis is available

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
