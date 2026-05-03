from datetime import datetime

from pydantic import BaseModel


class CreateTTSRequest(BaseModel):
    request_id: str
    text: str
    model_code: str = "MiMo-V2.5-TTS"
    voice_profile_id: int | None = None
    style_prompt: str | None = None
    speed: float | None = None
    pitch: float | None = None
    volume: float | None = None
    emotion: str | None = None
    output_format: str = "mp3"
    enable_fallback: bool = True


class TaskCreated(BaseModel):
    task_id: int
    task_no: str
    status: str


class TaskDetail(BaseModel):
    task_id: int
    task_no: str
    status: str
    model_code: str
    final_model_code: str | None = None
    fallback_used: bool = False
    voice_profile_id: int | None = None
    text_char_count: int = 0
    style_prompt: str | None = None
    speed: float | None = None
    output_format: str = "mp3"
    audio_url: str | None = None
    audio_duration_ms: int | None = None
    provider_error_code: str | None = None
    provider_error_message: str | None = None
    segment_count: int = 0
    created_at: datetime | None = None
    finished_at: datetime | None = None


class SegmentItem(BaseModel):
    segment_no: int
    segment_text: str
    char_count: int
    status: str
    audio_url: str | None = None
    audio_duration_ms: int | None = None
    error_code: str | None = None


class TaskListItem(BaseModel):
    task_id: int
    task_no: str
    status: str
    model_code: str
    fallback_used: bool = False
    audio_url: str | None = None
    audio_duration_ms: int | None = None
    created_at: datetime | None = None


class RetryTaskRequest(BaseModel):
    force_fallback: bool = False


class TaskActionResponse(BaseModel):
    task_id: int
    status: str
    source_task_id: int | None = None


class ProviderLogItem(BaseModel):
    id: int
    provider_name: str
    model_code: str
    request_summary: str | None = None
    response_summary: str | None = None
    http_status: int | None = None
    provider_error_code: str | None = None
    latency_ms: int
    created_at: datetime | None = None
