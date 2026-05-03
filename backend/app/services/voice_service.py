import asyncio
import base64
import logging
import mimetypes
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Thread

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.voice_clone_source import VoiceCloneSource
from app.models.voice_profile import VoiceProfile

logger = logging.getLogger(__name__)

# Sync engine for background threads (same pattern as tts_tasks.py)
_db_url = settings.DATABASE_URL.replace("mysql+aiomysql", "mysql+pymysql")
if _db_url.startswith("sqlite+aiosqlite"):
    _db_url = _db_url.replace("sqlite+aiosqlite", "sqlite")
sync_engine = create_engine(_db_url, pool_pre_ping=True)
SyncSession = sessionmaker(bind=sync_engine)
_active_voice_jobs: set[int] = set()
_active_voice_jobs_lock = Lock()


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _mark_voice_job_inactive(profile_id: int) -> None:
    with _active_voice_jobs_lock:
        _active_voice_jobs.discard(profile_id)


def dispatch_voice_profile_job(profile_id: int) -> bool:
    """
    Dispatch a committed voice profile job exactly once per process.
    Must be called only after the surrounding DB transaction has committed.
    """
    with _active_voice_jobs_lock:
        if profile_id in _active_voice_jobs:
            return False
        _active_voice_jobs.add(profile_id)

    thread = Thread(target=_execute_voice_profile_job, args=(profile_id,), daemon=True)
    thread.start()
    return True


def recover_processing_voice_jobs() -> list[int]:
    """Re-dispatch voice jobs that were left in processing state after a restart or reload."""
    session = SyncSession()
    try:
        profile_ids = session.execute(
            select(VoiceProfile.id).where(
                VoiceProfile.status == "processing",
                VoiceProfile.profile_type.in_(("designed", "cloned")),
            )
        ).scalars().all()
    finally:
        session.close()

    dispatched: list[int] = []
    for profile_id in profile_ids:
        if dispatch_voice_profile_job(profile_id):
            dispatched.append(profile_id)
    return dispatched


def _convert_audio_bytes_to_wav(data: bytes, source_name: str, preferred_mime: str | None) -> tuple[bytes, str]:
    """
    Normalize arbitrary uploaded audio into a WAV payload that MiMo can ingest more reliably.
    Uses ffmpeg, which is already available in the local environment.
    """
    suffix = Path(source_name).suffix or ".bin"
    with tempfile.TemporaryDirectory(prefix="mimo-clone-audio-") as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / f"input{suffix}"
        output_path = temp_path / "normalized.wav"
        input_path.write_bytes(data)

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "wav",
            str(output_path),
        ]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=60,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("ffmpeg is required to normalize clone audio but was not found") from exc
        except subprocess.CalledProcessError as exc:
            detail = (exc.stderr or exc.stdout or "").strip()
            raise RuntimeError(f"Failed to normalize clone audio with ffmpeg: {detail[:500]}") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("Timed out while normalizing clone audio with ffmpeg") from exc

        wav_data = output_path.read_bytes()
        return wav_data, "audio/wav"


def _build_audio_data_url(data: bytes, mime_type: str) -> str:
    payload = base64.b64encode(data).decode("ascii")
    return f"data:{mime_type};base64,{payload}"


async def _normalize_clone_audio_source(source_audio_url: str) -> str:
    """Convert supported audio sources into the DataURL format required by MiMo clone."""
    if source_audio_url.startswith("data:audio/"):
        header, _, encoded = source_audio_url.partition(",")
        if not encoded:
            raise ValueError("Invalid data:audio payload")
        mime_type = header.removeprefix("data:").split(";", 1)[0] or "audio/wav"
        raw = base64.b64decode(encoded)
        wav_data, wav_mime = _convert_audio_bytes_to_wav(raw, "inline_audio", mime_type)
        return _build_audio_data_url(wav_data, wav_mime)

    if source_audio_url.startswith("/static/"):
        relative_path = source_audio_url.removeprefix("/static/")
        file_path = Path(settings.LOCAL_STORAGE_PATH) / relative_path
        if not file_path.exists():
            raise FileNotFoundError(f"Clone audio file not found: {source_audio_url}")

        data = file_path.read_bytes()
        mime_type, _ = mimetypes.guess_type(file_path.name)
        if not mime_type or not mime_type.startswith("audio/"):
            mime_type = "audio/wav"
        wav_data, wav_mime = _convert_audio_bytes_to_wav(data, file_path.name, mime_type)
        return _build_audio_data_url(wav_data, wav_mime)

    if source_audio_url.startswith(("http://", "https://")):
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(source_audio_url)
            resp.raise_for_status()
            data = resp.content
            mime_type = resp.headers.get("content-type", "").split(";")[0].strip()
            if not mime_type.startswith("audio/"):
                mime_type = "audio/wav"
            name = Path(source_audio_url.split("?", 1)[0]).name or "remote_audio"
            wav_data, wav_mime = _convert_audio_bytes_to_wav(data, name, mime_type)
            return _build_audio_data_url(wav_data, wav_mime)

    raise ValueError(
        "Invalid source_audio_url: must be an http(s) URL, /static/ path, or data:audio payload"
    )


