from sqlalchemy import BigInteger, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdType, TimestampMixin


class ProviderCallLog(TimestampMixin, Base):
    __tablename__ = "provider_call_logs"
    __table_args__ = (
        Index("ix_provider_call_logs_task_id", "task_id"),
        Index("ix_provider_call_logs_model_code_created_at", "model_code", "created_at"),
    )

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    task_id: Mapped[int | None] = mapped_column(BigInteger)
    segment_id: Mapped[int | None] = mapped_column(BigInteger)
    provider_name: Mapped[str] = mapped_column(String(64), nullable=False)
    model_code: Mapped[str] = mapped_column(String(64), nullable=False)
    request_summary: Mapped[str | None] = mapped_column(Text)
    response_summary: Mapped[str | None] = mapped_column(Text)
    http_status: Mapped[int | None] = mapped_column(Integer)
    provider_error_code: Mapped[str | None] = mapped_column(String(64))
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
