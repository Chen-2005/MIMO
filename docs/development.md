# 开发说明

## 项目定位

内部小团队 TTS 工具，优先级：

1. 能稳定跑起来
2. 真实 MiMo 能稳定调用
3. 音色克隆/设计到文本生成链路顺畅
4. 错误可定位、可恢复
5. 再考虑审计、权限、治理

## 架构概览

```text
前端（Next.js 16 + React 19）
  -> API 调用（axios）
  -> 后端路由（routers/）
  -> 业务逻辑（services/）
  -> Provider 适配（infra/provider.py）
  -> MiMo API（chat completions 格式）
  -> 数据库（SQLAlchemy async）
  -> 存储（本地文件 / S3）
```

## 关键目录

### 后端

| 目录 | 说明 |
|------|------|
| `backend/app/routers/` | HTTP 接口入口（tts、voice_profile、metrics） |
| `backend/app/services/` | 业务逻辑（tts_service、voice_service、audit_service、metrics_service） |
| `backend/app/infra/` | Provider 适配、存储、文本分段 |
| `backend/app/models/` | SQLAlchemy 数据模型 |
| `backend/app/schemas/` | Pydantic 请求/响应模型 |
| `backend/app/tasks/` | TTS 任务执行逻辑 |
| `backend/tests/` | 单测与集成测试 |

### 前端

| 文件 | 说明 |
|------|------|
| `frontend/src/app/workspace/page.tsx` | 语音生成主工作台 |
| `frontend/src/app/history/page.tsx` | 任务历史 |
| `frontend/src/app/voices/page.tsx` | 音色中心 |
| `frontend/src/components/tts/TextInput.tsx` | 文本输入（含内联标签插入） |
| `frontend/src/components/tts/StyleControls.tsx` | 风格控制（含导演模式） |
| `frontend/src/components/tts/VoiceSelector.tsx` | 音色选择器 |
| `frontend/src/components/tts/ModelSelector.tsx` | 模型选择器 |
| `frontend/src/components/tts/AudioPlayer.tsx` | 音频播放器 |
| `frontend/src/components/voice/VoiceCloneTab.tsx` | 音色克隆（含录音、上传、直接生成） |
| `frontend/src/components/voice/VoiceDesignTab.tsx` | 音色设计（含描述生成器） |
| `frontend/src/components/voice/VoiceDetailPanel.tsx` | 音色详情（含试听、发布） |
| `frontend/src/stores/tts-store.ts` | TTS 全局状态（Zustand） |
| `frontend/src/services/voice.ts` | 音色 API 封装 |
| `frontend/src/services/tts.ts` | TTS API 封装 |

## 核心功能实现

### 语音生成流程

1. 前端收集：文本、模型、音色、风格、语速、格式
2. 调用 `POST /api/v1/tts/tasks` 创建任务
3. 后端根据音色类型解析生成上下文：
   - 系统音色：直接使用 `provider_voice_id`
   - 设计音色：使用描述作为风格提示（MiMo 设计 ID 不能复用）
   - 克隆音色：使用克隆后的 voice ID
4. 文本超过 2500 字自动分段（`infra/text_segmentation.py`）
5. 每段独立调用 MiMo API
6. 多段音频用 ffmpeg 拼接
7. 前端轮询任务状态，成功后展示播放器

### 内联表现力标签

在文本中用括号包裹标签，直接传给 MiMo API，后端无需处理。

支持的标签类别：

- 情绪：`(开心)` `(悲伤)` `(愤怒)` `(惊讶)` 等
- 基调：`(温柔)` `(冷酷)` `(活泼)` `(严肃)` 等
- 音色：`(磁性)` `(醇厚)` `(清亮)` `(空灵)` 等
- 方言：`(东北话)` `(四川话)` `(河南话)` `(粤语)`
- 角色：`(夹子音)` `(成熟女声)` `(正太音)` `(大叔音)` `(台湾腔)`
- 特殊：`(唱歌)` （必须放在文本最前面）

前端在 `TextInput.tsx` 中提供标签插入面板，用户点击即可在光标位置插入。

### 导演模式

通过 `[角色]` `[场景]` `[指令]` 三个维度结构化控制语音表现。

前端在 `StyleControls.tsx` 中实现：

- 用户填写三个文本框（或使用预设提示点击填入）
- 系统格式化为：`[角色] xxx\n[场景] xxx\n[指令] xxx`
- 作为 `style_prompt` 传给后端
- 后端将其映射为 MiMo API 的 `user` 消息

### 音色设计

