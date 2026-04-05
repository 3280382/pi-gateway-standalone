/**
 * WebSocket 处理器注册入口
 * 集中导入并注册所有 Feature 的 WebSocket 处理器
 *
 * 注意：导入顺序决定了注册顺序，但不影响运行时行为
 */

// 注册 Session Feature 处理器
import "../features/chat/session-ws/index";

// 注册 Chat Feature 处理器
import "../features/chat/ws/index";

// 导出路由器供 server.ts 使用
export { type WSContext, wsRouter } from "../shared/websocket/ws-router";
