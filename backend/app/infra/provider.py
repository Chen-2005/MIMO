import base64
import io
import logging
import math
import struct
import uuid
from abc import ABC, abstractmethod
from urllib.parse import urlsplit, urlunsplit

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_MODEL_MAP = {
    "MiMo-V2.5-TTS": "mimo-v2.5-tts",
    "MiMo-V2.5-TTS-VoiceDesign": "mimo-v2.5-tts-voicedesign",
    "MiMo-V2.5-TTS-VoiceClone": "mimo-v2.5-tts-voiceclone",
    "MiMo-V2-TTS": "mimo-v2-tts",
}

_VOICE_SAMPLE_TEXT = "你好，这是一段用于创建音色的测试语音。"


class AbstractProviderAdapter(ABC):
    @abstractmethod
    async def create_tts(
        self, text: str, voice_id: str, model_code: str, **params
    ) -> dict:
        """Submit a TTS request and return provider task metadata."""

    @abstractmethod
    async def poll_status(self, provider_task_id: str) -> dict:
        """Poll task status."""

    @abstractmethod
    async def get_audio_data(self, provider_task_id: str) -> bytes:
        """Download synthesized audio bytes."""

    @abstractmethod
    async def create_voice_design(self, description: str, model_code: str) -> dict:
        """Create a voice from a natural language description."""

    async def get_design_audio_data(self, provider_voice_id: str) -> bytes | None:
        """Retrieve cached audio from the last voice design call, if available."""
        return None

    @abstractmethod
    async def create_voice_clone(self, source_audio_url: str, model_code: str) -> dict:
        """Clone a voice from source audio."""


class MockProviderAdapter(AbstractProviderAdapter):
    async def create_tts(
        self, text: str, voice_id: str, model_code: str, **params
    ) -> dict:
        provider_task_id = uuid.uuid4().hex
        return {"provider_task_id": provider_task_id, "status": "succeeded"}

    async def poll_status(self, provider_task_id: str) -> dict:
        return {"status": "succeeded"}

    async def get_audio_data(self, provider_task_id: str) -> bytes:
        return _generate_test_wav(duration_ms=3000, sample_rate=16000)

    async def create_voice_design(self, description: str, model_code: str) -> dict:
        voice_id = f"mock_voice_{uuid.uuid4().hex[:8]}"
        self._audio_cache = getattr(self, "_audio_cache", {})
        self._audio_cache[voice_id] = _generate_test_wav(duration_ms=3000, sample_rate=16000)
        return {"provider_voice_id": voice_id, "status": "active"}

    async def get_design_audio_data(self, provider_voice_id: str) -> bytes | None:
        cache = getattr(self, "_audio_cache", {})
        return cache.pop(provider_voice_id, None)

    async def create_voice_clone(self, source_audio_url: str, model_code: str) -> dict:
        return {"provider_voice_id": f"mock_clone_{uuid.uuid4().hex[:8]}", "status": "active"}


