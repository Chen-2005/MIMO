import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_user, get_db
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.tts import (
    CreateTTSRequest,
    ProviderLogItem,
    SegmentItem,
    TaskActionResponse,
    TaskCreated,
    TaskDetail,
    TaskListItem,
    RetryTaskRequest,
)
from app.services.tts_service import TTSService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["TTS"])


def _dispatch_generation(task_id: int, enable_fallback: bool = True) -> None:
    """Dispatch TTS generation to Celery or background thread."""
    if settings.CELERY_ENABLED:
        try:
            from app.tasks.tts_tasks import generate_tts
            generate_tts.delay(task_id)
        except Exception:
            logger.warning("Failed to dispatch TTS task to Celery, running sync")
            from app.tasks.tts_tasks import run_tts_sync
            run_tts_sync(task_id, enable_fallback)
    else:
        from app.tasks.tts_tasks import run_tts_sync
        run_tts_sync(task_id, enable_fallback)


@router.post("/tasks", response_model=ApiResponse[TaskCreated])
async def create_task(
    body: CreateTTSRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = TTSService(db)
    result = await service.create_task(user_id, body)
    await db.commit()

    _dispatch_generation(result["task_id"], body.enable_fallback)

    return ApiResponse(data=TaskCreated(**result))


@router.get("/tasks/{task_id}", response_model=ApiResponse[TaskDetail])
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = TTSService(db)
    result = await service.get_task(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return ApiResponse(data=TaskDetail(**result))


@router.get("/tasks", response_model=ApiResponse[PaginatedData[TaskListItem]])
async def list_tasks(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    model_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = TTSService(db)
    items, total = await service.list_tasks(user_id, page, page_size, status, model_code)
    return ApiResponse(data=PaginatedData(
        list=[TaskListItem(**i) for i in items],
        page=page,
        page_size=page_size,
        total=total,
    ))


@router.post("/tasks/{task_id}/retry", response_model=ApiResponse[TaskActionResponse])
async def retry_task(
    task_id: int,
    body: RetryTaskRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = TTSService(db)
    try:
        result = await service.retry_task(task_id, body.force_fallback if body else False)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    await db.commit()
    _dispatch_generation(result["task_id"], enable_fallback=not (body and body.force_fallback))

    return ApiResponse(data=TaskActionResponse(**result))


@router.post("/tasks/{task_id}/cancel", response_model=ApiResponse[TaskActionResponse])
async def cancel_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = TTSService(db)
    try:
        result = await service.cancel_task(task_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()
    return ApiResponse(data=TaskActionResponse(**result))


@router.get("/tasks/{task_id}/logs", response_model=ApiResponse[list[ProviderLogItem]])
async def get_task_logs(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = TTSService(db)
    logs = await service.get_task_logs(task_id)
    return ApiResponse(data=[ProviderLogItem(**log) for log in logs])


@router.get("/tasks/{task_id}/audio")
async def download_audio(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    from pathlib import Path

    from fastapi.responses import FileResponse

    from app.config import settings

    service = TTSService(db)
    audio_url = await service.get_task_audio(task_id)
    if not audio_url:
        raise HTTPException(status_code=404, detail="Audio not found or task not completed")

    # Local storage: serve file directly so <a download> works
    if audio_url.startswith("/static/"):
        relative = audio_url.removeprefix("/static/")
        file_path = Path(settings.LOCAL_STORAGE_PATH) / relative
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found on disk")
        ext = file_path.suffix.lstrip(".")
        media = "audio/mpeg" if ext == "mp3" else "audio/wav" if ext == "wav" else f"audio/{ext}"
        filename = f"tts_{task_id}.{ext}"
        return FileResponse(
            path=str(file_path),
            media_type=media,
            filename=filename,
        )

    # S3 or external URL: redirect
    return RedirectResponse(url=audio_url)


@router.get("/tasks/{task_id}/segments", response_model=ApiResponse[list[SegmentItem]])
async def get_task_segments(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = TTSService(db)
    segments = await service.get_task_segments(task_id)
    return ApiResponse(data=[SegmentItem(**s) for s in segments])