def _execute_voice_profile_job(profile_id: int):
    session = SyncSession()
    try:
        profile = session.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        ).scalar_one_or_none()
        if not profile:
            logger.error("VoiceProfile %s not found for dispatch", profile_id)
            return

        if profile.status != "processing":
            logger.info(
                "Skip dispatch for VoiceProfile %s because status is %s",
                profile_id,
                profile.status,
            )
            return

        profile_type = profile.profile_type
    finally:
        session.close()

    try:
        if profile_type == "designed":
            _execute_voice_design(profile_id)
        elif profile_type == "cloned":
            _execute_voice_clone(profile_id)
        else:
            logger.warning("Unsupported voice profile type %s for profile %s", profile_type, profile_id)
    finally:
        _mark_voice_job_inactive(profile_id)


def _execute_voice_design(profile_id: int):
    """Run voice design in a background thread. Loads profile, calls provider, updates status."""
    import uuid as _uuid

    from app.infra.provider import get_provider_adapter
    from app.infra.storage import get_storage_service

    session = SyncSession()
    try:
        profile = session.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        ).scalar_one_or_none()

        if not profile:
            logger.error(f"VoiceProfile {profile_id} not found")
            return

        provider = get_provider_adapter(profile.model_code)
        result = _run_async(provider.create_voice_design(
            description=profile.description or "",
            model_code=profile.model_code,
        ))

        profile.provider_voice_id = result["provider_voice_id"]
        profile.status = result.get("status", "active")

        audio_data = _run_async(provider.get_design_audio_data(result["provider_voice_id"]))
        if audio_data:
            storage = get_storage_service()
            key = f"audio/design/{profile_id}/{_uuid.uuid4().hex}.wav"
            profile.audio_url = _run_async(storage.upload(key, audio_data, content_type="audio/wav"))

        session.commit()
        logger.info(f"VoiceProfile {profile_id} design succeeded: {profile.provider_voice_id}")

    except Exception as exc:
        session.rollback()
        try:
            profile = session.execute(
                select(VoiceProfile).where(VoiceProfile.id == profile_id)
            ).scalar_one_or_none()
            if profile:
                profile.status = "rejected"
            session.commit()
        except Exception:
            session.rollback()
        logger.exception(f"VoiceProfile {profile_id} design failed")

    finally:
        session.close()


def _execute_voice_clone(profile_id: int):
    """Run voice clone in a background thread. Loads profile + source, calls provider, updates status."""
    from app.infra.provider import get_provider_adapter

    session = SyncSession()
    try:
        profile = session.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        ).scalar_one_or_none()
        if not profile:
            logger.error(f"VoiceProfile {profile_id} not found for clone")
            return

        source = session.execute(
            select(VoiceCloneSource).where(VoiceCloneSource.voice_profile_id == profile_id)
        ).scalar_one_or_none()
        if not source:
            logger.error(f"VoiceCloneSource for profile {profile_id} not found")
            return

        provider = get_provider_adapter(profile.model_code)
        normalized_source = _run_async(_normalize_clone_audio_source(source.source_audio_url))
        result = _run_async(provider.create_voice_clone(
            source_audio_url=normalized_source,
            model_code=profile.model_code,
        ))

        profile.provider_voice_id = result["provider_voice_id"]
        profile.status = result.get("status", "active")
        source.risk_status = "approved"
        session.commit()
        logger.info(f"VoiceProfile {profile_id} clone succeeded: {profile.provider_voice_id}")

    except Exception as exc:
        session.rollback()
        try:
            profile = session.execute(
                select(VoiceProfile).where(VoiceProfile.id == profile_id)
            ).scalar_one_or_none()
            if profile:
                profile.status = "rejected"
            source = session.execute(
                select(VoiceCloneSource).where(VoiceCloneSource.voice_profile_id == profile_id)
            ).scalar_one_or_none()
            if source:
                source.risk_status = "rejected"
                source.review_note = str(exc)[:1000]
            session.commit()
        except Exception:
            session.rollback()
        logger.exception(f"VoiceProfile {profile_id} clone failed")

    finally:
        session.close()