class MiMoProviderAdapter(AbstractProviderAdapter):
    """MiMo adapter via an OpenAI-compatible chat completions API."""

    def __init__(self):
        self.endpoint_url = self._resolve_endpoint_url(settings.MIMO_API_BASE)
        self.client = httpx.AsyncClient(
            headers={
                "api-key": settings.MIMO_API_KEY,
                "Content-Type": "application/json",
            },
            timeout=120.0,
        )
        self._audio_cache: dict[str, bytes] = {}

    def _resolve_endpoint_url(self, raw_base: str) -> str:
        """
        Accept either:
        - https://api.xiaomimimo.com
        - https://api.xiaomimimo.com/v1
        - https://api.xiaomimimo.com/v1/chat/completions
        and normalize all of them to the final chat completions endpoint.
        """
        base = raw_base.strip().rstrip("/")
        if not base:
            raise ValueError("MIMO_API_BASE is not configured")

        parsed = urlsplit(base)
        path = parsed.path.rstrip("/")
        if path.endswith("/v1/chat/completions"):
            final_path = path
        elif path.endswith("/v1"):
            final_path = f"{path}/chat/completions"
        else:
            final_path = f"{path}/v1/chat/completions" if path else "/v1/chat/completions"

        return urlunsplit((parsed.scheme, parsed.netloc, final_path, "", ""))

    def _resolve_model(self, model_code: str) -> str:
        return _MODEL_MAP.get(model_code, model_code.lower())

    async def create_tts(
        self, text: str, voice_id: str, model_code: str, **params
    ) -> dict:
        api_model = self._resolve_model(model_code)
        style_parts = []
        if params.get("style_prompt"):
            style_parts.append(str(params["style_prompt"]))
        if params.get("emotion"):
            style_parts.append(str(params["emotion"]))

        payload = {
            "model": api_model,
            "messages": [
                {"role": "user", "content": "，".join(style_parts) if style_parts else ""},
                {"role": "assistant", "content": text},
            ],
            "audio": {
                "format": "wav",
                **({"voice": voice_id} if voice_id else {}),
            },
            "stream": False,
        }

        resp = await self.client.post(self.endpoint_url, json=payload)
        if resp.status_code != 200:
            logger.error("MiMo API error %s: %s", resp.status_code, resp.text[:500])
        resp.raise_for_status()

        data = resp.json()
        task_id = data.get("id", uuid.uuid4().hex)
        audio_b64 = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("audio", {})
            .get("data")
        )
        if audio_b64:
            self._audio_cache[task_id] = base64.b64decode(audio_b64)

        return {"provider_task_id": task_id, "status": "succeeded"}

    async def poll_status(self, provider_task_id: str) -> dict:
        return {"status": "succeeded"}

    async def get_audio_data(self, provider_task_id: str) -> bytes:
        if provider_task_id in self._audio_cache:
            return self._audio_cache.pop(provider_task_id)
        raise RuntimeError(f"No audio data cached for task {provider_task_id}")

    async def create_voice_design(self, description: str, model_code: str) -> dict:
        api_model = self._resolve_model(model_code)
        payload = {
            "model": api_model,
            "messages": [
                {"role": "user", "content": description},
                {"role": "assistant", "content": _VOICE_SAMPLE_TEXT},
            ],
            "audio": {"format": "wav"},
            "stream": False,
        }
        resp = await self.client.post(self.endpoint_url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        voice_id = data.get("id", f"voice_{uuid.uuid4().hex[:8]}")
        audio_b64 = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("audio", {})
            .get("data")
        )
        if audio_b64:
            self._audio_cache[voice_id] = base64.b64decode(audio_b64)
        return {"provider_voice_id": voice_id, "status": "active"}

    async def get_design_audio_data(self, provider_voice_id: str) -> bytes | None:
        return self._audio_cache.pop(provider_voice_id, None)

    async def create_voice_clone(self, source_audio_url: str, model_code: str) -> dict:
        api_model = self._resolve_model(model_code)
        payload = {
            "model": api_model,
            "messages": [
                {"role": "user", "content": ""},
                {"role": "assistant", "content": _VOICE_SAMPLE_TEXT},
            ],
            "audio": {
                "format": "wav",
                **({"voice": source_audio_url} if source_audio_url else {}),
            },
            "stream": False,
        }
        resp = await self.client.post(self.endpoint_url, json=payload)
        if resp.status_code != 200:
            logger.error(
                "MiMo voice clone error %s at %s: %s",
                resp.status_code,
                self.endpoint_url,
                resp.text[:500],
            )
        resp.raise_for_status()
        data = resp.json()
        return {
            "provider_voice_id": data.get("id", f"clone_{uuid.uuid4().hex[:8]}"),
            "status": "active",
        }

    async def close(self):
        await self.client.aclose()


def get_provider_adapter(model_code: str | None = None) -> AbstractProviderAdapter:
    if settings.PROVIDER_MODE == "mimo" and settings.MIMO_API_BASE:
        return MiMoProviderAdapter()
    return MockProviderAdapter()


def _generate_test_wav(duration_ms: int = 3000, sample_rate: int = 16000) -> bytes:
    """Generate a short audible sine-wave WAV file for local development."""
    num_samples = int(sample_rate * duration_ms / 1000)
    bits_per_sample = 16
    num_channels = 1
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = num_samples * block_align

    max_amp = 32767 * 0.6
    samples = bytearray()
    fade_samples = int(sample_rate * 0.05)
    for i in range(num_samples):
        t = i / sample_rate
        val = (
            math.sin(2 * math.pi * 440 * t) * 0.7
            + math.sin(2 * math.pi * 880 * t) * 0.2
            + math.sin(2 * math.pi * 1320 * t) * 0.1
        )
        if i < fade_samples:
            val *= i / fade_samples
        elif i > num_samples - fade_samples:
            val *= (num_samples - i) / fade_samples
        sample = int(val * max_amp)
        sample = max(-32768, min(32767, sample))
        samples.extend(struct.pack("<h", sample))

    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(
        struct.pack(
            "<IHHIIHH",
            16,
            1,
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
        )
    )
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(bytes(samples))
    return buf.getvalue()
