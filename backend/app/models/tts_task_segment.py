from sqlalchemy import BigInteger, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdType, TimestampMixin


class TTSTaskSegment(TimestampMixin, Base):
    __tablename__ = "tts_task_segments"
    __table_args__ = (
        Index("ix_tts_task_segments_task_id_segment_no", "task_id", "segment_no"),
    )

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    segment_no: Mapped[int] = mapped_column(Integer, nullable=False)
    segment_text: Mapped[str] = mapped_column(Text, nullable=False)
    char_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    provider_task_id: Mapped[str | None] = mapped_column(String(128))
    audio_url: Mapped[str | None] = mapped_column(String(1024))
    audio_duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(String(1000))
