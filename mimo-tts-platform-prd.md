# MiMo Multi-Model TTS Platform PRD

## 1. Document Info

- Project name: MiMo Multi-Model TTS Platform
- Version: v0.1
- Date: 2026-05-01
- Scope: MVP + extensible design for `MiMo-V2.5-TTS`, `MiMo-V2.5-TTS-VoiceDesign`, `MiMo-V2.5-TTS-VoiceClone`, `MiMo-V2-TTS`

## 2. Product Goals

### 2.1 Background

The project aims to build a multi-model speech generation platform instead of a single TTS caller. The platform should provide a unified product experience and unified backend orchestration for standard TTS, voice design, voice clone, and fallback generation.

### 2.2 Core Goals

1. Build a stable end-to-end path from text input to audio output.
2. Abstract model differences behind one unified API and task system.
3. Support future expansion to `VoiceDesign` and `VoiceClone` without major frontend rewrites.
4. Record task, cost, and quality data from day one for optimization and commercialization.

### 2.3 MVP Goal

The MVP focuses on:

- `MiMo-V2.5-TTS` as the primary generation model
- `MiMo-V2-TTS` as fallback
- Text input, voice selection, style control, generation, playback, download, history
- Async task orchestration
- Generation logs and failure tracking

Not in MVP:

- Public release of voice clone
- Full compliance workflow for clone review
- Team billing and open platform API keys

## 3. Target Users

### 3.1 Core Users

- Individual creators: short videos, podcasts, audiobooks, narration
- AI application developers: assistants, agents, customer service bots
- Enterprise content teams: product intros, training audio, announcements

### 3.2 Future Users

- Game teams requiring role voices
- MCN or studio teams requiring batch generation
- Brand teams requiring private voice assets

## 4. Product Scope

### 4.1 Capability Layers

1. General TTS: `MiMo-V2.5-TTS`
2. Voice design: `MiMo-V2.5-TTS-VoiceDesign`
3. Authorized voice clone: `MiMo-V2.5-TTS-VoiceClone`
4. Stable fallback: `MiMo-V2-TTS`

### 4.2 MVP Features

1. Text input and text segmentation
2. Model selection
3. Voice selection
4. Style prompt input
5. TTS task creation
6. Task status polling
7. Audio playback
8. Audio download
9. History view
10. Failure reason display
11. Basic usage statistics

### 4.3 Phase 2 Features

1. Voice design prompt templates
2. Custom voice profile management
3. Multi-speaker script support
4. A/B candidate generation

### 4.4 Phase 3 Features

1. Reference audio upload
2. Voice authorization confirmation
3. Clone voice profile management
4. Compliance review and risk control

## 5. User Flow

### 5.1 MVP Main Flow

1. User enters text.
2. User selects model and voice.
3. User optionally sets style prompt, speed, volume, emotion, output format.
4. Frontend submits a generation request.
5. Backend validates parameters and creates a TTS task.
6. Orchestrator routes to the selected model.
7. If primary model fails and fallback is enabled, backend retries on `MiMo-V2-TTS`.
8. Audio is stored in object storage.
9. Task status becomes `succeeded` or `failed`.
10. Frontend displays player, download URL, metadata, and history.

### 5.2 VoiceDesign Flow

1. User enters text.
2. User describes target voice in natural language.
3. Backend converts description into a normalized voice design request.
4. Model returns generated voice parameters or a designed voice result.
5. User can save it as a reusable voice profile.
6. User uses the profile for future TTS jobs.

### 5.3 VoiceClone Flow

1. User uploads reference audio.
2. User confirms ownership and usage authorization.
3. Backend runs audio quality check and policy validation.
4. Backend calls clone model and creates a clone voice profile.
5. User applies the clone profile to later TTS jobs.
6. Audit logs are retained for compliance review.

## 6. Functional Requirements

### 6.1 Text Input

- Support plain text input
- Support max length per request
- Support auto segmentation for long text
- Support punctuation normalization
- Support basic sensitive text checking

### 6.2 Model Selection

- Allow user to select a model explicitly
- Allow backend auto-routing in future
- Support model capability metadata

### 6.3 Voice and Style

