from collections.abc import AsyncGenerator

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import async_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_current_user(x_user_id: int | None = Header(default=None)) -> int:
    """MVP auth: read user ID from X-User-Id header, fall back to default."""
    return x_user_id or settings.TASK_DEFAULT_USER_ID
