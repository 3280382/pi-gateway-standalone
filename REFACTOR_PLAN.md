# Gateway 完整重构计划

## 目标架构

```
src/
├── client/           # 前端代码（浏览器）
│   ├── components/   # React 组件
│   ├── stores/       # Zustand 状态管理
│   ├── services/     # 前端 API 服务
│   ├── lib/          # 前端工具
│   ├── types/        # 前端私有类型
│   ├── main.tsx      # 入口
│   └── App.tsx       # 根组件
│
├── server/           # 后端代码（Node.js）
│   ├── routes/       # Express 路由
│   ├── controllers/  # 后端控制器
│   ├── middleware/   # 中间件
│   ├── services/     # 后端业务逻辑
│   ├── session/      # 会话管理
│   ├── llm/          # LLM 拦截器、日志
│   ├── lib/          # 后端工具
│   ├── types/        # 后端私有类型
│   └── server.ts     # 服务器入口
│
└── shared/           # 共享代码（仅类型/常量）
    ├── types/        # API 契约类型
    └── constants/    # 常量

test/
├── unit/             # 单元测试
├── integration/      # 集成测试
├── e2e/              # E2E 测试
└── setup.ts          # 测试配置
```

## 重构步骤

1. 创建新目录结构
2. 移动 client 代码（原 components/, stores/, 部分 services/）
3. 移动 server 代码（原 api/, session/, core/llm/, core/server/）
4. 移动 shared 代码（原 shared/types/, types/shared/）
5. 更新所有导入路径
6. 更新 vite.config.ts
7. 更新 tsconfig.json
8. 重构测试代码
9. 运行测试验证
