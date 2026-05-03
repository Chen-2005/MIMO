from pydantic import BaseModel


class MetricsSummary(BaseModel):
    request_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    fallback_count: int = 0
    text_char_count: int = 0
    audio_duration_ms: int = 0
    estimated_cost: float = 0.0
    clone_request_count: int = 0
