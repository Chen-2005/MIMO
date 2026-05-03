# MiMo TTS Platform

基于小米 MiMo V2.5 多模型的内部文本转语音平台，支持预置音色生成、音色设计、音色克隆，以及丰富的风格控制能力。

## 功能概览

### 语音生成

- **预置音色生成**：8 个官方音色（中文 4 个 + 英文 4 个），开箱即用
- **音色克隆生成**：上传音频样本或直接录音，克隆后当场生成语音
- **长文本自动分段**：超过 2500 字自动按句子边界分段，独立生成后拼接
- **模型降级**：主模型 `MiMo-V2.5-TTS` 不可用时自动降级到 `MiMo-V2-TTS`

### 风格控制

- **内联表现力标签**：在文本中插入 `(开心)` `(温柔)` `(东北话)` `(唱歌)` 等标签控制语气
- **导演模式**：通过 `[角色]` `[场景]` `[指令]` 三个维度精确控制语音表现
- **自然语言风格描述**：在风格提示词中用自然语言描述想要的效果
- **语速调节**：0.5x ~ 2.0x 语速滑块
- **输出格式**：支持 MP3 和 WAV

### 音色管理

- **音色设计**：通过文字描述生成全新音色，提供描述生成器和快速模板
- **设计→克隆管线**：设计音色后，用其输出音频作为克隆输入源，创建可复用的克隆音色
- **音色克隆**：上传音频样本或浏览器录音，支持"仅本次使用"模式
- **音色发布**：试听满意后可选择发布，发布后团队其他成员可见
- **音色编辑**：修改名称、描述、性别/年龄/语言标签

### 任务管理

- **任务历史**：查看所有任务状态，支持按状态和模型筛选
- **最近生成**：工作台保留最近 5 次生成结果，支持同时试听对比
- **重试与取消**：失败任务可重试，排队中任务可取消
- **音频下载**：生成完成后可直接下载音频文件

### 任务管理

- **任务历史**：查看所有任务状态，支持按状态和模型筛选
- **重试与取消**：失败任务可重试，排队中任务可取消
- **音频下载**：生成完成后可直接下载音频文件

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16、React 19、TypeScript、Tailwind CSS 4、Zustand |
| 后端 | FastAPI、SQLAlchemy (async)、Alembic、httpx |
| 数据库 | SQLite（轻量模式）或 MySQL 8.0 |
| 异步任务 | 后台线程（轻量模式）或 Celery + Redis |
| 存储 | 本地文件系统或 S3 兼容存储 |

## 目录结构

```text
mimo/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── infra/              # Provider 适配、存储、文本分段
│   │   ├── models/             # SQLAlchemy 数据模型
│   │   ├── routers/            # API 路由（tts、voice_profile、metrics）
│   │   ├── schemas/            # 请求/响应 Pydantic 模型
│   │   ├── services/           # 业务逻辑层
│   │   ├── tasks/              # TTS 任务执行
│   │   ├── config.py           # 配置管理
│   │   ├── db.py               # 数据库连接
│   │   └── main.py             # FastAPI 入口
│   ├── alembic/                # 数据库迁移
│   ├── tests/                  # 测试
│   ├── storage/                # 本地音频/克隆样本存储
│   └── pyproject.toml
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── app/                # 页面（workspace、history、voices）
│   │   ├── components/         # 组件（tts/、voice/、layout/、common/）
│   │   ├── services/           # API 调用封装
│   │   ├── stores/             # Zustand 状态管理
│   │   └── types/              # TypeScript 类型定义
│   ├── server.mjs              # HTTPS + 反向代理服务器
│   └── package.json
├── docs/                       # 项目文档
├── docker/                     # Docker 部署配置
└── .env.example                # 环境变量模板
```

## 快速开始

### 前置条件

