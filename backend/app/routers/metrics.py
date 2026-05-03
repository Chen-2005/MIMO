from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.schemas.common import ApiResponse
from app.schemas.metrics import MetricsSummary
from app.services.metrics_service import MetricsService

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/summary", response_model=ApiResponse[MetricsSummary])
async def get_metrics_summary(
    start_date: str | None = None,
    end_date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    service = MetricsService(db)
    result = await service.get_summary(start_date, end_date)
    return ApiResponse(data=MetricsSummary(**result))


@router.post("/aggregate", response_model=ApiResponse[dict])
async def trigger_aggregation(
    target_date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    service = MetricsService(db)
    d = date.fromisoformat(target_date) if target_date else None
    result = await service.aggregate_daily(d)
    await db.commit()
    return ApiResponse(data=result)