- Support system voice list
- Support style prompt
- Support speed, pitch, volume where available
- Support emotion or tone where available
- Normalize unsupported parameters silently or with warning

### 6.4 Task Management

- Create async task
- Query task status
- Retry failed task
- Cancel queued or running task if supported
- Record provider request and response summary

### 6.5 Audio Output

- Store generated audio in object storage
- Return audio duration and format
- Support playback and download
- Support merged audio for segmented generation

### 6.6 Logging and Metrics

- Task success rate
- Model latency
- Character count
- Audio duration
- Failure reason
- Fallback usage count
- Estimated cost

## 7. Non-Functional Requirements

### 7.1 Performance

- Single short text task target response: queued within 1 second
- Task status visibility: near real-time
- History list query: under 500 ms for normal pagination

### 7.2 Reliability

- Idempotent task creation with client request ID
- Retry mechanism for transient provider failures
- Fallback path for primary model failure

### 7.3 Security

- Authenticated API access
- Signed object storage URLs
- Sensitive configuration in environment variables
- Audit logs for clone-related actions

### 7.4 Compliance

- Voice clone requires explicit authorization confirmation
- Preserve consent records and reference metadata
- Provide voice asset deletion capability

## 8. Product Pages

### 8.1 TTS Workspace

- Text input area
- Model selector
- Voice selector
- Style prompt input
- Advanced controls: speed, pitch, volume, format
- Generate button
- Result player

### 8.2 Task History

- Task list
- Status
- Model used
- Voice used
- Create time
- Audio duration
- Retry action

### 8.3 Voice Asset Center

- System voices
- Designed voices
- Cloned voices
- Status and metadata

### 8.4 Admin and Metrics

- Success rate
- Failure distribution
- Model latency
- Cost overview

## 9. Technical Architecture

### 9.1 Architecture Overview

```text
Frontend Web App
    |
API Gateway / BFF
    |
TTS Application Service
    |
---------------------------------------------------------
| Text Preprocessor | Task Manager | Model Router        |
| Voice Asset Svc   | Provider Adapter | Audit Service   |
| Audio Processor   | Metrics Service  | Storage Service |
---------------------------------------------------------
    |
MiMo Provider Adapters
    |
MiMo-V2.5-TTS / VoiceDesign / VoiceClone / MiMo-V2-TTS
    |
MySQL / PostgreSQL + Redis + Object Storage
```

### 9.2 Recommended Backend Modules

#### API Gateway / BFF

- Authentication
- Request validation
- Rate limiting
- Response shaping

#### TTS Application Service

- Accept frontend requests
- Create business tasks
- Return task IDs

#### Text Preprocessor

- Clean text
- Split long text
- Normalize punctuation
- Count characters

#### Model Router

- Resolve model from request
- Validate capability compatibility
- Select fallback strategy

#### Provider Adapter

- Convert unified request into provider-specific payload
- Parse provider response
- Shield provider differences

#### Task Manager

- Manage task state machine
- Handle retries
- Trigger async workers

#### Audio Processor

- Merge segmented audio
- Normalize format if necessary
- Calculate duration and metadata

#### Voice Asset Service

- Manage system, designed, and cloned voices
- Associate voices with users
- Store authorization state

#### Audit Service

- Record clone authorization
- Record sensitive operations

#### Metrics Service

- Success rate
- Latency
- Cost estimation
- Fallback rate

### 9.3 Recommended Infrastructure

- Frontend: React + Next.js or Vue + Nuxt
- Backend: Node.js with NestJS or Java with Spring Boot
- Database: MySQL or PostgreSQL
- Cache and queue: Redis
- Object storage: S3-compatible storage, OSS, or COS
- Async worker: BullMQ, RabbitMQ worker, or Celery-like queue system
- Observability: Prometheus + Grafana or equivalent managed stack

### 9.4 Suggested State Machine

Task status:

- `pending`
- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

Retry status:

- `none`
- `retrying`
- `fallback_succeeded`
- `fallback_failed`

## 10. Database Design

### 10.1 Design Principles

