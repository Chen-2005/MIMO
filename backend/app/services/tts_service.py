from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.text_segmentation import segment_text
from app.models.provider_call_log import ProviderCallLog
from app.models.tts_task import TTSTask
from app.models.tts_task_segment import TTSTaskSegment
from app.schemas.tts import CreateTTSRequest


def _generate_task_no() -> str:
    now = datetime.now(timezone.utc)
    return f"tts_{now.strftime('%Y%m%d_%H%M%S')}_{now.microsecond // 1000:03d}"


def _task_to_detail(task: TTSTask) -> dict:
    return {
        "task_id": task.id,
        "task_no": task.task_no,
        "status": task.status,
        "model_code": task.model_code,
        "final_model_code": task.final_model_code,
        "fallback_used": bool(task.fallback_used),
        "voice_profile_id": task.voice_profile_id,
        "text_char_count": task.text_char_count,
        "style_prompt": task.style_prompt,
        "speed": float(task.speed) if task.speed is not None else None,
        "output_format": task.output_format,
        "audio_url": task.audio_url,
        "audio_duration_ms": task.audio_duration_ms,
        "provider_error_code": task.provider_error_code,
        "provider_error_message": task.provider_error_message,
        "created_at": task.created_at,
        "finished_at": task.finished_at,
    }


def _task_to_list_item(task: TTSTask) -> dict:
    return {
        "task_id": task.id,
        "task_no": task.task_no,
        "status": task.status,
        "model_code": task.model_code,
        "fallback_used": bool(task.fallback_used),
        "audio_url": task.audio_url,
        "audio_duration_ms": task.audio_duration_ms,
        "created_at": task.created_at,
    }


