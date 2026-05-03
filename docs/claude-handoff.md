# Claude Code 交接文档

更新时间：2026-05-03

## 1. 项目目标

内部小团队 MiMo TTS 工具，当前目标：

1. 能稳定启动
2. 能稳定走真实 MiMo
3. 音色克隆/设计可用
4. 克隆/设计后当场可生成语音
5. 错误可定位、可恢复

不作为当前重点：完整 RBAC、重审计流程、大规模外部推广。

## 2. 建议先读的文件

1. [README.md](/D:/mimo/README.md) — 项目总览和使用说明
2. [docs/voice-clone-workflow.md](/D:/mimo/docs/voice-clone-workflow.md) — 克隆链路详解
3. [docs/api.md](/D:/mimo/docs/api.md) — API 接口文档
4. [docs/development.md](/D:/mimo/docs/development.md) — 开发说明与架构
5. [backend/app/services/voice_service.py](/D:/mimo/backend/app/services/voice_service.py) — 音色业务逻辑
6. [backend/app/tasks/tts_tasks.py](/D:/mimo/backend/app/tasks/tts_tasks.py) — TTS 任务执行
7. [frontend/src/app/workspace/page.tsx](/D:/mimo/frontend/src/app/workspace/page.tsx) — 主工作台
8. [frontend/src/components/voice/VoiceCloneTab.tsx](/D:/mimo/frontend/src/components/voice/VoiceCloneTab.tsx) — 克隆页面

## 3. 已完成的关键能力

### 基础链路

- TTS 任务创建、查询、历史、重试、取消
- 系统音色、设计音色、克隆音色管理
- 真实 MiMo 集成测试通过
- 长文本自动分段（2500 字阈值）
- 模型自动降级

### 音色克隆

- 两段式提交（先上传后申请）
- 后端统一 DataURL 规范化
- 克隆完成后同页直接生成文本语音
- "仅本次使用"模式（生成后自动禁用）
- 浏览器直接录音

### 音色设计

- 通过文字描述生成新音色
- 描述生成器（性别/年龄/质感/节奏/情绪选择器）
- 快速模板（4 种预设音色描述）

### 风格控制

- 内联表现力标签（情绪/基调/音色/方言/角色/唱歌）
- 导演模式（[角色][场景][指令] 结构化控制）
- 自然语言风格描述
- 语速调节（0.5x ~ 2.0x）

### 音色发布

- 试听后可选择发布/取消发布
- `is_public` 控制可见性：0=仅自己，1=团队可见

### 前端

- 工作台单列布局，结果内联显示（无侧边栏）
- 手机端适配（克隆页面、音色卡片、详情面板）
- HTTPS 服务器 + API/静态文件反向代理

## 4. 关键实现位置

### 后端

| 文件 | 说明 |
|------|------|
| `backend/app/routers/tts.py` | TTS 任务 API |
| `backend/app/routers/voice_profile.py` | 音色管理 API |
| `backend/app/services/tts_service.py` | TTS 业务逻辑 |
| `backend/app/services/voice_service.py` | 音色业务逻辑（克隆规范化、设计/克隆执行） |
| `backend/app/tasks/tts_tasks.py` | TTS 任务执行（音色解析、分段、生成、拼接） |
| `backend/app/infra/provider.py` | MiMo API 适配 |
| `backend/app/infra/text_segmentation.py` | 长文本分段 |
| `backend/app/config.py` | 配置管理 |

### 前端

| 文件 | 说明 |
|------|------|
| `frontend/src/app/workspace/page.tsx` | 主工作台页面 |
| `frontend/src/components/tts/TextInput.tsx` | 文本输入（含标签插入） |
| `frontend/src/components/tts/StyleControls.tsx` | 风格控制（含导演模式） |
| `frontend/src/components/tts/VoiceSelector.tsx` | 音色选择器 |
| `frontend/src/components/voice/VoiceCloneTab.tsx` | 克隆页面 |
| `frontend/src/components/voice/VoiceDesignTab.tsx` | 音色设计（含描述生成器） |
| `frontend/src/components/voice/VoiceDetailPanel.tsx` | 音色详情（含试听、发布） |
| `frontend/src/stores/tts-store.ts` | TTS 全局状态 |
| `frontend/src/services/voice.ts` | 音色 API 封装 |
| `frontend/src/services/tts.ts` | TTS API 封装 |
| `frontend/server.mjs` | HTTPS + 反向代理 |

## 5. 运行方式

### 后端

```bash
cd backend
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端（开发）

```bash
cd frontend
npm install
npm run dev
```

### 前端（HTTPS）

```bash
cd frontend
npm run build
node server.mjs
```

## 6. 测试

### 默认测试

```bash
cd backend
python -m pytest tests -q
```

### 真实 MiMo 集成测试

```powershell
$env:RUN_REAL_MIMO_TESTS="true"
python -m pytest tests/test_mimo_integration.py -vv -s
```

## 7. 已验证通过

- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- 真实 MiMo 集成测试通过
- 真实音色克隆链路通过
- 真实音色设计链路通过
- 长文本分段生成通过

## 8. 当前建议方向

### 高优先级

- 克隆页面 E2E 测试
- 优化轮询超时和失败提示
- 设计→克隆管线（用设计音色的输出作为克隆输入）

### 中优先级

- 评估后台线程是否迁移到更稳定的任务执行器
- 梳理本地存储文件清理策略
- 真实 MiMo 错误码映射

### 低优先级

- 完整 RBAC
- 重审批审计闭环
