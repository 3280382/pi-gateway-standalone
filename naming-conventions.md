# 命名规范

## Session相关
- shortId: 8字符短ID (如 "019d9a87")
- sessionId: 同shortId，前端使用
- sessionFile: 完整文件路径
- fullPath: 同sessionFile

## Status相关
- runtimeStatus: 会话运行状态 (idle/thinking/tooling/streaming/waiting/error)
- connectionStatus: WebSocket连接状态
- sidebarVisible: 侧边栏可见性

## 函数命名
- 动词开头: get/set/update/handle/broadcast/flush
- 查询函数: has/is/should + 描述
- 事件处理: handle + EventName

## 文件职责
- session-manager.ts: 服务端session管理
- piAgentSession.ts: 单个session实例
- sidebarStore.ts: 前端sidebar状态
- SessionDropdownSection.tsx: session列表UI
