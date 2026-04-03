# 问题：Server 目录是否需要按照 Features 方式重构？

## 背景

我已经完成了前端（client）的 features 目录重构，将代码从传统的按类型分层（components/services/stores）改为按功能域组织（features/chat, features/files）。

## 当前目录结构对比

### Client（已重构为 Features 架构）
```
src/client/
├── app/                          # 应用根层（最小化）
│   ├── LayoutContext/
│   ├── pages/
│   ├── App.tsx
│   └── Footer.tsx
│
├── features/                     # 功能域（完全自包含）
│   ├── chat/                     # 💬 聊天功能
│   │   ├── components/           # ChatPanel, InputArea, MessageList...
│   │   ├── controllers/          # chat.controller.ts
│   │   ├── hooks/                # useChat.ts
│   │   ├── services/             # chatApi.ts, sidebarApi.ts
│   │   ├── sidebar/              # 聊天专用侧边栏
│   │   ├── stores/               # chatStore.ts, sidebarStore.ts
│   │   └── types/                # chat.ts, sidebar.ts
│   │
│   └── files/                    # 📁 文件功能
│       ├── components/           # FileBrowser, FileGrid...
│       ├── hooks/                # useDragDrop.ts
│       ├── services/             # fileApi.ts
│       └── stores/               # fileStore.ts
│
├── shared/                       # 全局共享（最少必要）
│   ├── controllers/              # session.controller.ts
│   ├── hooks/                    # useAppInitialization.ts
│   ├── services/                 # websocket.service.ts
│   ├── stores/                   # sessionStore.ts
│   ├── types/
│   └── ui/                       # Button, Input, Select...
│
└── lib/                          # 工具库（logger, debug...）
```

### Server（当前为传统分层架构）
```
src/server/
├── config/                       # 配置
│   └── index.ts
│
├── controllers/                  # 控制器（按类型）
│   ├── file.controller.ts
│   ├── llm-log.controller.ts
│   ├── model.controller.ts
│   ├── ocr.controller.ts
│   ├── session.controller.ts
│   └── version.controller.ts
│
├── lib/                          # 工具库
│   ├── app-factory.ts
│   ├── constants/
│   ├── errors/
│   └── utils/
│       ├── logger.ts
│       ├── validator.ts
│       └── formatter.ts
│
├── llm/                          # LLM 相关
│   ├── index.ts
│   ├── interceptor.ts
│   ├── log-manager.ts
│   └── types.ts
│
├── middleware/                   # 中间件
│
├── routes/                       # 路由
│   └── index.ts                  # 所有路由集中注册
│
├── services/                     # 服务层（目前为空）
│
├── session/                      # Session 管理
│   ├── gateway-session.ts
│   └── utils.ts
│
├── types/                        # 类型定义
│
└── server.ts                     # 入口（包含 WebSocket 处理）
```

## 问题

**Server 端是否也需要按照 Features 方式重构？**

### 需要考虑的因素：

1. **Server 与 Client 的差异**
   - Client 有 UI 组件，需要按功能域隔离
   - Server 主要是 API 端点和 WebSocket 消息处理
   - Server 的 controller 目前按功能拆分（file, session, model...），但集中注册在 routes/index.ts

2. **当前 Server 架构的问题**
   - `server.ts` 文件过大（400+ 行），包含所有 WebSocket 消息处理逻辑
   - WebSocket 消息类型与功能分散（prompt, abort, steer, change_dir 等集中处理）
   - 如果有新的功能（如新增一个 "search" 功能），需要修改多个地方

3. **潜在的 Features 架构方案**
   ```
   src/server/
   ├── features/
   │   ├── chat/                   # 聊天功能（WebSocket 消息处理）
   │   │   ├── handlers/           # prompt, abort, steer 处理
   │   │   ├── controllers/
   │   │   └── routes.ts
   │   │
   │   ├── files/                  # 文件功能
   │   │   ├── handlers/           # browse, read, write 处理
   │   │   ├── controllers/
   │   │   └── routes.ts
   │   │
   │   └── session/                # 会话功能
   │       ├── handlers/           # init, change_dir 处理
   │       ├── controllers/
   │       └── routes.ts
   │
   ├── shared/                     # 共享层
   │   ├── llm/                    # LLM 拦截器、日志
   │   ├── websocket/              # WebSocket 基础设施
   │   └── utils/
   │
   └── server.ts                   # 入口（简化，只负责启动）
   ```

4. **Server 重构的复杂性**
   - WebSocket 是长连接，消息处理有状态（currentSession, currentDir）
   - 需要保持与前端事件协议一致（turn_start, agent_end, content_delta...）
   - GatewaySession 管理 pi-coding-agent 进程生命周期

## 具体问题

1. **Server 端是否适合 Features 架构？**
   - 如果不适合，当前架构如何优化？
   - 如果适合，如何设计以避免过度工程化？

2. **WebSocket 消息处理如何组织？**
   - 当前所有消息类型处理集中在 server.ts
   - 是否应该拆分到 features/chat/handlers/ 目录？

3. **Controller 与 Routes 的关系**
   - 目前 controllers/ 目录存放业务逻辑
   - routes/index.ts 集中注册所有路由
   - 是否应该改为 features/xxx/routes.ts 分散注册？

4. **Session 管理的归属**
   - GatewaySession 管理 pi 进程和会话状态
   - 这是全局共享的还是属于 chat feature？

请给出分析和建议。
