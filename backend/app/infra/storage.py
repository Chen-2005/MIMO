import uuid
from abc import ABC, abstractmethod
from pathlib import Path

import aiofiles

from app.config import settings


class AbstractStorageService(ABC):
    @abstractmethod
    async def upload(self, key: str, data: bytes, content_type: str = "audio/mpeg") -> str:
        """Upload file and return the public URL."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete a file by key."""


class LocalStorageService(AbstractStorageService):
    """Stores files on the local filesystem, served via FastAPI StaticFiles."""

    def __init__(self, base_path: str | None = None):
        self.base_path = Path(base_path or settings.LOCAL_STORAGE_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def upload(self, key: str, data: bytes, content_type: str = "audio/mpeg") -> str:
        file_path = self.base_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)
        return f"/static/{key}"

    async def delete(self, key: str) -> None:
        file_path = self.base_path / key
        if file_path.exists():
            file_path.unlink()


class S3StorageService(AbstractStorageService):
    """S3-compatible storage using boto3."""

    def __init__(self):
        import boto3

        kwargs = {"region_name": settings.S3_REGION}
        if settings.S3_ENDPOINT:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT
        if settings.S3_ACCESS_KEY:
            kwargs["aws_access_key_id"] = settings.S3_ACCESS_KEY
            kwargs["aws_secret_access_key"] = settings.S3_SECRET_KEY
        self.s3 = boto3.client("s3", **kwargs)
        self.bucket = settings.S3_BUCKET

    async def upload(self, key: str, data: bytes, content_type: str = "audio/mpeg") -> str:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        if settings.S3_ENDPOINT:
            return f"{settings.S3_ENDPOINT}/{self.bucket}/{key}"
        return f"https://{self.bucket}.s3.{settings.S3_REGION}.amazonaws.com/{key}"

    async def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)


def get_storage_service() -> AbstractStorageService:
    if settings.S3_ACCESS_KEY and settings.S3_BUCKET:
        return S3StorageService()
    return LocalStorageService()


def make_audio_key(task_id: int, output_format: str = "mp3") -> str:
    return f"audio/{task_id}/{uuid.uuid4().hex}.{output_format}"
