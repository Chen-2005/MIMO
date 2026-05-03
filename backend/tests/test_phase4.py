"""Phase 4 end-to-end tests: VoiceClone, Consent/Audit, Metrics."""
import asyncio
import uuid

import pytest


def _uid():
    return uuid.uuid4().hex[:12]


# ── Voice Clone: create ──────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_create_voice_clone(client):
    """Create a clone request → status=pending_review, risk_status=pending."""
    resp = await client.post("/api/v1/voice-profiles/clone", json={
        "name": f"clone_{_uid()}",
        "source_audio_url": "https://example.com/voice.wav",
        "consent_type": "self",
        "consent_statement": "I own this voice",
    })
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "pending_review"
    assert data["risk_status"] == "pending"


# ── Voice Clone: approve → active ────────────────────────────────────────────

@pytest.mark.anyio
async def test_approve_clone(client):
    """Approve a clone request → background execution → status=active."""
    resp = await client.post("/api/v1/voice-profiles/clone", json={
        "name": f"approve_{_uid()}",
        "source_audio_url": "https://example.com/voice.wav",
        "consent_type": "self",
        "consent_statement": "I own this voice",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    resp = await client.post(f"/api/v1/voice-profiles/{pid}/clone/approve", json={
        "review_note": "Looks good",
    })
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "processing"

    # Wait for background clone to complete
    for _ in range(20):
        await asyncio.sleep(0.3)
        resp = await client.get(f"/api/v1/voice-profiles/{pid}")
        if resp.json()["data"]["status"] not in ("processing",):
            break

    detail = resp.json()["data"]
    assert detail["status"] == "active"
    assert detail["provider_voice_id"] is not None
    assert detail["provider_voice_id"].startswith("mock_clone_")


# ── Voice Clone: reject ──────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_reject_clone(client):
    """Reject a clone request → status=rejected."""
    resp = await client.post("/api/v1/voice-profiles/clone", json={
        "name": f"reject_{_uid()}",
        "source_audio_url": "https://example.com/voice.wav",
        "consent_type": "self",
        "consent_statement": "I own this voice",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    resp = await client.post(f"/api/v1/voice-profiles/{pid}/clone/reject", json={
        "review_note": "Insufficient proof",
    })
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "rejected"
    assert resp.json()["data"]["risk_status"] == "rejected"


# ── Voice Clone: source detail ───────────────────────────────────────────────

@pytest.mark.anyio
async def test_clone_source_detail(client):
    """Get clone source detail after creating a clone request."""
    resp = await client.post("/api/v1/voice-profiles/clone", json={
        "name": f"detail_{_uid()}",
        "source_audio_url": "https://example.com/voice.wav",
        "consent_type": "self",
        "consent_statement": "I own this voice",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    resp = await client.get(f"/api/v1/voice-profiles/{pid}/clone-source")
    assert resp.status_code == 200
    src = resp.json()["data"]
    assert src["voice_profile_id"] == pid
    assert src["consent_type"] == "self"
    assert src["risk_status"] == "pending"


# ── Consent proof upload ─────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_consent_proof_upload(client):
    """Upload a consent proof document."""
    resp = await client.post("/api/v1/voice-profiles/clone", json={
        "name": f"upload_{_uid()}",
        "source_audio_url": "https://example.com/voice.wav",
        "consent_type": "self",
        "consent_statement": "I own this voice",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    # Create a minimal PDF-like file
    fake_pdf = b"%PDF-1.4 fake content"
    resp = await client.post(
        f"/api/v1/voice-profiles/{pid}/consent-proof",
        files={"file": ("consent.pdf", fake_pdf, "application/pdf")},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["consent_proof_url"] is not None


# ── Clone: invalid consent type ──────────────────────────────────────────────

@pytest.mark.anyio
async def test_clone_invalid_consent_type(client):
    """Invalid consent_type should return 400."""
    resp = await client.post("/api/v1/voice-profiles/clone", json={
        "name": f"bad_{_uid()}",
        "source_audio_url": "https://example.com/voice.wav",
        "consent_type": "invalid_type",
        "consent_statement": "test",
    })
    assert resp.status_code == 400


# ── Audit logs ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_audit_logs_created(client):
    """Clone create + approve should produce audit log entries."""
    resp = await client.post("/api/v1/voice-profiles/clone", json={
        "name": f"audit_{_uid()}",
        "source_audio_url": "https://example.com/voice.wav",
        "consent_type": "self",
        "consent_statement": "I own this voice",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    await client.post(f"/api/v1/voice-profiles/{pid}/clone/approve", json={
        "review_note": "Approved",
    })

    resp = await client.get("/api/v1/voice-profiles/audit-logs", params={
        "entity_type": "voice_clone_source",
        "entity_id": pid,
    })
    assert resp.status_code == 200
    logs = resp.json()["data"]
    actions = [l["action"] for l in logs]
    assert "clone_consent_submitted" in actions


@pytest.mark.anyio
async def test_voice_profile_delete_audit(client):
    """Deleting a voice profile should create an audit log entry."""
    # Create a voice design first
    resp = await client.post("/api/v1/voice-profiles/design", json={
        "name": f"del_audit_{_uid()}",
        "description": "to be deleted",
    })
    pid = resp.json()["data"]["voice_profile_id"]

    await client.delete(f"/api/v1/voice-profiles/{pid}")

    resp = await client.get("/api/v1/voice-profiles/audit-logs", params={
        "entity_type": "voice_profile",
        "entity_id": pid,
    })
    assert resp.status_code == 200
    logs = resp.json()["data"]
    actions = [l["action"] for l in logs]
    assert "voice_profile_deleted" in actions


# ── Metrics: aggregation + summary ───────────────────────────────────────────

@pytest.mark.anyio
async def test_metrics_aggregation(client):
    """Create a TTS task, aggregate metrics, then check summary."""
    # Create a task to generate ProviderCallLog entries
    rid = f"metrics_{_uid()}"
    resp = await client.post("/api/v1/tts/tasks", json={
        "request_id": rid,
        "text": "metrics test",
        "output_format": "wav",
    })
    task_id = resp.json()["data"]["task_id"]

    # Wait for task to complete
    for _ in range(20):
        await asyncio.sleep(0.3)
        resp = await client.get(f"/api/v1/tts/tasks/{task_id}")
        if resp.json()["data"]["status"] == "succeeded":
            break

    # Trigger aggregation (use UTC date since SQLite now() is UTC)
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    resp = await client.post("/api/v1/metrics/aggregate", params={"target_date": today})
    assert resp.status_code == 200
    agg = resp.json()["data"]
    assert agg["stat_date"] == today
    assert len(agg["models"]) >= 1

    # Check summary
    resp = await client.get("/api/v1/metrics/summary")
    assert resp.status_code == 200
    summary = resp.json()["data"]
    assert summary["request_count"] >= 1
    assert summary["success_count"] >= 1
