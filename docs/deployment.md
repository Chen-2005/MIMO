# 部署指南

## 环境要求

| 组件 | 版本要求 |
|------|----------|
| Python | >= 3.11 |
| Node.js | >= 18 |
| MySQL | >= 8.0 |
| Redis | >= 7.0 |
| Docker（可选） | >= 24.0 |

---

## 方式一：Docker Compose 部署

最简单的部署方式，一键启动所有服务。

### 1. 配置环境变量

复制环境变量模板并编辑：

```bash
cp .env.example .env
```

在 `.env` 中填写：

```bash
MIMO_API_BASE=https://api.xiaomimimo.com
MIMO_API_KEY=your-api-key-here
```

### 2. 启动服务

```bash
cd docker
docker compose up -d
```

启动的服务：

| 服务 | 端口 | 说明 |
|------|------|------|
| mysql | 3306 | MySQL 8.0 数据库 |
| redis | 6379 | Redis 7 缓存/消息队列 |
| backend | 8000 | FastAPI 后端 |
| celery-worker | — | Celery 异步任务处理 |
| frontend | 3000 | Next.js 前端 |

### 3. 初始化数据库

```bash
docker compose exec backend alembic upgrade head
```

### 4. 访问

- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- Swagger 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

### 5. 常用命令

```bash
# 查看日志
docker compose logs -f backend
docker compose logs -f celery-worker

# 重启服务
docker compose restart backend

# 停止所有服务
docker compose down

# 清除数据重新开始
docker compose down -v
```

---

## 方式二：本地开发部署

适合开发调试，可选择连接 Docker 容器化的 MySQL/Redis，或使用纯本地环境。

### 步骤 1：启动基础设施

```bash
cd docker
docker compose up -d mysql redis
```

### 步骤 2：后端

```bash
cd backend

# 安装依赖
pip install -e ".[dev]"

# 配置环境变量
cat > .env << EOF
DATABASE_URL=mysql+aiomysql://appuser:app-password@localhost:3306/mimo_tts
REDIS_URL=redis://localhost:6379/0
PROVIDER_MODE=mimo
MIMO_API_BASE=https://api.xiaomimimo.com
MIMO_API_KEY=your-api-key-here
CELERY_ENABLED=true
LOCAL_STORAGE_PATH=./storage
EOF

# 数据库迁移
alembic upgrade head

# 启动后端
uvicorn app.main:app --reload --port 8000

# 启动 Celery Worker（另开终端）
celery -A app.tasks.celery_app worker --loglevel=info
```

### 步骤 3：前端

```bash
cd frontend

# 安装依赖
npm install

# 配置 API 地址（可选，默认连接 localhost:8000）
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 启动开发服务器
npm run dev
```

---

## 方式三：轻量本地环境（无需 MySQL/Redis）

适合快速验证功能，使用 SQLite 和后台线程替代。

### 后端配置

```bash
cd backend
pip install -e ".[dev]"
pip install aiosqlite

cat > .env << EOF
DATABASE_URL=sqlite+aiosqlite:///test.db
PROVIDER_MODE=mock
CELERY_ENABLED=false
LOCAL_STORAGE_PATH=./storage
DEBUG=true
EOF

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

`PROVIDER_MODE=mock` 模式下不调用真实 TTS API，生成一段测试音调音频。

如需测试真实 TTS：

```bash
# 修改 .env
PROVIDER_MODE=mimo
MIMO_API_BASE=https://api.xiaomimimo.com
MIMO_API_KEY=your-api-key-here
```

---

## 方式四：局域网团队使用（HTTPS + 自签名证书）

适合团队成员通过手机或电脑在同一局域网内访问。需要 HTTPS 以支持录音功能。

### 1. 生成自签名证书

```bash
cd frontend
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=<你的局域网IP>"
```

将 `<你的局域网IP>` 替换为实际 IP（如 `10.160.123.124`）。

### 2. 后端

```bash
cd backend
pip install -e ".[dev]"

cat > .env << EOF
DATABASE_URL=sqlite+aiosqlite:///test.db
PROVIDER_MODE=mock
CELERY_ENABLED=false
LOCAL_STORAGE_PATH=./storage
DEBUG=true
CORS_ORIGINS=["*"]
EOF

alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. 前端（生产模式）

```bash
cd frontend
npm install
npm run build
node server.mjs
```

### 4. 访问

- 前端：`https://<局域网IP>:3000`
- 首次访问需接受浏览器的自签名证书警告
- 手机和电脑需在同一局域网

### 5. 架构说明

`server.mjs` 是一个自定义 HTTPS 服务器，同时充当 API 反向代理：

