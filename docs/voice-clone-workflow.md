# 音色克隆工作流

更新时间：2026-05-03

## 1. 文档范围

聚焦音色克隆相关实现，方便后续维护克隆链路时快速进入上下文。

## 2. 需求目标

克隆功能不只是"保存一个长期音色"，还要支持：

1. 用户提交声音样本（上传文件或浏览器录音）
2. 克隆音色
3. 在同一页面直接对当前文本生成语音
4. 支持"仅本次使用"模式

克隆功能更像"一次性的定制配音入口"，而不只是纯音色资产管理。

## 3. 当前入口

### 工作台内嵌模式（主要入口）

`frontend/src/app/workspace/page.tsx` → "音色克隆生成" 标签页

用户在语音生成页面切换到克隆模式，完成克隆→生成→播放一体化流程。

### 音色中心独立模式

`frontend/src/components/voice/VoiceCloneTab.tsx`（`embedded=false`）

在音色中心查看和管理已有克隆音色。

## 4. 实现方案

### 4.1 前端两段式提交

文件：`frontend/src/components/voice/VoiceCloneTab.tsx`

流程：

1. 用户上传本地音频，或使用浏览器录音
2. 前端调用 `uploadVoiceCloneAudio(file)` 上传
3. 后端返回 `source_audio_url`
4. 前端再调用 `createVoiceClone(...)` 提交克隆申请

支持的音频来源：
- 本地文件上传（推荐）
- 浏览器录音（需要 HTTPS）
- 手动填写 URL / DataURL（高级方式）

### 4.2 后端上传接口

`POST /api/v1/voice-profiles/clone/audio`

- 接收 `multipart/form-data`
- 校验 `audio/*`
- 限制最大 20MB
- 存到本地或对象存储
- 返回可引用的 `source_audio_url`

### 4.3 后端克隆源规范化

关键函数：`voice_service.py` → `_normalize_clone_audio_source()`

支持输入：
- `http://...` / `https://...`
- `/static/...`
- `data:audio/...;base64,...`

输出统一为 `data:audio/...;base64,...`（MiMo 克隆模型要求）。

### 4.4 后端执行克隆

关键函数：`voice_service.py` → `_execute_voice_clone(profile_id)`

1. 读取 `VoiceProfile` 和 `VoiceCloneSource`
2. 规范化 `source_audio_url` 为 DataURL
3. 调用 provider 的 `create_voice_clone()`
4. 成功：设置 `provider_voice_id`，状态变为 `active`
5. 失败：状态变为 `rejected`

当前用后台线程执行。

## 5. 同页直接生成

工作台嵌入模式下，克隆成功后自动进入生成流程：

1. 创建克隆申请
2. 轮询克隆音色状态，等待 `active`（最长 90 秒）
3. 如果填写了文本，立即创建 TTS 任务
4. 轮询任务状态（最长 120 秒）
5. 成功后在当前页展示播放器

## 6. 仅本次使用模式

默认勾选 `one_time_only: true`。

逻辑：
1. TTS 生成成功后
2. 前端调用 `DELETE /api/v1/voice-profiles/{id}`
3. 后端把音色状态改成 `disabled`
4. 列表接口不返回 `disabled` 音色

用户体验：这次音色只用于当前一次生成，不会在长期列表里保留。

## 7. 浏览器录音

文件：`VoiceCloneTab.tsx` → `startRecording()` / `stopRecording()`

- 使用 `navigator.mediaDevices.getUserMedia({ audio: true })`
- `MediaRecorder` 录制为 webm 格式
- 录制完成后转为 File 对象
- 需要 HTTPS 或 localhost 环境

## 8. 状态约定

### 音色状态

| 状态 | 说明 |
|------|------|
| `processing` | 克隆执行中 |
| `active` | 克隆成功，可用 |
| `rejected` | 克隆失败 |
| `disabled` | 已禁用（删除或一次性使用后） |

### 克隆失败时

前端等待音色状态时，如果看到 `rejected` 或 `disabled`，按失败处理并提示用户。

## 9. 剩余风险

### 后台线程非强持久

如果服务在执行克隆时重启，当前线程任务不会自动恢复。启动时会尝试恢复 `processing` 状态的任务。

### 轮询超时体验

当前已能工作，但还可以补充：
- 更清晰的阶段提示
- 超时后的恢复建议

### 缺少 E2E 测试

"克隆页上传样本 → 克隆 → 直接生成 → 播放结果" 这条前端整链路还缺端到端测试。

## 10. 建议后续动作

1. 补克隆页 E2E 测试
2. 优化超时和失败提示
3. 设计→克隆管线（用设计音色输出作为克隆输入源）
