# 云服务器部署指南

从局域网共享迁移到公网云服务器的完整操作文档。

---

## 目录

1. [云服务器选购与初始化](#1-云服务器选购与初始化)
2. [域名与 DNS 配置](#2-域名与-dns-配置)
3. [服务器基础环境安装](#3-服务器基础环境安装)
4. [项目代码部署](#4-项目代码部署)
5. [生产环境配置](#5-生产环境配置)
6. [Docker Compose 生产部署](#6-docker-compose-生产部署)
7. [Nginx 反向代理 + SSL](#7-nginx-反向代理--ssl)
8. [防火墙与安全加固](#8-防火墙与安全加固)
9. [数据库迁移与数据导入](#9-数据库迁移与数据导入)
10. [日志与监控](#10-日志与监控)
11. [CI/CD 自动部署（可选）](#11-cicd-自动部署可选)
12. [常见问题排查](#12-常见问题排查)
13. [运维速查表](#13-运维速查表)

---

## 1. 云服务器选购与初始化

### 1.1 推荐配置

| 用途 | 最低配置 | 推荐配置 |
|------|----------|----------|
| 测试/小团队（<10人） | 2C4G 50GB SSD | 4C8G 80GB SSD |
| 正式使用 | 4C8G 80GB SSD | 8C16G 160GB SSD |

> **推荐云服务商**: 阿里云 ECS、腾讯云 CVM、华为云 ECS（国内访问快）；AWS EC2、GCP（海外）

### 1.2 操作系统

推荐 **Ubuntu 22.04 LTS** 或 **Debian 12**，本文档以 Ubuntu 22.04 为例。

### 1.3 购买后初始化

```bash
# SSH 登录服务器（以阿里云为例）
ssh root@<服务器公网IP>

# 更新系统
apt update && apt upgrade -y

# 创建部署专用用户（不要用 root 跑服务）
adduser mimo
usermod -aG sudo mimo

# 配置 SSH 密钥登录（推荐，禁用密码登录更安全）
# 在本地机器执行：
ssh-copy-id mimo@<服务器公网IP>

# 服务器上禁用密码登录
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

---

## 2. 域名与 DNS 配置

### 2.1 购买域名

在阿里云万网、腾讯云 DNSPod、Cloudflare 等注册域名。

### 2.2 DNS 解析配置

添加两条 A 记录：

| 主机记录 | 类型 | 记录值 |
|----------|------|--------|
| `@` | A | `<服务器公网IP>` |
| `www` | A | `<服务器公网IP>` |

如果前后端使用不同子域名（推荐）：

| 主机记录 | 类型 | 记录值 |
|----------|------|--------|
| `@` 或 `app` | A | `<服务器公网IP>` |
| `api` | A | `<服务器公网IP>` |

> DNS 生效通常需要 10 分钟 ~ 2 小时。

---

## 3. 服务器基础环境安装

### 3.1 安装 Docker & Docker Compose

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 验证
docker --version
docker compose version
```

### 3.2 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3.3 安装 Certbot（免费 SSL 证书）

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 3.4 安装 Git

```bash
sudo apt install -y git
```

---

## 4. 项目代码部署

### 4.1 克隆代码

```bash
cd /opt
sudo mkdir mimo-tts
sudo chown $USER:$USER mimo-tts
cd mimo-tts

# 从 Git 仓库克隆（替换为你的仓库地址）
git clone <你的仓库地址> .
```

如果是私有仓库，先配置 SSH Key 或 Personal Access Token。

### 4.2 项目目录结构（服务器上）

```
/opt/mimo-tts/
├── backend/
├── frontend/
├── docker/
├── docs/
├── .env              # 生产环境变量（从 .env.example 复制后修改）
└── docker-compose.yml
```

---

## 5. 生产环境配置

### 5.1 创建生产环境变量文件

```bash
cp .env.example .env
```

编辑 `.env`，关键配置如下：

```bash
# ===== 应用配置 =====
APP_NAME=MiMo TTS Platform
DEBUG=false
SECRET_KEY=<用 openssl rand -hex 32 生成一个强密钥>

# ===== 数据库 =====
DATABASE_URL=mysql+aiomysql://mimo:<数据库密码>@mysql:3306/mimo_tts

# ===== Redis =====
REDIS_URL=redis://redis:6379/0

# ===== CORS（只允许你的域名） =====
CORS_ORIGINS=["https://your-domain.com"]

# ===== MiMo TTS Provider =====
MIMO_API_BASE=https://api.xiaomimimo.com
MIMO_API_KEY=<你的 API Key>

# ===== 存储 =====
PROVIDER_MODE=mimo
LOCAL_STORAGE_PATH=./storage

# ===== Celery =====
CELERY_ENABLED=true

# ===== 其他 =====
TASK_DEFAULT_USER_ID=1
```

### 5.2 生成强密钥

```bash
openssl rand -hex 32
```

将输出填入 `SECRET_KEY`。

### 5.3 修改 Docker Compose 生产配置

创建 `docker/docker-compose.prod.yml`：

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: mimo-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: <替换为强密码>
      MYSQL_DATABASE: mimo_tts
      MYSQL_USER: mimo
      MYSQL_PASSWORD: <替换为强密码>
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - mimo-net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    # 不暴露端口到宿主机，只在内部网络通信
    # ports:
    #   - "3306:3306"

  redis:
    image: redis:7-alpine
    container_name: mimo-redis
    restart: always
    command: redis-server --requirepass <替换为Redis密码>
    volumes:
      - redis_data:/data
    networks:
      - mimo-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "<替换为Redis密码>", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    # 不暴露端口
    # ports:
    #   - "6379:6379"

  backend:
    build:
      context: ../backend
      dockerfile: ../docker/backend.Dockerfile
    container_name: mimo-backend
    restart: always
    ports:
      - "127.0.0.1:8000:8000"   # 只绑定 localhost，由 Nginx 代理
    environment:
      DATABASE_URL: mysql+aiomysql://mimo:<数据库密码>@mysql:3306/mimo_tts
      REDIS_URL: redis://:<Redis密码>@redis:6379/0
      DEBUG: "false"
      SECRET_KEY: <你的密钥>
      CORS_ORIGINS: '["https://your-domain.com"]'
      MIMO_API_BASE: https://api.xiaomimimo.com
      MIMO_API_KEY: <你的API Key>
      PROVIDER_MODE: mimo
      CELERY_ENABLED: "true"
      LOCAL_STORAGE_PATH: ./storage
    volumes:
      - backend_storage:/app/storage    # 持久化音频文件
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
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
    environment:
      DATABASE_URL: mysql+aiomysql://mimo:<数据库密码>@mysql:3306/mimo_tts
      REDIS_URL: redis://:<Redis密码>@redis:6379/0
      MIMO_API_BASE: https://api.xiaomimimo.com
      MIMO_API_KEY: <你的API Key>
      PROVIDER_MODE: mimo
      LOCAL_STORAGE_PATH: ./storage
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
      - "127.0.0.1:3000:3000"   # 只绑定 localhost
    environment:
      NEXT_PUBLIC_API_URL: https://your-domain.com   # 公网域名
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
```

> **重要**: 将所有 `<替换为...>` 占位符替换为实际值。密码建议用 `openssl rand -base64 24` 生成。

---

## 6. Docker Compose 生产部署

### 6.1 构建并启动

```bash
cd /opt/mimo-tts/docker

# 构建镜像（首次较慢）
docker compose -f docker-compose.prod.yml build

# 启动所有服务
docker compose -f docker-compose.prod.yml up -d

# 查看运行状态
docker compose -f docker-compose.prod.yml ps
```

### 6.2 初始化数据库

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 6.3 验证服务

```bash
# 后端健康检查
curl http://127.0.0.1:8000/health
# 应返回 {"status": "ok"}

# 前端
curl -I http://127.0.0.1:3000
# 应返回 200 OK
```

---

## 7. Nginx 反向代理 + SSL

### 7.1 申请 SSL 证书（Let's Encrypt 免费证书）

```bash
# 先用 HTTP 验证域名所有权
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

如果前后端用不同子域名：

```bash
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

Certbot 会自动修改 Nginx 配置并设置自动续期。

### 7.2 手动 Nginx 配置（如果不用 certbot --nginx 自动配置）

创建 `/etc/nginx/sites-available/mimo`：

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

# 前端
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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
        client_max_body_size 50m;    # 允许上传大文件
        proxy_read_timeout 300s;     # TTS 长任务可能需要较长时间
        proxy_send_timeout 300s;
    }

    # 后端静态文件（音频等）
    location /static/ {
        proxy_pass http://127.0.0.1:8000/static/;
        proxy_set_header Host $host;
    }

    # WebSocket 支持（如果需要实时推送）
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/mimo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # 移除默认站点
sudo nginx -t                                 # 测试配置
sudo systemctl reload nginx
```

### 7.3 SSL 自动续期

Certbot 安装时已自动设置 systemd timer。验证：

```bash
sudo certbot renew --dry-run
```

---

## 8. 防火墙与安全加固

### 8.1 配置 UFW 防火墙

```bash
# 只开放必要端口
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh           # 22
sudo ufw allow 80/tcp        # HTTP（重定向到 HTTPS）
sudo ufw allow 443/tcp       # HTTPS
sudo ufw enable

# 验证
sudo ufw status verbose
```

### 8.2 云服务商安全组

在云服务商控制台配置安全组规则：

| 方向 | 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|------|
| 入站 | TCP | 22 | 你的 IP / 0.0.0.0/0 | SSH |
| 入站 | TCP | 80 | 0.0.0.0/0 | HTTP |
| 入站 | TCP | 443 | 0.0.0.0/0 | HTTPS |
| 出站 | ALL | ALL | 0.0.0.0/0 | 允许所有出站 |

> **不要** 开放 3306、6379、8000、3000 端口到公网。

### 8.3 MySQL 安全加固

```bash
# 进入 MySQL 容器
docker compose -f docker-compose.prod.yml exec mysql mysql -uroot -p

# 执行安全加固
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '<强密码>';
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
FLUSH PRIVILEGES;
```

### 8.4 fail2ban 防暴力破解

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 9. 数据库迁移与数据导入

### 9.1 全新部署

```bash
# 直接执行迁移
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 9.2 从本地迁移数据到云端

如果本地有需要保留的数据：

```bash
# 本地导出 MySQL 数据
docker exec mimo-mysql mysqldump -uroot -proot mimo_tts > mimo_tts_dump.sql

# 传输到服务器
scp mimo_tts_dump.sql mimo@<服务器IP>:/opt/mimo-tts/

# 服务器上导入
docker compose -f docker-compose.prod.yml exec -T mysql mysql -uroot -p<密码> mimo_tts < /opt/mimo-tts/mimo_tts_dump.sql
```

### 9.3 迁移音频文件

如果本地有已生成的音频文件需要迁移：

```bash
# 本地打包
tar czf storage_backup.tar.gz backend/storage/

# 传输
scp storage_backup.tar.gz mimo@<服务器IP>:/opt/mimo-tts/

# 服务器上解压到 Docker volume
docker compose -f docker-compose.prod.yml exec -T backend tar xzf - -C / < storage_backup.tar.gz
```

---

## 10. 日志与监控

### 10.1 查看日志

```bash
cd /opt/mimo-tts/docker

# 所有服务日志
docker compose -f docker-compose.prod.yml logs -f

# 单个服务
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f celery-worker

# 最近 100 行
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### 10.2 日志轮转（防止磁盘爆满）

Docker 默认配置了日志轮转，但建议显式配置。在 `docker-compose.prod.yml` 的每个服务下添加：

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

### 10.3 简单监控脚本

创建 `/opt/mimo-tts/scripts/health-check.sh`：

```bash
#!/bin/bash
# 健康检查脚本，可配合 crontab 使用

DOMAIN="your-domain.com"
WEBHOOK_URL=""  # 可选：企业微信/钉钉/飞书 webhook

check() {
    status=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/health" --max-time 10)
    if [ "$status" != "200" ]; then
        echo "[ALERT] $(date): Backend health check failed (HTTP $status)"
        # 可选：发送告警通知
        # curl -s -X POST "$WEBHOOK_URL" -H 'Content-Type: application/json' \
        #   -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"MiMo TTS 服务异常: HTTP $status\"}}"
        return 1
    fi
    echo "[OK] $(date): Backend healthy"
    return 0
}

check
```

设置定时检查：

```bash
chmod +x /opt/mimo-tts/scripts/health-check.sh
# 每 5 分钟检查一次
crontab -e
# 添加：
*/5 * * * * /opt/mimo-tts/scripts/health-check.sh >> /var/log/mimo-health.log 2>&1
```

---

## 11. CI/CD 自动部署（可选）

### 11.1 使用 GitHub Actions

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Server

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: mimo
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/mimo-tts
            git pull origin main
            cd docker
            docker compose -f docker-compose.prod.yml build
            docker compose -f docker-compose.prod.yml up -d
            docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

在 GitHub 仓库 Settings → Secrets 中配置：

| Secret | 值 |
|--------|------|
| `SERVER_HOST` | 服务器公网 IP |
| `SSH_PRIVATE_KEY` | 部署用户的 SSH 私钥 |

### 11.2 使用 Watchtower 自动更新镜像

```yaml
# 在 docker-compose.prod.yml 中添加
  watchtower:
    image: containrrr/watchtower
    container_name: mimo-watchtower
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300   # 每 5 分钟检查镜像更新
    networks:
      - mimo-net
```

---

## 12. 常见问题排查

### 12.1 前端访问返回 502

```bash
# 检查后端是否运行
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:8000/health

# 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 12.2 SSL 证书申请失败

```bash
# 确认 DNS 已解析
dig your-domain.com

# 确认 80 端口可达
curl http://your-domain.com

# 确认 Nginx 正在运行且监听 80
sudo ss -tlnp | grep :80
```

### 12.3 Docker 容器不断重启

```bash
# 查看容器日志
docker compose -f docker-compose.prod.yml logs backend

# 常见原因：数据库连接失败、环境变量缺失
docker compose -f docker-compose.prod.yml exec backend env | grep DATABASE
```

### 12.4 磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 清理 Docker 无用数据
docker system prune -a --volumes

# 查看 Docker 磁盘占用
docker system df
```

### 12.5 TTS 请求超时

```bash
# 检查 Nginx 超时配置
# 确保 proxy_read_timeout 设置足够长（如 300s）

# 检查 Celery Worker 是否在运行
docker compose -f docker-compose.prod.yml ps celery-worker
docker compose -f docker-compose.prod.yml logs celery-worker
```

---

## 13. 运维速查表

### 日常操作

```bash
# 进入项目目录
cd /opt/mimo-tts/docker

# 查看所有服务状态
docker compose -f docker-compose.prod.yml ps

# 重启单个服务
docker compose -f docker-compose.prod.yml restart backend

# 重启所有服务
docker compose -f docker-compose.prod.yml restart

# 查看日志
docker compose -f docker-compose.prod.yml logs -f --tail=50

# 进入后端容器
docker compose -f docker-compose.prod.yml exec backend bash

# 进入数据库
docker compose -f docker-compose.prod.yml exec mysql mysql -umimo -p mimo_tts

# 更新代码并重新部署
cd /opt/mimo-tts
git pull
cd docker
docker compose -f docker-compose.prod.yml up -d --build

# 数据库迁移
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 备份数据库
docker compose -f docker-compose.prod.yml exec mysql mysqldump -uroot -p<密码> mimo_tts > backup_$(date +%Y%m%d).sql

# 清理 Docker 垃圾
docker system prune -f
```

### 密码管理

建议将所有密码存储在密码管理器中，并定期轮换。关键密码：

- 服务器 SSH 密钥
- MySQL root 和 mimo 用户密码
- Redis 密码
- `SECRET_KEY`
- `MIMO_API_KEY`
- 域名 DNS 管理账号

---

## 附录：与局域网部署的主要差异

| 方面 | 局域网部署 | 云服务器部署 |
|------|-----------|-------------|
| SSL 证书 | 自签名 | Let's Encrypt 正式证书 |
| CORS | `["*"]` | `["https://your-domain.com"]` |
| DEBUG | `true` | `false` |
| 数据库密码 | 简单密码 | 强随机密码 |
| 端口暴露 | 全部局域网可达 | 只暴露 80/443 |
| 防火墙 | 无/宽松 | UFW + 安全组严格限制 |
| 数据备份 | 无 | 定期自动备份 |
| 进程管理 | 手动启动 | Docker restart: always |
| 日志 | 控制台输出 | 文件 + 轮转 |
