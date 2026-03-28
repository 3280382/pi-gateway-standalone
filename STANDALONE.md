# Pi Gateway - 独立版本

这是从 pi-mono monorepo 独立出来的 Gateway 项目。

## 与原 monorepo 的区别

- ✅ 依赖 `@mariozechner/*` 包通过 npm 安装
- ✅ 不再依赖 workspace 链接
- ✅ 独立的版本管理
- ✅ 独立的部署流程

## 安装依赖

```bash
npm install
```

## 开发启动

```bash
# Tmux 三窗格模式（推荐）
bash scripts/start-tmux-dev.sh

# 或分别启动
# 终端1: 后端
npx tsx watch src/server/server.ts

# 终端2: 前端
npx vite --host 127.0.0.1 --port 5173
```

## 更新 monorepo 包

如果需要更新 `@mariozechner/*` 包：

```bash
# 从 npm 更新
npm update @mariozechner/pi-coding-agent

# 或从本地 monorepo 链接（开发调试）
cd /path/to/pi-mono/packages/coding-agent
npm link
cd /path/to/this/project
npm link @mariozechner/pi-coding-agent
```

## 文档

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
- [FEATURES.md](./FEATURES.md) - 功能规格
