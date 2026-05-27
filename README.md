# MiMo TTS Platform

> 基于小米 MiMo V2.5 多模型的文本转语音平台，支持预置音色、音色设计、音色克隆，以及丰富的风格控制能力。

## Features

- **预置音色** — 8 个官方音色（中文 4 + 英文 4），开箱即用
- **音色克隆** — 上传音频或浏览器录音，克隆后直接生成
- **音色设计** — 通过文字描述 AI 生成全新音色
- **风格控制** — 内联标签 `(开心)` `(东北话)` `(唱歌)`、导演模式、自然语言描述
- **长文本** — 超 2500 字自动分段生成并拼接
- **团队协作** — 音色发布共享，用户数据隔离

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand |
| Backend | FastAPI, SQLAlchemy (async), Alembic, httpx |
| Database | SQLite (lite) / MySQL 8.0 |
| Task Queue | Background threads (lite) / Celery + Redis |
| Storage | Local filesystem / S3-compatible |

## Quick Start

最快的上手方式，无需 MySQL/Redis，使用 SQLite + mock 模式。

**Prerequisites:** Python >= 3.11, Node.js >= 18

```bash
git clone git@github.com:Chen-2005/MIMO.git mimo
cd mimo
```

**Backend:**

```bash
cd backend
pip install -e ".[dev]" && pip install aiosqlite

cat > .env << EOF
DATABASE_URL=sqlite+aiosqlite:///test.db
PROVIDER_MODE=mock
CELERY_ENABLED=false
LOCAL_STORAGE_PATH=./storage
DEBUG=true
EOF

alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

> `PROVIDER_MODE=mock` 不调用真实 API，生成测试音调音频。真实 TTS 需配置 `PROVIDER_MODE=mimo` 及 API Key。

## Deployment

### Docker Compose (Production)

```bash
cp .env.example .env   # 编辑配置，设置 MIMO_API_KEY 等
cd docker
docker compose up -d
docker compose exec backend alembic upgrade head
```

### 局域网 HTTPS（移动端录音需要）

详见 [docs/deployment.md](docs/deployment.md)。

### 云服务器

详见 [docs/cloud-deployment.md](docs/cloud-deployment.md)。

## Project Structure

```
mimo/
├── backend/
│   ├── app/
│   │   ├── infra/          # Provider 适配、存储、文本分段
│   │   ├── models/         # SQLAlchemy 数据模型
│   │   ├── routers/        # API 路由
│   │   ├── schemas/        # Pydantic 模型
│   │   ├── services/       # 业务逻辑
│   │   └── tasks/          # TTS 任务执行
│   ├── alembic/            # 数据库迁移
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/            # Pages (workspace, history, voices)
│       ├── components/     # UI components
│       ├── services/       # API layer
│       └── stores/         # Zustand state
├── docs/
└── docker/
```

## Testing

```bash
cd backend
python -m pytest tests -q          # 单元测试 (SQLite + mock)
```

真实 MiMo 集成测试需配置 `MIMO_API_KEY`，详见 [docs/development.md](docs/development.md)。

## Documentation

| Doc | Description |
|-----|-------------|
| [API Reference](docs/api.md) | REST API 接口文档 |
| [Development](docs/development.md) | 开发说明与架构 |
| [Deployment](docs/deployment.md) | 部署指南 |
| [Voice Clone Workflow](docs/voice-clone-workflow.md) | 音色克隆工作流 |

## License

内部项目，仅限团队使用。
