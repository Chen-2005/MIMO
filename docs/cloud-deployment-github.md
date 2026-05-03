# 华为云部署指南（GitHub + root 用户）

前提：华为云服务器、root 用户、无域名（IP 直接访问）、代码在 GitHub 仓库。
**重要：服务器上已有其他服务在运行，部署时不能破坏任何已有内容。**

---

## 第一步：SSH 登录并全面检查现有环境

> **这一步最关键。** 先摸清服务器上有什么，再动手。

```bash
ssh -i /path/to/your-key.pem root@<服务器IP>
```

### 1.1 检查系统

```bash
cat /etc/os-release
uname -a
```

### 1.2 检查已有工具

```bash
docker --version          2>/dev/null && echo "已安装" || echo "未安装"
docker compose version    2>/dev/null && echo "已安装" || echo "未安装"
nginx -v                  2>/dev/null && echo "已安装" || echo "未安装"
git --version             2>/dev/null && echo "已安装" || echo "未安装"
```

### 1.3 检查已在运行的服务（重点！）

```bash
# 查看所有正在监听的端口
ss -tlnp
# 或
netstat -tlnp
```

**记录下输出中每个端口对应的服务。** 常见情况：

| 端口 | 可能的服务 |
|------|-----------|
| 22 | SSH |
| 80 | Nginx / Apache / 其他 Web |
| 443 | Nginx / Apache（HTTPS） |
| 3306 | MySQL |
| 6379 | Redis |
| 3000 | Node.js 应用 |
| 8000 | Python 应用 |
| 8080 | Java / 其他 Web |

### 1.4 检查 Docker 容器

```bash
# 查看正在运行的容器
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"

# 查看所有容器（包括停止的）
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

### 1.5 检查 Nginx 配置

```bash
# Nginx 配置文件位置
ls /etc/nginx/sites-enabled/
ls /etc/nginx/conf.d/

