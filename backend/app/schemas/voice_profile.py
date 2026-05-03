from datetime import datetime

from pydantic import BaseModel


class VoiceProfileItem(BaseModel):
    id: int
    profile_type: str
    name: str
    model_code: str
    provider_voice_id: str | None = None
    description: str | None = None
    gender_hint: str | None = None
    age_hint: str | None = None
    language_hint: str | None = None
    status: str
    audio_url: str | None = None


class VoiceProfileDetail(BaseModel):
    id: int
    profile_type: str
    name: str
    model_code: str
    provider_voice_id: str | None = None
    description: str | None = None
    gender_hint: str | None = None
    age_hint: str | None = None
    language_hint: str | None = None
    status: str
    is_public: int
    audio_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CreateVoiceDesignRequest(BaseModel):
    name: str
    model_code: str = "MiMo-V2.5-TTS-VoiceDesign"
    description: str


class CreateVoiceCloneRequest(BaseModel):
    name: str
    model_code: str = "MiMo-V2.5-TTS-VoiceClone"
    source_audio_url: str
    consent_type: str
    consent_statement: str


class UpdateVoiceProfileRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    gender_hint: str | None = None
    age_hint: str | None = None
    language_hint: str | None = None
    is_public: int | None = None


class VoiceProfileCreated(BaseModel):
    voice_profile_id: int
    status: str
    risk_status: str | None = None


class UploadVoiceCloneAudioResponse(BaseModel):
    source_audio_url: str


class ApproveCloneRequest(BaseModel):
    review_note: str | None = None


class RejectCloneRequest(BaseModel):
    review_note: str


class CloneSourceDetail(BaseModel):
    id: int
    voice_profile_id: int
    source_audio_url: str
    consent_type: str
    consent_statement: str
    consent_proof_url: str | None = None
    risk_status: str
    review_note: str | None = None


class AuditLogItem(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None = None
    detail: str | None = None
    created_at: datetime | None = None
