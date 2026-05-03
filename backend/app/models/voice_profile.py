from sqlalchemy import BigInteger, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdType, TimestampMixin


class VoiceProfile(TimestampMixin, Base):
    __tablename__ = "voice_profiles"
    __table_args__ = (
        Index("ix_voice_profiles_user_id_profile_type", "user_id", "profile_type"),
        Index("ix_voice_profiles_provider_voice_id", "provider_voice_id"),
    )

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger)
    profile_type: Mapped[str] = mapped_column(String(32), nullable=False)  # system, designed, cloned
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_code: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_voice_id: Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(String(1000))
    gender_hint: Mapped[str | None] = mapped_column(String(32))
    age_hint: Mapped[str | None] = mapped_column(String(32))
    language_hint: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    is_public: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(512))