class VoiceService:
    def __init__(self, db):
        self.db = db

    async def list_profiles(
        self, user_id: int | None, profile_type: str | None
    ) -> list[dict]:
        from sqlalchemy import and_, or_

        stmt = select(VoiceProfile).where(VoiceProfile.status != "disabled")
        if profile_type:
            stmt = stmt.where(VoiceProfile.profile_type == profile_type)
        # System voices are public; user also sees their own non-cloned profiles.
        # Unpublished cloned profiles are managed by the frontend via localStorage.
        if user_id:
            stmt = stmt.where(
                or_(
                    VoiceProfile.is_public == 1,
                    and_(
                        VoiceProfile.user_id == user_id,
                        VoiceProfile.profile_type != "cloned",
                    ),
                )
            )
        else:
            stmt = stmt.where(VoiceProfile.is_public == 1)
        stmt = stmt.order_by(VoiceProfile.id)
        result = await self.db.execute(stmt)
        profiles = result.scalars().all()
        return [
            {
                "id": p.id,
                "profile_type": p.profile_type,
                "name": p.name,
                "model_code": p.model_code,
                "provider_voice_id": p.provider_voice_id,
                "description": p.description,
                "gender_hint": p.gender_hint,
                "age_hint": p.age_hint,
                "language_hint": p.language_hint,
                "status": p.status,
            }
            for p in profiles
        ]

    async def get_profile(self, profile_id: int) -> dict | None:
        result = await self.db.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        )
        p = result.scalar_one_or_none()
        if not p:
            return None
        return {
            "id": p.id,
            "profile_type": p.profile_type,
            "name": p.name,
            "model_code": p.model_code,
            "provider_voice_id": p.provider_voice_id,
            "description": p.description,
            "gender_hint": p.gender_hint,
            "age_hint": p.age_hint,
            "language_hint": p.language_hint,
            "status": p.status,
            "is_public": p.is_public,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }

    async def update_profile(self, profile_id: int, **fields) -> dict | None:
        result = await self.db.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return None

        allowed = {"name", "description", "gender_hint", "age_hint", "language_hint", "is_public"}
        for key, value in fields.items():
            if key in allowed and value is not None:
                setattr(profile, key, value)

        await self.db.flush()
        return {
            "id": profile.id,
            "profile_type": profile.profile_type,
            "name": profile.name,
            "model_code": profile.model_code,
            "provider_voice_id": profile.provider_voice_id,
            "status": profile.status,
        }

    async def delete_profile(self, profile_id: int) -> bool:
        result = await self.db.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return False

        profile.status = "disabled"
        await self.db.flush()
        return True

    async def create_design(
        self, user_id: int, name: str, model_code: str, description: str
    ) -> dict:
        profile = VoiceProfile(
            user_id=user_id,
            profile_type="designed",
            name=name,
            model_code=model_code,
            description=description,
            status="processing",
        )
        self.db.add(profile)
        await self.db.flush()

        return {"voice_profile_id": profile.id, "status": profile.status}

    async def create_clone(
        self,
        user_id: int,
        name: str,
        model_code: str,
        source_audio_url: str,
        consent_type: str,
        consent_statement: str,
    ) -> dict:
        if not source_audio_url or not source_audio_url.startswith(
            ("http://", "https://", "/static/", "data:audio/")
        ):
            raise ValueError(
                "Invalid source_audio_url: must be an http(s) URL, /static/ path, or data:audio payload"
            )
        valid_consent_types = {"self", "authorized_agent", "enterprise"}
        if consent_type not in valid_consent_types:
            raise ValueError(f"Invalid consent_type: must be one of {valid_consent_types}")

        profile = VoiceProfile(
            user_id=user_id,
            profile_type="cloned",
            name=name,
            model_code=model_code,
            status="processing",
        )
        self.db.add(profile)
        await self.db.flush()

        source = VoiceCloneSource(
            voice_profile_id=profile.id,
            user_id=user_id,
            source_audio_url=source_audio_url,
            consent_type=consent_type,
            consent_statement=consent_statement,
            risk_status="approved",
        )
        self.db.add(source)
        await self.db.flush()

        return {
            "voice_profile_id": profile.id,
            "status": "processing",
            "risk_status": "approved",
        }

    async def approve_clone(self, profile_id: int, review_note: str | None = None) -> dict | None:
        result = await self.db.execute(
            select(VoiceCloneSource).where(VoiceCloneSource.voice_profile_id == profile_id)
        )
        source = result.scalar_one_or_none()
        if not source or source.risk_status != "pending":
            return None

        profile_result = await self.db.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile or profile.status != "pending_review":
            return None

        source.risk_status = "approved"
        if review_note:
            source.review_note = review_note
        profile.status = "processing"
        await self.db.flush()

        return {"voice_profile_id": profile.id, "status": profile.status, "risk_status": source.risk_status}

    async def reject_clone(self, profile_id: int, review_note: str) -> dict | None:
        result = await self.db.execute(
            select(VoiceCloneSource).where(VoiceCloneSource.voice_profile_id == profile_id)
        )
        source = result.scalar_one_or_none()
        if not source or source.risk_status != "pending":
            return None

        profile_result = await self.db.execute(
            select(VoiceProfile).where(VoiceProfile.id == profile_id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile or profile.status != "pending_review":
            return None

        source.risk_status = "rejected"
        source.review_note = review_note
        profile.status = "rejected"
        await self.db.flush()

        return {"voice_profile_id": profile.id, "status": profile.status, "risk_status": source.risk_status}

    async def get_clone_source(self, profile_id: int) -> dict | None:
        result = await self.db.execute(
            select(VoiceCloneSource).where(VoiceCloneSource.voice_profile_id == profile_id)
        )
        source = result.scalar_one_or_none()
        if not source:
            return None
        return {
            "id": source.id,
            "voice_profile_id": source.voice_profile_id,
            "source_audio_url": source.source_audio_url,
            "consent_type": source.consent_type,
            "consent_statement": source.consent_statement,
            "consent_proof_url": source.consent_proof_url,
            "risk_status": source.risk_status,
            "review_note": source.review_note,
        }
