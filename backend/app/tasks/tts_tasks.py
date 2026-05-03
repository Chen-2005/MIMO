import asyncio
import io
import logging
import struct
import time
import uuid
from datetime import datetime, timezone
from threading import Thread

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.provider_call_log import ProviderCallLog
from app.models.tts_task import TTSTask
from app.models.tts_task_segment import TTSTaskSegment
from app.models.voice_clone_source import VoiceCloneSource
from app.models.voice_profile import VoiceProfile
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# Celery workers use synchronous SQLAlchemy
_db_url = settings.DATABASE_URL.replace("mysql+aiomysql", "mysql+pymysql")
if _db_url.startswith("sqlite+aiosqlite"):
    _db_url = _db_url.replace("sqlite+aiosqlite", "sqlite")
sync_engine = create_engine(_db_url, pool_pre_ping=True)
SyncSession = sessionmaker(bind=sync_engine)


def _get_provider(model_code: str | None = None):
    from app.infra.provider import get_provider_adapter
    return get_provider_adapter(model_code)


def _get_storage():
    from app.infra.storage import get_storage_service, make_audio_key
    return get_storage_service(), make_audio_key


def _run_async(coro):
    """Run an async coroutine from sync context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _estimate_duration(data: bytes, fmt: str) -> int:
    """Estimate audio duration in ms."""
    if fmt == "wav" and len(data) > 44 and data[:4] == b"RIFF":
        try:
            sample_rate = struct.unpack_from("<I", data, 24)[0]
            data_size = struct.unpack_from("<I", data, 40)[0]
            bits_per_sample = struct.unpack_from("<H", data, 34)[0]
            channels = struct.unpack_from("<H", data, 22)[0]
            if sample_rate > 0 and bits_per_sample > 0 and channels > 0:
                duration_s = data_size / (sample_rate * channels * bits_per_sample // 8)
                return int(duration_s * 1000)
        except Exception:
            pass
    return max(1000, int(len(data) * 8 / 128_000 * 1000))


def _resolve_generation_context(session, task, requested_model_code: str) -> tuple[str, str, bool, str | None]:
    """
    Return (effective_model_code, voice_value, disable_fallback, extra_style_prompt).

    System voices use the TTS model with provider_voice_id.
    Cloned voices use the VoiceClone model with source audio.
    Designed voices use the VoiceDesign model with description.
    """
    if not task.voice_profile_id:
        return requested_model_code, "", False, None

    profile = session.execute(
        select(VoiceProfile).where(VoiceProfile.id == task.voice_profile_id)
    ).scalar_one_or_none()
    if not profile:
        return requested_model_code, "", False, None

    if profile.profile_type == "cloned":
        source = session.execute(
            select(VoiceCloneSource).where(VoiceCloneSource.voice_profile_id == profile.id)
        ).scalar_one_or_none()
        if not source:
            raise RuntimeError(f"Clone source not found for voice profile {profile.id}")

        from app.services.voice_service import _normalize_clone_audio_source

        normalized_source = _run_async(_normalize_clone_audio_source(source.source_audio_url))
        return "MiMo-V2.5-TTS-VoiceClone", normalized_source, True, None

    if profile.profile_type == "designed":
        return "MiMo-V2.5-TTS-VoiceDesign", "", True, profile.description or None

    if profile.profile_type == "system":
        return requested_model_code, profile.provider_voice_id or "", False, None

    return requested_model_code, "", False, None


def _execute_single_model(session, task, model_code, provider_name, storage, make_key):
    """Execute TTS for a single model. Returns (audio_url, audio_duration_ms, provider_task_id) or raises."""
    start_time = time.monotonic()
    provider = _get_provider(model_code)
    effective_model_code, effective_voice, disable_fallback, extra_style = _resolve_generation_context(
        session,
        task,
        model_code,
    )

    merged_style = task.style_prompt
    if extra_style:
        merged_style = f"{extra_style}。{merged_style}" if merged_style else extra_style

    log_entry = ProviderCallLog(
        task_id=task.id,
        provider_name=provider_name,
        model_code=effective_model_code,
        request_summary=(
            f"text_len={task.text_char_count}, voice={task.voice_profile_id}, "
            f"effective_model={effective_model_code}"
        ),
        latency_ms=0,
    )

    try:
        result = _run_async(provider.create_tts(
            text=task.normalized_text or task.input_text,
            voice_id=effective_voice,
            model_code=effective_model_code,
            speed=float(task.speed) if task.speed else None,
            pitch=float(task.pitch) if task.pitch else None,
            volume=float(task.volume) if task.volume else None,
            emotion=task.emotion,
            style_prompt=merged_style,
        ))

        provider_task_id = result.get("provider_task_id")
        task.provider_task_id = provider_task_id

        audio_data = _run_async(provider.get_audio_data(provider_task_id))
        key = make_key(task.id, task.output_format)
        audio_url = _run_async(storage.upload(key, audio_data))
        audio_duration_ms = _estimate_duration(audio_data, task.output_format)

        # Success — log it
        latency_ms = int((time.monotonic() - start_time) * 1000)
        log_entry.response_summary = f"provider_task_id={provider_task_id}, audio_size={len(audio_data)}"
        log_entry.http_status = 200
        log_entry.latency_ms = latency_ms
        session.add(log_entry)

        return audio_url, audio_duration_ms, provider_task_id, effective_model_code, disable_fallback

    except Exception as exc:
        # Log the failure
        latency_ms = int((time.monotonic() - start_time) * 1000)
        log_entry.request_summary = str(exc)[:500]
        log_entry.http_status = 0
        log_entry.provider_error_code = type(exc).__name__
        log_entry.latency_ms = latency_ms
        session.add(log_entry)
        raise


def _merge_audio(audio_chunks: list[bytes], fmt: str) -> bytes:
    """Merge multiple audio chunks into one file."""
    if not audio_chunks:
        return b""
    if len(audio_chunks) == 1:
        return audio_chunks[0]

    if fmt == "wav":
        return _merge_wav(audio_chunks)
    # For mp3/ogg/other formats: concatenate raw bytes
    # Most players handle consecutive same-codec frames correctly
    return b"".join(audio_chunks)


def _merge_wav(chunks: list[bytes]) -> bytes:
    """Merge WAV files by concatenating PCM data and fixing the RIFF header."""
    if not chunks:
        return b""

    # Use the first chunk's header as the template
    header = chunks[0][:44]
    sample_rate = struct.unpack_from("<I", header, 24)[0]
    bits_per_sample = struct.unpack_from("<H", header, 34)[0]
    num_channels = struct.unpack_from("<H", header, 22)[0]
    block_align = num_channels * bits_per_sample // 8
    byte_rate = sample_rate * block_align

    # Collect all PCM data
    pcm_data = bytearray()
    for chunk in chunks:
        if len(chunk) > 44 and chunk[:4] == b"RIFF":
            pcm_data.extend(chunk[44:])
        else:
            pcm_data.extend(chunk)

    data_size = len(pcm_data)
    file_size = 36 + data_size

    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", file_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, num_channels, sample_rate, byte_rate, block_align, bits_per_sample))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(bytes(pcm_data))
    return buf.getvalue()


def _download_segment_audio(storage, audio_url: str) -> bytes:
    """Download segment audio from storage."""
    if hasattr(storage, "base_path"):
        # LocalStorageService — read from filesystem
        # audio_url is like "/static/audio/..." — strip prefix to get key
        key = audio_url.removeprefix("/static/")
        file_path = storage.base_path / key
        with open(file_path, "rb") as f:
            return f.read()
    else:
        # S3StorageService — use boto3
        key = audio_url.split("/", 3)[-1] if "/" in audio_url else audio_url
        resp = storage.s3.get_object(Bucket=storage.bucket, Key=key)
        return resp["Body"].read()


def _execute_segmented_generation(session, task, storage, make_key):
    """Execute TTS for a segmented task. Processes each segment, then merges audio."""
    provider_name = "mimo" if settings.PROVIDER_MODE == "mimo" else "mock"
    model_code = task.model_code

    # For cloned voices, resolve the effective model and voice once for all segments
    effective_model_code, effective_voice, _, extra_style = _resolve_generation_context(
        session, task, model_code,
    )

    # Query all segments
    segments = session.execute(
        select(TTSTaskSegment)
        .where(TTSTaskSegment.task_id == task.id)
        .order_by(TTSTaskSegment.segment_no)
    ).scalars().all()

    if not segments:
        raise ValueError(f"No segments found for task {task.id}")

    audio_chunks: list[bytes] = []
    total_duration_ms = 0

    for segment in segments:
        segment.status = "running"
        session.commit()

        provider = _get_provider(model_code)
        log_entry = ProviderCallLog(
            task_id=task.id,
            segment_id=segment.id,
            provider_name=provider_name,
            model_code=effective_model_code,
            request_summary=f"segment={segment.segment_no}, text_len={segment.char_count}",
            latency_ms=0,
        )
        start_time = time.monotonic()

        try:
            seg_style = task.style_prompt
            if extra_style:
                seg_style = f"{extra_style}。{seg_style}" if seg_style else extra_style

            result = _run_async(provider.create_tts(
                text=segment.segment_text,
                voice_id=effective_voice,
                model_code=effective_model_code,
                speed=float(task.speed) if task.speed else None,
                pitch=float(task.pitch) if task.pitch else None,
                volume=float(task.volume) if task.volume else None,
                emotion=task.emotion,
                style_prompt=seg_style,
            ))

            provider_task_id = result.get("provider_task_id")
            segment.provider_task_id = provider_task_id

            audio_data = _run_async(provider.get_audio_data(provider_task_id))
            key = make_key(task.id, task.output_format)
            # Store segment audio with segment number in key
            seg_key = f"audio/{task.id}/seg_{segment.segment_no}_{uuid.uuid4().hex[:8]}.{task.output_format}"
            seg_audio_url = _run_async(storage.upload(seg_key, audio_data))
            seg_duration_ms = _estimate_duration(audio_data, task.output_format)

            segment.audio_url = seg_audio_url
            segment.audio_duration_ms = seg_duration_ms
            segment.status = "succeeded"
            audio_chunks.append(audio_data)
            total_duration_ms += seg_duration_ms

            # Log success
            latency_ms = int((time.monotonic() - start_time) * 1000)
            log_entry.response_summary = f"provider_task_id={provider_task_id}, audio_size={len(audio_data)}"
            log_entry.http_status = 200
            log_entry.latency_ms = latency_ms
            session.add(log_entry)
            session.commit()

        except Exception as exc:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            segment.status = "failed"
            segment.error_code = type(exc).__name__
            segment.error_message = str(exc)[:1000]

            log_entry.request_summary = str(exc)[:500]
            log_entry.http_status = 0
            log_entry.provider_error_code = type(exc).__name__
            log_entry.latency_ms = latency_ms
            session.add(log_entry)
            session.commit()

            raise

    # All segments succeeded — merge audio
    merged_data = _merge_audio(audio_chunks, task.output_format)
    merged_key = make_key(task.id, task.output_format)
    merged_url = _run_async(storage.upload(merged_key, merged_data))
    merged_duration_ms = _estimate_duration(merged_data, task.output_format)

    task.status = "succeeded"
    task.final_model_code = effective_model_code
    task.audio_url = merged_url
    task.audio_duration_ms = merged_duration_ms
    task.finished_at = datetime.now(timezone.utc)


def _execute_tts_generation(session, task, storage, make_key):
    """Core TTS generation with automatic fallback. Modifies task in-place."""
    # Check if task has segments (long text)
    segments = session.execute(
        select(TTSTaskSegment).where(TTSTaskSegment.task_id == task.id)
    ).scalars().all()
    if segments:
        _execute_segmented_generation(session, task, storage, make_key)
        return

    provider_name = "mimo" if settings.PROVIDER_MODE == "mimo" else "mock"
    primary_model = task.model_code

    try:
        audio_url, audio_duration_ms, provider_task_id, actual_model_code, disable_fallback = _execute_single_model(
            session, task, primary_model, provider_name, storage, make_key
        )
        task.status = "succeeded"
        task.final_model_code = actual_model_code
        task.audio_url = audio_url
        task.audio_duration_ms = audio_duration_ms
        task.finished_at = datetime.now(timezone.utc)
        return

    except Exception as primary_exc:
        logger.warning(f"Task {task.id} primary model {primary_model} failed: {primary_exc}")

        # Attempt fallback if enabled
        enable_fallback = getattr(task, "_enable_fallback", True)
        if not enable_fallback:
            raise

        fallback_model = "MiMo-V2-TTS"
        if primary_model == fallback_model:
            raise  # Already the fallback model, give up

        logger.info(f"Task {task.id} falling back to {fallback_model}")
        try:
            audio_url, audio_duration_ms, provider_task_id, actual_model_code, _ = _execute_single_model(
                session, task, fallback_model, provider_name, storage, make_key
            )
            task.status = "succeeded"
            task.final_model_code = actual_model_code
            task.fallback_used = 1
            task.audio_url = audio_url
            task.audio_duration_ms = audio_duration_ms
            task.finished_at = datetime.now(timezone.utc)
            return

        except Exception as fallback_exc:
            logger.error(f"Task {task.id} fallback also failed: {fallback_exc}")
            raise fallback_exc from primary_exc


def _execute_task(task_id: int, enable_fallback: bool = True):
    """Execute a TTS task synchronously. Used by both Celery and sync executor."""
    session = SyncSession()
    try:
        task = session.execute(select(TTSTask).where(TTSTask.id == task_id)).scalar_one_or_none()
        if not task:
            return {"error": f"Task {task_id} not found"}

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        # Stash fallback flag for _execute_tts_generation
        task._enable_fallback = enable_fallback
        session.commit()

        storage, make_key = _get_storage()

        _execute_tts_generation(session, task, storage, make_key)
        session.commit()

        logger.info(f"Task {task_id} succeeded, audio_url={task.audio_url}")
        return {"task_id": task_id, "status": "succeeded", "audio_url": task.audio_url}

    except Exception as exc:
        session.rollback()
        try:
            task = session.execute(select(TTSTask).where(TTSTask.id == task_id)).scalar_one_or_none()
            if task:
                task.status = "failed"
                task.provider_error_message = str(exc)[:1000]
                task.finished_at = datetime.now(timezone.utc)
            session.commit()
        except Exception:
            session.rollback()

        logger.exception(f"Task {task_id} failed")
        return {"task_id": task_id, "status": "failed", "error": str(exc)}

    finally:
        session.close()


@celery_app.task(bind=True, name="tts.generate", max_retries=2, default_retry_delay=5)
def generate_tts(self, task_id: int) -> dict:
    """Celery task entry point for TTS generation."""
    result = _execute_task(task_id, enable_fallback=True)
    if result.get("status") == "failed" and self.request.retries < self.max_retries:
        raise self.retry(exc=Exception(result.get("error", "unknown")))
    return result


def run_tts_sync(task_id: int, enable_fallback: bool = True) -> None:
    """Run TTS generation in a background thread (for non-Celery environments)."""
    def _worker():
        _execute_task(task_id, enable_fallback=enable_fallback)
    Thread(target=_worker, daemon=True).start()
