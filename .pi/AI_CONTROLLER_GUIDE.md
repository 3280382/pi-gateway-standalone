# AI Tmux 控制器使用指南

## 概述

作为 AI，你现在运行在 **底部窗格** 中（通过 `pi` 启动），可以直接控制开发环境。

三窗格布局：
- **上左 (0)**: 前端服务 (Vite)
- **上右 (1)**: 后端服务 (tsx watch)  
- **底部 (2)**: AI 交互窗格 (pi) - 你在这里

## 快速开始

底部窗格已经启动了 `pi`，你正在这里运行。可以通过 tmux 控制器控制其他两个窗格：

## 快速开始

```javascript
const controller = require('/root/pi-mono/packages/gateway/scripts/tmux-controller.js');

// 初始化检查
if (!controller.init()) {
  // 会话不存在，创建
  controller.createSession();
}

// 获取状态
const status = await controller.getStatus();
console.log(status);
```

## 可用方法

### 状态检查

```javascript
// 获取完整状态
const status = await controller.getStatus();
// {
//   session: true,
//   frontend: { pid: '12345', healthy: true, port: 5173 },
//   backend: { pid: '12346', healthy: true, port: 3000 }
// }

// 打印状态
await controller.printStatus();
```

### 服务控制

```javascript
// 启动服务
await controller.startFrontend();
await controller.startBackend();

// 停止服务
controller.stopFrontend();
controller.stopBackend();

// 重启服务
await controller.restartFrontend();
await controller.restartBackend();
await controller.restartAll();
```

### 缓存管理

```javascript
// 清除 Vite 缓存
controller.clearCache();
```

### 自动修复

```javascript
// 自动检测并修复问题
await controller.autoFix();
// 这会：
// 1. 检查会话是否存在
// 2. 检查后端是否运行
// 3. 检查前端是否运行
// 4. 自动启动缺失的服务
```

### 在 AI 窗格执行命令

```javascript
// 在底部窗格执行任意命令
controller.runInAIPane('ls -la');
controller.runInAIPane('npm run typecheck');
```

## 典型工作流程

### 检测到 Vite 错误时的处理

```javascript
// 当 AI 检测到 "Failed to load url" 错误时：

// 1. 清缓存
controller.clearCache();

// 2. 重启前端
await controller.restartFrontend();

// 3. 验证
const health = await controller.checkFrontendHealth();
if (health) {
  console.log('修复成功');
} else {
  console.log('需要进一步检查');
}
```

### 每日开发开始

```javascript
// 自动确保环境就绪
await controller.autoFix();
```

### 修改配置文件后

```javascript
// 修改 vite.config.ts 或 index.html 后
await controller.restartFrontend();
```

## 与用户协作流程

虽然 AI 可以自动操作，但仍需告知用户：

```
AI: "检测到前端路径错误，正在自动重启前端服务..."
[执行 controller.restartFrontend()]
AI: "✅ 前端已重启，请观察上左窗格确认服务正常启动"
```

## 注意事项

1. **用户观察**: 操作会在底部窗格显示，用户可看到命令执行
2. **日志保留**: 所有输出都保留在对应窗格，便于追溯
3. **并发安全**: 不要在短时间内重复执行相同命令
4. **错误处理**: 方法会返回 boolean 表示成功/失败

## CLI 用法

也可以直接命令行使用：

```bash
node scripts/tmux-controller.js status
node scripts/tmux-controller.js autofix
node scripts/tmux-controller.js restart-frontend
```
