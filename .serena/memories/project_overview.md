# LunaTV 项目概述

## 项目简介
LunaTV (原名 MoonTV) 是一个开箱即用的、跨平台的影视聚合播放器。它是一个基于 Next.js 14 构建的全栈 Web 应用，支持多资源搜索、在线播放、收藏同步、播放记录和云端存储。

## 核心功能
- 🔍 多源聚合搜索：一次搜索返回全源结果
- 📄 丰富详情页：剧集列表、演员、年份、简介等完整信息
- ▶️ 流畅在线播放：集成 HLS.js 和 ArtPlayer
- 📺 直播功能：支持直播源播放和 EPG 节目单
- ❤️ 收藏 + 继续观看：支持 Kvrocks/Redis/Upstash 存储，多端同步
- 📱 PWA 支持：离线缓存、安装到桌面
- 🌗 响应式布局：支持桌面和移动端
- 👿 智能去广告：自动跳过视频中的切片广告（实验性）

## 技术栈

### 前端框架
- Next.js 14 (App Router)
- React 18.2
- TypeScript 4.9

### UI 和样式
- Tailwind CSS 3
- Framer Motion (动画)
- Headless UI
- Lucide React (图标)

### 视频播放
- ArtPlayer 5.3 (主要播放器)
- HLS.js 1.6 (HLS 流媒体支持)
- Vidstack (备用播放器)

### 数据存储
- Redis (播放记录、收藏)
- Kvrocks (推荐)
- Upstash Redis (云存储)
- LocalStorage (客户端缓存)

### 代码质量工具
- ESLint (代码检查)
- Prettier (代码格式化)
- TypeScript (类型检查)
- Jest (单元测试)
- Husky + lint-staged (Git hooks)

### 其他依赖
- next-pwa (PWA 支持)
- next-themes (主题切换)
- @dnd-kit (拖拽排序)
- zod (数据验证)
- crypto-js (加密)

## 项目结构
```
LunaTV/
├── src/
│   ├── app/              # Next.js App Router 页面
│   ├── components/       # React 组件
│   ├── lib/              # 工具函数和客户端
│   ├── hooks/            # 自定义 React Hooks
│   ├── types/            # TypeScript 类型定义
│   ├── styles/           # 全局样式
│   └── middleware.ts     # Next.js 中间件
├── public/               # 静态资源
├── scripts/              # 构建脚本
├── .husky/               # Git hooks 配置
└── docker相关文件

```

## 部署方式
项目仅支持 Docker 部署，支持三种存储方式：
1. Kvrocks 存储（推荐）
2. Redis 存储
3. Upstash 存储（云端）

## 包管理器
- 使用 pnpm (版本 10.14.0)
- 配置文件：package.json, .npmrc

## 环境要求
- Node.js（通过 .nvmrc 指定版本）
- Docker（部署）
- macOS/Linux/Windows（开发）
