from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import settings

# SQLite doesn't support BigInteger autoincrement; use Integer for dev
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
IdType = Integer if _is_sqlite else BigInteger


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
