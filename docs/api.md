# API 文档

接口前缀：`/api/v1`

统一响应格式：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败时通常返回：

```json
{
  "code": 400,
  "message": "error message",
  "data": null
}
```

## TTS 任务

### 创建任务

`POST /api/v1/tts/tasks`

请求体：

```json
{
  "request_id": "req_20260503_001",
  "text": "这是一段需要转语音的文本",
  "model_code": "MiMo-V2.5-TTS",
  "voice_profile_id": 12,
  "style_prompt": "温和、自然、适合讲解",
  "speed": 0.9,
  "output_format": "mp3",
  "enable_fallback": true
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `request_id` | string | 是 | 请求唯一标识 |
| `text` | string | 是 | 待合成文本，支持内联表现力标签如 `(开心)` `(东北话)` |
| `model_code` | string | 否 | TTS 模型，默认 `MiMo-V2.5-TTS` |
| `voice_profile_id` | int | 否 | 音色 ID，为空使用默认音色 |
| `style_prompt` | string | 否 | 风格描述，支持导演模式格式 `[角色]...[场景]...[指令]...` |
| `speed` | float | 否 | 语速，范围 0.5 ~ 2.0 |
| `output_format` | string | 否 | 输出格式：`mp3` 或 `wav`，默认 `mp3` |
| `enable_fallback` | bool | 否 | 是否允许降级到备用模型，默认 `true` |

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "task_id": 42,
    "task_no": "T20260503001",
    "status": "queued"
  }
}
```

### 查询任务详情

`GET /api/v1/tts/tasks/{task_id}`

返回字段：

| 字段 | 说明 |
|------|------|
| `task_id` | 任务 ID |
| `task_no` | 任务编号 |
| `status` | 状态：`queued` / `running` / `succeeded` / `failed` / `canceled` |
| `model_code` | 请求的模型 |
| `final_model_code` | 实际使用的模型（降级后可能不同） |
| `fallback_used` | 是否触发了降级 |
| `voice_profile_id` | 使用的音色 ID |
| `text_char_count` | 文本字数 |
| `style_prompt` | 风格提示词 |
| `speed` | 语速 |
| `output_format` | 输出格式 |
| `audio_url` | 音频文件地址（成功后） |
| `audio_duration_ms` | 音频时长（毫秒） |
| `provider_error_code` | 错误码（失败时） |
| `provider_error_message` | 错误信息（失败时） |
| `segment_count` | 分段数（长文本自动分段） |
| `created_at` | 创建时间 |
| `finished_at` | 完成时间 |

### 任务列表

`GET /api/v1/tts/tasks`

查询参数：

| 参数 | 说明 |
|------|------|
| `page` | 页码，默认 1 |
| `page_size` | 每页数量，默认 20 |
| `status` | 按状态筛选 |
| `model_code` | 按模型筛选 |

示例：`GET /api/v1/tts/tasks?page=1&page_size=20&status=succeeded`

### 重试任务

`POST /api/v1/tts/tasks/{task_id}/retry`

可选请求体：

```json
{
  "force_fallback": false
}
```

### 取消任务

`POST /api/v1/tts/tasks/{task_id}/cancel`

### 获取任务音频

`GET /api/v1/tts/tasks/{task_id}/audio`

返回音频文件流，可直接用于 `<audio>` 标签或下载。

### 获取分段信息

`GET /api/v1/tts/tasks/{task_id}/segments`

长文本任务返回各分段的状态和音频信息。

### 获取任务日志

`GET /api/v1/tts/tasks/{task_id}/logs`

返回 Provider 调用日志，用于排查问题。

## 音色管理

### 查询音色列表

`GET /api/v1/voice-profiles`

可选参数：

| 参数 | 说明 |
|------|------|
| `profile_type` | 按类型筛选：`system` / `designed` / `cloned` |

返回行为：

- `status="disabled"` 的音色不会出现
- 系统音色（`profile_type=system`）对所有用户可见
- 用户可以看到自己创建的设计/克隆音色
- 其他用户发布的音色（`is_public=1`）也可见

### 查询单个音色

`GET /api/v1/voice-profiles/{profile_id}`

返回完整音色详情，包含 `is_public`、`created_at`、`updated_at` 等字段。

### 更新音色

`PATCH /api/v1/voice-profiles/{profile_id}`

可更新字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 音色名称 |
| `description` | string | 音色描述 |
| `gender_hint` | string | 性别提示 |
| `age_hint` | string | 年龄提示 |
| `language_hint` | string | 语言提示 |
| `is_public` | int | 发布状态：`0`=仅自己，`1`=公开 |

示例 — 发布音色：

```json
{
  "is_public": 1
}
```

### 删除/禁用音色

`DELETE /api/v1/voice-profiles/{profile_id}`

说明：

- 当前不是物理删除
- 后端会把音色状态改成 `disabled`
- `disabled` 音色不会出现在列表中

## 设计音色

### 创建设计音色

`POST /api/v1/voice-profiles/design`

请求体：

