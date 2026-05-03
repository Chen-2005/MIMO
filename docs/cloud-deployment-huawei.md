# 华为云服务器部署指南（实际操作版）

你的情况：别人的华为云服务器、普通用户 + sudo、无域名（IP 直接访问）、scp 上传代码。

---

## 第一步：连接服务器并检查环境

```bash
# 用密钥登录（替换为实际 IP 和密钥路径）
ssh -i /path/to/your-key.pem <用户名>@<服务器IP>

# 查看系统信息
cat /etc/os-release
uname -a

# 检查已安装的工具
docker --version          # Docker
docker compose version    # Docker Compose
nginx -v                  # Nginx
git --version             # Git
python3 --version         # Python
node --version            # Node.js
```

记录下输出，看看哪些已经有了、哪些需要装。

---

## 第二步：安装缺失的依赖

### 2.1 安装 Docker（如果没有）

```bash
# 用 sudo 安装
sudo apt update
sudo apt install -y docker.io docker-compose-v2

# 将当前用户加入 docker 组（免 sudo 执行 docker）
sudo usermod -aG docker $USER

# 退出重新登录，使组权限生效
exit
# 重新 SSH 登录
ssh -i /path/to/your-key.pem <用户名>@<服务器IP>

# 验证
docker run hello-world
```

### 2.2 安装 Nginx（如果没有）

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 第三步：上传项目代码

### 3.1 本地打包（在你的 Windows 机器上执行）

先排除不需要的文件，在项目根目录执行：

```bash
cd D:\mimo

# 创建打包脚本（排除 node_modules、.next、storage 等）
tar czf mimo-deploy.tar.gz \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude="backend/storage" \
  --exclude="backend/test.db" \
  --exclude="backend/__pycache__" \
  --exclude="*.pyc" \
  --exclude="frontend/key.pem" \
  --exclude="frontend/cert.pem" \
  --exclude=".env" \
  .
```

> Windows 上如果 tar 不好用，可以用 7-Zip 或 Git Bash 来打包。

### 3.2 上传到服务器

```bash
scp -i /path/to/your-key.pem mimo-deploy.tar.gz <用户名>@<服务器IP>:~/
```

### 3.3 服务器上解压

```bash
ssh -i /path/to/your-key.pem <用户名>@<服务器IP>

# 创建项目目录
sudo mkdir -p /opt/mimo-tts
sudo chown $USER:$USER /opt/mimo-tts

# 解压
cd /opt/mimo-tts
tar xzf ~/mimo-deploy.tar.gz
rm ~/mimo-deploy.tar.gz

# 确认文件
ls -la
# 应该看到 backend/ frontend/ docker/ docs/ 等目录
```

---

## 第四步：配置生产环境

### 4.1 创建 .env 文件

```bash
cd /opt/mimo-tts

# 生成一个强密钥
SECRET_KEY=$(openssl rand -hex 32)
echo "SECRET_KEY=$SECRET_KEY"

# 创建 .env
cat > .env << EOF
APP_NAME=MiMo TTS Platform
DEBUG=false
SECRET_KEY=$SECRET_KEY

DATABASE_URL=mysql+aiomysql://mimo:mimo_db_pass_$(openssl rand -hex 8)@mysql:3306/mimo_tts
REDIS_URL=redis://redis:6379/0

CORS_ORIGINS=["http://<服务器IP>"]

MIMO_API_BASE=https://api.xiaomimimo.com
MIMO_API_KEY=<你的MiMo API Key>

PROVIDER_MODE=mimo
CELERY_ENABLED=true
LOCAL_STORAGE_PATH=./storage
TASK_DEFAULT_USER_ID=1
EOF
```

> **把 `<服务器IP>` 和 `<你的MiMo API Key>` 替换为实际值。**

### 4.2 创建生产 Docker Compose 配置

```bash
cat > docker/docker-compose.prod.yml << 'YAMLEOF'
services:
  mysql:
    image: mysql:8.0
    container_name: mimo-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: mimo_root_2026!
      MYSQL_DATABASE: mimo_tts
      MYSQL_USER: mimo
      MYSQL_PASSWORD: mimo_db_pass_2026!
    volumes:
      - mysql_data:/var/lib/mysql
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
    volumes:
      - redis_data:/data
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
      - "127.0.0.1:8000:8000"
    env_file:
      - ../.env
    environment:
      DATABASE_URL: mysql+aiomysql://mimo:mimo_db_pass_2026!@mysql:3306/mimo_tts
      REDIS_URL: redis://redis:6379/0
      DEBUG: "false"
    volumes:
      - backend_storage:/app/storage
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
    env_file:
      - ../.env
    environment:
      DATABASE_URL: mysql+aiomysql://mimo:mimo_db_pass_2026!@mysql:3306/mimo_tts
      REDIS_URL: redis://redis:6379/0
    volumes:
      - backend_storage:/app/storage
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
      - "127.0.0.1:3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://<服务器IP>
    depends_on:
      - backend
    networks:
      - mimo-net

volumes:
  mysql_data:
  redis_data:
  backend_storage:

networks:
  mimo-net:
    driver: bridge
YAMLEOF
```