- Store unified business entities instead of provider-specific raw structures only
- Keep provider request IDs for troubleshooting
- Separate task records from voice assets
- Preserve auditability for clone operations

### 10.2 Table: `users`

Purpose: platform user info

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | user id |
| `email` | varchar(128) | unique if needed |
| `name` | varchar(64) | display name |
| `status` | varchar(32) | active, disabled |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### 10.3 Table: `tts_tasks`

Purpose: main task table

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | task id |
| `task_no` | varchar(64) | external task number |
| `user_id` | bigint | creator |
| `request_id` | varchar(64) | idempotency key |
| `task_type` | varchar(32) | `tts`, `voice_design_tts`, `voice_clone_tts` |
| `status` | varchar(32) | pending, queued, running, succeeded, failed, canceled |
| `model_code` | varchar(64) | requested model |
| `final_model_code` | varchar(64) | actually used model |
| `fallback_used` | tinyint | 0 or 1 |
| `voice_profile_id` | bigint | nullable |
| `input_text` | text | original input |
| `normalized_text` | text | preprocessed text |
| `text_char_count` | int | |
| `style_prompt` | varchar(1000) | nullable |
| `speed` | decimal(4,2) | nullable |
| `pitch` | decimal(4,2) | nullable |
| `volume` | decimal(4,2) | nullable |
| `emotion` | varchar(64) | nullable |
| `output_format` | varchar(16) | mp3, wav |
| `audio_url` | varchar(1024) | nullable |
| `audio_duration_ms` | int | nullable |
| `provider_task_id` | varchar(128) | nullable |
| `provider_error_code` | varchar(64) | nullable |
| `provider_error_message` | varchar(1000) | nullable |
| `started_at` | datetime | nullable |
| `finished_at` | datetime | nullable |
| `created_at` | datetime | |
| `updated_at` | datetime | |

Indexes:

- unique index on `request_id`
- index on `user_id, created_at`
- index on `status, created_at`
- index on `model_code, created_at`

### 10.4 Table: `tts_task_segments`

Purpose: segmented generation details for long text

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | |
| `task_id` | bigint | parent task |
| `segment_no` | int | order |
| `segment_text` | text | |
| `char_count` | int | |
| `status` | varchar(32) | pending, running, succeeded, failed |
| `provider_task_id` | varchar(128) | nullable |
| `audio_url` | varchar(1024) | nullable |
| `audio_duration_ms` | int | nullable |
| `error_code` | varchar(64) | nullable |
| `error_message` | varchar(1000) | nullable |
| `created_at` | datetime | |
| `updated_at` | datetime | |

Indexes:

- index on `task_id, segment_no`

### 10.5 Table: `voice_profiles`

Purpose: unified voice assets

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | |
| `user_id` | bigint | owner, nullable for system voices |
| `profile_type` | varchar(32) | `system`, `designed`, `cloned` |
| `name` | varchar(128) | |
| `model_code` | varchar(64) | source model |
| `provider_voice_id` | varchar(128) | provider-side voice id |
| `description` | varchar(1000) | design prompt or summary |
| `gender_hint` | varchar(32) | nullable |
| `age_hint` | varchar(32) | nullable |
| `language_hint` | varchar(32) | nullable |
| `status` | varchar(32) | active, disabled, processing, rejected |
| `is_public` | tinyint | 0 or 1 |
| `created_at` | datetime | |
| `updated_at` | datetime | |

Indexes:

- index on `user_id, profile_type`
- index on `provider_voice_id`

### 10.6 Table: `voice_clone_sources`

Purpose: source records for clone audio and authorization

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | |
| `voice_profile_id` | bigint | associated cloned profile |
| `user_id` | bigint | uploader |
| `source_audio_url` | varchar(1024) | |
| `source_audio_duration_ms` | int | |
| `consent_type` | varchar(32) | self, authorized_agent, enterprise |
| `consent_statement` | varchar(2000) | raw confirmation text |
| `consent_proof_url` | varchar(1024) | nullable |
| `risk_status` | varchar(32) | pending, approved, rejected |
| `review_note` | varchar(1000) | nullable |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### 10.7 Table: `provider_call_logs`

