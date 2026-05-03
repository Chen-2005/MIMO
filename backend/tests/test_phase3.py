"""Phase 3 end-to-end tests: TTS tasks, voice profiles, segments, provider logs."""
import asyncio
import time
import uuid

import pytest


def _unique_id():
    return uuid.uuid4().hex[:12]


# ── Health ────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ── TTS Task: create + auto-execute ──────────────────────────────────────────

@pytest.mark.anyio
async def test_create_task_short_text(client):
    """Create a task with short text → should auto-execute and succeed."""
    rid = f"req_{_unique_id()}"
    resp = await client.post("/api/v1/tts/tasks", json={
        "request_id": rid,
        "text": "你好世界",
        "model_code": "MiMo-V2.5-TTS",
        "output_format": "wav",
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "queued"
    task_id = data["task_id"]

    # Wait for background thread to finish (mock provider is instant)
    for _ in range(20):
        await asyncio.sleep(0.3)
        resp = await client.get(f"/api/v1/tts/tasks/{task_id}")
        detail = resp.json()["data"]
        if detail["status"] != "queued":
            break

    assert detail["status"] == "succeeded"
    assert detail["audio_url"] is not None
    assert detail["audio_duration_ms"] > 0
    assert detail["segment_count"] == 0


# ── TTS Task: long text with segmentation ────────────────────────────────────

@pytest.mark.anyio
async def test_create_task_long_text_segments(client):
    """Long text should be segmented into multiple segments."""
    # Generate text > 500 chars to trigger segmentation
    long_text = "这是一段很长的测试文本，用于验证分段功能是否正常工作。" * 50
    rid = f"req_{_unique_id()}"
    resp = await client.post("/api/v1/tts/tasks", json={
        "request_id": rid,
        "text": long_text,
        "output_format": "wav",
    })
    assert resp.status_code == 200
    task_id = resp.json()["data"]["task_id"]

    # Wait for completion
    for _ in range(30):
        await asyncio.sleep(0.5)
        resp = await client.get(f"/api/v1/tts/tasks/{task_id}")
        detail = resp.json()["data"]
        if detail["status"] not in ("queued", "running"):
            break

    assert detail["status"] == "succeeded"
    assert detail["segment_count"] > 1

    # Verify segments endpoint
    resp = await client.get(f"/api/v1/tts/tasks/{task_id}/segments")
    assert resp.status_code == 200
    segments = resp.json()["data"]
    assert len(segments) == detail["segment_count"]
    for seg in segments:
        assert seg["status"] == "succeeded"
        assert seg["audio_url"] is not None


# ── TTS Task: idempotency ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_task_idempotency(client):
    """Same request_id should return existing task, not create a new one."""
    rid = f"req_{_unique_id()}"
    body = {"request_id": rid, "text": "幂等测试"}
    resp1 = await client.post("/api/v1/tts/tasks", json=body)
    resp2 = await client.post("/api/v1/tts/tasks", json=body)
    assert resp1.json()["data"]["task_id"] == resp2.json()["data"]["task_id"]


# ── TTS Task: cancel ─────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_cancel_task(client):
    """Cancel a queued task."""
    rid = f"req_{_unique_id()}"
    resp = await client.post("/api/v1/tts/tasks", json={
        "request_id": rid,
        "text": "取消测试",
    })
    task_id = resp.json()["data"]["task_id"]

    # Try to cancel immediately (may already be succeeded with mock)
    resp = await client.post(f"/api/v1/tts/tasks/{task_id}/cancel")
    # Either 200 (canceled) or 400 (already completed)
    assert resp.status_code in (200, 400)


# ── TTS Task: list ───────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_list_tasks(client):
    """List tasks returns paginated results."""
    resp = await client.get("/api/v1/tts/tasks", params={"page": 1, "page_size": 5})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "list" in data
    assert "total" in data
    assert data["page"] == 1
    assert data["page_size"] == 5


# ── TTS Task: provider logs ──────────────────────────────────────────────────

@pytest.mark.anyio
async def test_task_logs(client):
    """After task completes, provider logs should exist."""
    rid = f"req_{_unique_id()}"
    resp = await client.post("/api/v1/tts/tasks", json={
        "request_id": rid,
        "text": "日志测试",
        "output_format": "wav",
    })
    task_id = resp.json()["data"]["task_id"]

    # Wait for completion
    for _ in range(20):
        await asyncio.sleep(0.3)
        resp = await client.get(f"/api/v1/tts/tasks/{task_id}")
        if resp.json()["data"]["status"] == "succeeded":
            break

    resp = await client.get(f"/api/v1/tts/tasks/{task_id}/logs")
    assert resp.status_code == 200
    logs = resp.json()["data"]
    assert len(logs) >= 1
    assert logs[0]["provider_name"] == "mock"
    assert logs[0]["latency_ms"] >= 0


# ── TTS Task: 404 for non-existent ───────────────────────────────────────────

@pytest.mark.anyio
async def test_task_not_found(client):
    resp = await client.get("/api/v1/tts/tasks/99999")
    assert resp.status_code == 404


# ── TTS Task: segments for non-existent ──────────────────────────────────────

@pytest.mark.anyio
async def test_segments_empty_for_unknown(client):
    resp = await client.get("/api/v1/tts/tasks/99999/segments")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


# ── Voice Profile: design create ─────────────────────────────────────────────

@pytest.mark.anyio
async def test_voice_design_create(client):
    """Create a voice design profile."""
    resp = await client.post("/api/v1/voice-profiles/design", json={
        "name": f"test_voice_{_unique_id()}",
        "description": "一个温柔的女声",
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["voice_profile_id"] > 0
    # Initial status is "processing"; background thread will set to "active"
    assert data["status"] in ("processing", "active")


# ── Voice Profile: get detail ────────────────────────────────────────────────

@pytest.mark.anyio
async def test_voice_profile_detail(client):
    """Create then get voice profile detail."""
    resp = await client.post("/api/v1/voice-profiles/design", json={
        "name": f"detail_test_{_unique_id()}",
        "description": "测试详情",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    resp = await client.get(f"/api/v1/voice-profiles/{pid}")
    assert resp.status_code == 200
    detail = resp.json()["data"]
    assert detail["id"] == pid
    assert detail["profile_type"] == "designed"


# ── Voice Profile: update ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_voice_profile_update(client):
    """Update voice profile name and description."""
    resp = await client.post("/api/v1/voice-profiles/design", json={
        "name": f"update_test_{_unique_id()}",
        "description": "原始描述",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    resp = await client.patch(f"/api/v1/voice-profiles/{pid}", json={
        "name": "updated_name",
        "description": "更新后的描述",
    })
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "updated_name"


# ── Voice Profile: delete (soft) ─────────────────────────────────────────────

@pytest.mark.anyio
async def test_voice_profile_delete(client):
    """Soft-delete a voice profile."""
    resp = await client.post("/api/v1/voice-profiles/design", json={
        "name": f"delete_test_{_unique_id()}",
        "description": "待删除",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    resp = await client.delete(f"/api/v1/voice-profiles/{pid}")
    assert resp.status_code == 200

    # Verify it's disabled
    resp = await client.get(f"/api/v1/voice-profiles/{pid}")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "disabled"


# ── Voice Profile: list ──────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_voice_profile_list(client):
    """List voice profiles."""
    resp = await client.get("/api/v1/voice-profiles")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert isinstance(data, list)


# ── Voice Profile: 404 ───────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_voice_profile_not_found(client):
    resp = await client.get("/api/v1/voice-profiles/99999")
    assert resp.status_code == 404
