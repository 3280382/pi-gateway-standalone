# Pi Gateway

Pi Coding Agent 的 Web 网关，提供美观的 AI 聊天界面和文件管理功能。

**技术栈**: React 19 + TypeScript + Vite (前端) | Node.js + Express + TypeScript (后端)

## 快速开始

```bash
bash dev-start.sh
```

访问: http://127.0.0.1:5173 (前端) | http://127.0.0.1:3000 (后端)

## 项目架构

采用**模块化单体架构**：
- `src/client/` - 前端代码（浏览器运行）
- `src/server/` - 后端代码（Node.js）
- `src/shared/` - 共享类型和常量

```
src/
├── client/           # 前端：组件、状态管理、API 客户端
├── server/           # 后端：Express 路由、控制器、业务逻辑
└── shared/           # 共享：API 契约类型
```

## 文档

| 文档 | 说明 |
|------|------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 开发指南、架构说明、开发规范 |
| [FEATURES.md](./FEATURES.md) | 功能规格书（界面布局、功能清单、交互流程） |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更历史 |
| [mock-data/README.md](./mock-data/README.md) | Mock 数据说明 |

## 常用命令

```bash
npm run dev              # 启动开发服务器
npm run build            # 生产构建
npm test                 # 运行测试
npm run check            # 代码检查
```

## 主要功能

- **AI 聊天**: 实时流式对话、代码高亮、工具调用显示
- **文件管理**: 目录浏览、文件编辑、终端执行
- **会话管理**: 多会话切换、历史记录
- **移动端支持**: 响应式布局、触摸优化

## 许可证

MIT
