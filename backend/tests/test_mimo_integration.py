"""Optional real MiMo integration tests.

These tests are skipped by default and only run when:

- RUN_REAL_MIMO_TESTS=true
- PROVIDER_MODE=mimo
- MIMO_API_BASE and MIMO_API_KEY are configured
"""

from __future__ import annotations

import asyncio
import base64
import os
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


RUN_REAL_MIMO = os.getenv("RUN_REAL_MIMO_TESTS", "").lower() == "true"
MIMO_READY = all(
    [
        settings.PROVIDER_MODE.lower() == "mimo",
        settings.MIMO_API_BASE,
        settings.MIMO_API_KEY,
    ]
)

pytestmark = pytest.mark.skipif(
    not (RUN_REAL_MIMO and MIMO_READY),
    reason="Real MiMo integration tests require RUN_REAL_MIMO_TESTS=true and a configured mimo provider.",
)

SHORT_TIMEOUT_LOOPS = 60
LONG_TIMEOUT_LOOPS = 150
VOICE_TIMEOUT_LOOPS = 45
CLONE_TIMEOUT_LOOPS = 90
POLL_DELAY_SECONDS = 1.0
TEST_AUDIO_PATH = Path(__file__).resolve().parent.parent / "test_audio.wav"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def integration_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _request_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _build_data_audio_url(path: Path) -> str:
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:audio/wav;base64,{payload}"


async def _wait_for_task(
    client: AsyncClient,
    task_id: int,
    loops: int,
    delay: float,
):
    detail = None
    for _ in range(loops):
        await asyncio.sleep(delay)
        resp = await client.get(f"/api/v1/tts/tasks/{task_id}")
        assert resp.status_code == 200
        detail = resp.json()["data"]
        if detail["status"] not in ("queued", "running"):
            return detail

    pytest.fail(
        f"TTS task {task_id} timed out after {loops * delay:.0f}s; last detail: {detail}"
    )


async def _wait_for_voice_profile(
    client: AsyncClient,
    profile_id: int,
    loops: int,
    delay: float,
):
    detail = None
    for _ in range(loops):
        await asyncio.sleep(delay)
        resp = await client.get(f"/api/v1/voice-profiles/{profile_id}")
        assert resp.status_code == 200
        detail = resp.json()["data"]
        if detail["status"] != "processing":
            return detail

    pytest.fail(
        f"Voice profile {profile_id} timed out after {loops * delay:.0f}s; last detail: {detail}"
    )


@pytest.mark.anyio
async def test_real_mimo_tts_short_text(integration_client: AsyncClient):
    resp = await integration_client.post(
        "/api/v1/tts/tasks",
        json={
            "request_id": _request_id("real_mimo_short"),
            "text": "你好，这是一段真实 MiMo 集成测试。",
            "model_code": "MiMo-V2.5-TTS",
            "output_format": "wav",
            "enable_fallback": True,
        },
    )
    assert resp.status_code == 200
    task_id = resp.json()["data"]["task_id"]

    detail = await _wait_for_task(
        integration_client,
        task_id,
        loops=SHORT_TIMEOUT_LOOPS,
        delay=POLL_DELAY_SECONDS,
    )
    assert detail["status"] == "succeeded", detail
    assert detail["audio_url"], detail
    assert detail["audio_duration_ms"] > 0, detail


@pytest.mark.anyio
async def test_real_mimo_tts_long_text(integration_client: AsyncClient):
    text = "这是一段用于真实 MiMo 长文本测试的内容。" * 24
    resp = await integration_client.post(
        "/api/v1/tts/tasks",
        json={
            "request_id": _request_id("real_mimo_long"),
            "text": text,
            "model_code": "MiMo-V2.5-TTS",
            "output_format": "wav",
            "enable_fallback": True,
        },
    )
    assert resp.status_code == 200
    task_id = resp.json()["data"]["task_id"]

    detail = await _wait_for_task(
        integration_client,
        task_id,
        loops=LONG_TIMEOUT_LOOPS,
        delay=POLL_DELAY_SECONDS,
    )
    assert detail["status"] == "succeeded", detail
    assert detail["segment_count"] > 1, detail


@pytest.mark.anyio
async def test_real_mimo_voice_design(integration_client: AsyncClient):
    resp = await integration_client.post(
        "/api/v1/voice-profiles/design",
        json={
            "name": f"real_design_{uuid.uuid4().hex[:8]}",
            "model_code": "MiMo-V2.5-TTS-VoiceDesign",
            "description": "年轻女声，声音自然，适合客服和播报场景。",
        },
    )
    assert resp.status_code == 200
    profile_id = resp.json()["data"]["voice_profile_id"]

    detail = await _wait_for_voice_profile(
        integration_client,
        profile_id,
        loops=VOICE_TIMEOUT_LOOPS,
        delay=POLL_DELAY_SECONDS,
    )
    assert detail["status"] == "active", detail
    assert detail["provider_voice_id"], detail


@pytest.mark.anyio
async def test_real_mimo_voice_clone(integration_client: AsyncClient):
    assert TEST_AUDIO_PATH.exists(), f"Missing test audio file: {TEST_AUDIO_PATH}"

    source_audio_url = _build_data_audio_url(TEST_AUDIO_PATH)
    create_resp = await integration_client.post(
        "/api/v1/voice-profiles/clone",
        json={
            "name": f"real_clone_{uuid.uuid4().hex[:8]}",
            "model_code": "MiMo-V2.5-TTS-VoiceClone",
            "source_audio_url": source_audio_url,
            "consent_type": "self",
            "consent_statement": "I own and authorize the use of this voice sample for testing.",
        },
    )
    assert create_resp.status_code == 200
    create_data = create_resp.json()["data"]
    assert create_data["status"] == "pending_review"
    profile_id = create_data["voice_profile_id"]

    approve_resp = await integration_client.post(
        f"/api/v1/voice-profiles/{profile_id}/clone/approve",
        json={"review_note": "Approved for integration testing."},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["data"]["status"] == "processing"

    detail = await _wait_for_voice_profile(
        integration_client,
        profile_id,
        loops=CLONE_TIMEOUT_LOOPS,
        delay=POLL_DELAY_SECONDS,
    )
    assert detail["status"] == "active", detail
    assert detail["provider_voice_id"], detail

    clone_source_resp = await integration_client.get(
        f"/api/v1/voice-profiles/{profile_id}/clone-source"
    )
    assert clone_source_resp.status_code == 200
    clone_source = clone_source_resp.json()["data"]
    assert clone_source["risk_status"] == "approved", clone_source