1. 用户在 `VoiceDesignTab.tsx` 中填写名称和描述
2. 描述可通过三种方式生成：
   - **描述生成器**：选择性别/年龄/质感/节奏/情绪，自动拼接
   - **快速模板**：预设的 4 种音色描述
   - **手动填写**：自由文本
3. 提交后后端创建 `VoiceProfile`（status=processing）
4. 后台线程调用 MiMo 设计模型
5. 前端轮询状态直到 `active` 或 `rejected`

### 音色克隆

两段式提交：

1. 前端上传音频文件 → `POST /api/v1/voice-profiles/clone/audio` → 拿到 `source_audio_url`
2. 前端提交克隆申请 → `POST /api/v1/voice-profiles/clone`
3. 后端后台线程执行克隆：
   - 读取 `VoiceCloneSource`
   - 将音频源统一转换为 DataURL（MiMo 要求）
   - 调用 MiMo 克隆模型
   - 成功后设置 `provider_voice_id`，状态变为 `active`
4. 前端轮询克隆音色状态
5. 克隆成功后，如果填写了文本，立即创建 TTS 任务
6. 可选"仅本次使用"模式：生成成功后自动禁用克隆音色

关键函数：

- `voice_service.py` → `_normalize_clone_audio_source()`：统一转换音频源为 DataURL
- `voice_service.py` → `_execute_voice_clone()`：后台线程执行克隆
- `tts_tasks.py` → `_resolve_generation_context()`：解析音色类型，返回生成参数

### 音色发布

设计或克隆音色默认 `is_public=0`（仅自己可见）。

发布流程：

1. 用户在音色详情面板点击"试听"
2. 试听生成后，出现"发布音色"按钮
3. 点击后调用 `PATCH /api/v1/voice-profiles/{id}` 设置 `is_public=1`
4. 发布后团队所有成员可见

### 长文本分段

`backend/app/infra/text_segmentation.py`：

- 阈值：2500 字符
- 分段策略：按句子边界（`。！？!?.`）切分
- 贪心合并：尽量填满每段不超过 2500 字
- 降级切分：单句超长时按逗号/分号切分
- 最终兜底：按字符数强制切分

## Provider 模式

`backend/app/infra/provider.py`：

| 模式 | 说明 |
|------|------|
| `mock` | 不调用真实 API，生成测试音调音频 |
| `mimo` | 调用真实 MiMo API |

开发建议：默认用 `mock` 跑全量测试，验证真实链路时切到 `mimo`。

## 数据与状态约定

### 音色状态

| 状态 | 说明 |
|------|------|
| `processing` | 设计/克隆执行中 |
| `active` | 可用 |
| `rejected` | 失败 |
| `disabled` | 已禁用 |

### 克隆源风险状态

| 状态 | 说明 |
|------|------|
| `approved` | 已通过 |
| `pending` | 待审核 |
| `rejected` | 已拒绝 |

### 可见性

| `is_public` | 说明 |
|-------------|------|
| `0` | 仅创建者可见（默认） |
| `1` | 所有用户可见 |

## 运行方式

### 轻量模式

`backend/.env`：

```env
DATABASE_URL=sqlite+aiosqlite:///test.db
PROVIDER_MODE=mock
CELERY_ENABLED=false
LOCAL_STORAGE_PATH=./storage
```

### 真实 MiMo 模式

```env
PROVIDER_MODE=mimo
MIMO_API_BASE=https://api.xiaomimimo.com/v1
MIMO_API_KEY=your_api_key
```

## HTTPS 前端

文件：`frontend/server.mjs`

用途：

- 解决浏览器录音权限问题（`getUserMedia` 要求 HTTPS）
- 统一代理 `/api/*` 和 `/static/*`

启动：

```bash
cd frontend
npm run build
node server.mjs
```

## 测试

### 默认测试

```bash
cd backend
python -m pytest tests -q
```

使用 SQLite + mock provider，无需真实 API。

### 真实 MiMo 集成测试

文件：`backend/tests/test_mimo_integration.py`

```powershell
$env:RUN_REAL_MIMO_TESTS="true"
python -m pytest tests/test_mimo_integration.py -vv -s
```

不开环境变量时测试会跳过。

## 当前任务执行方式

设计音色和克隆音色通过后台线程执行：

- `_execute_voice_design()`
- `_execute_voice_clone()`

优点：简单，本地开发容易跑通。

限制：进程重启后不恢复，不如正式队列系统稳定。适合当前内部小团队阶段。

TTS 任务执行在 `backend/app/tasks/tts_tasks.py`：

- `execute_tts_task()`：主入口
- `_resolve_generation_context()`：解析音色和模型
- `_generate_segments()`：分段生成
- `_concat_audio_files()`：ffmpeg 拼接
