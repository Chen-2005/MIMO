# 项目上传 GitHub 操作指南

## 前提

- 项目目录：`D:\mimo`
- 项目尚未初始化 Git 仓库
- 代码中有敏感信息（API Key）和大量测试生成文件，需要先清理

---

## 第一步：安装 Git（如果还没有）

在 Git Bash 或终端中检查：

```bash
git --version
```

如果没有，去 https://git-scm.com/downloads 下载安装。

安装后配置你的 GitHub 用户名和邮箱：

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱@example.com"
```

---

## 第二步：在 GitHub 上创建仓库

1. 登录 https://github.com
2. 右上角 `+` → `New repository`
3. 填写：
   - **Repository name**: `mimo`（或 `mimo-tts-platform`）
   - **Description**: `MiMo TTS Platform - 团队内部语音合成平台`
   - **Public** 或 **Private**（团队内部建议 Private）
   - **不要勾选** "Add a README file"、".gitignore"、"License"（本地已有文件）
4. 点击 `Create repository`
5. 记下仓库地址，格式为：
   - HTTPS: `https://github.com/<你的用户名>/<仓库名>.git`
   - SSH: `git@github.com:<你的用户名>/<仓库名>.git`

---

## 第三步：清理项目文件

### 3.1 更新 .gitignore

当前 `.gitignore` 不够完整，需要补充。用以下内容覆盖：

```bash
cd D:\mimo
```

在项目根目录 `.gitignore` 中确保包含以下内容：

```gitignore
# ============ Python ============
__pycache__/
*.py[cod]
*.egg-info/
dist/
.venv/
venv/
*.egg
*.pyc

# ============ Environment (敏感信息) ============
.env
.env.local
.env.*.local

# ============ Node ============
node_modules/
.next/
out/
.vercel

# ============ IDE ============
.vscode/
.idea/
*.swp
*.swo

# ============ OS ============
.DS_Store
Thumbs.db

# ============ Docker ============
docker/data/

# ============ 测试生成文件 ============
backend/test.db
backend/test_suite.db
backend/test_audio*.wav
backend/test_fixed.wav
backend/storage/
backend/storage_test/
backend/.pytest_cache/
backend/.next/

# ============ Claude Code ============
.claude/

# ============ 项目临时文件 ============
sql_test.txt
test_output.txt
verbose_import.txt
test_sql.py

# ============ SSL 证书 ============
*.pem
*.key
*.crt
```

### 3.2 删除已跟踪的敏感/临时文件（如果已存在）

```bash
cd D:\mimo

# 删除敏感的 .env（不会删本地文件，只是从 Git 排除）
# 由于还没 git init，这步跳过，只要 .gitignore 配好就不会被提交

# 删除项目根目录的临时测试文件
rm -f sql_test.txt test_output.txt verbose_import.txt test_sql.py

# 删除后端的测试生成文件
rm -f backend/test_audio*.wav backend/test_fixed.wav
rm -f backend/test.db backend/test_suite.db
rm -rf backend/storage_test/
rm -rf backend/.pytest_cache/
rm -rf backend/.next/
rm -rf backend/mimo_tts_backend.egg-info/

# 删除前端构建产物（如果存在）
rm -rf frontend/.next/
rm -rf frontend/node_modules/
```

> **注意**: `.env` 文件不要删本地的，只是让 Git 忽略它。

### 3.3 确认没有敏感信息泄露

```bash
# 检查 .env 文件不会被提交
# 确认 .gitignore 中有 .env

# 检查是否有硬编码的 API Key 在代码中
grep -r "sk-cy3rsn" backend/app/ frontend/ 2>/dev/null
# 如果有输出，说明代码中有硬编码的 Key，需要改为从环境变量读取
```

如果 `backend/.env` 中有真实的 API Key，确保它不会被提交。`.gitignore` 已经排除了 `.env`，所以没问题。

---

## 第四步：初始化 Git 并提交