Purpose: provider observability and troubleshooting

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | |
| `task_id` | bigint | nullable |
| `segment_id` | bigint | nullable |
| `provider_name` | varchar(64) | |
| `model_code` | varchar(64) | |
| `request_summary` | text | sanitized summary |
| `response_summary` | text | sanitized summary |
| `http_status` | int | nullable |
| `provider_error_code` | varchar(64) | nullable |
| `latency_ms` | int | |
| `created_at` | datetime | |

Indexes:

- index on `task_id`
- index on `model_code, created_at`

### 10.8 Table: `usage_stats_daily`

Purpose: aggregated metrics

| Column | Type | Notes |
|---|---|---|
| `id` | bigint pk | |
| `stat_date` | date | |
| `user_id` | bigint | nullable for global stats |
| `model_code` | varchar(64) | |
| `request_count` | int | |
| `success_count` | int | |
| `failure_count` | int | |
| `fallback_count` | int | |
| `text_char_count` | bigint | |
| `audio_duration_ms` | bigint | |
| `estimated_cost` | decimal(18,4) | |
| `created_at` | datetime | |
| `updated_at` | datetime | |

## 11. API Design

### 11.1 General Rules

- Base path: `/api/v1`
- Auth: `Authorization: Bearer <token>`
- Content type: `application/json`
- Async tasks return `task_id`
- Standard response envelope:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

### 11.2 Create TTS Task

`POST /api/v1/tts/tasks`

Request:

```json
{
  "request_id": "req_20260501_0001",
  "text": "欢迎使用我们的语音平台。",
  "model_code": "MiMo-V2.5-TTS",
  "voice_profile_id": 1001,
  "style_prompt": "温和、自然、专业感，语速稍慢",
  "speed": 0.95,
  "pitch": 1.0,
  "volume": 1.0,
  "emotion": "calm",
  "output_format": "mp3",
  "enable_fallback": true
}
```

Validation rules:

- `request_id` required
- `text` required
- `model_code` required
- `voice_profile_id` optional for system default flow if provider supports default voice
- `output_format` default to `mp3`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "task_id": 900001,
    "task_no": "tts_20260501_000001",
    "status": "queued"
  }
}
```

### 11.3 Query Task Detail

`GET /api/v1/tts/tasks/{taskId}`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "task_id": 900001,
    "task_no": "tts_20260501_000001",
    "status": "succeeded",
    "model_code": "MiMo-V2.5-TTS",
    "final_model_code": "MiMo-V2.5-TTS",
    "fallback_used": false,
    "voice_profile_id": 1001,
    "text_char_count": 13,
    "audio_url": "https://storage.example.com/audio/900001.mp3",
    "audio_duration_ms": 4200,
    "provider_error_code": null,
    "provider_error_message": null,
    "created_at": "2026-05-01T11:00:00Z",
    "finished_at": "2026-05-01T11:00:03Z"
  }
}
```

### 11.4 List Tasks

`GET /api/v1/tts/tasks?page=1&page_size=20&status=succeeded&model_code=MiMo-V2.5-TTS`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "task_id": 900001,
        "task_no": "tts_20260501_000001",
        "status": "succeeded",
        "model_code": "MiMo-V2.5-TTS",
        "audio_duration_ms": 4200,
        "created_at": "2026-05-01T11:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  }
}
```

### 11.5 Retry Task

`POST /api/v1/tts/tasks/{taskId}/retry`

Request:

```json
{
  "force_fallback": false
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "task_id": 900002,
    "source_task_id": 900001,
    "status": "queued"
  }
}
```

### 11.6 Cancel Task

`POST /api/v1/tts/tasks/{taskId}/cancel`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "task_id": 900001,
    "status": "canceled"
  }
}
```

### 11.7 List Voice Profiles