- 所有 `/api/*` 和 `/static/*` 请求转发到 `http://127.0.0.1:8000`（后端）
- 其他请求由 Next.js 处理
- 这样前端和后端都通过同一个 HTTPS 端口提供服务，避免混合内容问题

### 6. 注意事项

- 录音功能必须在 HTTPS 下使用（浏览器 `getUserMedia` 限制）
- 如果服务器 IP 变化，需重新生成证书
- `CORS_ORIGINS=["*"]` 仅适用于内部团队使用，不要暴露到公网

---

## 生产环境部署

### 安全配置

```bash
# .env 生产环境配置
DEBUG=false
SECRET_KEY=<随机生成的强密钥>
CORS_ORIGINS=["https://your-domain.com"]
```

### 数据库

推荐使用 MySQL 8.0，配置独立的数据库用户：

```sql
CREATE DATABASE mimo_tts CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mimo'@'%' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON mimo_tts.* TO 'mimo'@'%';
```

更新连接字符串：

```bash
DATABASE_URL=mysql+aiomysql://mimo:strong-password@mysql-host:3306/mimo_tts
```

### 对象存储

生产环境建议使用 S3 兼容存储：

```bash
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=mimo-tts-audio
S3_REGION=us-east-1
```

### 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50m;
    }
}
```

### Celery Worker

生产环境务必启用 Celery + Redis：

```bash
CELERY_ENABLED=true
REDIS_URL=redis://redis-host:6379/0

# 启动 Worker
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

---

## 数据库迁移

```bash
# 查看当前版本
alembic current

# 升级到最新
alembic upgrade head

# 回退一个版本
alembic downgrade -1

# 生成新迁移（修改模型后）
alembic revision --autogenerate -m "描述信息"
```

---

### 云服务器部署（Git Bash + SSH 密钥）

如果本地使用 Git Bash 和 SSH 密钥连接云服务器，按以下步骤操作：

#### 本地操作（Git Bash）

```bash
# 1. 确保代码已提交
git status  # 应该是 clean 的

# 2. 打包
git archive --format=tar.gz --output=mimo-deploy.tar.gz HEAD

# 3. 上传到服务器
scp -i ~/Desktop/KeyPair-xxx.pem mimo-deploy.tar.gz root@your-server-ip:~/mimo-deploy.tar.gz
scp -i ~/Desktop/KeyPair-xxx.pem scripts/deploy.sh root@your-server-ip:~/mimo-deploy-remote.sh
```

#### 服务器操作（SSH 登录后）

```bash
# 同步代码并重建（跳过数据库迁移）
bash ~/mimo-deploy-remote.sh --archive ~/mimo-deploy.tar.gz --project-dir ~/cwj --skip-migrations
```

如果只是修改了代码（没有改依赖或 Dockerfile），可以跳过重建：

```bash
# 同步代码
mkdir -p /tmp/mimo-staging
tar -xzf ~/mimo-deploy.tar.gz -C /tmp/mimo-staging
rsync -av --delete \
  --exclude '.env' \
  --exclude 'backend/.env' \
  --exclude 'frontend/.env.local' \
  --exclude 'backend/storage' \
  --exclude 'frontend/key.pem' \
  --exclude 'frontend/cert.pem' \
  --exclude 'docker/docker-compose.yml' \
  /tmp/mimo-staging/ ~/cwj/
rm -rf /tmp/mimo-staging

# 只重启容器（不重建镜像，秒完成）
docker compose -f ~/cwj/docker/docker-compose.yml restart
```

#### 构建加速

Dockerfile 已配置国内镜像源，首次构建后会缓存：
- apt: 阿里云镜像
- pip: 清华镜像
- npm: npmmirror 镜像

---

## 健康检查

后端提供健康检查端点：

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

---

## 故障排查

### 端口被占用

```bash
# Windows
netstat -ano | findstr :8000
taskkill /F /PID <PID>

# Linux/macOS
lsof -i :8000
kill -9 <PID>
```

### SQLAlchemy 导入卡死

Python 3.14 环境下可能出现 SQLAlchemy C 扩展兼容问题：

```bash
pip install --force-reinstall --no-binary :all: sqlalchemy
```

### Celery 连接 Redis 失败

确认 Redis 运行中：

```bash
redis-cli ping
# 应返回 PONG
```

### 音频生成失败

1. 检查 `MIMO_API_KEY` 是否正确
2. 检查 `MIMO_API_BASE` 是否为 `https://api.xiaomimimo.com`
3. 查看后端日志中的错误详情
4. 将 `PROVIDER_MODE` 设为 `mock` 排除 API 问题