```bash
cd D:\mimo

# 1. 初始化仓库
git init

# 2. 查看将要提交的文件（检查有没有不该提交的东西）
git status
```

**仔细检查 `git status` 的输出**，确认没有以下文件：

- `.env` / `.env.local` — 有 API Key 密码
- `test.db` / `test_suite.db` — 测试数据库
- `*.wav` — 测试音频
- `storage/` — 音频存储目录
- `node_modules/` — 前端依赖
- `.next/` — Next.js 构建产物
- `.claude/` — Claude Code 配置

如果看到了，回到第三步检查 `.gitignore`。

```bash
# 3. 添加所有文件
git add .

# 4. 再次确认暂存区的内容
git status

# 5. 确认没有敏感文件后，提交
git commit -m "feat: initial commit - MiMo TTS Platform"
```

---

## 第五步：关联远程仓库并推送

### 方式 A：HTTPS（简单，推荐首次使用）

```bash
# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/<你的用户名>/<仓库名>.git

# 推送
git branch -M main
git push -u origin main
```

推送时会弹出认证窗口：
- **推荐**：使用 Personal Access Token（PAT）
  1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
  2. 创建 Token，权限选 `Contents: Read and Write`，选择你的仓库
  3. 复制 Token，粘贴到认证窗口的密码栏

### 方式 B：SSH（一劳永逸）

```bash
# 1. 生成 SSH Key（如果还没有）
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
# 一路回车使用默认设置

# 2. 复制公钥
cat ~/.ssh/id_ed25519.pub
# 复制输出内容

# 3. 添加到 GitHub
# GitHub → Settings → SSH and GPG keys → New SSH key
# 粘贴公钥

# 4. 测试连接
ssh -T git@github.com
# 看到 "Hi xxx! You've successfully authenticated" 就对了

# 5. 添加远程仓库
git remote add origin git@github.com:<你的用户名>/<仓库名>.git

# 6. 推送
git branch -M main
git push -u origin main
```

---

## 第六步：验证

1. 打开 `https://github.com/<你的用户名>/<仓库名>`
2. 确认文件已上传
3. **检查仓库中没有以下文件**：
   - `.env` 文件（搜索仓库）
   - 任何包含 API Key 的文件
   - `test.db`、`*.wav` 等测试文件
4. 如果发现泄露了密钥，**立即在 MiMo 平台重新生成 API Key**，然后在 GitHub 上删除泄露的 commit

---

## 后续代码更新流程

```bash
cd D:\mimo

# 查看修改了什么
git status
git diff

# 添加修改
git add .
# 或者只添加特定文件
git add backend/app/some_file.py

# 提交
git commit -m "feat: 描述你的修改"

# 推送到 GitHub
git push
```

### 提交信息规范（推荐）

```
feat: 新功能
fix: 修复 bug
refactor: 重构
docs: 文档更新
chore: 构建/配置变更
test: 测试相关
```

---

## 常见问题

### Q: 推送时报 "remote: Permission denied"

检查仓库地址是否正确，以及是否有推送权限（Private 仓库需要是 Collaborator）。

### Q: 推送时报 "fatal: remote origin already exists"

```bash
git remote remove origin
git remote add origin <你的仓库地址>
```

### Q: 忘记排除 .env 已经提交了

```bash
# 从 Git 历史中删除（本地文件保留）
git rm --cached backend/.env
git rm --cached frontend/.env.local 2>/dev/null

# 提交删除
git commit -m "chore: remove .env from tracking"

# 推送
git push

# 然后立即去 MiMo 平台重新生成 API Key
```

### Q: 想把 .claude/ 目录也排除

已在 `.gitignore` 中排除。如果已经提交了：

```bash
git rm -r --cached .claude/
git commit -m "chore: remove .claude from tracking"
git push
```

### Q: GitHub 仓库要不要选 Private？

团队内部项目建议选 **Private**，然后在 Settings → Collaborators 中添加团队成员。
