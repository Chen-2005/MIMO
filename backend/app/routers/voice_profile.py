import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.infra.storage import get_storage_service
from app.models.audit_log import AuditLog
from app.models.voice_clone_source import VoiceCloneSource
from app.schemas.common import ApiResponse
from app.schemas.voice_profile import (
    ApproveCloneRequest,
    AuditLogItem,
    CloneSourceDetail,
    CreateVoiceCloneRequest,
    CreateVoiceDesignRequest,
    RejectCloneRequest,
    UploadVoiceCloneAudioResponse,
    UpdateVoiceProfileRequest,
    VoiceProfileCreated,
    VoiceProfileDetail,
    VoiceProfileItem,
)
from app.services.audit_service import AuditService
from app.services.voice_service import VoiceService, dispatch_voice_profile_job

router = APIRouter(prefix="/voice-profiles", tags=["Voice Profiles"])


@router.get("", response_model=ApiResponse[list[VoiceProfileItem]])
async def list_voice_profiles(
    profile_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    items = await service.list_profiles(user_id, profile_type)
    return ApiResponse(data=[VoiceProfileItem(**i) for i in items])


@router.get("/audit-logs", response_model=ApiResponse[list[AuditLogItem]])
async def list_audit_logs(
    entity_type: str | None = None,
    entity_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return ApiResponse(data=[AuditLogItem(
        id=l.id, action=l.action, entity_type=l.entity_type,
        entity_id=l.entity_id, detail=l.detail, created_at=l.created_at,
    ) for l in logs])


@router.get("/{profile_id}", response_model=ApiResponse[VoiceProfileDetail])
async def get_voice_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    result = await service.get_profile(profile_id)
    if not result:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    return ApiResponse(data=VoiceProfileDetail(**result))


@router.patch("/{profile_id}", response_model=ApiResponse[VoiceProfileItem])
async def update_voice_profile(
    profile_id: int,
    body: UpdateVoiceProfileRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    result = await service.update_profile(profile_id, **body.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    await db.commit()
    return ApiResponse(data=VoiceProfileItem(**result))


@router.delete("/{profile_id}", response_model=ApiResponse[dict])
async def delete_voice_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    deleted = await service.delete_profile(profile_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    audit = AuditService(db)
    await audit.log(
        action="voice_profile_deleted",
        entity_type="voice_profile",
        entity_id=profile_id,
        user_id=user_id,
    )
    await db.commit()
    return ApiResponse(data={"message": "Voice profile disabled"})


@router.post("/design", response_model=ApiResponse[VoiceProfileCreated])
async def create_voice_design(
    body: CreateVoiceDesignRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    result = await service.create_design(user_id, body.name, body.model_code, body.description)
    await db.commit()
    dispatch_voice_profile_job(result["voice_profile_id"])
    return ApiResponse(data=VoiceProfileCreated(**result))


@router.post("/clone", response_model=ApiResponse[VoiceProfileCreated])
async def create_voice_clone(
    body: CreateVoiceCloneRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    try:
        result = await service.create_clone(
            user_id, body.name, body.model_code,
            body.source_audio_url, body.consent_type, body.consent_statement,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit = AuditService(db)
    await audit.log(
        action="clone_consent_submitted",
        entity_type="voice_clone_source",
        entity_id=result["voice_profile_id"],
        user_id=user_id,
        detail=f"consent_type={body.consent_type or 'internal_use'}",
    )
    await db.commit()
    dispatch_voice_profile_job(result["voice_profile_id"])
    return ApiResponse(data=VoiceProfileCreated(**result))


@router.post("/clone/audio", response_model=ApiResponse[UploadVoiceCloneAudioResponse])
async def upload_clone_audio(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    allowed_prefixes = ("audio/",)
    if not file.content_type or not file.content_type.startswith(allowed_prefixes):
        raise HTTPException(status_code=400, detail="Only audio files are accepted")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 20MB)")

    storage = get_storage_service()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "wav"
    key = f"voice_clone_sources/{user_id}/{uuid.uuid4().hex}.{ext}"
    url = await storage.upload(key, data, content_type=file.content_type)
    return ApiResponse(data=UploadVoiceCloneAudioResponse(source_audio_url=url))


@router.post("/{profile_id}/clone/approve", response_model=ApiResponse[VoiceProfileCreated])
async def approve_clone(
    profile_id: int,
    body: ApproveCloneRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    result = await service.approve_clone(profile_id, body.review_note if body else None)
    if not result:
        raise HTTPException(status_code=404, detail="Clone request not found or not pending")
    audit = AuditService(db)
    await audit.log(
        action="clone_approved",
        entity_type="voice_profile",
        entity_id=profile_id,
        user_id=user_id,
        detail=body.review_note if body else None,
    )
    await db.commit()
    dispatch_voice_profile_job(profile_id)
    return ApiResponse(data=VoiceProfileCreated(**result))


@router.post("/{profile_id}/clone/reject", response_model=ApiResponse[VoiceProfileCreated])
async def reject_clone(
    profile_id: int,
    body: RejectCloneRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    result = await service.reject_clone(profile_id, body.review_note)
    if not result:
        raise HTTPException(status_code=404, detail="Clone request not found or not pending")
    audit = AuditService(db)
    await audit.log(
        action="clone_rejected",
        entity_type="voice_profile",
        entity_id=profile_id,
        user_id=user_id,
        detail=body.review_note,
    )
    await db.commit()
    return ApiResponse(data=VoiceProfileCreated(**result))


@router.get("/{profile_id}/clone-source", response_model=ApiResponse[CloneSourceDetail])
async def get_clone_source(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    service = VoiceService(db)
    result = await service.get_clone_source(profile_id)
    if not result:
        raise HTTPException(status_code=404, detail="Clone source not found")
    return ApiResponse(data=CloneSourceDetail(**result))


@router.post("/{profile_id}/consent-proof", response_model=ApiResponse[dict])
async def upload_consent_proof(
    profile_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    allowed_types = {"image/jpeg", "image/png", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and PDF files are accepted")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    storage = get_storage_service()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    key = f"consent_proofs/{profile_id}/{uuid.uuid4().hex}.{ext}"
    url = await storage.upload(key, data, content_type=file.content_type)

    result = await db.execute(
        select(VoiceCloneSource).where(VoiceCloneSource.voice_profile_id == profile_id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Clone source not found")
    source.consent_proof_url = url
    await db.flush()

    audit = AuditService(db)
    await audit.log(
        action="consent_proof_uploaded",
        entity_type="voice_clone_source",
        entity_id=profile_id,
        user_id=user_id,
    )
    await db.commit()
    return ApiResponse(data={"consent_proof_url": url})