# 查看当前 Nginx 虚拟主机配置
cat /etc/nginx/sites-enabled/* 2>/dev/null
cat /etc/nginx/conf.d/*.conf 2>/dev/null
```

### 1.6 检查磁盘空间

```bash
df -h
```

### 1.7 填写环境检查表

根据上面的输出，填写这个表（后面会用到）：

```
已有服务和端口：
- 80:   __________ (如：Nginx)
- 443:  __________
- 3306: __________ (如：MySQL)
- 6379: __________ (如：Redis)
- 3000: __________
- 8000: __________

Docker 已安装: 是/否
Docker 容器: 列出名称
Nginx 已安装: 是/否
Nginx 已有站点: 列出域名/路径
磁盘剩余: _____ GB
```

---

## 第二步：安装缺失依赖（不影响已有服务）

> **只安装缺的，不碰已有的。** 不要执行 `apt upgrade -y`，避免更新影响已有服务。

```bash
apt update
```

### 2.1 Docker（如果未安装）

```bash
apt install -y docker.io docker-compose-v2
systemctl enable docker
systemctl start docker
# 将当前用户加入 docker 组（如果不用 root 跑服务）
# usermod -aG docker $USER
```

如果 Docker 已安装，跳过。

### 2.2 Nginx（如果未安装）

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

如果 Nginx 已安装且在运行，跳过。**不要重启它。**

### 2.3 Git（如果未安装）

```bash
apt install -y git
```

---

## 第三步：确定可用端口

根据第一步的检查结果，确定 MiMo 使用的端口。**避开已被占用的端口。**

### 端口规划

默认端口和替代方案：

| 服务 | 默认端口 | 如果被占用，改用 |
|------|---------|----------------|
| MySQL | 3306 | 13306 |
| Redis | 6379 | 16379 |
| 后端 API | 8000 | 18000 |
| 前端 | 3000 | 13000 |
| Nginx HTTP | 80 | 见下方说明 |
| Nginx HTTPS | 443 | 见下方说明 |

### 关于 80/443 端口

**如果 80/443 已被 Nginx 占用（有其他站点在用）：**

不要动已有的 Nginx 配置。方案有两种：

**方案 A（推荐）：通过路径前缀挂载到已有 Nginx**

在已有 Nginx 配置中添加一个 location block，把 `/mimo/` 路径转发到 MiMo 前端。这样通过 `http://<IP>/mimo/` 访问。

**方案 B：用其他端口**

MiMo 通过其他端口直接访问，如 `http://<IP>:13000`。不需要配置 Nginx。

**如果 80/443 没有被占用：**

直接用默认端口，创建新的 Nginx 站点配置。

### 记录最终端口方案

```
MiMo MySQL:  端口 ____ (默认 3306 或替代 13306)
MiMo Redis:  端口 ____ (默认 6379 或替代 16379)
MiMo 后端:   端口 ____ (默认 8000 或替代 18000)
MiMo 前端:   端口 ____ (默认 3000 或替代 13000)
MiMo 访问:   http://<IP>:____ / https://<IP>:____
```

> **后续步骤中的配置会用到这些端口，根据你的实际情况替换。**

---

## 第四步：从 GitHub 拉取代码到独立目录

```bash
# 选择一个不影响已有服务的目录
# 常见选择：/opt/mimo-tts 或 /home/mimo-tts
mkdir -p /opt/mimo-tts
```

### 4.1 配置 Git 访问

**方式 A：HTTPS + Personal Access Token（推荐）**

```bash
# GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
# 权限：Contents (Read)，选择你的仓库

git clone https://<你的用户名>:<你的token>@github.com/<你的用户名>/<仓库名>.git /opt/mimo-tts
```

**方式 B：SSH Key**

```bash
ssh-keygen -t ed25519 -C "deploy@mimo"
cat ~/.ssh/id_ed25519.pub
# 复制到 GitHub → Settings → SSH keys

ssh -T git@github.com
git clone git@github.com:<你的用户名>/<仓库名>.git /opt/mimo-tts
```

### 4.2 确认

```bash
cd /opt/mimo-tts
ls -la
# 确认看到 backend/ frontend/ docker/ docs/ 等
```

---

## 第五步：配置生产环境

### 5.1 生成密钥和密码

```bash
echo "SECRET_KEY=$(openssl rand -hex 32)"
echo "DB_PASSWORD=mimo_$(openssl rand -hex 12)"
```

记下输出。

### 5.2 创建 .env

```bash
cd /opt/mimo-tts

cat > .env << EOF
APP_NAME=MiMo TTS Platform
DEBUG=false
SECRET_KEY=<上面生成的 SECRET_KEY>

DATABASE_URL=mysql+aiomysql://mimo:<上面生成的 DB_PASSWORD>@mysql:<MySQL端口>/mimo_tts
REDIS_URL=redis://redis:<Redis端口>/0

CORS_ORIGINS=["http://<服务器IP>:<前端端口>"]

MIMO_API_BASE=https://api.xiaomimimo.com
MIMO_API_KEY=<你的 MiMo API Key>

PROVIDER_MODE=mimo
CELERY_ENABLED=true
LOCAL_STORAGE_PATH=./storage
TASK_DEFAULT_USER_ID=1
EOF
```

> **注意端口**：MySQL 和 Redis 端口是容器内部端口（3306/6379），CORS_ORIGINS 填用户实际访问的地址。

### 5.3 创建生产 Docker Compose

容器名称加 `mimo-` 前缀，Docker volume 也加前缀，避免与已有服务冲突。

```bash
cat > docker/docker-compose.prod.yml << 'YAMLEOF'
services:
  mysql:
    image: mysql:8.0
    container_name: mimo-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: <DB_PASSWORD>
      MYSQL_DATABASE: mimo_tts
      MYSQL_USER: mimo
      MYSQL_PASSWORD: <DB_PASSWORD>
    ports:
      - "127.0.0.1:<MySQL宿主机端口>:3306"
    volumes:
      - mimo_mysql_data:/var/lib/mysql
    networks:
      - mimo-net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: mimo-redis
    restart: always
    ports:
      - "127.0.0.1:<Redis宿主机端口>:6379"
    volumes:
      - mimo_redis_data:/data
    networks:
      - mimo-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ../backend
      dockerfile: ../docker/backend.Dockerfile
    container_name: mimo-backend
    restart: always
    ports:
      - "127.0.0.1:<后端端口>:8000"
    environment:
      DATABASE_URL: mysql+aiomysql://mimo:<DB_PASSWORD>@mysql:3306/mimo_tts
      REDIS_URL: redis://redis:6379/0
      DEBUG: "false"
      SECRET_KEY: <SECRET_KEY>
      CORS_ORIGINS: '["http://<服务器IP>:<前端端口>"]'
      MIMO_API_BASE: https://api.xiaomimimo.com
      MIMO_API_KEY: <MIMO_API_KEY>
      PROVIDER_MODE: mimo
      CELERY_ENABLED: "true"
      LOCAL_STORAGE_PATH: ./storage
    volumes:
      - mimo_backend_storage:/app/storage
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - mimo-net

  celery-worker:
    build:
      context: ../backend
      dockerfile: ../docker/backend.Dockerfile
    container_name: mimo-celery-worker
    restart: always
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
    environment:
      DATABASE_URL: mysql+aiomysql://mimo:<DB_PASSWORD>@mysql:3306/mimo_tts
      REDIS_URL: redis://redis:6379/0
      MIMO_API_BASE: https://api.xiaomimimo.com
      MIMO_API_KEY: <MIMO_API_KEY>
      PROVIDER_MODE: mimo
      LOCAL_STORAGE_PATH: ./storage
    volumes:
      - mimo_backend_storage:/app/storage
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - mimo-net

  frontend:
    build:
      context: ../frontend
      dockerfile: ../docker/frontend.Dockerfile
    container_name: mimo-frontend
    restart: always
    ports:
      - "127.0.0.1:<前端端口>:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://<服务器IP>:<Nginx端口>
    depends_on:
      - backend
    networks:
      - mimo-net

volumes:
  mimo_mysql_data:
  mimo_redis_data:
  mimo_backend_storage:

networks:
  mimo-net:
    driver: bridge
YAMLEOF
```

### 5.4 替换占位符

```bash
cd /opt/mimo-tts/docker

DB_PASS="<你的DB_PASSWORD>"
SKEY="<你的SECRET_KEY>"
MKEY="<你的MIMO_API_KEY>"
SERVER_IP="<服务器IP>"

# 端口根据第三步的规划填写
MYSQL_PORT="<MySQL宿主机端口>"     # 如 3306 或 13306
REDIS_PORT="<Redis宿主机端口>"     # 如 6379 或 16379
BACKEND_PORT="<后端端口>"          # 如 8000 或 18000
FRONTEND_PORT="<前端端口>"         # 如 3000 或 13000
NGINX_PORT="<Nginx对外端口>"       # 如 80 或其他

sed -i "s/<DB_PASSWORD>/$DB_PASS/g" docker-compose.prod.yml
sed -i "s/<SECRET_KEY>/$SKEY/g" docker-compose.prod.yml
sed -i "s/<MIMO_API_KEY>/$MKEY/g" docker-compose.prod.yml
sed -i "s/<服务器IP>/$SERVER_IP/g" docker-compose.prod.yml
sed -i "s/<MySQL宿主机端口>/$MYSQL_PORT/g" docker-compose.prod.yml
sed -i "s/<Redis宿主机端口>/$REDIS_PORT/g" docker-compose.prod.yml
sed -i "s/<后端端口>/$BACKEND_PORT/g" docker-compose.prod.yml
sed -i "s/<前端端口>/$FRONTEND_PORT/g" docker-compose.prod.yml
sed -i "s/<Nginx端口>/$NGINX_PORT/g" docker-compose.prod.yml
```

**验证替换结果：**

```bash
grep -n "<" docker-compose.prod.yml
# 如果还有输出，说明有遗漏的占位符
```

---

## 第六步：构建并启动

```bash
cd /opt/mimo-tts/docker

# 构建（首次较慢，5-10 分钟）
docker compose -f docker-compose.prod.yml build

# 启动
docker compose -f docker-compose.prod.yml up -d

# 确认所有容器 running
docker compose -f docker-compose.prod.yml ps

# 初始化数据库
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 验证后端
curl http://127.0.0.1:<后端端口>/health
```

---

## 第七步：配置 Nginx

### 情况 A：80/443 空闲，创建独立站点

```bash
# 生成自签名证书
mkdir -p /etc/nginx/ssl
openssl req -x509 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/mimo.key \
  -out /etc/nginx/ssl/mimo.crt \
  -days 365 -nodes \
  -subj "/CN=<服务器IP>"

# 写配置（不影响已有配置文件）
cat > /etc/nginx/sites-available/mimo << NGXEOF
server {
    listen <Nginx端口>;
    server_name <服务器IP>;

    location / {
        proxy_pass http://127.0.0.1:<前端端口>;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:<后端端口>/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        client_max_body_size 50m;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /static/ {
        proxy_pass http://127.0.0.1:<后端端口>/static/;
    }
}

server {
    listen 443 ssl;
    server_name <服务器IP>;

    ssl_certificate /etc/nginx/ssl/mimo.crt;
    ssl_certificate_key /etc/nginx/ssl/mimo.key;

    location / {
        proxy_pass http://127.0.0.1:<前端端口>;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:<后端端口>/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50m;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /static/ {
        proxy_pass http://127.0.0.1:<后端端口>/static/;
    }
}
NGXEOF

# 替换端口占位符
sed -i "s/<Nginx端口>/$NGINX_PORT/g" /etc/nginx/sites-available/mimo
sed -i "s/<前端端口>/$FRONTEND_PORT/g" /etc/nginx/sites-available/mimo
sed -i "s/<后端端口>/$BACKEND_PORT/g" /etc/nginx/sites-available/mimo
sed -i "s/<服务器IP>/$SERVER_IP/g" /etc/nginx/sites-available/mimo

# 启用（只添加软链接，不删除已有的）
ln -sf /etc/nginx/sites-available/mimo /etc/nginx/sites-enabled/mimo

# 测试配置（不影响已有站点）
nginx -t && systemctl reload nginx
```

### 情况 B：80/443 已被占用，追加到已有 Nginx

```bash
# 先备份已有配置
cp /etc/nginx/sites-enabled/<已有配置文件> /etc/nginx/sites-enabled/<已有配置文件>.bak

# 查看已有配置
cat /etc/nginx/sites-enabled/<已有配置文件>
```

在已有配置文件的 `server { }` 块中添加 location：

```nginx
    # MiMo TTS Platform
    location /mimo/ {
        proxy_pass http://127.0.0.1:<前端端口>/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /mimo/api/ {
        proxy_pass http://127.0.0.1:<后端端口>/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 50m;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /mimo/static/ {
        proxy_pass http://127.0.0.1:<后端端口>/static/;
    }
```

```bash
# 测试并重载
nginx -t && systemctl reload nginx
```

访问地址变为：`http://<IP>/mimo/`

### 情况 C：不用 Nginx，直接端口访问

跳过 Nginx 配置，直接访问：

- 前端：`http://<服务器IP>:<前端端口>`
- 后端：`http://<服务器IP>:<后端端口>`

> 录音功能需要 HTTPS。如果不配 Nginx，需要在前端 Docker 中配置自签名 HTTPS，或者放弃录音功能。

---

## 第八步：华为云安全组

华为云控制台 → 云服务器 → 安全组 → 添加入站规则：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 22 | 你的 IP | SSH |
| TCP | <Nginx端口> | 0.0.0.0/0 | MiMo HTTP |
| TCP | 443 | 0.0.0.0/0 | MiMo HTTPS（如果用） |

**不要开放** 3000、3306、6379、8000 等内部端口。

> 如果已有服务的安全组规则已经开放了 80/443，且 MiMo 也用这些端口，则不需要额外添加。

---

## 第九步：访问验证

根据你的配置情况：

```bash
# 健康检查（从服务器内部）
curl http://127.0.0.1:<后端端口>/health
```

浏览器访问：

- **独立站点**: `http://<服务器IP>` 或 `https://<服务器IP>`
- **路径挂载**: `http://<服务器IP>/mimo/`
- **直连端口**: `http://<服务器IP>:<前端端口>`
- **API 文档**: 对应地址 + `/api/docs`
- **健康检查**: 对应地址 + `/api/health`

> HTTPS 访问需接受自签名证书警告。录音功能必须用 HTTPS。

---

## 代码更新流程

```bash
ssh -i /path/to/your-key.pem root@<服务器IP>
cd /opt/mimo-tts
git pull
cd docker
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head 2>/dev/null || true
```

### 一键更新脚本

```bash
mkdir -p /opt/mimo-tts/scripts

cat > /opt/mimo-tts/scripts/deploy.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/mimo-tts

echo ">>> Pulling latest code..."
git pull

echo ">>> Rebuilding services..."
cd docker
docker compose -f docker-compose.prod.yml up -d --build

echo ">>> Running migrations..."
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head 2>/dev/null || true

echo ">>> Checking health..."
sleep 5
curl -s http://127.0.0.1:8000/health && echo ""

echo ">>> Done!"
EOF

chmod +x /opt/mimo-tts/scripts/deploy.sh
```

以后更新：`/opt/mimo-tts/scripts/deploy.sh`

---

## 卸载/清理（如果需要）

**只删除 MiMo 相关的东西，不影响其他服务：**

```bash
# 停止并删除 MiMo 容器
cd /opt/mimo-tts/docker
docker compose -f docker-compose.prod.yml down

# 删除 MiMo Docker volume（数据会丢失）
docker compose -f docker-compose.prod.yml down -v

# 删除 MiMo Nginx 配置
rm -f /etc/nginx/sites-available/mimo
rm -f /etc/nginx/sites-enabled/mimo
nginx -t && systemctl reload nginx

# 删除 MiMo 代码目录
rm -rf /opt/mimo-tts

# 删除 MiMo SSL 证书
rm -f /etc/nginx/ssl/mimo.key /etc/nginx/ssl/mimo.crt
```

---

## 常用运维命令

```bash
COMPOSE_FILE="-f /opt/mimo-tts/docker/docker-compose.prod.yml"

# 查看服务状态
docker compose $COMPOSE_FILE ps

# 查看日志
docker compose $COMPOSE_FILE logs -f backend
docker compose $COMPOSE_FILE logs -f celery-worker

# 重启单个服务
docker compose $COMPOSE_FILE restart backend

# 进入容器调试
docker compose $COMPOSE_FILE exec backend bash
docker compose $COMPOSE_FILE exec mysql mysql -umimo -p mimo_tts

# 查看 MiMo 专用资源占用
docker stats mimo-mysql mimo-redis mimo-backend mimo-celery-worker mimo-frontend
```

---

## 问题排查

```bash
# 容器起不来
docker compose -f /opt/mimo-tts/docker/docker-compose.prod.yml logs backend

# 端口冲突
ss -tlnp | grep <你怀疑冲突的端口>

# Nginx 502（后端没起来）
curl http://127.0.0.1:<后端端口>/health

# Nginx 配置错误
nginx -t
tail -20 /var/log/nginx/error.log

# git pull 冲突
cd /opt/mimo-tts
git stash
git pull
git stash pop
```

---

## 检查清单

部署完成后逐项确认：

- [ ] `docker compose ps` 所有 5 个容器都是 running
- [ ] `curl http://127.0.0.1:<后端端口>/health` 返回正常
- [ ] 浏览器能打开前端页面
- [ ] 已有服务没有受影响（访问已有服务的地址确认）
- [ ] 录音功能可用（需 HTTPS 访问）
- [ ] 安全组没有开放内部端口