class TTSService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_task(self, user_id: int, req: CreateTTSRequest) -> dict:
        # Idempotency check
        existing = await self.db.execute(
            select(TTSTask).where(TTSTask.request_id == req.request_id)
        )
        row = existing.scalar_one_or_none()
        if row:
            return {"task_id": row.id, "task_no": row.task_no, "status": row.status}

        task = TTSTask(
            task_no=_generate_task_no(),
            user_id=user_id,
            request_id=req.request_id,
            task_type="tts",
            status="queued",
            model_code=req.model_code,
            voice_profile_id=req.voice_profile_id,
            input_text=req.text,
            normalized_text=req.text.strip(),
            text_char_count=len(req.text),
            style_prompt=req.style_prompt,
            speed=req.speed,
            pitch=req.pitch,
            volume=req.volume,
            emotion=req.emotion,
            output_format=req.output_format,
        )
        self.db.add(task)
        await self.db.flush()

        # Create segments for long text
        segments = segment_text(task.normalized_text)
        if len(segments) > 1:
            for i, seg_text in enumerate(segments, start=1):
                segment = TTSTaskSegment(
                    task_id=task.id,
                    segment_no=i,
                    segment_text=seg_text,
                    char_count=len(seg_text),
                    status="pending",
                )
                self.db.add(segment)
            await self.db.flush()

        return {"task_id": task.id, "task_no": task.task_no, "status": task.status}

    async def get_task(self, task_id: int) -> dict | None:
        result = await self.db.execute(select(TTSTask).where(TTSTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return None
        detail = _task_to_detail(task)
        # Query segment count
        count_result = await self.db.execute(
            select(func.count()).select_from(TTSTaskSegment).where(TTSTaskSegment.task_id == task_id)
        )
        detail["segment_count"] = count_result.scalar() or 0
        return detail

    async def list_tasks(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        model_code: str | None = None,
    ) -> tuple[list[dict], int]:
        base = select(TTSTask).where(TTSTask.user_id == user_id)
        count_base = select(func.count()).select_from(TTSTask).where(TTSTask.user_id == user_id)

        if status:
            base = base.where(TTSTask.status == status)
            count_base = count_base.where(TTSTask.status == status)
        if model_code:
            base = base.where(TTSTask.model_code == model_code)
            count_base = count_base.where(TTSTask.model_code == model_code)

        total_result = await self.db.execute(count_base)
        total = total_result.scalar() or 0

        base = base.order_by(TTSTask.created_at.desc())
        base = base.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(base)
        tasks = result.scalars().all()

        return [_task_to_list_item(t) for t in tasks], total

    async def retry_task(self, task_id: int, force_fallback: bool = False) -> dict:
        result = await self.db.execute(select(TTSTask).where(TTSTask.id == task_id))
        original = result.scalar_one_or_none()
        if not original:
            raise ValueError(f"Task {task_id} not found")

        new_task = TTSTask(
            task_no=_generate_task_no(),
            user_id=original.user_id,
            request_id=f"retry_{original.request_id}_{int(datetime.now(timezone.utc).timestamp())}",
            task_type=original.task_type,
            status="queued",
            model_code="MiMo-V2-TTS" if force_fallback else original.model_code,
            voice_profile_id=original.voice_profile_id,
            input_text=original.input_text,
            normalized_text=original.normalized_text,
            text_char_count=original.text_char_count,
            style_prompt=original.style_prompt,
            speed=original.speed,
            pitch=original.pitch,
            volume=original.volume,
            emotion=original.emotion,
            output_format=original.output_format,
            fallback_used=1 if force_fallback else 0,
        )
        self.db.add(new_task)
        await self.db.flush()
        return {"task_id": new_task.id, "source_task_id": task_id, "status": new_task.status}

    async def cancel_task(self, task_id: int) -> dict:
        result = await self.db.execute(select(TTSTask).where(TTSTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task.status not in ("pending", "queued"):
            raise ValueError(f"Cannot cancel task in status '{task.status}'")

        task.status = "canceled"
        task.finished_at = datetime.now(timezone.utc)
        await self.db.flush()
        return {"task_id": task.id, "status": task.status}

    async def update_task_status(
        self,
        task_id: int,
        status: str,
        audio_url: str | None = None,
        audio_duration_ms: int | None = None,
        final_model_code: str | None = None,
        fallback_used: bool | None = None,
        provider_task_id: str | None = None,
        provider_error_code: str | None = None,
        provider_error_message: str | None = None,
    ) -> None:
        values: dict = {"status": status}
        if status == "running":
            values["started_at"] = datetime.now(timezone.utc)
        if status in ("succeeded", "failed", "canceled"):
            values["finished_at"] = datetime.now(timezone.utc)
        if audio_url is not None:
            values["audio_url"] = audio_url
        if audio_duration_ms is not None:
            values["audio_duration_ms"] = audio_duration_ms
        if final_model_code is not None:
            values["final_model_code"] = final_model_code
        if fallback_used is not None:
            values["fallback_used"] = int(fallback_used)
        if provider_task_id is not None:
            values["provider_task_id"] = provider_task_id
        if provider_error_code is not None:
            values["provider_error_code"] = provider_error_code
        if provider_error_message is not None:
            values["provider_error_message"] = provider_error_message

        await self.db.execute(
            update(TTSTask).where(TTSTask.id == task_id).values(**values)
        )
        await self.db.flush()

    async def get_task_logs(self, task_id: int) -> list[dict]:
        result = await self.db.execute(
            select(ProviderCallLog)
            .where(ProviderCallLog.task_id == task_id)
            .order_by(ProviderCallLog.created_at)
        )
        logs = result.scalars().all()
        return [
            {
                "id": log.id,
                "provider_name": log.provider_name,
                "model_code": log.model_code,
                "request_summary": log.request_summary,
                "response_summary": log.response_summary,
                "http_status": log.http_status,
                "provider_error_code": log.provider_error_code,
                "latency_ms": log.latency_ms,
                "created_at": log.created_at,
            }
            for log in logs
        ]

    async def get_task_audio(self, task_id: int) -> str | None:
        result = await self.db.execute(select(TTSTask).where(TTSTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return None
        return task.audio_url

    async def get_task_segments(self, task_id: int) -> list[dict]:
        result = await self.db.execute(
            select(TTSTaskSegment)
            .where(TTSTaskSegment.task_id == task_id)
            .order_by(TTSTaskSegment.segment_no)
        )
        segments = result.scalars().all()
        return [
            {
                "segment_no": s.segment_no,
                "segment_text": s.segment_text[:100],
                "char_count": s.char_count,
                "status": s.status,
                "audio_url": s.audio_url,
                "audio_duration_ms": s.audio_duration_ms,
                "error_code": s.error_code,
            }
            for s in segments
        ]