> **注意**: 把 `docker-compose.prod.yml` 中的 `<服务器IP>` 也替换掉。数据库密码建议换成你自己生成的随机值，前后保持一致。

---

## 第五步：构建并启动服务

```bash
cd /opt/mimo-tts/docker

# 构建镜像（首次需要几分钟）
docker compose -f docker-compose.prod.yml build

# 启动所有服务
docker compose -f docker-compose.prod.yml up -d

# 查看状态（所有容器应该是 running）
docker compose -f docker-compose.prod.yml ps

# 初始化数据库
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

验证后端：

```bash
curl http://127.0.0.1:8000/health
# 应返回 {"status": "ok"} 或类似内容
```

---

## 第六步：配置 Nginx 反向代理

### 6.1 生成自签名证书（录音功能需要 HTTPS）

```bash
sudo mkdir -p /etc/nginx/ssl

sudo openssl req -x509 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/mimo.key \
  -out /etc/nginx/ssl/mimo.crt \
  -days 365 -nodes \
  -subj "/CN=<服务器IP>"
```

### 6.2 配置 Nginx

```bash
sudo tee /etc/nginx/sites-available/mimo > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 50m;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # 后端静态文件
    location /static/ {
        proxy_pass http://127.0.0.1:8000/static/;
    }
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/mimo.crt;
    ssl_certificate_key /etc/nginx/ssl/mimo.key;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # 后端静态文件
    location /static/ {
        proxy_pass http://127.0.0.1:8000/static/;
    }
}
NGINXEOF

# 启用配置
sudo ln -sf /etc/nginx/sites-available/mimo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

---

## 第七步：华为云安全组配置

登录华为云控制台 → 云服务器 → 安全组，添加入站规则：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 22 | 0.0.0.0/0 | SSH（或限定你的 IP） |
| TCP | 80 | 0.0.0.0/0 | HTTP |
| TCP | 443 | 0.0.0.0/0 | HTTPS |

> 不要开放 3000、3306、6379、8000 端口。

---

## 第八步：访问验证

在浏览器中打开：

- **HTTP**: `http://<服务器IP>` → 应该看到前端页面
- **HTTPS**: `https://<服务器IP>` → 浏览器会提示证书不受信任，点"继续访问"即可
- **API 文档**: `http://<服务器IP>/api/docs` → Swagger UI
- **健康检查**: `http://<服务器IP>/api/health`

> 录音功能必须用 HTTPS 访问（浏览器限制）。

---

## 常用运维命令

```bash
cd /opt/mimo-tts/docker

# 查看所有服务状态
docker compose -f docker-compose.prod.yml ps

# 查看后端日志
docker compose -f docker-compose.prod.yml logs -f backend

# 查看 Celery 日志
docker compose -f docker-compose.prod.yml logs -f celery-worker

# 重启后端
docker compose -f docker-compose.prod.yml restart backend

# 重启所有服务
docker compose -f docker-compose.prod.yml restart

# 进入后端容器调试
docker compose -f docker-compose.prod.yml exec backend bash

# 进入数据库
docker compose -f docker-compose.prod.yml exec mysql mysql -umimo -p mimo_tts
```

---

## 代码更新流程

每次修改代码后，重复以下步骤：

```bash
# 1. 本地打包上传
scp -i /path/to/your-key.pem mimo-deploy.tar.gz <用户名>@<服务器IP>:~/

# 2. 服务器上更新
ssh -i /path/to/your-key.pem <用户名>@<服务器IP>
cd /opt/mimo-tts
tar xzf ~/mimo-deploy.tar.gz

# 3. 重新构建并部署
cd docker
docker compose -f docker-compose.prod.yml up -d --build

# 4. 如果有数据库变更
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## 排查问题

```bash
# 容器启动失败
docker compose -f docker-compose.prod.yml logs backend

# Nginx 502 错误
curl http://127.0.0.1:8000/health   # 后端是否正常
docker compose -f docker-compose.prod.yml ps   # 容器是否在运行

# Nginx 配置错误
sudo nginx -t
sudo tail -20 /var/log/nginx/error.log

# 磁盘满了
df -h
docker system prune -f   # 清理 Docker 缓存
```