```json
{
  "name": "解说女声",
  "model_code": "MiMo-V2.5-TTS-VoiceDesign",
  "description": "30岁左右的女性声音，气息柔和，咬字清晰，音色温暖醇厚。语速平稳偏慢，情绪基调放松柔和，适合知识讲解和有声书。"
}
```

描述要求：

- 必须包含：身份锚点（年龄+性别）、声音质感、语速节奏、情绪基线
- 1-2 句话，纯散文
- 不要场景或动作描述
- 不要使用真实演员姓名

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "voice_profile_id": 15,
    "status": "processing"
  }
}
```

设计通过后台线程执行，前端需轮询音色状态直到 `active` 或 `rejected`。

## 克隆音色

### 1. 上传克隆样本音频

`POST /api/v1/voice-profiles/clone/audio`

请求格式：`multipart/form-data`

| 字段 | 说明 |
|------|------|
| `file` | 音频文件 |

限制：

- 只接受音频文件（`audio/*`）
- 最大 20MB

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "source_audio_url": "/static/voice_clone_sources/1/xxxx.wav"
  }
}
```

### 2. 创建克隆申请

`POST /api/v1/voice-profiles/clone`

请求体：

```json
{
  "name": "本次视频配音",
  "model_code": "MiMo-V2.5-TTS-VoiceClone",
  "source_audio_url": "/static/voice_clone_sources/1/xxxx.wav",
  "consent_type": "self",
  "consent_statement": "我确认该声音样本已获得合法授权，仅用于团队内部项目。"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 音色名称 |
| `model_code` | string | 否 | 默认 `MiMo-V2.5-TTS-VoiceClone` |
| `source_audio_url` | string | 是 | 音频来源 |
| `consent_type` | string | 是 | 授权类型：`self` / `authorized_agent` / `enterprise` |
| `consent_statement` | string | 是 | 授权声明 |

支持的 `source_audio_url`：

- `http://...` 或 `https://...`
- `/static/...`（上传接口返回的地址）
- `data:audio/...;base64,...`

后端行为：

1. 记录 `VoiceProfile` 和 `VoiceCloneSource`
2. 后台线程启动真实克隆
3. 调用 MiMo 前，统一将音频源转换为 DataURL
4. 成功后音色状态变为 `active`
5. 失败后音色状态变为 `rejected`

### 3. 查询克隆源信息

`GET /api/v1/voice-profiles/{profile_id}/clone-source`

返回：

```json
{
  "id": 1,
  "voice_profile_id": 15,
  "source_audio_url": "/static/voice_clone_sources/1/xxxx.wav",
  "consent_type": "self",
  "consent_statement": "...",
  "consent_proof_url": null,
  "risk_status": "approved",
  "review_note": null
}
```

### 4. 上传授权证明

`POST /api/v1/voice-profiles/{profile_id}/consent-proof`

请求格式：`multipart/form-data`

限制：JPEG / PNG / PDF，最大 10MB

### 5. 审批克隆申请

`POST /api/v1/voice-profiles/{profile_id}/clone/approve`

当前内部使用场景下，克隆创建通常直接进入执行，不强依赖审批。

### 6. 拒绝克隆申请

`POST /api/v1/voice-profiles/{profile_id}/clone/reject`

## 指标

### 汇总指标

`GET /api/v1/metrics/summary`

查询参数：

| 参数 | 说明 |
|------|------|
| `start_date` | 开始日期（YYYY-MM-DD） |
| `end_date` | 结束日期（YYYY-MM-DD） |

返回字段：

| 字段 | 说明 |
|------|------|
| `request_count` | 总请求数 |
| `success_count` | 成功数 |
| `failure_count` | 失败数 |
| `fallback_count` | 降级数 |
| `text_char_count` | 总文本字数 |
| `audio_duration_ms` | 总音频时长 |
| `estimated_cost` | 预估费用 |
| `clone_request_count` | 克隆请求数 |

### 聚合指标

`POST /api/v1/metrics/aggregate`

支持自定义聚合维度和时间范围。

## 模型代码

| 模型 | 说明 |
|------|------|
| `MiMo-V2.5-TTS` | 主模型，效果最好 |
| `MiMo-V2.5-TTS-VoiceDesign` | 音色设计模型 |
| `MiMo-V2.5-TTS-VoiceClone` | 音色克隆模型 |
| `MiMo-V2-TTS` | 降级备用模型 |

## 状态值

### TTS 任务状态

```text
queued -> running -> succeeded
                 -> failed
       -> canceled
```

### 音色状态

| 状态 | 说明 |
|------|------|
| `processing` | 设计/克隆执行中 |
| `active` | 可用 |
| `rejected` | 设计/克隆失败 |
| `disabled` | 已禁用（删除后） |

### 克隆源风险状态

| 状态 | 说明 |
|------|------|
| `approved` | 已通过 |
| `pending` | 待审核 |
| `rejected` | 已拒绝 |

## 健康检查

`GET /health`

```json
{
  "status": "ok"
}
```