`GET /api/v1/voice-profiles?profile_type=system`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 1001,
        "profile_type": "system",
        "name": "Warm Female CN",
        "model_code": "MiMo-V2.5-TTS",
        "provider_voice_id": "voice_cn_female_01",
        "status": "active"
      }
    ]
  }
}
```

### 11.8 Create Voice Design Profile

`POST /api/v1/voice-profiles/design`

Request:

```json
{
  "name": "Narrator A",
  "model_code": "MiMo-V2.5-TTS-VoiceDesign",
  "description": "30岁左右，女声，沉稳、温暖、适合讲述品牌故事"
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "voice_profile_id": 2001,
    "status": "processing"
  }
}
```

### 11.9 Create Voice Clone Profile

`POST /api/v1/voice-profiles/clone`

Request:

```json
{
  "name": "Founder Voice",
  "model_code": "MiMo-V2.5-TTS-VoiceClone",
  "source_audio_url": "https://storage.example.com/upload/founder.wav",
  "consent_type": "enterprise",
  "consent_statement": "We confirm the uploaded voice is used with authorization."
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "voice_profile_id": 3001,
    "status": "processing",
    "risk_status": "pending"
  }
}
```

### 11.10 Metrics Summary

`GET /api/v1/metrics/summary?start_date=2026-05-01&end_date=2026-05-07`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "request_count": 1200,
    "success_count": 1150,
    "failure_count": 50,
    "fallback_count": 28,
    "text_char_count": 582000,
    "audio_duration_ms": 9432000
  }
}
```

## 12. Unified Domain Models

### 12.1 Unified TTS Request

```json
{
  "text": "string",
  "model_code": "string",
  "voice_profile_id": 0,
  "style_prompt": "string",
  "speed": 1.0,
  "pitch": 1.0,
  "volume": 1.0,
  "emotion": "string",
  "output_format": "mp3",
  "enable_fallback": true
}
```

### 12.2 Unified TTS Result

```json
{
  "task_id": 0,
  "status": "queued",
  "audio_url": "string",
  "audio_duration_ms": 0,
  "final_model_code": "string",
  "fallback_used": false
}
```

## 13. Model Routing Strategy

### 13.1 MVP Strategy

- If `model_code = MiMo-V2.5-TTS`, use it as primary.
- If provider call fails with retryable error and `enable_fallback = true`, switch to `MiMo-V2-TTS`.
- If `voice_profile_id` belongs to `designed` or `cloned`, route to its associated model family.

### 13.2 Future Strategy

- Auto-select model based on text scenario
- Route by latency budget or cost budget
- Route by language support or voice type

## 14. Error Code Design

### 14.1 Business Error Codes

| Code | Meaning |
|---|---|
| `400100` | invalid parameter |
| `400101` | text too long |
| `400102` | unsupported model |
| `400103` | voice profile not found |
| `400104` | voice profile unavailable |
| `400105` | unauthorized clone request |
| `500100` | provider request failed |
| `500101` | provider timeout |
| `500102` | audio storage failed |
| `500103` | task execution failed |

## 15. Recommended Development Order

### Phase 1: Foundation

1. Set up project repo structure
2. Build database tables
3. Implement task creation and task query APIs
4. Integrate `MiMo-V2.5-TTS`
5. Integrate object storage

### Phase 2: Reliability

1. Add async queue
2. Add retry and fallback
3. Add provider logs
4. Add history list and download

### Phase 3: Expansion

1. Add `VoiceDesign`
2. Add voice profile center
3. Add long-text segmentation and audio merge

### Phase 4: Compliance and Scale

1. Add `VoiceClone`
2. Add consent and audit flow
3. Add metrics dashboard and billing basis

## 16. Suggested Repo Structure

```text
docs/
backend/
  src/
    modules/
      auth/
      tts/
      voice-profile/
      audit/
      metrics/
    infrastructure/
      db/
      queue/
      storage/
      provider/
frontend/
  src/
    pages/
    components/
    services/
```

## 17. MVP Acceptance Criteria

1. User can submit text and create a task successfully.
2. User can select `MiMo-V2.5-TTS` and get playable audio.
3. When primary model fails, the system can fallback to `MiMo-V2-TTS` if enabled.
4. User can query task status and view history.
5. User can play and download generated audio.
6. System records provider latency, errors, and fallback usage.

## 18. Notes

- Confirm actual MiMo provider parameter names before coding adapters.
- Keep provider adapters isolated from business service logic.
- Do not expose clone capability publicly before compliance workflow is ready.
