# MiMo TTS Platform — 前端

基于 Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 的 TTS 平台前端。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.2 | App Router、SSR |
| React | 19.2 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 样式 |
| Zustand | 5.x | 状态管理 |
| Axios | 1.x | HTTP 客户端 |
| Lucide React | 1.x | 图标库 |
| Recharts | 3.x | 图表（指标页面） |

## 目录结构

```text
src/
├── app/
│   ├── layout.tsx          # 根布局（侧边栏 + 头部 + 内容区）
│   ├── page.tsx            # 重定向到 /workspace
│   ├── workspace/page.tsx  # 语音生成主工作台
│   ├── history/page.tsx    # 任务历史
│   └── voices/page.tsx     # 音色中心
├── components/
│   ├── common/             # 通用组件（TaskStatusBadge、PageContainer）
│   ├── layout/             # 布局组件（Header、Sidebar、MobileDrawer）
│   ├── tts/                # TTS 相关组件
│   │   ├── AudioPlayer.tsx # 音频播放器
│   │   ├── ModelSelector.tsx
│   │   ├── StyleControls.tsx   # 风格控制（含导演模式）
│   │   ├── TextInput.tsx       # 文本输入（含标签插入）
│   │   └── VoiceSelector.tsx
│   └── voice/              # 音色相关组件
│       ├── VoiceCard.tsx
│       ├── VoiceCloneTab.tsx   # 音色克隆
│       ├── VoiceDesignTab.tsx  # 音色设计
│       ├── VoiceDetailPanel.tsx # 音色详情（含试听、发布）
│       ├── VoiceListTab.tsx
│       └── VoiceStatusBadge.tsx
├── services/               # API 调用封装
│   ├── api.ts              # Axios 实例和基础配置
│   ├── tts.ts              # TTS 任务 API
│   ├── voice.ts            # 音色管理 API
│   └── metrics.ts          # 指标 API
├── stores/
│   └── tts-store.ts        # TTS 全局状态（Zustand）
├── types/
│   └── index.ts            # TypeScript 类型定义
└── lib/
    └── utils.ts            # 工具函数
```

## 开发

```bash
# 安装依赖
npm install

# 开发服务器（HTTP）
npm run dev

# 类型检查
npx tsc --noEmit

# 代码检查
npm run lint

# 构建
npm run build
```

## HTTPS 模式

音频录制需要 HTTPS 环境。项目内置 HTTPS 服务器：

```bash
# 生成自签名证书
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=<你的IP>"

# 构建并启动
npm run build
node server.mjs
```

`server.mjs` 功能：
- HTTPS 启动前端（端口 3000）
- 反向代理 `/api/*` → `http://127.0.0.1:8000`
- 反向代理 `/static/*` → `http://127.0.0.1:8000`

## 环境变量

在 `.env.local` 中配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:8000` |

## 页面说明

### /workspace — 语音生成

两种模式切换：
- **预置音色生成**：文本输入 → 选择模型/音色 → 调整风格 → 生成
- **音色克隆生成**：上传/录音 → 填写信息 → 克隆+生成一体化

### /history — 任务历史

任务列表，支持按状态/模型筛选，点击展开试听和下载。

### /voices — 音色中心

- 全部音色：查看、试听、编辑、发布/取消发布
- 音色设计：描述生成器 + 快速模板 + 手动输入
