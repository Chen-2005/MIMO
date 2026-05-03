from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdType, TimestampMixin


class TTSTask(TimestampMixin, Base):
    __tablename__ = "tts_tasks"
    __table_args__ = (
        Index("ix_tts_tasks_user_id_created_at", "user_id", "created_at"),
        Index("ix_tts_tasks_status_created_at", "status", "created_at"),
        Index("ix_tts_tasks_model_code_created_at", "model_code", "created_at"),
    )

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    task_no: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    request_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    task_type: Mapped[str] = mapped_column(String(32), default="tts", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    model_code: Mapped[str] = mapped_column(String(64), nullable=False)
    final_model_code: Mapped[str | None] = mapped_column(String(64))
    fallback_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    voice_profile_id: Mapped[int | None] = mapped_column(BigInteger)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str | None] = mapped_column(Text)
    text_char_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    style_prompt: Mapped[str | None] = mapped_column(String(1000))
    speed: Mapped[float | None] = mapped_column(Numeric(4, 2))
    pitch: Mapped[float | None] = mapped_column(Numeric(4, 2))
    volume: Mapped[float | None] = mapped_column(Numeric(4, 2))
    emotion: Mapped[str | None] = mapped_column(String(64))
    output_format: Mapped[str] = mapped_column(String(16), default="mp3", nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(1024))
    audio_duration_ms: Mapped[int | None] = mapped_column(Integer)
    provider_task_id: Mapped[str | None] = mapped_column(String(128))
    provider_error_code: Mapped[str | None] = mapped_column(String(64))
    provider_error_message: Mapped[str | None] = mapped_column(String(1000))
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