- Python >= 3.11
- Node.js >= 18
- MiMo API Key（从 [小米 MiMo 平台](https://api.xiaomimimo.com) 获取）

### 1. 克隆项目

```bash
git clone <repo-url> mimo
cd mimo
```

### 2. 启动后端

```bash
cd backend

# 安装依赖
pip install -e ".[dev]"

# 配置环境变量
cp ../.env.example .env
# 编辑 .env，填入 MIMO_API_KEY

# 数据库迁移
alembic upgrade head

# 启动
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`.env` 最小配置：

```env
DATABASE_URL=sqlite+aiosqlite:///test.db
PROVIDER_MODE=mimo
CELERY_ENABLED=false
LOCAL_STORAGE_PATH=./storage
MIMO_API_BASE=https://api.xiaomimimo.com/v1
MIMO_API_KEY=your_api_key_here
```

### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 4. 访问

- 前端：http://localhost:3000
- 后端 API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## 页面说明

### 语音生成（/workspace）

主工作台页面，提供两种生成模式：

**预置音色生成**：
1. 输入文本（可插入表现力标签）
2. 选择模型和音色
3. 调整风格和参数（风格提示词 / 导演模式 / 语速 / 输出格式）
4. 点击"生成语音"，等待完成后试听和下载
5. 每次生成的结果会保留在"最近生成"列表中（最多 5 条），支持同时试听对比

**音色克隆生成**：
1. 上传音频文件或直接录音
2. 填写音色名称和授权信息
3. 输入本次要生成的文本
4. 提交后自动完成克隆 → 生成 → 播放
5. 可选择"仅本次使用"，生成后自动移除克隆音色

### 任务历史（/history）

- 查看所有 TTS 任务的执行状态
- 按状态（排队中/生成中/已完成/失败/已取消）筛选
- 按模型筛选
- 点击任务行展开试听和下载
- 失败任务可重试，排队中任务可取消

### 音色中心（/voices）

**全部音色**：
- 查看所有可用音色（系统预置 + 设计 + 克隆）
- 点击音色卡片查看详情
- 试听音色效果
- 编辑音色信息
- 发布/取消发布（控制是否对团队可见）

**音色设计**：
- 通过文字描述创建新音色
- 使用描述生成器（选择性别/年龄/质感/节奏/情绪自动生成描述）
- 使用快速模板（温柔知性女声、活力少年男声等）
- 提交后等待设计完成

## 音色类型

| 类型 | 说明 | 来源 |
|------|------|------|
| 系统音色 (system) | 官方预置，团队共享 | 冰糖、茉莉、苏打、白桦、Mia、Chloe、Milo、Dean |
| 设计音色 (designed) | 通过文字描述 AI 生成 | 用户在音色中心创建 |
| 克隆音色 (cloned) | 从音频样本克隆 | 用户上传音频或录音 |

## 风格控制详解

### 内联表现力标签

在待合成文本中直接插入标签，用括号包裹。每句话建议最多一个标签。

**情绪标签**：`(开心)` `(悲伤)` `(愤怒)` `(惊讶)` `(兴奋)` `(委屈)` `(平静)` `(冷漠)` `(感动)` `(焦虑)` `(疲惫)` `(无奈)`

**基调标签**：`(温柔)` `(冷酷)` `(活泼)` `(严肃)` `(慵懒)` `(俏皮)` `(低沉)` `(犀利)`

**音色标签**：`(磁性)` `(醇厚)` `(清亮)` `(空灵)` `(甜美)` `(沙哑)`

**方言标签**：`(东北话)` `(四川话)` `(河南话)` `(粤语)`

**角色标签**：`(夹子音)` `(成熟女声)` `(正太音)` `(大叔音)` `(台湾腔)`

**特殊标签**：`(唱歌)` （必须放在文本最前面）

示例：

```
(温柔)大家好，欢迎来到今天的分享。(兴奋)今天我们聊一个特别有意思的话题！
```

### 导演模式

通过三个结构化维度精确控制语音表现：

- **[角色]**：身份、性格、说话习惯。例如"25岁知性女性，说话温和有条理"
- **[场景]**：正在发生什么、面向谁。例如"在安静的录音棚里为有声书配音"
- **[指令]**：语速、停顿、重音、情绪弧线。例如"语速平稳适中，句间留有自然停顿"

系统提供预设提示，点击即可填入。

### 自然语言控制

在风格提示词中用自然语言描述想要的效果，例如：

```
自然、平稳、像真人讲解，停顿自然，不要播音腔，不要夸张。
```

```
开头稍慢引人入胜，中段节奏加快，结尾放慢收束。全程保持克制，像真人在耳边说话。
```

## 设计→克隆管线

设计音色后，可以将其输出音频作为克隆输入源：

1. 进入音色中心，设计一个新音色
2. 等待设计完成，在音色详情中试听样本音频
3. 点击"用此音色克隆"
4. 自动跳转到工作台的克隆生成标签页，音频 URL 已预填
5. 填写音色名称和授权信息，提交克隆

这样设计的音色就可以通过克隆变成一个可复用、可发布的音色。

## 音色发布

设计或克隆音色后，默认仅自己可见。发布流程：

1. 进入音色中心，找到目标音色
2. 点击"试听"生成预览音频
3. 试听满意后，点击"发布音色"
4. 发布后，团队所有成员都能在语音生成页面看到该音色
5. 随时可以"取消发布"，恢复为仅自己可见

## 配置参考

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `sqlite+aiosqlite:///test.db` |
| `PROVIDER_MODE` | TTS 提供者模式：`mock` 或 `mimo` | `mock` |
| `MIMO_API_BASE` | MiMo API 地址 | `https://api.xiaomimimo.com/v1` |
| `MIMO_API_KEY` | MiMo API 密钥 | - |
| `CELERY_ENABLED` | 是否启用 Celery | `false` |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379/0` |
| `LOCAL_STORAGE_PATH` | 本地存储路径 | `./storage` |
| `CORS_ORIGINS` | 允许的跨域来源 | `["http://localhost:3000"]` |
| `DEBUG` | 调试模式 | `true` |

### Provider 模式

- **mock**：不调用真实 API，生成测试音调音频，适合开发调试
- **mimo**：调用真实 MiMo API，需要配置 `MIMO_API_BASE` 和 `MIMO_API_KEY`

## HTTPS 部署

音频录制依赖浏览器麦克风权限，需要 HTTPS 环境。项目提供内置的 HTTPS 服务器：

```bash
cd frontend

# 生成自签名证书
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=<你的IP>"

# 构建并启动
npm run build
node server.mjs
```

`server.mjs` 会：
- 以 HTTPS 启动前端（默认端口 3000）
- 代理 `/api/*` 和 `/static/*` 到后端（默认 `http://127.0.0.1:8000`）

局域网内其他设备通过 `https://<你的IP>:3000` 访问，首次需接受自签名证书警告。

## 测试

### 单元测试

```bash
cd backend
python -m pytest tests -q
```

默认使用 SQLite + mock provider，无需真实 API。

### 真实 MiMo 集成测试

```bash
cd backend

# PowerShell
$env:RUN_REAL_MIMO_TESTS="true"
python -m pytest tests/test_mimo_integration.py -vv -s

# CMD
set RUN_REAL_MIMO_TESTS=true
python -m pytest tests/test_mimo_integration.py -vv -s
```

需要在 `.env` 中配置 `PROVIDER_MODE=mimo` 和有效的 `MIMO_API_KEY`。

## Docker 部署

```bash
cp .env.example .env
# 编辑 .env 填入 MIMO_API_KEY

cd docker
docker compose up -d

# 初始化数据库
docker compose exec backend alembic upgrade head
```

详见 [docs/deployment.md](docs/deployment.md)。

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/api.md](docs/api.md) | REST API 接口文档 |
| [docs/development.md](docs/development.md) | 开发说明与架构 |
| [docs/deployment.md](docs/deployment.md) | 部署指南（Docker / 本地 / 局域网） |
| [docs/voice-clone-workflow.md](docs/voice-clone-workflow.md) | 音色克隆工作流详解 |
| [docs/mimo-skill-optimization.md](docs/mimo-skill-optimization.md) | 基于官方 Skill 的优化清单 |
| [docs/commercialization-roadmap.md](docs/commercialization-roadmap.md) | 商业化路线图与实施方案 |
| [docs/claude-handoff.md](docs/claude-handoff.md) | Claude Code 交接文档 |

## License

内部项目，仅限团队使用。
