from datetime import date, datetime, time, timezone, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tts_task import TTSTask
from app.models.usage_stat import UsageStatsDaily
from app.models.voice_clone_source import VoiceCloneSource


DEFAULT_ESTIMATED_COST_PER_1K_CHARS = Decimal("0.02")


def _utc_day_bounds(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end


class MetricsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_summary(
        self, start_date: str | None, end_date: str | None
    ) -> dict:
        stmt = select(
            func.coalesce(func.sum(UsageStatsDaily.request_count), 0),
            func.coalesce(func.sum(UsageStatsDaily.success_count), 0),
            func.coalesce(func.sum(UsageStatsDaily.failure_count), 0),
            func.coalesce(func.sum(UsageStatsDaily.fallback_count), 0),
            func.coalesce(func.sum(UsageStatsDaily.text_char_count), 0),
            func.coalesce(func.sum(UsageStatsDaily.audio_duration_ms), 0),
            func.coalesce(func.sum(UsageStatsDaily.estimated_cost), 0),
        )
        if start_date:
            stmt = stmt.where(UsageStatsDaily.stat_date >= date.fromisoformat(start_date))
        if end_date:
            stmt = stmt.where(UsageStatsDaily.stat_date <= date.fromisoformat(end_date))

        result = await self.db.execute(stmt)
        row = result.one()

        clone_stmt = select(func.count()).select_from(VoiceCloneSource)
        if start_date:
            clone_stmt = clone_stmt.where(
                VoiceCloneSource.created_at >= date.fromisoformat(start_date)
            )
        if end_date:
            clone_stmt = clone_stmt.where(
                VoiceCloneSource.created_at <= date.fromisoformat(end_date)
            )
        clone_count = (await self.db.execute(clone_stmt)).scalar() or 0

        return {
            "request_count": row[0],
            "success_count": row[1],
            "failure_count": row[2],
            "fallback_count": row[3],
            "text_char_count": row[4],
            "audio_duration_ms": row[5],
            "estimated_cost": float(row[6]),
            "clone_request_count": clone_count,
        }

    async def aggregate_daily(self, target_date: date | None = None) -> dict:
        if target_date is None:
            target_date = date.today()

        day_start, day_end = _utc_day_bounds(target_date)

        stmt = (
            select(TTSTask)
            .where(and_(TTSTask.created_at >= day_start, TTSTask.created_at < day_end))
            .order_by(TTSTask.model_code)
        )
        tasks = (await self.db.execute(stmt)).scalars().all()

        grouped: dict[str, dict] = {}
        for task in tasks:
            bucket = grouped.setdefault(
                task.model_code,
                {
                    "request_count": 0,
                    "success_count": 0,
                    "failure_count": 0,
                    "fallback_count": 0,
                    "text_char_count": 0,
                    "audio_duration_ms": 0,
                    "estimated_cost": Decimal("0"),
                },
            )

            bucket["request_count"] += 1
            if task.status == "succeeded":
                bucket["success_count"] += 1
            elif task.status == "failed":
                bucket["failure_count"] += 1

            bucket["fallback_count"] += int(bool(task.fallback_used))
            bucket["text_char_count"] += task.text_char_count or 0
            bucket["audio_duration_ms"] += task.audio_duration_ms or 0
            bucket["estimated_cost"] += self._estimate_task_cost(task.text_char_count or 0)

        aggregated = []
        for model_code, values in grouped.items():
            existing = await self.db.execute(
                select(UsageStatsDaily).where(
                    UsageStatsDaily.stat_date == target_date,
                    UsageStatsDaily.model_code == model_code,
                )
            )
            stat = existing.scalar_one_or_none()

            if stat:
                stat.request_count = values["request_count"]
                stat.success_count = values["success_count"]
                stat.failure_count = values["failure_count"]
                stat.fallback_count = values["fallback_count"]
                stat.text_char_count = values["text_char_count"]
                stat.audio_duration_ms = values["audio_duration_ms"]
                stat.estimated_cost = values["estimated_cost"]
            else:
                stat = UsageStatsDaily(
                    stat_date=target_date,
                    model_code=model_code,
                    request_count=values["request_count"],
                    success_count=values["success_count"],
                    failure_count=values["failure_count"],
                    fallback_count=values["fallback_count"],
                    text_char_count=values["text_char_count"],
                    audio_duration_ms=values["audio_duration_ms"],
                    estimated_cost=values["estimated_cost"],
                )
                self.db.add(stat)

            aggregated.append(
                {
                    "model_code": model_code,
                    "request_count": values["request_count"],
                    "success_count": values["success_count"],
                    "failure_count": values["failure_count"],
                    "fallback_count": values["fallback_count"],
                    "text_char_count": values["text_char_count"],
                    "audio_duration_ms": values["audio_duration_ms"],
                    "estimated_cost": float(values["estimated_cost"]),
                }
            )

        await self.db.flush()
        return {"stat_date": str(target_date), "models": aggregated}

    def _estimate_task_cost(self, text_char_count: int) -> Decimal:
        if text_char_count <= 0:
            return Decimal("0")
        return (Decimal(text_char_count) / Decimal("1000")) * DEFAULT_ESTIMATED_COST_PER_1K_CHARS
