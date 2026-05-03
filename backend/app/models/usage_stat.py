import datetime as dt

from sqlalchemy import BigInteger, Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdType, TimestampMixin


class UsageStatsDaily(TimestampMixin, Base):
    __tablename__ = "usage_stats_daily"

    id: Mapped[int] = mapped_column(IdType, primary_key=True, autoincrement=True)
    stat_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    user_id: Mapped[int | None] = mapped_column(BigInteger)
    model_code: Mapped[str] = mapped_column(String(64), nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fallback_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    text_char_count: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    audio_duration_ms: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    estimated_cost: Mapped[float] = mapped_column(Numeric(18, 4), default=0, nullable=False)
