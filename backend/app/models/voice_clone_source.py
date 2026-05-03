from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdType, TimestampMixin


class VoiceCloneSource(TimestampMixin, Base):
    __tablename__ = "voice_clone_sources"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    voice_profile_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    source_audio_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    source_audio_duration_ms: Mapped[int | None] = mapped_column(Integer)
    consent_type: Mapped[str] = mapped_column(String(32), nullable=False)  # self, authorized_agent, enterprise
    consent_statement: Mapped[str] = mapped_column(String(2000), nullable=False)
    consent_proof_url: Mapped[str | None] = mapped_column(String(1024))
    risk_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    review_note: Mapped[str | None] = mapped_column(String(1000))
